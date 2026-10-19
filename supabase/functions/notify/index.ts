// Supabase Edge Function (Deno): parent emails through Brevo's free plan (300 emails/day).
//  • { type: 'session', student_id, date }  — called by the app after a teacher saves a session (caller must be staff).
//  • { type: 'daily' } / { type: 'weekly' }  — called by pg_cron with header x-cron-secret (see supabase/cron.sql).
// Secrets (Supabase → Edge Functions → Secrets): BREVO_API_KEY, SENDER_EMAIL, SENDER_NAME, CRON_SECRET.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const env = (k: string) => Deno.env.get(k) ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Mail { to: string; toName: string; subject: string; lines: string[] }

async function send(m: Mail): Promise<{ ok: boolean; error?: string }> {
  if (!env('BREVO_API_KEY') || !env('SENDER_EMAIL')) return { ok: false, error: 'Email is not set up (BREVO_API_KEY / SENDER_EMAIL missing)' };
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1B2524">${m.lines.map(l => `<p>${esc(l)}</p>`).join('')}<p style="color:#888;font-size:12px">You get this because your child's teacher added your email. Ask the teacher to turn emails off.</p></div>`;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { email: env('SENDER_EMAIL'), name: env('SENDER_NAME') || 'Hifz Tracker' }, to: [{ email: m.to, name: m.toName || undefined }], subject: m.subject, htmlContent: html, textContent: m.lines.join('\n\n') }),
  });
  return r.ok ? { ok: true } : { ok: false, error: `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}` };
}
async function log(admin: SupabaseClient, org: string, student: string | null, to: string | null, template: string, subject: string, res: { ok: boolean; error?: string } | 'skipped', why?: string) {
  await admin.from('notifications').insert({ org_id: org, student_id: student, to_address: to, template, subject, status: res === 'skipped' ? 'skipped' : res.ok ? 'sent' : 'failed', error: res === 'skipped' ? why ?? null : res.error ?? null });
}
const settingsOf = (o: Row) => ({ enabled: true, onSession: true, lowRevision: true, weekly: false, ...(o.settings?.email ?? {}) });
const TYPE: Record<string, string> = { new: 'New lesson', recent: 'Recent revision', old: 'Old revision', juz_revision: 'Full juz revision', assessment: 'Assessment', catch_up: 'Catch-up', review: 'Review', other: 'Other' };

async function rangeText(admin: SupabaseClient, a: number, b: number) {
  const { data } = await admin.from('quran_ayahs').select('id,surah,ayah,page').in('id', [a, b]);
  const s = (data ?? []).find((x: Row) => x.id === a), e = (data ?? []).find((x: Row) => x.id === b);
  if (!s || !e) return `ayahs ${a}–${b}`;
  const { data: names } = await admin.from('quran_surahs').select('number,name_en').in('number', [s.surah, e.surah]);
  const n = (k: number) => (names ?? []).find((x: Row) => x.number === k)?.name_en ?? `Surah ${k}`;
  return s.surah === e.surah ? `${n(s.surah)} ${s.ayah}–${e.ayah} (page ${s.page}${e.page !== s.page ? `–${e.page}` : ''})` : `${n(s.surah)} ${s.ayah} – ${n(e.surah)} ${e.ayah}`;
}

async function sessionEmail(admin: SupabaseClient, studentId: string, date: string) {
  const { data: st } = await admin.from('students').select('*').eq('id', studentId).single();
  if (!st) return { skipped: 'student not found' };
  const { data: org } = await admin.from('organizations').select('id,name,settings').eq('id', st.org_id).single();
  const subject = `${st.name}: today's hifz`;
  if (!settingsOf(org!).enabled || !settingsOf(org!).onSession) { await log(admin, st.org_id, st.id, st.guardian_email, 'session', subject, 'skipped', 'turned off in settings'); return { skipped: 'off' }; }
  if (!st.notify || !st.guardian_email) { await log(admin, st.org_id, st.id, st.guardian_email, 'session', subject, 'skipped', 'no parent email or emails turned off'); return { skipped: 'no email' }; }
  const { data: sessions } = await admin.from('sessions').select('*').eq('student_id', st.id).eq('date', date).is('deleted_at', null).eq('recorded_by', 'teacher');
  if (!sessions?.length) return { skipped: 'no sessions' };
  const lines = [`Assalamu alaikum${st.guardian_name ? ` ${st.guardian_name}` : ''},`, `Here is ${st.name}'s hifz for ${date} at ${org!.name}:`];
  for (const s of sessions) {
    const errs = s.errors_major + s.errors_minor;
    lines.push(`• ${TYPE[s.type] ?? s.type}: ${await rangeText(admin, s.start_ayah_id, s.end_ayah_id)} — ${errs} mistake${errs === 1 ? '' : 's'}${s.score_overall !== null ? `, overall ${s.score_overall}` : ''}.${s.teacher_note ? ` Teacher: "${s.teacher_note}"` : ''}`);
  }
  lines.push('Please listen to the new lesson and the recent pages at home today. JazakAllahu khayran.');
  const res = await send({ to: st.guardian_email, toName: st.guardian_name ?? '', subject, lines });
  await log(admin, st.org_id, st.id, st.guardian_email, 'session', subject, res);
  return res;
}

