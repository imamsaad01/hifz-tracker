// "Who needs my attention today?" — the teacher's home, with one-tap recording.
import { useMemo, useState } from 'react';
import { Plus, UserPlus, ClipboardList, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { insight } from '../../lib/insights';
import { addDays, niceDate, hijriDate } from '../../lib/dates';
import { formatRange, fromAyahId } from '../../quran';
import { groupPages } from '../../lib/revision';
import { ERROR_LABEL } from '../../lib/types';
import { Button, Card, CardHead, Stat, Pill, Spinner, ErrorBox, Empty, useToast } from '../../components/ui';
import { DailyBars } from '../../components/quran';
import { RecordSheet } from '../../components/RecordSheet';
import { StudentPicker } from '../../components/StudentPicker';
import { Leaderboard } from '../../components/Leaderboard';
import { PageTitle } from '../../components/Shell';
import { href, go } from '../../app/router';
import { friendly } from '../../api/backend';

export function Today() {
  const { org, today, api } = useOrg();
  const { data, error, reload } = useOrgData();
  const toast = useToast();
  const [pick, setPick] = useState(false);
  const [rec, setRec] = useState<string | null>(null);
  const ins = useMemo(() => data ? data.students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const present = data.attendance.filter(a => a.date === today && (a.status === 'present' || a.status === 'late')).length;
  const sessionsToday = data.sessions.filter(s => s.date === today).length;
  const attention = ins.filter(i => i.reasons.some(r => r.severity >= 2)).sort((a, b) => b.reasons[0].severity - a.reasons[0].severity);
  const overdueStudents = ins.filter(i => i.revision.overdue.length > 0).length;
  const order = [...ins].sort((a, b) => Number(a.recordedToday) - Number(b.recordedToday) || (b.reasons[0]?.severity ?? 0) - (a.reasons[0]?.severity ?? 0) || a.student.name.localeCompare(b.student.name));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map(d => ({ date: d, value: data.sessions.filter(s => s.date === d && s.type === 'new').reduce((n, s) => n + s.range.end - s.range.start + 1, 0) }));
  const recentErrors = data.sessions.filter(s => s.date >= addDays(today, -6)).flatMap(s => s.errors.map(e => ({ s, e }))).slice(0, 8);
  const nameOf = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  const recIns = ins.find(i => i.student.id === rec);
  const markAbsent = async (sid: string) => { try { await api.saveAttendance(org.id, sid, today, 'absent', 'in_person'); toast('Marked absent.'); reload(); } catch (e) { toast(friendly(e), 'err'); } };

  return <>
    <PageTitle title="Today" sub={<>{niceDate(today)} · {hijriDate(today)}</>} action={<div className="flex flex-wrap gap-2"><Button onClick={() => setPick(true)}><Plus size={18} />Record session</Button><Button kind="secondary" onClick={() => go('assignments', 'new')}><ClipboardList size={18} />Assign</Button><Button kind="secondary" onClick={() => go('students', 'new')}><UserPlus size={18} />Add student</Button></div>} />
    {!data.students.length ? <Card><Empty icon={<Users size={32} />} title="No students yet" action={<Button onClick={() => go('students', 'new')}><UserPlus size={18} />Add your first student</Button>}>Add students yourself, or share the class code <b className="font-mono">{org.joinCode}</b> so they can join and set themselves up.</Empty></Card> : <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Present today" value={`${present}/${data.students.length}`} />
        <Stat label="Sessions today" value={sessionsToday} />
        <Stat label="Need attention" value={attention.length} tone={attention.length ? 'warn' : undefined} />
        <Stat label="Overdue revision" value={overdueStudents} sub="students with overdue pages" tone={overdueStudents ? 'warn' : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHead title="Today’s students" sub="Not yet recorded first. Tap Record: everything is filled in." />
          <ul className="mt-3 divide-y divide-line">{order.map(i => <li key={i.student.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <a href={href('students', i.student.id)} className="block font-bold text-ink hover:underline">{i.student.name}</a>
              <span className="block text-sm text-ink-faint">Next: {i.nextNew ? formatRange(i.nextNew) : 'all memorised'}{i.revision.today.length ? ` · revise ${groupPages(i.revision.today.map(r => r.page)).map(([a, b]) => a === b ? `p. ${a}` : `pp. ${a}–${b}`).join(', ')}` : ''}</span>
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
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHead title="Needs attention" />
            {attention.length ? <ul className="mt-2 divide-y divide-line">{attention.map(i => <li key={i.student.id}><a href={href('students', i.student.id)} className="flex items-start gap-3 px-5 py-3 hover:bg-paper">
              <AlertTriangle size={18} className={i.reasons[0].severity >= 3 ? 'mt-0.5 text-bad' : 'mt-0.5 text-warn'} aria-hidden />
              <span className="min-w-0"><b className="block">{i.student.name}</b><span className="text-sm text-ink-soft">{i.reasons.map(r => r.text).join(' · ')}</span></span></a></li>)}</ul>
              : <p className="flex items-center gap-2 px-5 py-4 text-sm text-good"><CheckCircle2 size={16} />Everyone is on track.</p>}
          </Card>
          <Leaderboard limit={5} />
          <Card className="pb-4"><CardHead title="New ayahs, last 14 days" sub="Whole class" /><div className="px-5 pt-3"><DailyBars days={days} label="ayahs a day" /></div></Card>
          <Card>
            <CardHead title="Recent errors" sub="Tagged in the last 7 days" />
            {recentErrors.length ? <ul className="mt-2 divide-y divide-line">{recentErrors.map(({ s, e }, k) => <li key={k} className="px-5 py-2.5 text-sm"><b>{nameOf(s.studentId)}</b> · {ERROR_LABEL[e.category]}{e.ayahId ? ` at ${fromAyahId(e.ayahId).surah}:${fromAyahId(e.ayahId).ayah}` : ''} <span className="text-ink-faint">· {niceDate(s.date)}</span></li>)}</ul>
              : <p className="px-5 py-4 text-sm text-ink-faint">No tagged errors this week.</p>}
          </Card>
        </div>
      </div>
    </div>}
    <StudentPicker open={pick} onClose={() => setPick(false)} insights={order} onPick={id => { setPick(false); setRec(id); }} />
    {recIns && <RecordSheet open={!!rec} onClose={() => setRec(null)} student={recIns.student} insight={recIns} sessions={data.sessions} onSaved={reload} />}
  </>;
}
