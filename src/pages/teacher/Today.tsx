// "Who needs my attention today?" — the teacher's home, with one-tap recording.
import { JoinRequestsCard } from '../../components/HalaqahJoin';
import { SetupCard } from '../../components/SetupCard';
import { QiraatTestsDue } from '../../components/Qiraat';
import { RevisionCheckCard } from '../../components/RevisionSelf';
import { useMemo, useState } from 'react';
import { Plus, UserPlus, ClipboardList, AlertTriangle, CheckCircle2, Users, Radio, CalendarDays, Megaphone } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { insight } from '../../lib/insights';
import { addDays, niceDate, hijriDate } from '../../lib/dates';
import { formatRange, fromAyahId } from '../../quran';
import { ERROR_LABEL } from '../../lib/types';
import { Button, Card, CardHead, Pill, Spinner, ErrorBox, Empty, useToast } from '../../components/ui';
import { DailyBars } from '../../components/quran';
import { RecordSheet } from '../../components/RecordSheet';
import { StudentPicker } from '../../components/StudentPicker';
import { Leaderboard } from '../../components/Leaderboard';
import { AnnouncementBoard, Composer as AnnounceModal } from '../../components/Announcements';
import { NotifyToggle } from '../../components/Notifications';
import { Select } from '../../components/ui';
import { PageTitle } from '../../components/Shell';
import { href, go } from '../../app/router';
import { friendly } from '../../api/backend';

