// Database and security tests against a real Postgres engine (PGlite), with a stand-in for Supabase's auth schema.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(__dirname, '../supabase');
const sql = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const db = new PGlite();

const U = {
  teacher: '00000000-0000-0000-0000-00000000000a', student: '00000000-0000-0000-0000-00000000000b',
  parent: '00000000-0000-0000-0000-00000000000c', otherAdmin: '00000000-0000-0000-0000-00000000000d',
  otherStudent: '00000000-0000-0000-0000-00000000000e', teacher2: '00000000-0000-0000-0000-00000000000f', parent2: '00000000-0000-0000-0000-000000000010',
};
// global ayah ids (Hafs): An-Nas 1 = 6231, Juz 30 = 5673..6236, An-Naba 1 = 5673 (page 582)
const NAS1 = 6231, JUZ30 = [5673, 6236] as const;

async function as<T = Record<string, unknown>>(user: string | null, query: string, params: unknown[] = []): Promise<T[]> {
  await db.exec('reset role');
  if (user) { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]); await db.exec('set role authenticated'); }
  try { return (await db.query<T>(query, params)).rows; } finally { await db.exec('reset role'); }
}
const one = async <T = Record<string, unknown>>(user: string | null, q: string, p: unknown[] = []) => (await as<T>(user, q, p))[0];
const rejects = async (user: string, q: string, p: unknown[] = []) => { let err: unknown = null; try { await as(user, q, p); } catch (e) { err = e; } expect(err, `should fail: ${q}`).not.toBeNull(); return String((err as Error).message); };

let orgA = '', orgB = '', studentS = '', child = '', joinA = '', teacherCodeA = '';
const rec = (user: string, p: Record<string, unknown>) => one<{ id: string }>(user, 'select public.record_session($1::jsonb) as id', [JSON.stringify(p)]);

beforeAll(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const id of Object.values(U)) await db.query('insert into auth.users (id) values ($1)', [id]);
  for (const f of ['migrations/0001_schema.sql', 'migrations/0002_security.sql', 'migrations/0003_functions.sql', 'migrations/0004_parent_codes.sql', 'migrations/0005_leaderboard.sql', 'seed_quran.sql', 'finish_setup.sql', 'migrations/0006_program_owners.sql', 'migrations/0007_school_features.sql']) await db.exec(sql(f));

  await db.query('insert into public.platform_owners (user_id) values ($1), ($2)', [U.teacher, U.otherAdmin]);
  orgA = (await one<{ id: string }>(U.teacher, `select public.create_organization('Masjid Hifz Class', 'America/New_York', 'Ustadh') as id`))!.id;
  orgB = (await one<{ id: string }>(U.otherAdmin, `select public.create_organization('Other School', 'Europe/London') as id`))!.id;
  joinA = (await one<{ join_code: string }>(U.teacher, 'select join_code from public.organizations where id = $1', [orgA]))!.join_code;
  teacherCodeA = (await one<{ c: string }>(U.teacher, 'select public.teacher_code($1) as c', [orgA]))!.c;
  await one(U.student, 'select public.join_organization($1, $2)', [joinA, 'Student S']);
  studentS = (await one<{ id: string }>(U.student, 'select public.create_student($1::jsonb) as id', [JSON.stringify({ org_id: orgA, for_self: true, name: 'Student S', direction: 'back', daily_new_ayahs: 3, guardian_email: 'parent@example.com', memorized: [[JUZ30[0], JUZ30[1]]] })]))!.id;
  child = (await one<{ id: string }>(U.teacher, 'select public.create_student($1::jsonb) as id', [JSON.stringify({ org_id: orgA, name: 'Child Without Account', memorized: [] })]))!.id;
  const otherOrgB = await one<{ join_code: string }>(U.otherAdmin, 'select join_code from public.organizations where id = $1', [orgB]);
  await one(U.otherStudent, 'select public.join_organization($1)', [otherOrgB!.join_code]);
}, 120000);

describe('Qur\'an seed', () => {
  it('loads the Hafs reference data', async () => {
    const r = await one<{ n: number; pages: number }>(null, 'select count(*)::int as n, count(distinct page)::int as pages from public.quran_ayahs');
    expect(r).toEqual({ n: 6236, pages: 604 });
    expect(await one(null, 'select page, juz from public.quran_ayahs where surah = 67 and ayah = 1')).toEqual({ page: 562, juz: 29 });
  });
});

