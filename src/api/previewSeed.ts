// Sample data for the preview database. Fictional people only. Everything is written through the real
// server functions (create_organization, create_student, record_session …) so the preview behaves like production.
import type { PGlite } from '@electric-sql/pglite';
import { surahRange, ayahId, pageRange, type Range } from '../quran';
import { nextNewStart } from '../lib/suggest';
import { todayIn, addDays } from '../lib/dates';
import { DEFAULT_RULES as RULES } from '../lib/rules';

export const PERSONAS = [
  { id: '11111111-0000-4000-8000-000000000001', name: 'Ustadh Bilal', email: 'bilal@example.com', label: 'Teacher and admin', description: 'Runs the Al-Noor Hifz Program: sees every student, records sessions, manages settings.' },
  { id: '11111111-0000-4000-8000-000000000002', name: 'Ustadha Khadija', email: 'khadija@example.com', label: 'Teacher', description: 'Teaches the weekend class. Records sessions; cannot change program settings.' },
  { id: '11111111-0000-4000-8000-000000000003', name: 'Amina Siddiqui', email: 'amina@example.com', label: 'Student', description: 'Sees her own progress, revision and teacher feedback only.' },
  { id: '11111111-0000-4000-8000-000000000004', name: 'Umm Ibrahim', email: 'parent@example.com', label: 'Parent', description: 'Sees her son Ibrahim’s progress. Cannot change anything.' },
  { id: '11111111-0000-4000-8000-000000000005', name: 'Other School Admin', email: 'other@example.com', label: 'Another program', description: 'Admin of a different organization: sees none of Al-Noor’s data.' },
] as const;
const [T1, T2, S1, P1, X1] = PERSONAS.map(p => p.id);

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const surahs = (from: number, to: number): Range[] => { const out: Range[] = []; for (let s = from; s <= to; s++) out.push(surahRange(s)); return out; };