export function Today() {
  const { org, today, api, user } = useOrg();
  const { data, error, reload } = useOrgData();
  const [cls, setCls] = useState<string | null>(null);
  const toast = useToast();
  const [pick, setPick] = useState(false); const [allStudents, setAllStudents] = useState(false); const [announce, setAnnounce] = useState(false);
  const [rec, setRec] = useState<string | null>(null);
  const myClass = data?.classes.find(c => c.teacherUserId === user?.id)?.id ?? 'all';
  const activeCls = cls ?? myClass;
  const inCls = (sid: string) => activeCls === 'all' || !!data?.classes.find(c => c.id === activeCls)?.studentIds.includes(sid);
  const ins = useMemo(() => data ? data.students.filter(s => inCls(s.id)).map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today, activeCls]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const present = data.attendance.filter(a => a.date === today && inCls(a.studentId) && (a.status === 'present' || a.status === 'late')).length;
  const sessionsToday = data.sessions.filter(s => s.date === today && inCls(s.studentId)).length;
  const attention = ins.filter(i => i.reasons.some(r => r.severity >= 2)).sort((a, b) => b.reasons[0].severity - a.reasons[0].severity);
  const overdueStudents = ins.filter(i => i.revision.overdue.length > 0).length;
  const order = [...ins].sort((a, b) => Number(a.recordedToday) - Number(b.recordedToday) || (b.reasons[0]?.severity ?? 0) - (a.reasons[0]?.severity ?? 0) || a.student.name.localeCompare(b.student.name));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map(d => ({ date: d, value: data.sessions.filter(s => s.date === d && s.type === 'new').reduce((n, s) => n + s.range.end - s.range.start + 1, 0) }));
  const recentErrors = data.sessions.filter(s => s.date >= addDays(today, -6)).flatMap(s => s.errors.map(e => ({ s, e }))).slice(0, 8);
  const nameOf = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  const recIns = ins.find(i => i.student.id === rec);
  const markAbsent = async (sid: string) => { try { await api.saveAttendance(org.id, sid, today, 'absent', 'in_person'); toast('Marked absent.'); reload(); } catch (e) { toast(friendly(e), 'err'); } };

  return <>
    <PageTitle title="Today" sub={<>{niceDate(today)} · {hijriDate(today)}</>} action={<div className="flex flex-wrap gap-2" data-tour="today-actions"><Button onClick={() => go('classes', 'live')}><Radio size={18} />Live class</Button><Button kind="secondary" onClick={() => setPick(true)}><Plus size={18} />Record</Button><Button kind="secondary" onClick={() => go('assignments', 'new')}><ClipboardList size={18} />Assign</Button><Button kind="secondary" onClick={() => go('students', 'new')}><UserPlus size={18} />Add student</Button><Button kind="secondary" onClick={() => setAnnounce(true)}><Megaphone size={18} />Announce</Button></div>} />
    {announce && <AnnounceModal classes={data.classes} onClose={() => setAnnounce(false)} onSaved={reload} />}
    <div className="mb-5 empty:hidden"><SetupCard data={data} onChanged={reload} /></div>
    <div className="mb-5 empty:hidden" data-tour="requests"><JoinRequestsCard data={data} onChanged={reload} /></div>
    <div className="mb-5 empty:hidden" data-tour="revision-check"><RevisionCheckCard data={data} onChanged={reload} /></div>
    <div className="mb-5 empty:hidden" data-tour="qiraat-due"><QiraatTestsDue data={data} onOpenStudent={id => go('students', id)} /></div>
    {data.classes.length > 0 && <div className="mb-4 flex items-center gap-2"><span className="text-sm font-bold text-ink-soft">Halaqah</span><Select aria-label="Halaqah" className="!w-auto" value={activeCls} onChange={setCls} options={[['all', 'All students'], ...data.classes.map(c => [c.id, c.name] as [string, string])]} /></div>}
    {!data.students.length ? <Card><Empty icon={<Users size={32} />} title="No students yet" action={<Button onClick={() => go('students', 'new')}><UserPlus size={18} />Add your first student</Button>}>Add students yourself, or share the class code <b className="font-mono">{org.joinCode}</b> so they can join and set themselves up.</Empty></Card> : <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 text-sm" aria-label="Today in numbers">
        <Pill tone="slate">Present {present}/{ins.length}</Pill>
        <Pill tone="slate">{sessionsToday} session{sessionsToday === 1 ? '' : 's'} today</Pill>
        {attention.length > 0 && <Pill tone="amber">{attention.length} need attention</Pill>}
        {org.settings.revision.oldPlan === 'cycle' ? (ins.some(i => i.revision.weak.length) && <Pill tone="amber">{ins.filter(i => i.revision.weak.length).length} with weak pages</Pill>) : (overdueStudents > 0 && <Pill tone="amber">{overdueStudents} with overdue revision</Pill>)}
      </div>
      {attention.length > 0 && <Card>
        <CardHead title="Needs attention" />
        <ul className="mt-2 divide-y divide-line">{attention.map(i => <li key={i.student.id}><a href={href('students', i.student.id)} className="flex items-start gap-3 px-5 py-3 hover:bg-paper">
          <AlertTriangle size={18} className={i.reasons[0].severity >= 3 ? 'mt-0.5 text-bad' : 'mt-0.5 text-warn'} aria-hidden />
          <span className="min-w-0"><b className="block">{i.student.name}</b><span className="text-sm text-ink-soft">{i.reasons.map(r => r.text).join(' · ')}</span></span></a></li>)}</ul>
      </Card>}
      <div className="empty:hidden"><UpNext data={data} today={today} /></div>
      <NotifyToggle compact />
      <Card data-tour="today-students">
        <CardHead title="Today’s students" sub={`${order.filter(i => !i.recordedToday && i.attendanceToday !== 'absent').length} still to hear`} />
        <ul className="mt-3 divide-y divide-line">{(allStudents ? order : order.filter(i => !i.recordedToday && i.attendanceToday !== 'absent')).map(i => <li key={i.student.id} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <a href={href('students', i.student.id)} className="block font-bold text-ink hover:underline">{i.student.name}</a>
            <span className="block text-sm text-ink-faint">Next: {i.nextNew ? formatRange(i.nextNew) : 'all memorised'}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {i.recordedToday ? <Pill tone="green"><CheckCircle2 size={12} />Recorded</Pill> : i.attendanceToday === 'absent' ? <Pill tone="amber">Absent</Pill> : null}
              {i.revision.overdue.length > 0 && <Pill tone="amber">{i.revision.overdue.length} overdue</Pill>}
              {i.overdueAssignments.length > 0 && <Pill tone="red">assignment overdue</Pill>}
            </span>
          </div>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
            {!i.recordedToday && i.attendanceToday !== 'absent' && <Button kind="quiet" className="min-h-[40px] px-3 text-sm" onClick={() => markAbsent(i.student.id)}>Absent</Button>}
            <Button className="min-h-[40px] px-4 text-sm" onClick={() => setRec(i.student.id)}>Record</Button>
          </div>
        </li>)}</ul>
        <button type="button" onClick={() => setAllStudents(v => !v)} className="w-full border-t border-line px-5 py-3 text-left text-sm font-bold text-pine-700">{allStudents ? 'Show only students still to hear' : `Show all ${order.length} students`}</button>
      </Card>
      <details className="group rounded-2xl border border-line bg-white shadow-card">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 px-5 font-bold text-ink-soft"><span className="flex-1">More: announcements, leaderboard, charts</span><span className="text-ink-faint transition group-open:rotate-180">▾</span></summary>
        <div className="flex flex-col gap-5 border-t border-line p-4">
          <AnnouncementBoard items={data.announcements} classes={data.classes} onChanged={reload} limit={3} />
          <Leaderboard limit={5} />
          <Card className="pb-4"><CardHead title="New ayahs, last 14 days" sub="Whole class" /><div className="px-5 pt-3"><DailyBars days={days} label="ayahs a day" /></div></Card>
          <Card>
            <CardHead title="Recent errors" sub="Tagged in the last 7 days" />
            {recentErrors.length ? <ul className="mt-2 divide-y divide-line">{recentErrors.map(({ s, e }, k) => <li key={k} className="px-5 py-2.5 text-sm"><b>{nameOf(s.studentId)}</b> · {ERROR_LABEL[e.category]}{e.ayahId ? ` at ${fromAyahId(e.ayahId).surah}:${fromAyahId(e.ayahId).ayah}` : ''} <span className="text-ink-faint">· {niceDate(s.date)}</span></li>)}</ul>
              : <p className="px-5 py-4 text-sm text-ink-faint">No tagged errors this week.</p>}
          </Card>
        </div>
      </details>
    </div>}
    <StudentPicker open={pick} onClose={() => setPick(false)} insights={order} onPick={id => { setPick(false); setRec(id); }} />
    {recIns && <RecordSheet open={!!rec} onClose={() => setRec(null)} student={recIns.student} insight={recIns} sessions={data.sessions} onSaved={reload} />}
  </>;
}

