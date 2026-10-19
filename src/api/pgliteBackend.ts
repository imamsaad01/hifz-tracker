// Preview backend: the real migrations, RLS policies and functions, running in PGlite (Postgres compiled to WebAssembly)
// inside the browser. Sign-in is replaced by choosing a sample person; nothing leaves the device.
import { PGlite, type Transaction } from '@electric-sql/pglite';
import m1 from '../../supabase/migrations/0001_schema.sql?raw';
import m2 from '../../supabase/migrations/0002_security.sql?raw';
import m3 from '../../supabase/migrations/0003_functions.sql?raw';
import m4 from '../../supabase/migrations/0004_parent_codes.sql?raw';
import m5 from '../../supabase/migrations/0005_leaderboard.sql?raw';
import quran from '../../supabase/seed_quran.sql?raw';
import { ApiError, type Backend, type Filter, type Query, type AuthUser } from './backend';
import { PERSONAS, seedPreview } from './previewSeed';

const AUTH_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text, name text);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;`;

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s: string) => { if (!IDENT.test(s)) throw new ApiError(`Bad identifier ${s}`); return `"${s}"`; };
const cols = (c?: string) => (!c || c.trim() === '*' ? '*' : c.split(',').map(x => ident(x.trim())).join(', '));
function whereSql(where: Filter[] = [], params: unknown[]): string {
  if (!where.length) return '';
  return ' where ' + where.map(f => {
    const c = ident(f.col);
    switch (f.op) {
      case 'is': return `${c} is null`;
      case 'not_is': return `${c} is not null`;
      case 'in': params.push(f.value); return `${c} = any($${params.length})`;
      default: { params.push(f.value); const op = { eq: '=', neq: '<>', gte: '>=', lte: '<=', gt: '>', lt: '<' }[f.op]; return `${c} ${op} $${params.length}`; }
    }
  }).join(' and ');
}
const LS_KEY = 'hifz-preview-user';
const store = { get: () => { try { return localStorage.getItem(LS_KEY); } catch { return null; } }, set: (v: string | null) => { try { if (v) localStorage.setItem(LS_KEY, v); else localStorage.removeItem(LS_KEY); } catch { /* storage blocked */ } } };

export async function pgliteBackend(): Promise<Backend> {
  let db: PGlite;
  // Hosts that will not serve a .data file get the Postgres file bundle under a .wasm name (copied at build time; see vite.config.ts).
  const fsBundle = typeof document === 'undefined' ? undefined : await fetch(new URL('./assets/pglite-fs.wasm', document.baseURI)).then(r => (r.ok ? r.blob() : undefined)).catch(() => undefined);
  const opts = fsBundle ? { fsBundle } : {};
  try { db = new PGlite('idb://hifz-tracker-preview-v3', opts); await db.waitReady; } catch { db = new PGlite(opts); await db.waitReady; }
  const ready = await db.query<{ t: string | null }>(`select to_regclass('public.students')::text as t`);
  if (!ready.rows[0]?.t) {
    await db.exec(AUTH_STUB); await db.exec(m1); await db.exec(m2); await db.exec(m3); await db.exec(m4); await db.exec(m5); await db.exec(quran);
    await seedPreview(db);
  }
  let current: string | null = store.get();
  const listeners = new Set<(u: AuthUser | null) => void>();
  const userOf = (id: string | null): AuthUser | null => { const p = PERSONAS.find(x => x.id === id); return p ? { id: p.id, email: p.email, name: p.name } : null; };
  const emit = () => listeners.forEach(l => l(userOf(current)));
  // every query runs inside a transaction as the signed-in sample person, under the real RLS policies
  const run = async <T>(fn: (tx: Transaction) => Promise<T>): Promise<T> => db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [current ?? '']);
    await tx.exec('set local role authenticated');
    try { return await fn(tx); } catch (e) { throw new ApiError((e as Error).message, (e as { code?: string }).code); }
  });
  return {
    kind: 'preview',
    personas: PERSONAS.map(p => ({ id: p.id, label: p.label, description: p.description })),
    async getUser() { return userOf(current); },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signInAs(id) { current = id; store.set(id); emit(); },
    async signOut() { current = null; store.set(null); emit(); },
    async resetPreview() {
      await db.exec(`drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated; drop schema auth cascade;`);
      await db.exec(AUTH_STUB); await db.exec(m1); await db.exec(m2); await db.exec(m3); await db.exec(m4); await db.exec(m5); await db.exec(quran); await seedPreview(db);
    },
    async select<T>(q: Query) {
      const params: unknown[] = [];
      let sql = `select ${cols(q.columns)} from public.${ident(q.table)}${whereSql(q.where, params)}`;
      if (q.order?.length) sql += ' order by ' + q.order.map(([c, d]) => `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}`).join(', ');
      if (q.limit) sql += ` limit ${Math.min(5000, Math.max(1, Math.floor(q.limit)))}`;
      return run(async tx => (await tx.query<T>(sql, params)).rows);
    },
    async insert<T>(table: string, row: Record<string, unknown>) {
      const keys = Object.keys(row); const params = keys.map(k => row[k]);
      const sql = `insert into public.${ident(table)} (${keys.map(ident).join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`;
      return run(async tx => (await tx.query<T>(sql, params)).rows[0]);
    },
    async update(table, patch, where) {
      const keys = Object.keys(patch); const params: unknown[] = keys.map(k => patch[k]);
      const sql = `update public.${ident(table)} set ${keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(', ')}${whereSql(where, params)} returning 1`;
      return run(async tx => (await tx.query(sql, params)).rows.length);
    },
    async remove(table, where) {
      const params: unknown[] = [];
      return run(async tx => (await tx.query(`delete from public.${ident(table)}${whereSql(where, params)} returning 1`, params)).rows.length);
    },
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const keys = Object.keys(args);
      const params = keys.map(k => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
      const call = `public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}${args[k] !== null && typeof args[k] === 'object' ? '::jsonb' : ''}`).join(', ')})`;
      return run(async tx => {
        const r = await tx.query<Record<string, unknown>>(`select * from ${call}`, params);
        const f = r.fields.map(x => x.name);
        if (f.length === 1 && f[0] === fn) return (r.rows[0]?.[fn] ?? null) as T;
        return r.rows as T;
      });
    },
    async invoke() { return { sent: 0, preview: true }; },
  };
}