async function scheduled(admin: SupabaseClient, kind: 'daily' | 'weekly') {
  const { data: orgs } = await admin.from('organizations').select('id,name,settings').is('deleted_at', null);
  let sent = 0;
  for (const org of orgs ?? []) {
    const s = settingsOf(org);
    if (!s.enabled || (kind === 'daily' && !s.lowRevision) || (kind === 'weekly' && !s.weekly)) continue;
    const { data: today } = await admin.rpc('org_today', { org: org.id });
    const { data: students } = await admin.from('students').select('*').eq('org_id', org.id).is('archived_at', null).eq('notify', true).not('guardian_email', 'is', null);
    for (const st of students ?? []) {
      if (kind === 'daily') {
        const { count } = await admin.from('revision_items').select('page', { count: 'exact', head: true }).eq('student_id', st.id).lt('due_on', today);
        if ((count ?? 0) < 10) continue;
        const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
        const { count: recent } = await admin.from('notifications').select('id', { count: 'exact', head: true }).eq('student_id', st.id).eq('template', 'low_revision').gte('created_at', weekAgo);
        if (recent) continue;
        const subject = `${st.name}: revision is falling behind`;
        const res = await send({ to: st.guardian_email, toName: st.guardian_name ?? '', subject, lines: [`Assalamu alaikum${st.guardian_name ? ` ${st.guardian_name}` : ''},`, `${st.name} has ${count} pages of old revision overdue. A little every day keeps what has been memorised strong.`, 'Could you help by listening to a few pages at home this week? JazakAllahu khayran.', `— ${org.name}`] });
        await log(admin, org.id, st.id, st.guardian_email, 'low_revision', subject, res); if (res.ok) sent++;
      } else {
        const since = new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10);
        const { data: ss } = await admin.from('sessions').select('type,start_ayah_id,end_ayah_id,errors_major,errors_minor,date').eq('student_id', st.id).gte('date', since).is('deleted_at', null);
        const newAyahs = (ss ?? []).filter((x: Row) => x.type === 'new').reduce((n: number, x: Row) => n + x.end_ayah_id - x.start_ayah_id + 1, 0);
        const days = new Set((ss ?? []).map((x: Row) => x.date)).size;
        const errs = (ss ?? []).reduce((n: number, x: Row) => n + x.errors_major + x.errors_minor, 0);
        const subject = `${st.name}: this week's hifz`;
        const res = await send({ to: st.guardian_email, toName: st.guardian_name ?? '', subject, lines: [`Assalamu alaikum${st.guardian_name ? ` ${st.guardian_name}` : ''},`, `This week ${st.name} came to ${days} session${days === 1 ? '' : 's'}, learned ${newAyahs} new ayah${newAyahs === 1 ? '' : 's'}, and had ${errs} mistake${errs === 1 ? '' : 's'} in total.`, 'You can see the details any time by signing in with the parent code from the teacher.', `— ${org.name}`] });
        await log(admin, org.id, st.id, st.guardian_email, 'weekly', subject, res); if (res.ok) sent++;
      }
    }
  }
  return { sent };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  let body: Row; try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  try {
    if (body.type === 'daily' || body.type === 'weekly') {
      if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return json({ error: 'Forbidden' }, 403);
      return json(await scheduled(admin, body.type));
    }
    if (body.type === 'session') {
      if (typeof body.student_id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) return json({ error: 'student_id and date are required' }, 400);
      // who is calling? use their own token, so RLS decides whether they may see this student
      const asCaller = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });
      const { data: { user } } = await asCaller.auth.getUser();
      if (!user) return json({ error: 'Sign in first' }, 401);
      const { data: st } = await asCaller.from('students').select('org_id').eq('id', body.student_id).maybeSingle();
      if (!st) return json({ error: 'Not found' }, 404);
      const { data: m } = await asCaller.from('organization_members').select('role').eq('org_id', st.org_id).eq('user_id', user.id).maybeSingle();
      if (!m || !['admin', 'teacher'].includes(m.role)) return json({ error: 'Only teachers can send session emails' }, 403);
      return json(await sessionEmail(admin, body.student_id, body.date));
    }
    return json({ error: 'Unknown type' }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