describe('organizations and roles', () => {
  it('makes the creator an admin and a code-joiner a student', async () => {
    expect(await one(U.teacher, 'select role from public.organization_members where org_id = $1 and user_id = $2', [orgA, U.teacher])).toEqual({ role: 'admin' });
    expect(await one(U.student, 'select role from public.organization_members where org_id = $1 and user_id = $2', [orgA, U.student])).toEqual({ role: 'student' });
  });
  it('gives the teacher code a teacher role, who cannot change settings', async () => {
    const r = await one<{ j: { role: string } }>(U.teacher2, 'select public.join_organization($1) as j', [teacherCodeA]);
    expect(r!.j.role).toBe('teacher');
    await as(U.teacher2, `update public.organizations set name = 'Hacked' where id = $1`, [orgA]);
    expect(await one(U.teacher, 'select name from public.organizations where id = $1', [orgA])).toEqual({ name: 'Masjid Hifz Class' });
  });
  it('hides the teacher code from everyone but admins', async () => {
    await rejects(U.student, 'select teacher_code from public.organizations where id = $1', [orgA]);
    expect(await rejects(U.student, 'select public.teacher_code($1)', [orgA])).toMatch(/admin/);
  });
  it('rejects a wrong join code', async () => {
    expect(await rejects(U.parent, `select public.join_organization('NOPE00')`)).toMatch(/not found/);
  });
});

describe('tenant isolation', () => {
  it('shows another organization nothing', async () => {
    expect(await as(U.otherAdmin, 'select id from public.students')).toHaveLength(0);
    expect(await as(U.otherAdmin, 'select id from public.organizations where id = $1', [orgA])).toHaveLength(0);
    expect(await as(U.otherStudent, 'select id from public.memorized_ranges')).toHaveLength(0);
    expect(await rejects(U.otherAdmin, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'new', start_ayah_id: NAS1, end_ayah_id: NAS1 + 2 })])).toMatch(/Not allowed/);
  });
  it('blocks a cross-tenant insert', async () => {
    await rejects(U.otherAdmin, `insert into public.students (org_id, name) values ($1, 'Intruder')`, [orgA]);
  });
});

