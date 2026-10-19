// Program settings, codes, people, reports, the email log and the audit log.
import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, Download, Settings, KeyRound, Users, BarChart3, Mail, History as HistoryIcon, BookOpen } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useRoute, href } from '../../app/router';
import { addDays, niceDate } from '../../lib/dates';
import { downloadCsv } from '../../lib/csv';
import { insight } from '../../lib/insights';
import { accuracy } from '../../lib/scoring';
import { pagesInRange, SOURCE } from '../../quran';
import { sessionRows } from '../../components/StudentReport';
import type { OrgSettings, Role } from '../../lib/types';
import type { AuditRow, Notice } from '../../api/data';
import { Button, Card, CardHead, Field, Select, Toggle, inputCls, Spinner, ErrorBox, Pill, Stat, Empty, Confirm, useToast, cx } from '../../components/ui';
import { DailyBars } from '../../components/quran';
import { PageTitle } from '../../components/Shell';
import { friendly } from '../../api/backend';

const SECTIONS = [
  ['reports', 'Reports', BarChart3, false], ['settings', 'Settings', Settings, true], ['codes', 'Join codes', KeyRound, true], ['people', 'People', Users, true],
  ['email', 'Email log', Mail, false], ['audit', 'Audit log', HistoryIcon, true], ['about', 'About the data', BookOpen, false],
] as const;
export function More() {
  const { org } = useOrg();
  const route = useRoute();
  const admin = org.role === 'admin';
  const visible = SECTIONS.filter(s => !s[3] || admin);
  const sec = visible.find(s => s[0] === route[1])?.[0] ?? 'reports';
  return <>
    <PageTitle title="More" sub={org.name} />
    <nav aria-label="More sections" className="no-print mb-5 flex gap-1 overflow-x-auto pb-1">{visible.map(([k, l, I]) => <a key={k} href={href('more', k)} aria-current={sec === k ? 'page' : undefined} className={cx('inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold', sec === k ? 'bg-pine-700 text-white' : 'bg-white text-ink-soft ring-1 ring-line')}><I size={15} />{l}</a>)}</nav>
    {sec === 'reports' && <Reports />}
    {sec === 'settings' && <SettingsForm />}
    {sec === 'codes' && <Codes />}
    {sec === 'people' && <People />}
    {sec === 'email' && <EmailLog />}
    {sec === 'audit' && <Audit />}
    {sec === 'about' && <About />}
  </>;
}