function UpNext({ data, today }: { data: import('../../app/useOrgData').OrgData; today: string }) {
  const week = addDays(today, 7);
  const ev = data.events.filter(e => e.startsOn <= week && (e.endsOn ?? e.startsOn) >= today);
  const ex = data.exams.filter(x => x.status === 'scheduled' && x.scheduledOn <= week);
  const ab = data.absences.filter(a => a.date >= today && a.date <= week);
  if (!ev.length && !ex.length && !ab.length) return null;
  const name = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  return <Card><CardHead title={<span className="inline-flex items-center gap-2"><CalendarDays size={18} className="text-pine-700" />This week</span>} action={<a href={href('classes', 'calendar')} className="text-sm font-bold text-pine-700 underline">Calendar</a>} />
    <ul className="mt-2 divide-y divide-line">{ev.map(e => <li key={e.id} className="px-5 py-2.5 text-sm"><b>{e.title}</b> <span className="text-ink-faint">· {niceDate(e.startsOn)}{e.endsOn ? ` – ${niceDate(e.endsOn)}` : ''}</span></li>)}
      {ex.map(x => <li key={x.id} className="px-5 py-2.5 text-sm"><b>{x.title}</b> · {name(x.studentId)} <span className={x.scheduledOn < today ? 'text-bad' : 'text-ink-faint'}>· {x.scheduledOn < today ? 'needs result' : niceDate(x.scheduledOn)}</span></li>)}
      {ab.map(a => <li key={a.id} className="px-5 py-2.5 text-sm"><a href={href('classes', 'attendance')} className="hover:underline"><b>Absence</b> · {name(a.studentId)} <span className={a.status === 'pending' ? 'font-bold text-warn' : 'text-ink-faint'}>· {niceDate(a.date)} · {a.status === 'pending' ? 'needs your answer' : a.status}</span></a></li>)}</ul>
  </Card>;
}