describe('sessions', () => {
  it('records a new lesson, memorises it, and does not duplicate on a second save', async () => {
    const p = { student_id: child, type: 'new', start_ayah_id: NAS1, end_ayah_id: NAS1 + 2, scores: { tajweed: 4, fluency: 5, overall: 4 }, teacher_note: 'Strong today' };
    const a = await rec(U.teacher, p); const b = await rec(U.teacher, { ...p, scores: { overall: 5 } });
    expect(a!.id).toBe(b!.id);
    expect(await as(U.teacher, 'select id from public.sessions where student_id = $1', [child])).toHaveLength(1);
    expect(await one(U.teacher, 'select score_overall::int as s from public.sessions where id = $1', [a!.id])).toEqual({ s: 5 });
    expect(await one(U.teacher, 'select start_ayah_id, end_ayah_id from public.memorized_ranges where student_id = $1', [child])).toEqual({ start_ayah_id: NAS1, end_ayah_id: NAS1 + 2 });
    expect(await one(U.teacher, 'select status from public.attendance where student_id = $1', [child])).toEqual({ status: 'present' });
  });
  it('rejects invalid ranges, future dates and out-of-scale scores', async () => {
    expect(await rejects(U.teacher, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'new', start_ayah_id: 10, end_ayah_id: 5 })])).toMatch(/range/);
    expect(await rejects(U.teacher, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'new', start_ayah_id: 6236, end_ayah_id: 6237 })])).toMatch(/range/);
    expect(await rejects(U.teacher, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'new', date: '2999-01-01', start_ayah_id: 1, end_ayah_id: 7 })])).toMatch(/date/);
    expect(await rejects(U.teacher, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'new', start_ayah_id: 1, end_ayah_id: 7, scores: { overall: 9 } })])).toMatch(/between 1 and 5/);
    expect(await rejects(U.teacher, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'old', start_ayah_id: 1, end_ayah_id: 7, errors: [{ ayah_id: 200, category: 'tajweed' }] })])).toMatch(/outside/);
  });
  it('lets a student record their own revision but nothing a teacher owns', async () => {
    const own = await rec(U.student, { student_id: studentS, type: 'old', start_ayah_id: JUZ30[0], end_ayah_id: JUZ30[0] + 10, errors_minor: 1 });
    expect(own!.id).toBeTruthy();
    expect(await rejects(U.student, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: studentS, type: 'new', start_ayah_id: 1, end_ayah_id: 3 })])).toMatch(/revision only/);
    expect(await rejects(U.student, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: studentS, type: 'old', start_ayah_id: 1, end_ayah_id: 3, scores: { overall: 5 } })])).toMatch(/scores/);
    expect(await rejects(U.student, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'old', start_ayah_id: NAS1, end_ayah_id: NAS1 })])).toMatch(/Not allowed/);
    await rec(U.teacher, { student_id: studentS, type: 'recent', start_ayah_id: 6000, end_ayah_id: 6010, scores: { overall: 3 } });
    expect(await rejects(U.student, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: studentS, type: 'recent', start_ayah_id: 6000, end_ayah_id: 6010 })])).toMatch(/teacher already/);
  });
  it('never lets a student write to the tables directly', async () => {
    await rejects(U.student, `insert into public.sessions (org_id, student_id, date, type, start_ayah_id, end_ayah_id, recorded_by) values ($1, $2, current_date, 'new', 1, 7, 'teacher')`, [orgA, studentS]);
    const n = await as(U.student, `update public.sessions set score_overall = 5 where student_id = $1 returning id`, [studentS]);
    expect(n).toHaveLength(0);
    await rejects(U.student, `insert into public.memorized_ranges (org_id, student_id, start_ayah_id, end_ayah_id, source) values ($1, $2, 1, 6236, 'setup')`, [orgA, studentS]);
  });
  it('soft-deletes a session and removes what it memorised', async () => {
    const s = await rec(U.teacher, { student_id: child, type: 'new', start_ayah_id: NAS1 + 3, end_ayah_id: NAS1 + 5 });
    await as(U.teacher, 'select public.delete_session($1)', [s!.id]);
    expect(await one(U.teacher, 'select deleted_at is not null as d from public.sessions where id = $1', [s!.id])).toEqual({ d: true });
    expect(await as(U.teacher, 'select id from public.memorized_ranges where session_id = $1', [s!.id])).toHaveLength(0);
  });
});

describe('student privacy', () => {
  it('shows a student only their own record', async () => {
    const rows = await as<{ id: string }>(U.student, 'select id from public.students');
    expect(rows.map(r => r.id)).toEqual([studentS]);
  });
  it('lets a student edit their plan but not where they belong', async () => {
    await as(U.student, `update public.students set goal = 'Juz 29' where id = $1`, [studentS]);
    expect(await one(U.student, 'select goal from public.students where id = $1', [studentS])).toEqual({ goal: 'Juz 29' });
    expect(await rejects(U.student, 'update public.students set org_id = $1 where id = $2', [orgB, studentS])).toMatch(/teacher/);
  });
  it('hides the audit log from students and shows it to the admin', async () => {
    expect(await as(U.student, 'select id from public.audit_logs')).toHaveLength(0);
    expect((await as(U.teacher, 'select id from public.audit_logs where org_id = $1', [orgA])).length).toBeGreaterThan(0);
  });
});

describe('parents', () => {
  it('can see a linked child but change nothing', async () => {
    await as(U.teacher, 'select public.link_guardian($1, $2)', [child, U.parent]);
    expect((await as<{ id: string }>(U.parent, 'select id from public.students')).map(r => r.id)).toEqual([child]);
    expect((await as(U.parent, 'select id from public.sessions')).length).toBeGreaterThan(0);
    expect(await rejects(U.parent, 'select public.record_session($1::jsonb)', [JSON.stringify({ student_id: child, type: 'old', start_ayah_id: NAS1, end_ayah_id: NAS1 })])).toMatch(/Not allowed/);
    await rejects(U.parent, `insert into public.attendance (org_id, student_id, date, status) values ($1, $2, current_date - 1, 'present')`, [orgA, child]);
  });
});