export async function seedPreview(db: PGlite) {
  const as = async (user: string) => { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]); };
  const val = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ v: T }>(sql, params)).rows[0]?.v as T;
  for (const p of PERSONAS) await db.query('insert into auth.users (id, email, name) values ($1, $2, $3) on conflict do nothing', [p.id, p.email, p.name]);

  await db.query('insert into public.platform_owners (user_id) values ($1), ($2) on conflict do nothing', [T1, X1]);
  await as(T1);
  const org = await val<string>(`select public.create_organization('Al-Noor Hifz Program', 'America/New_York', 'Ustadh Bilal') as v`);
  await db.query(`update public.organizations set settings = settings || '{"leaderboard":{"enabled":true,"fullNames":false},"revision":{"oldPlan":"cycle","days":[1,3,5]},"fees":{"monthly":40,"currency":"USD"}}'::jsonb where id = $1`, [org]);
  const codes = (await db.query<{ join_code: string; teacher_code: string }>('select join_code, teacher_code from public.organizations where id = $1', [org])).rows[0];
  await as(T2); await db.query('select public.join_organization($1, $2)', [codes.teacher_code, 'Ustadha Khadija']);
  await as(S1); await db.query('select public.join_organization($1, $2)', [codes.join_code, 'Amina Siddiqui']);

  const students: Array<{ id: string; name: string; dir: 'back' | 'forward'; daily: number; mem: Range[]; teacher: string; skipLast?: number; weakness?: number }> = [];
  const create = async (user: string, p: Record<string, unknown>, meta: Omit<(typeof students)[number], 'id' | 'name'>) => {
    await as(user);
    const id = await val<string>('select public.create_student($1::jsonb) as v', [JSON.stringify({ org_id: org, ...p, memorized: meta.mem.map(r => [r.start, r.end]) })]);
    students.push({ id, name: String(p.name), ...meta });
  };
  await create(S1, { for_self: true, name: 'Amina Siddiqui', age_group: '13–15', direction: 'back', daily_new_ayahs: 5, goal: 'Juz 29 and 30', guardian_name: 'Mrs Siddiqui', guardian_email: 'siddiqui.family@example.com' },
    { dir: 'back', daily: 5, mem: surahs(88, 114), teacher: T1, weakness: 0.15 });
  await create(T1, { name: 'Ibrahim Rahman', age_group: '7–9', direction: 'back', daily_new_ayahs: 3, goal: 'Juz ʿAmma (Juz 30)', guardian_name: 'Umm Ibrahim', guardian_email: 'parent@example.com' },
    { dir: 'back', daily: 3, mem: surahs(105, 114), teacher: T1, weakness: 0.35 });
  await create(T1, { name: 'Zayd Haddad', age_group: '10–12', direction: 'back', daily_new_ayahs: 4, goal: 'Juz ʿAmma (Juz 30)', guardian_name: 'Mr Haddad', guardian_email: 'haddad.home@example.com' },
    { dir: 'back', daily: 4, mem: surahs(99, 114), teacher: T1, skipLast: 4, weakness: 0.5 });
  await create(T2, { name: 'Yusra Karim', age_group: '13–15', direction: 'back', daily_new_ayahs: 7, goal: 'Juz 29 and 30', guardian_name: 'Mrs Karim', guardian_email: 'karim.family@example.com' },
    { dir: 'back', daily: 7, mem: [...surahs(78, 114), surahRange(77), surahRange(76)], teacher: T2, weakness: 0.1 });
  await create(T2, { name: 'Hana Okafor', age_group: 'Adult', direction: 'forward', daily_new_ayahs: 5, goal: 'The whole Qurʾān', guardian_name: '', guardian_email: '' },
    { dir: 'forward', daily: 5, mem: [surahRange(1), { start: ayahId(2, 1), end: ayahId(2, 40) }], teacher: T2, weakness: 0.2 });

  // three weeks of sessions, recorded through record_session on past dates
  const today = todayIn('America/New_York');
  const CATS = ['similar_ayah', 'tajweed', 'harakah', 'madd', 'added_missed_word', 'ghunnah', 'forgot_ayah'];
  for (const [si, st] of students.entries()) {
    const r = rng(17 + si * 31);
    const pagesOf = () => { const ps = new Set<number>(); for (const m of st.mem) for (let p = 1; p <= 604; p++) { const pr = pageRange(p); if (pr.start >= m.start && pr.end <= m.end) ps.add(p); } return [...ps].sort((a, b) => a - b); };
    let oldIdx = 0;
    for (let ago = 20; ago >= 0; ago--) {
      const d = addDays(today, -ago);
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (dow === 5 || (st.skipLast && ago < st.skipLast) || (ago === 0 && si % 2 === 1)) continue; // Fridays off; Zayd missed recent days
      await as(st.teacher);
      const start = nextNewStart(st.mem, st.dir);
      if (start !== null && r() > 0.15) {
        const nr = await db.query<{ end: number }>('select max(id)::int as "end" from public.quran_ayahs where surah = (select surah from public.quran_ayahs where id = $1)', [start]);
        const end = Math.min(start + st.daily - 1, nr.rows[0].end);
        const mistakes = r() < st.weakness! ? 1 + Math.floor(r() * 2) : 0;
        const errors = Array.from({ length: mistakes }, () => ({ ayah_id: start + Math.floor(r() * (end - start + 1)), category: CATS[Math.floor(r() * CATS.length)], severity: r() < 0.3 ? 'major' : 'minor' }));
        const score = mistakes === 0 ? 5 : mistakes === 1 ? 4 : 3;
        await db.query('select public.record_session($1::jsonb)', [JSON.stringify({
          student_id: st.id, date: d, type: 'new', start_ayah_id: start, end_ayah_id: end, errors,
          scores: { tajweed: Math.max(3, score - (r() < 0.3 ? 1 : 0)), fluency: score, overall: score },
          teacher_note: mistakes === 0 && r() < 0.3 ? 'Strong and clear today.' : mistakes > 1 ? 'Repeat this tonight before bed.' : null,
          attendance: r() < 0.08 ? 'late' : 'present', mode: r() < 0.25 ? 'online' : 'in_person',
        })]);
        st.mem.push({ start, end });
      }
      const pages = pagesOf();
      if (pages.length && r() > 0.2) {
        const n = Math.min(pages.length, 2 + Math.floor(r() * 3));
        const chunk = pages.slice(oldIdx % pages.length, (oldIdx % pages.length) + n);
        oldIdx += n;
        const a = pageRange(chunk[0]).start, b = pageRange(chunk[chunk.length - 1]).end;
        const weak = r() < st.weakness!;
        await db.query('select public.record_session($1::jsonb)', [JSON.stringify({
          student_id: st.id, date: d, type: 'old', start_ayah_id: a, end_ayah_id: b, errors_minor: weak ? 2 + Math.floor(r() * 2) : Math.floor(r() * 2), errors_major: weak && r() < 0.5 ? 1 : 0,
          scores: { overall: weak ? 3 : 4 + Math.round(r()) },
        })]);
      }
    }
    if (st.skipLast) { await as(st.teacher); for (let ago = st.skipLast - 1; ago >= 1; ago -= 2) await db.query(`insert into public.attendance (org_id, student_id, date, status) values ($1, $2, $3, 'absent') on conflict do nothing`, [org, st.id, addDays(today, -ago)]); }
  }
  const [amina, ibrahim, zayd, yusra, hana] = students;
  // Amina also records some revision herself
  await as(S1);
  await db.query('select public.record_session($1::jsonb)', [JSON.stringify({ student_id: amina.id, date: addDays(today, -1), type: 'recent', start_ayah_id: ayahId(87, 1), end_ayah_id: ayahId(87, 19), errors_minor: 1, student_note: 'Mixed up ayah 14 and 15 once.' })]);

  await as(T1);
  const cls1 = await val<string>(`insert into public.classes (org_id, name, teacher_user_id, schedule, starts_on) values ($1, 'Weekday Hifz', $2, 'Mon–Thu, 5:00–6:30 pm', $3) returning id as v`, [org, T1, addDays(today, -60)]);
  const cls2 = await val<string>(`insert into public.classes (org_id, name, teacher_user_id, schedule, starts_on) values ($1, 'Weekend Hifz', $2, 'Sat–Sun, 10:00 am–12:00 pm', $3) returning id as v`, [org, T2, addDays(today, -45)]);
  for (const s of [amina, ibrahim, zayd]) await db.query('insert into public.class_students (class_id, student_id, org_id) values ($1, $2, $3)', [cls1, s.id, org]);
  for (const s of [yusra, hana]) await db.query('insert into public.class_students (class_id, student_id, org_id) values ($1, $2, $3)', [cls2, s.id, org]);
  const assign = (s: string, type: string, a: number | null, b: number | null, due: string, pr: number, ins: string) =>
    db.query('insert into public.assignments (org_id, student_id, type, start_ayah_id, end_ayah_id, due_on, priority, instructions) values ($1, $2, $3, $4, $5, $6, $7, $8)', [org, s, type, a, b, due, pr, ins]);
  await assign(amina.id, 'revision', ayahId(78, 1), ayahId(79, 46), today, 2, 'Recite both surahs without the mushaf, then once to a parent.');
  await assign(ibrahim.id, 'listening', ayahId(104, 1), ayahId(104, 9), addDays(today, 1), 3, 'Listen to Al-Humazah 3 times before learning it.');
  await assign(zayd.id, 'revision', ayahId(99, 1), ayahId(102, 8), addDays(today, -2), 1, 'Catch up: revise these four surahs and recite them on Monday.');
  await assign(yusra.id, 'new', ayahId(75, 1), ayahId(75, 10), addDays(today, 2), 2, 'Prepare the opening of Al-Qiyāmah.');
  await assign(hana.id, 'tajweed', ayahId(2, 41), ayahId(2, 46), addDays(today, 3), 2, 'Watch the madd before hamzah in these ayahs.');
  await db.query(`insert into public.goals (org_id, student_id, period, metric, target, starts_on) values ($1, $2, 'weekly', 'new_ayahs', 25, $3), ($1, $4, 'weekly', 'sessions', 5, $3)`, [org, amina.id, addDays(today, -6), ibrahim.id]);
  await db.query('select public.link_guardian($1, $2)', [ibrahim.id, P1]);
  await db.query(`update public.classes set schedule_slots = '[{"day":6,"start":"17:00","end":"20:00"},{"day":1,"start":"16:30","end":"20:30"}]', require_code = true where id = $1`, [cls1]);
  await db.query(`update public.classes set schedule_slots = '[{"day":0,"start":"10:00","end":"12:00"}]', location = 'both' where id = $1`, [cls2]);
  await db.query(`update public.organizations set settings = settings || jsonb_build_object('attendance', jsonb_build_object('semesterStart', '2026-09-01', 'semesterEnd', '2027-02-06', 'freeAbsences', 1, 'excusedAbsences', 2), 'rulesText', $2::text) where id = $1`, [org, RULES]);
  const wk = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  for (const [sid, slot, partner, w] of [[amina.id, 'after_lesson', 'Yusra Karim', 0], [amina.id, 'wed', 'Yusra Karim', -7], [amina.id, 'fri', 'Yusra Karim', -7], [amina.id, 'after_lesson', 'Yusra Karim', -7], [zayd.id, 'after_lesson', 'Ibrahim Rahman', -7]] as const)
    await db.query(`insert into public.revision_checkins (org_id, student_id, week_start, slot, partner, recorded) values ($1, $2, $3, $4, $5, $6)`, [org, sid, addDays(wk, w), slot, partner, slot === 'fri']);
  await db.query(`insert into public.absence_requests (org_id, student_id, date, kind, reason, status) values ($1, $2, $3, 'excuse', 'Family wedding out of town', 'pending')`, [org, zayd.id, addDays(today, 5)]);
  await db.query(`insert into public.class_join_requests (org_id, class_id, student_id) values ($1, $2, $3)`, [org, cls1, yusra.id]);
  // qira'at: Amina reads Nāfiʿ (Qālūn and Warsh) in jamʿ and memorises the Shāṭibiyyah
  await db.query(`insert into public.qiraat_profiles (student_id, org_id, riwayat, mode, matn, matn_daily_lines) values ($1, $2, '{nafi.qalun,nafi.warsh}', 'jam', 'shatibiyyah', 3)`, [amina.id, org]);
  await db.query(`insert into public.qiraat_tests (org_id, student_id, kind, surah, title, riwayat, scheduled_on) values ($1, $2, 'farsh', 2, 'Farsh: Al-Baqarah', '{nafi.qalun,nafi.warsh}', $3)`, [org, amina.id, addDays(today, 2)]);
  await db.query(`insert into public.qiraat_tests (org_id, student_id, kind, bab, title, riwayat, status, result, taken_on, mistakes) values ($1, $2, 'usul', 'madd', 'Uṣūl: Madd & qaṣr', '{nafi.qalun,nafi.warsh}', 'done', 'repeat', $3, $4::jsonb)`,
    [org, amina.id, addDays(today, -4), JSON.stringify([{ text: 'Madd badal for Warsh', riwayah: 'nafi.warsh' }, { text: 'ءامنوا', riwayah: 'nafi.warsh' }, { text: 'Ṣilat mīm al-jamʿ', riwayah: 'nafi.qalun' }])]);
  await db.query(`insert into public.qiraat_tests (org_id, student_id, kind, surah, title, riwayat, status, result, taken_on) values ($1, $2, 'farsh', 1, 'Farsh: Al-Fatihah', '{nafi.qalun,nafi.warsh}', 'done', 'excellent', $3)`, [org, amina.id, addDays(today, -12)]);
  for (const s of [1, 2, 3, 114, 113, 112, 111, 110]) await db.query(`insert into public.qiraat_khatmah (org_id, student_id, track, surah) values ($1, $2, 'jam', $3)`, [org, amina.id, s]);
  await db.query(`insert into public.qiraat_matn_log (org_id, student_id, matn, line_from, line_to, kind, date) values ($1, $2, 'shatibiyyah', 1, 94, 'memorised', $3), ($1, $2, 'shatibiyyah', 1, 90, 'recited', $4)`, [org, amina.id, addDays(today, -1), addDays(today, -3)]);
  // school features: board, calendar, a juz test, adab points and a message thread
  await db.query(`insert into public.announcements (org_id, title, body, pinned) values ($1, 'Revision competition this month', 'Most clean pages by the end of the month wins a prize. Keep your Old revision steady!', true)`, [org]);
  await db.query(`insert into public.announcements (org_id, class_id, title, body) values ($1, $2, 'Bring your mushaf on Wednesday', 'We will practise reading from the page.')`, [org, cls1]);
  await db.query(`insert into public.events (org_id, starts_on, ends_on, title, kind) values ($1, $2, $3, 'Mid-term break', 'holiday'), ($1, $4, null, 'Parents evening', 'event')`, [org, addDays(today, 9), addDays(today, 11), addDays(today, 5)]);
  await db.query(`insert into public.exams (org_id, student_id, title, juz, start_ayah_id, end_ayah_id, scheduled_on, examiner) values ($1, $2, 'Juz 30 test', 30, $3, $4, $5, 'Ustadh Bilal')`, [org, amina.id, ayahId(78, 1), ayahId(114, 6), addDays(today, 4)]);
  for (const [sid, cat, v, d] of [[amina.id, 'On time', 1, 0], [amina.id, 'Focused', 1, -1], [ibrahim.id, 'Good manners', 1, 0], [zayd.id, 'Late', -1, -2], [yusra.id, 'Prepared', 1, -1], [hana.id, 'Helped others', 1, -3]] as const)
    await db.query(`insert into public.behaviour_points (org_id, student_id, date, category, value) values ($1, $2, $3, $4, $5)`, [org, sid, addDays(today, d), cat, v]);
  await db.query(`insert into public.messages (org_id, student_id, sender, sender_name, body, created_at) values ($1, $2, $3, 'Ustadh Bilal', 'Assalamu alaikum. Ibrahim did very well today. Please listen to Al-Humazah with him tonight.', now() - interval '3 hours')`, [org, ibrahim.id, T1]);
  await as(P1);
  await db.query(`insert into public.messages (org_id, student_id, body, sender_name) values ($1, $2, 'Wa alaikum assalam, JazakAllahu khayran. We will.', 'Umm Ibrahim')`, [org, ibrahim.id]);
  await as(T1);

  await as(X1);
  const orgB = await val<string>(`select public.create_organization('Other School', 'Europe/London', 'Other Admin') as v`);
  await db.query('select public.create_student($1::jsonb)', [JSON.stringify({ org_id: orgB, name: 'Private Student', memorized: [[ayahId(114, 1), ayahId(114, 6)]] })]);
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
}
