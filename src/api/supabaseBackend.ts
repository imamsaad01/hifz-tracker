/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { ApiError, type Backend, type Filter, type Query, type AuthUser } from './backend';

function applyFilters(b: any, where: Filter[] = []): any {
  for (const f of where) {
    if (f.op === 'in') b = b.in(f.col, f.value);
    else if (f.op === 'is') b = b.is(f.col, null);
    else if (f.op === 'not_is') b = b.not(f.col, 'is', null);
    else b = b[f.op](f.col, f.value);
  }
  return b;
}
const toUser = (u: any): AuthUser | null => (u ? { id: u.id, email: u.email ?? null, name: u.user_metadata?.full_name || u.user_metadata?.name || null } : null);

export function supabaseBackend(url: string, anonKey: string): Backend {
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const check = (r: { data: any; error: { message: string; code?: string } | null }) => { if (r.error) throw new ApiError(r.error.message, r.error.code); return r.data; };
  return {
    kind: 'live',
    async getUser() { const { data } = await sb.auth.getSession(); return toUser(data.session?.user); },
    onAuthChange(cb) { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toUser(s?.user))); return () => data.subscription.unsubscribe(); },
    async signInWithGoogle() { const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } }); if (r.error) throw new ApiError(r.error.message); },
    async signOut() { await sb.auth.signOut(); },
    async select<T>(q: Query): Promise<T[]> {
      let b: any = applyFilters(sb.from(q.table).select(q.columns ?? '*'), q.where);
      for (const [c, d] of q.order ?? []) b = b.order(c, { ascending: d === 'asc' });
      if (q.limit) b = b.limit(q.limit);
      return check(await b);
    },
    async insert<T>(table: string, row: Record<string, unknown>): Promise<T> { return check(await sb.from(table).insert(row).select().single()); },
    // count instead of returning rows: some tables (organizations) hide columns, so `returning *` would be refused
    async update(table, patch, where) { const r = await applyFilters(sb.from(table).update(patch, { count: 'exact' }), where); if (r.error) throw new ApiError(r.error.message, r.error.code); return r.count ?? 0; },
    async remove(table, where) { const r = await applyFilters(sb.from(table).delete({ count: 'exact' }), where); if (r.error) throw new ApiError(r.error.message, r.error.code); return r.count ?? 0; },
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> { return check(await sb.rpc(fn, args)); },
    async invoke(fn, body) { const r = await sb.functions.invoke(fn, { body }); if (r.error) throw new ApiError(r.error.message); return r.data; },
    subscribe(tables, cb) {
      let t: ReturnType<typeof setTimeout> | undefined;
      const go = () => { clearTimeout(t); t = setTimeout(cb, 500); };
      let ch: any = sb.channel(`live-${Math.random().toString(36).slice(2)}`);
      for (const table of tables) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, go);
      ch.subscribe();
      return () => { clearTimeout(t); sb.removeChannel(ch); };
    },
  };
}