function Reports() {
  const { org, today, api } = useOrg();
  const { data, error, reload } = useOrgData({ days: 90 });
  const [days, setDays] = useState('30'); const [busy, setBusy] = useState(false);
  const toast = useToast();
  const ins = useMemo(() => data ? data.students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const since = addDays(today, -Number(days) + 1);
  const list = data.sessions.filter(s => s.date >= since);
  const nameOf = (id: string) => data.students.find(s => s.id === id)?.name ?? 'Archived student';
  const acc = list.map(s => accuracy(s.errorsMajor, s.errorsMinor, pagesInRange(s.range).length, org.settings.accuracy));
  const att = data.attendance.filter(a => a.date >= since);
  const bars = Array.from({ length: Number(days) }, (_, i) => addDays(since, i)).map(d => ({ date: d, value: data.sessions.filter(s => s.date === d).length }));
  const allTime = async () => {
    setBusy(true);
    try { const all = await api.sessions(org.id, { limit: 20000 }); downloadCsv(`${org.name} all sessions.csv`, all.flatMap(s => sessionRows([s], nameOf(s.studentId), org.settings))); }
    catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Period" className="min-w-[180px]">{id => <Select id={id} value={days} onChange={setDays} options={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} />}</Field>
      <Button kind="secondary" disabled={!list.length} onClick={() => downloadCsv(`${org.name} sessions ${since} to ${today}.csv`, list.flatMap(s => sessionRows([s], nameOf(s.studentId), org.settings)))}><Download size={16} />Sessions CSV</Button>
      <Button kind="secondary" busy={busy} onClick={allTime}><Download size={16} />All sessions, all time</Button>
      <Button kind="secondary" disabled={!att.length} onClick={() => downloadCsv(`${org.name} attendance.csv`, att.map(a => ({ date: a.date, student: nameOf(a.studentId), status: a.status, mode: a.mode })))}><Download size={16} />Attendance CSV</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Sessions" value={list.length} sub={`${new Set(list.map(s => s.studentId)).size} students`} />
      <Stat label="New ayahs" value={list.filter(s => s.type === 'new').reduce((n, s) => n + s.range.end - s.range.start + 1, 0)} />
      <Stat label="Average accuracy" value={acc.length ? `${Math.round(acc.reduce((a, b) => a + b, 0) / acc.length)}%` : '—'} />
      <Stat label="Attendance" value={att.length ? `${Math.round((att.filter(a => a.status === 'present' || a.status === 'late').length / att.length) * 100)}%` : '—'} />
    </div>
    <Card className="pb-4"><CardHead title="Sessions a day" /><div className="px-5 pt-3"><DailyBars days={bars} label="sessions" /></div></Card>
    <Card><CardHead title="Students" sub="Sorted by most memorised" />
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase text-ink-faint"><th className="px-5 py-2">Name</th><th className="px-2">Memorised</th><th className="px-2">Juz</th><th className="px-2">Accuracy</th><th className="px-2">Attendance</th><th className="px-2">Overdue pages</th><th className="px-5">Streak</th></tr></thead>
        <tbody>{[...ins].sort((a, b) => b.progress.ayahs - a.progress.ayahs).map(i => <tr key={i.student.id} className="border-b border-line last:border-0">
          <td className="px-5 py-2.5"><a className="font-bold underline-offset-2 hover:underline" href={href('students', i.student.id)}>{i.student.name}</a></td>
          <td className="px-2 tabular-nums">{(i.progress.percent * 100).toFixed(1)}%</td><td className="px-2 tabular-nums">{i.progress.juz}</td>
          <td className="px-2 tabular-nums">{i.avgAccuracy30 ?? '—'}{i.avgAccuracy30 !== null && '%'}</td><td className="px-2 tabular-nums">{i.attendanceRate30 === null ? '—' : `${Math.round(i.attendanceRate30 * 100)}%`}</td>
          <td className={cx('px-2 tabular-nums', i.revision.overdue.length ? 'font-bold text-warn' : '')}>{i.revision.overdue.length}</td><td className="px-5 tabular-nums">{i.streak}</td></tr>)}</tbody>
      </table></div>
    </Card>
    <p className="text-xs text-ink-faint">For a printable monthly report for one student, open the student and choose Report.</p>
  </div>;
}

function SettingsForm() {
  const { org, api, refreshSession } = useOrg();
  const toast = useToast();
  const [name, setName] = useState(org.name); const [s, setS] = useState<OrgSettings>(org.settings); const [busy, setBusy] = useState(false);
  const r = s.revision;
  const setR = (p: Partial<OrgSettings['revision']>) => setS({ ...s, revision: { ...r, ...p } });
  const save = async () => { setBusy(true); try { await api.updateOrg(org.id, { name: name.trim(), settings: s }); toast('Settings saved.'); await refreshSession(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <div className="flex max-w-2xl flex-col gap-5">
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-bold">Program</h2>
      <Field label="Name">{id => <input id={id} className={inputCls} value={name} maxLength={80} onChange={e => setName(e.target.value)} />}</Field>
      <p className="text-sm text-ink-faint">Time zone: {org.timezone}. “Today” and streaks follow it.</p>
      <Field label="Scores">{id => <Select id={id} value={s.scoreScale} onChange={v => setS({ ...s, scoreScale: Number(v) })} options={[[5, '1 to 5 stars'], [10, '0 to 10 points']]} />}</Field>
    </Card>
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-bold">Revision</h2>
      <p className="-mt-2 text-sm text-ink-faint">After each Old revision, a clean page comes back later (the gap doubles up to the maximum); a weak page keeps its gap; a failed page comes back tomorrow.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recent revision covers">{id => <Select id={id} value={r.recentDays} onChange={v => setR({ recentDays: Number(v) })} options={[3, 5, 7, 10, 14, 21, 30].map(d => [d, `the last ${d} days of New`])} />}</Field>
        <Field label="Longest gap between reviews">{id => <Select id={id} value={r.maxIntervalDays} onChange={v => setR({ maxIntervalDays: Number(v) })} options={[7, 14, 21, 30, 45, 60, 90].map(d => [d, `${d} days`])} />}</Field>
        <Field label="Weak page at">{id => <Select id={id} value={r.weakThreshold} onChange={v => setR({ weakThreshold: Number(v), failThreshold: Math.max(Number(v) + 1, r.failThreshold) })} options={[1, 2, 3, 4, 5].map(d => [d, `${d} error${d > 1 ? 's' : ''} or more`])} />}</Field>
        <Field label="Failed page at">{id => <Select id={id} value={r.failThreshold} onChange={v => setR({ failThreshold: Number(v) })} options={[2, 3, 4, 5, 6, 8].filter(d => d > r.weakThreshold).map(d => [d, `${d} errors or more`])} />}</Field>
        <Field label="Old revision a day">{id => <Select id={id} value={r.dailyOldPages ?? 0} onChange={v => setR({ dailyOldPages: Number(v) || null })} options={[[0, 'Automatic (by pages memorised)'], ...[2, 3, 5, 10, 15, 20, 30, 40].map(d => [d, `${d} pages`] as [number, string])]} />}</Field>
        <Field label="Pause New when overdue reaches">{id => <Select id={id} value={r.maxOverdueBeforeNew ?? 0} onChange={v => setR({ maxOverdueBeforeNew: Number(v) || null })} options={[[0, 'Never pause'], ...[5, 10, 20, 40].map(d => [d, `${d} overdue pages`] as [number, string])]} />}</Field>
      </div>
    </Card>
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-bold">Accuracy</h2>
      <p className="-mt-2 text-sm text-ink-faint">Accuracy per page = 100 − points for each error. It reflects what the teacher recorded.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Major error">{id => <Select id={id} value={s.accuracy.major} onChange={v => setS({ ...s, accuracy: { ...s.accuracy, major: Number(v) } })} options={[5, 8, 10, 15, 20].map(d => [d, `−${d} points`])} />}</Field>
        <Field label="Minor error">{id => <Select id={id} value={s.accuracy.minor} onChange={v => setS({ ...s, accuracy: { ...s.accuracy, minor: Number(v) } })} options={[1, 2, 3, 5].map(d => [d, `−${d} points`])} />}</Field>
      </div>
    </Card>
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="font-bold">Parent emails</h2>
      <Toggle on={s.email.enabled} onChange={v => setS({ ...s, email: { ...s.email, enabled: v } })} label="Send emails to parents" sub="Only to parents with an email address who have not turned it off" />
      {s.email.enabled && <>
        <Toggle on={s.email.onSession} onChange={v => setS({ ...s, email: { ...s.email, onSession: v } })} label="After each session" />
        <Toggle on={s.email.lowRevision} onChange={v => setS({ ...s, email: { ...s.email, lowRevision: v } })} label="When revision falls behind" sub="At most once a week per student" />
        <Toggle on={s.email.weekly} onChange={v => setS({ ...s, email: { ...s.email, weekly: v } })} label="Weekly summary" sub="Sunday evening" />
      </>}
    </Card>
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="font-bold">Leaderboard</h2>
      <p className="-mt-1 text-sm text-ink-faint">Ranks students by consistency: days with a session, pages revised and clean pages. New lessons give no points. Teachers always see it.</p>
      <Toggle on={s.leaderboard.enabled} onChange={v => setS({ ...s, leaderboard: { ...s.leaderboard, enabled: v } })} label="Show it to students and parents" />
      {s.leaderboard.enabled && <Toggle on={s.leaderboard.fullNames} onChange={v => setS({ ...s, leaderboard: { ...s.leaderboard, fullNames: v } })} label="Show full names" sub="Off: first name and initial, e.g. “Amina S.”" />}
    </Card>
    <div><Button busy={busy} onClick={save} disabled={name.trim().length < 2}>Save settings</Button></div>
  </div>;
}

function Codes() {
  const { org, api, refreshSession } = useOrg();
  const toast = useToast();
  const [tc, setTc] = useState<string | null>(null); const [confirm, setConfirm] = useState(false);
  useEffect(() => { api.teacherCode(org.id).then(setTc).catch(e => toast(friendly(e), 'err')); }, [api, org.id, org.joinCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Copied.'); } catch { toast('Copy failed. Select the code and copy it.', 'err'); } };
  const Row = ({ label, code, who }: { label: string; code: string | null; who: string }) => <Card className="flex flex-wrap items-center gap-4 p-5">
    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink-soft">{label}</p><p className="font-mono text-3xl font-bold tracking-[.2em]">{code ?? '…'}</p><p className="text-sm text-ink-faint">{who}</p></div>
    {code && <Button kind="secondary" onClick={() => copy(code)}><Copy size={16} />Copy</Button>}
  </Card>;
  return <div className="flex max-w-2xl flex-col gap-4">
    <Row label="Student code" code={org.joinCode} who="Students sign in with Google, enter this, then answer a few setup questions." />
    <Row label="Teacher code" code={tc} who="Gives teacher access to every student. Share it only with teachers. Only admins see it." />
    <p className="text-sm text-ink-faint">Parents get a separate code for each child, on the child’s page.</p>
    <div><Button kind="secondary" onClick={() => setConfirm(true)}><RefreshCw size={16} />Make new codes</Button></div>
    <Confirm open={confirm} onClose={() => setConfirm(false)} title="Make new codes?" confirmLabel="Make new codes" danger body="The old student and teacher codes stop working. People who already joined stay in." onConfirm={async () => { try { await api.regenerateCodes(org.id); await refreshSession(); setTc(await api.teacherCode(org.id)); toast('New codes made.'); } catch (e) { toast(friendly(e), 'err'); } }} />
  </div>;
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', teacher: 'Teacher', student: 'Student', parent: 'Parent' };
function People() {
  const { org, api, user } = useOrg();
  const { data, error, reload } = useOrgData();
  const toast = useToast();
  const [rm, setRm] = useState<string | null>(null);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const admins = data.members.filter(m => m.role === 'admin').length;
  return <Card>
    <CardHead title={`${data.members.length} people`} sub="Everyone who has joined with a code. Children without accounts are under Students." />
    <ul className="mt-2 divide-y divide-line">{data.members.map(m => { const me = m.userId === user?.id; const student = data.students.find(s => s.userId === m.userId); return <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1 basis-48"><b>{m.displayName ?? student?.name ?? 'No name'}</b>{me && <Pill className="ml-2">you</Pill>}<span className="block text-sm text-ink-faint">Joined {niceDate(m.createdAt.slice(0, 10))}</span></span>
      <Select aria-label={`Role for ${m.displayName ?? 'member'}`} className="w-40" value={m.role} disabled={me && admins <= 1} onChange={async v => { try { await api.setMemberRole(org.id, m.userId, v as Role); toast('Role changed.'); reload(); } catch (e) { toast(friendly(e), 'err'); } }} options={(Object.keys(ROLE_LABEL) as Role[]).map(r => [r, ROLE_LABEL[r]])} />
      {!me && <Button kind="quiet" onClick={() => setRm(m.userId)}>Remove</Button>}
    </li>; })}</ul>
    <Confirm open={!!rm} onClose={() => setRm(null)} danger title="Remove from the program?" confirmLabel="Remove" body="They lose access straight away. Their student record and history stay." onConfirm={async () => { try { await api.removeMember(org.id, rm!); toast('Removed.'); reload(); } catch (e) { toast(friendly(e), 'err'); } }} />
  </Card>;
}

function EmailLog() {
  const { org, api, backend } = useOrg();
  const [rows, setRows] = useState<Notice[] | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.notifications(org.id).then(setRows).catch(e => setErr(friendly(e))); }, [api, org.id]);
  if (err) return <ErrorBox message={err} />;
  if (!rows) return <Spinner />;
  return <Card>
    <CardHead title="Emails to parents" sub="The last 100 attempts" />
    {backend.kind === 'preview' && <p className="mx-5 mt-3 rounded-xl bg-brass-100 px-3 py-2 text-sm text-brass-700">In the preview no email is sent. On the live site, emails go out through Brevo once the API key is set (see the setup guide).</p>}
    {rows.length ? <ul className="mt-2 divide-y divide-line">{rows.map(n => <li key={n.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm"><Pill tone={n.status === 'sent' ? 'green' : n.status === 'failed' ? 'red' : 'slate'}>{n.status}</Pill><span>{n.template}</span><span className="text-ink-faint">to {n.to ?? '—'}</span><span className="ml-auto text-ink-faint">{new Date(n.createdAt).toLocaleString()}</span>{n.error && <span className="basis-full text-bad">{n.error}</span>}</li>)}</ul> : <Empty icon={<Mail size={28} />} title="No emails yet" />}
  </Card>;
}

function Audit() {
  const { org, api } = useOrg();
  const { data } = useOrgData();
  const [rows, setRows] = useState<AuditRow[] | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.audit(org.id).then(setRows).catch(e => setErr(friendly(e))); }, [api, org.id]);
  if (err) return <ErrorBox message={err} />;
  if (!rows) return <Spinner />;
  const who = (id: string | null) => data?.members.find(m => m.userId === id)?.displayName ?? (id ? 'Someone' : 'System');
  return <Card>
    <CardHead title="Audit log" sub="Every change to students, sessions, attendance, classes, assignments and people. Kept even when a record is deleted." action={<Button kind="secondary" disabled={!rows.length} onClick={() => downloadCsv(`${org.name} audit.csv`, rows.map(r => ({ at: r.at, who: who(r.actor), action: r.action, entity: r.entity, id: r.entityId ?? '' })))}><Download size={16} />CSV</Button>} />
    {rows.length ? <ul className="mt-2 divide-y divide-line">{rows.map(r => <li key={r.id} className="flex flex-wrap gap-x-3 px-5 py-2 text-sm"><span className="w-40 shrink-0 text-ink-faint">{new Date(r.at).toLocaleString()}</span><b>{who(r.actor)}</b><span>{r.action.toLowerCase()} · {r.entity.replace('_', ' ')}</span></li>)}</ul> : <Empty title="Nothing yet" />}
  </Card>;
}

function About() {
  return <Card className="flex max-w-2xl flex-col gap-3 p-5 text-[15px]">
    <h2 className="font-bold">Where the Qurʾān data comes from</h2>
    <p>Surahs, ayah counts, and page, juz and hizb boundaries come from <b>{SOURCE.name} {SOURCE.version}</b> ({SOURCE.license} licence), for the {SOURCE.riwayah} riwayah and the {SOURCE.mushaf} mushaf. The data is checked against known boundaries when it is generated.</p>
    <p>This app stores ranges and positions only. It does not show Qurʾān text, so there is no text to mistype.</p>
    <h2 className="mt-2 font-bold">What the numbers mean</h2>
    <p>Accuracy, weak pages and revision dates are calculated from the errors the teacher records. They do not judge recitation automatically; the teacher’s ear is the judge.</p>
  </Card>;
}