describe('revision engine and milestones', () => {
  it('creates review items for setup pages and awards milestones', async () => {
    expect(await one(U.student, 'select count(*)::int as n from public.revision_items where student_id = $1', [studentS])).toEqual({ n: 23 });
    const codes = (await as<{ code: string }>(U.student, 'select code from public.milestones where student_id = $1 order by code', [studentS])).map(r => r.code);
    expect(codes).toEqual(expect.arrayContaining(['first_page', 'juz_1']));
  });
  it('doubles the interval after a clean review and resets it after a failed one', async () => {
    const page = await one<{ id: number }>(null, 'select min(id)::int as id from public.quran_ayahs where page = 590');
    const end = await one<{ id: number }>(null, 'select max(id)::int as id from public.quran_ayahs where page = 590');
    await rec(U.teacher, { student_id: studentS, type: 'old', start_ayah_id: page!.id, end_ayah_id: end!.id, errors_minor: 0 });
    expect(await one(U.teacher, 'select interval_days, lapses from public.revision_items where student_id = $1 and page = 590', [studentS])).toEqual({ interval_days: 14, lapses: 0 });
    await rec(U.teacher, { student_id: studentS, type: 'review', start_ayah_id: page!.id, end_ayah_id: end!.id, errors_major: 3 });
    expect(await one(U.teacher, 'select interval_days, lapses from public.revision_items where student_id = $1 and page = 590', [studentS])).toEqual({ interval_days: 1, lapses: 1 });
  });
});

describe('assignments', () => {
  it('lets the teacher assign and the student mark it done, not reviewed', async () => {
    const a = await one<{ id: string }>(U.teacher, `insert into public.assignments (org_id, student_id, type, start_ayah_id, end_ayah_id, due_on) values ($1, $2, 'revision', 5673, 5700, current_date + 1) returning id`, [orgA, studentS]);
    await rejects(U.teacher, `insert into public.assignments (org_id, student_id, type, start_ayah_id, end_ayah_id, due_on) values ($1, $2, 'revision', 5673, 5700, current_date + 1)`, [orgA, studentS]);
    await as(U.student, `select public.set_assignment_status($1, 'completed')`, [a!.id]);
    expect(await one(U.student, 'select status from public.assignments where id = $1', [a!.id])).toEqual({ status: 'completed' });
    expect(await rejects(U.student, `select public.set_assignment_status($1, 'reviewed')`, [a!.id])).toMatch(/Not allowed/);
    await rejects(U.student, `insert into public.assignments (org_id, student_id, type, due_on) values ($1, $2, 'other', current_date)`, [orgA, studentS]);
  });
});

describe('parent codes', () => {
  it('links a parent to exactly one child, read-only', async () => {
    const code = (await one<{ parent_code: string }>(U.teacher, 'select parent_code from public.students where id = $1', [child]))!.parent_code;
    expect(code).toHaveLength(10);
    const r = await one<{ j: { role: string } }>(U.parent2, 'select public.join_organization($1, $2) as j', [code.toLowerCase(), 'A Parent']);
    expect(r!.j.role).toBe('parent');
    const seen = await as<{ id: string }>(U.parent2, 'select id from public.students');
    expect(seen.map(x => x.id)).toEqual([child]);
    await rejects(U.parent2, `update public.students set name = 'X' where id = $1 returning id`, [child]).catch(() => undefined);
    const after = await one<{ name: string }>(U.teacher, 'select name from public.students where id = $1', [child]);
    expect(after!.name).toBe('Child Without Account');
  });
  it('does not let a student change their own parent code', async () => {
    const msg = await rejects(U.student, `update public.students set parent_code = 'AAAAAAAAAA' where id = $1`, [studentS]);
    expect(msg).toMatch(/Only a teacher/);
  });
});

describe('leaderboard', () => {
  it('is visible to staff, hidden from students until an admin turns it on', async () => {
    const rows = await as<{ display_name: string; points: number }>(U.teacher, 'select * from public.class_leaderboard($1, 7)', [orgA]);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    await rejects(U.student, 'select * from public.class_leaderboard($1, 7)', [orgA]);
    await rejects(U.otherAdmin, 'select * from public.class_leaderboard($1, 7)', [orgA]);
    await as(U.teacher, `update public.organizations set settings = settings || '{"leaderboard":{"enabled":true}}'::jsonb where id = $1`, [orgA]);
    const mine = await as<{ display_name: string; is_me: boolean }>(U.student, 'select * from public.class_leaderboard($1, 7)', [orgA]);
    expect(mine.find(r => r.is_me)?.display_name).toBe('Student S');
    expect(mine.find(r => !r.is_me)?.display_name).toBe('Child W.');
  });
});

