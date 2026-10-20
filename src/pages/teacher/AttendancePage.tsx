// Teacher: today's check-ins and code, absence requests, and each student's standing this semester.
import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Check, X, CalendarCheck, Download } from 'lucide-react';
import { useOrg } from '../../app/context';
import type { OrgData } from '../../app/useOrgData';
import type { Standing } from '../../api/data';
import { classToday, nowIn, fmtTime, scheduleText } from '../../lib/schedule';
import { niceDate } from '../../lib/dates';
import { downloadCsv } from '../../lib/csv';
import { Button, Card, CardHead, Empty, Field, Pill, Select, cx, useToast } from '../../components/ui';
import { friendly } from '../../api/backend';

export function CheckinCode({ classId }: { classId: string }) {
  const { api } = useOrg(); const [code, setCode] = useState<string | null>(null);
  useEffect(() => { api.checkinCode(classId).then(setCode).catch(() => setCode(null)); }, [api, classId]);
  if (!code) return null;
  return <div className="inline-flex items-center gap-3 rounded-2xl bg-pine-900 px-5 py-3 text-white"><KeyRound size={20} className="text-brass-500" /><span className="text-sm">Today’s check-in code</span><b className="font-mono text-3xl tracking-[.3em]">{code}</b></div>;
}

export function AttendancePage({ data, reload, onRegister }: { data: OrgData; reload: () => void; onRegister: () => void }) {
  const { org, api, user } = useOrg(); const toast = useToast();
  const now = nowIn(org.timezone);
  const meeting = data.classes.filter(c => c.slots.some(s => s.day === now.dow));
  const [cls, setCls] = useState(meeting.find(c => c.teacherUserId === user?.id)?.id ?? meeting[0]?.id ?? data.classes[0]?.id ?? '');
  const c = data.classes.find(x => x.id === cls);
  const students = data.students.filter(s => !c || c.studentIds.includes(s.id));
  const ct = c && students[0] ? classToday([c], students[0].id, org.timezone) : null;
  const att = (sid: string) => data.attendance.find(a => a.studentId === sid && a.date === now.date);
  const pending = data.absences.filter(a => a.status === 'pending' && a.date >= now.date).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = data.absences.filter(a => a.status !== 'pending' && a.date >= now.date);
  const [standing, setStanding] = useState<Map<string, Standing>>(new Map());
  useEffect(() => { Promise.all(data.students.map(s => api.standing(s.id).then(r => [s.id, r] as const).catch(() => null))).then(rs => setStanding(new Map(rs.filter(Boolean) as Array<readonly [string, Standing]>))); }, [api, data.students, data.attendance, data.absences]);
  const name = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  const decide = async (id: string, st: 'approved' | 'declined') => { try { await api.decideAbsence(id, st); toast(st === 'approved' ? 'Approved.' : 'Declined.'); reload(); } catch (e) { toast(friendly(e), 'err'); } };
  const sem = org.settings.attendance;
  const rows = useMemo(() => data.students.map(s => ({ s, st: standing.get(s.id) })).sort((a, b) => ((b.st?.over ?? 0) + (b.st?.unnotified ?? 0)) - ((a.st?.over ?? 0) + (a.st?.unnotified ?? 0)) || a.s.name.localeCompare(b.s.name)), [data.students, standing]);
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      {data.classes.length > 1 && <Field label="Halaqah" className="min-w-[200px]">{id => <Select id={id} value={cls} onChange={setCls} options={data.classes.map(x => [x.id, x.name] as [string, string])} />}</Field>}
      <Button kind="secondary" onClick={onRegister}><CalendarCheck size={16} />Take or fix attendance</Button>
    </div>
    {!c ? <Card><Empty title="No halaqahs yet">Create a halaqah with its class times first.</Empty></Card> : <Card className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{c.name} · today</h2><p className="text-sm text-ink-soft">{ct ? `${fmtTime(ct.slot.start)}–${fmtTime(ct.slot.end)} · check-in opens ${c.checkinOpenMin} min before · late after ${c.lateAfterMin} min` : `No class today. ${scheduleText(c.slots)}`}</p></div>
        {ct && c.requireCode && <CheckinCode classId={c.id} />}
      </div>
      {ct && <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{students.map(s => { const a = att(s.id); const r = data.absences.find(x => x.studentId === s.id && x.date === now.date); return <li key={s.id} className={cx('flex items-center gap-2 rounded-xl px-3 py-2 ring-1', a?.status === 'present' ? 'bg-emerald-50 ring-good/30' : a?.status === 'late' ? 'bg-amber-50 ring-warn/30' : a ? 'bg-red-50 ring-bad/30' : r ? 'bg-brass-100/50 ring-brass-500/30' : 'bg-white ring-line')}>
        <b className="min-w-0 flex-1 truncate">{s.name}</b>
        <span className="text-sm">{a ? `${a.status}${a.checkedInAt ? ` ${new Date(a.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}` : r ? `absence ${r.status}` : 'not checked in'}</span>
      </li>; })}</ul>}
    </Card>}
    <Card><CardHead title="Absence requests" sub={pending.length ? `${pending.length} waiting for you` : 'Nothing waiting'} />
      {pending.length + upcoming.length > 0 ? <ul className="mt-2 divide-y divide-line">{[...pending, ...upcoming].map(r => <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
        <span className="min-w-0 flex-1 basis-56"><b>{name(r.studentId)}</b> · {niceDate(r.date)}<span className="block text-sm text-ink-soft">{r.kind === 'free' ? 'Free absence (no reason needed)' : r.reason}</span><span className="text-xs text-ink-faint">Sent {new Date(r.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span>
        {r.status === 'pending' ? <span className="flex gap-1"><Button className="min-h-[44px] px-3 text-sm" onClick={() => decide(r.id, 'approved')}><Check size={15} />Approve</Button><Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => decide(r.id, 'declined')}><X size={15} />Decline</Button></span> : <Pill tone={r.status === 'approved' ? 'green' : 'red'}>{r.status}</Pill>}
      </li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-faint">Students send these from their app before class.</p>}
    </Card>
    <Card><CardHead title="Semester standing" sub={sem.semesterStart && sem.semesterEnd ? `${niceDate(sem.semesterStart)} – ${niceDate(sem.semesterEnd)} · ${sem.freeAbsences} free + ${sem.excusedAbsences} excused allowed` : 'Set the semester dates in More → Settings → Attendance'}
      action={<Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => downloadCsv('attendance standing.csv', rows.map(r => ({ student: r.s.name, absences: r.st?.absences ?? '', excused_approved: r.st?.excused ?? '', not_communicated: r.st?.unnotified ?? '', over_limit: r.st?.over ?? '' })))}><Download size={15} />CSV</Button>} />
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase text-ink-faint"><th className="px-5 py-2">Student</th><th className="px-2">Absences</th><th className="px-2">Excused (approved)</th><th className="px-2">Not communicated</th><th className="px-5">Status</th></tr></thead>
        <tbody>{rows.map(({ s, st }) => <tr key={s.id} className="border-b border-line last:border-0"><td className="px-5 py-2.5 font-bold">{s.name}</td><td className="px-2 tabular-nums">{st?.absences ?? '…'}</td><td className="px-2 tabular-nums">{st?.excused ?? '…'}</td><td className={cx('px-2 tabular-nums', st?.unnotified ? 'font-bold text-bad' : '')}>{st?.unnotified ?? '…'}</td>
          <td className="px-5">{!st ? '' : st.over > 0 ? <Pill tone="red">Over limit by {st.over}</Pill> : st.unnotified > 0 ? <Pill tone="red">Not communicated</Pill> : st.absences >= st.free + st.extra ? <Pill tone="amber">At limit</Pill> : <Pill tone="green">Good</Pill>}</td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}

export function RevisionForms({ data }: { data: OrgData }) {
  const { org, today } = useOrg();
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(`${today}T12:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow - i * 7); return d.toISOString().slice(0, 10); });
  const [wk, setWk] = useState(weeks[1] ?? weeks[0]);
  const slots = org.settings.revisionForm.slots; const allowed = org.settings.revisionForm.allowedMisses;
  const done = (sid: string, key: string) => data.revisionForms.find(f => f.studentId === sid && f.weekStart === wk && f.slot === key && f.done);
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-end gap-3"><Field label="Week" className="min-w-[220px]">{id => <Select id={id} value={wk} onChange={setWk} options={weeks.map((w, i) => [w, `${i === 0 ? 'This week' : i === 1 ? 'Last week' : 'Week of'} · ${niceDate(w)}`] as [string, string])} />}</Field>
      <p className="text-sm text-ink-soft">{allowed} missed session{allowed === 1 ? '' : 's'} a week {allowed === 1 ? 'is' : 'are'} excused; more than that is flagged for follow-up.</p></div>
    <Card><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase text-ink-faint"><th className="px-5 py-2">Student</th>{slots.map(s => <th key={s.key} className="px-2">{s.label}</th>)}<th className="px-5">Missed</th></tr></thead>
      <tbody>{data.students.map(st => { const missed = slots.filter(s => !done(st.id, s.key)).length; return <tr key={st.id} className="border-b border-line align-top last:border-0"><td className="px-5 py-2.5 font-bold">{st.name}</td>
        {slots.map(s => { const r = done(st.id, s.key); return <td key={s.key} className="px-2 py-2.5">{r ? <span className="text-good"><Check size={15} className="inline" /> {r.partner}{r.recorded ? (r.recordingLink ? <> · <a className="underline" href={r.recordingLink} target="_blank" rel="noreferrer">recording</a></> : ' · recorded') : ''}{r.pages ? <span className="block text-xs text-ink-faint">{r.pages}</span> : null}</span> : <span className="text-ink-faint">—</span>}</td>; })}
        <td className="px-5 py-2.5">{wk === weeks[0] ? <span className="text-ink-faint">{missed} so far</span> : missed > allowed ? <Pill tone="red">{missed} · follow up</Pill> : <Pill tone="green">{missed}</Pill>}</td></tr>; })}</tbody></table></div></Card>
  </div>;
}