describe('program owners', () => {
  it('lets only platform owners start a program', async () => {
    expect((await one<{ c: boolean }>(U.teacher, 'select public.can_create_programs() as c'))!.c).toBe(true);
    expect((await one<{ c: boolean }>(U.student, 'select public.can_create_programs() as c'))!.c).toBe(false);
    const msg = await rejects(U.student, `select public.create_organization('Sneaky School', 'America/New_York')`);
    expect(msg).toMatch(/Only the site owner/);
    await rejects(U.student, 'select * from public.platform_owners');
  });
});

describe('school features', () => {
  it('keeps messages inside the student\'s circle', async () => {
    await one(U.teacher, `insert into public.messages (org_id, student_id, body) values ($1, $2, 'Please revise page 590') returning id`, [orgA, studentS]);
    await one(U.student, `insert into public.messages (org_id, student_id, body) values ($1, $2, 'Done, jazakAllah') returning id`, [orgA, studentS]);
    expect(await as(U.student, 'select body from public.messages where student_id = $1', [studentS])).toHaveLength(2);
    expect(await as(U.otherAdmin, 'select body from public.messages')).toHaveLength(0);
    await rejects(U.student, `insert into public.messages (org_id, student_id, body) values ($1, $2, 'hi')`, [orgA, child]);           // not their thread
    await rejects(U.student, `insert into public.messages (org_id, student_id, sender, body) values ($1, $2, $3, 'fake')`, [orgA, studentS, U.teacher]);
  });
  it('lets staff manage announcements, events, exams, points and fees; others only read their share', async () => {
    await one(U.teacher, `insert into public.announcements (org_id, title) values ($1, 'No class Friday') returning id`, [orgA]);
    expect(await as(U.student, 'select title from public.announcements')).toHaveLength(1);
    await rejects(U.student, `insert into public.announcements (org_id, title) values ($1, 'Holiday!')`, [orgA]);
    await one(U.teacher, `insert into public.behaviour_points (org_id, student_id, date, category, value) values ($1, $2, current_date, 'Punctual', 1) returning id`, [orgA, studentS]);
    await rejects(U.student, `insert into public.behaviour_points (org_id, student_id, date, category, value) values ($1, $2, current_date, 'Punctual', 1)`, [orgA, studentS]);
    await one(U.teacher, `insert into public.exams (org_id, student_id, title, juz, scheduled_on) values ($1, $2, 'Juz 30 test', 30, current_date + 7) returning id`, [orgA, studentS]);
    expect(await as(U.student, 'select title from public.exams')).toHaveLength(1);
    await one(U.teacher, `insert into public.fee_records (org_id, student_id, month, amount, paid_on) values ($1, $2, '2026-10', 40, current_date) returning id`, [orgA, studentS]);
    expect(await as(U.student, 'select * from public.fee_records')).toHaveLength(0);
    expect(await as(U.otherAdmin, 'select * from public.exams')).toHaveLength(0);
  });
  it('accepts public applications without exposing any data', async () => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec('set role anon');
    try {
      const name = (await db.query<{ n: string }>('select public.program_public_name($1) as n', [orgA])).rows[0].n;
      expect(name).toBe('Masjid Hifz Class');
      await db.query(`select public.submit_application($1, $2::jsonb)`, [orgA, JSON.stringify({ name: 'New Child', contact: 'parent@example.com', memorised: 'Juz 30' })]);
      let err = null; try { await db.query('select * from public.applications'); } catch (e) { err = e; }
      expect(err).not.toBeNull();
    } finally { await db.exec('reset role'); }
    expect(await as(U.teacher, 'select name from public.applications')).toHaveLength(1);
    expect(await as(U.student, 'select name from public.applications')).toHaveLength(0);
  });
  it('lets only a teacher set a student\'s Old revision amount', async () => {
    await rejects(U.student, 'update public.students set old_pages = 10 where id = $1', [studentS]);
    await as(U.teacher, 'update public.students set old_pages = 4 where id = $1', [studentS]);
    expect((await one<{ old_pages: number }>(U.student, 'select old_pages from public.students where id = $1', [studentS]))!.old_pages).toBe(4);
  });
});
