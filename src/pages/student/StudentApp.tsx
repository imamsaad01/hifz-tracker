// The student's own app: what to do today, self-recorded revision, progress, history and plan.
import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw, Repeat, Plus, Flame, Pencil, KeyRound } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { insight, recentRanges } from '../../lib/insights';
import { groupPages } from '../../lib/revision';
import { niceDate, hijriDate } from '../../lib/dates';
import { formatRange } from '../../quran';
import type { SessionType } from '../../lib/types';
import { Button, Card, CardHead, Spinner, ErrorBox, Pill, Stat } from '../../components/ui';
import { Overview, History } from '../../components/StudentReport';
import { AssignmentList } from '../../components/AssignmentList';
import { RecordSheet } from '../../components/RecordSheet';
import { Leaderboard } from '../../components/Leaderboard';
import { StudentForm, type StudentDraft } from '../../components/StudentForm';
import { PageTitle } from '../../components/Shell';
import { EditStudent } from '../teacher/StudentDetail';
import { friendly } from '../../api/backend';

export function StudentApp({ tab }: { tab: string }) {
  const { org, today, user, api, refreshSession } = useOrg();
  const { data, error, reload } = useOrgData();
  const me = data?.students.find(s => s.userId === user?.id) ?? null;
  const sd = useStudentData(me?.id ?? null);
  const [rec, setRec] = useState<SessionType | null>(null); const [edit, setEdit] = useState(false);
  const ins = useMemo(() => me && data && sd.sessions ? insight(me, sd.sessions, data.revision.get(me.id) ?? [], data.assignments, data.attendance, org.settings, today) : null, [me, data, sd.sessions, org.settings, today]);
  if (error || sd.error) return <ErrorBox message={(error ?? sd.error)!} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (!me) return <Onboarding onDone={async () => { await reload(); await refreshSession(); }} create={d => api.createStudent({ orgId: org.id, forSelf: true, ...d }).then(() => undefined)} name={user?.name ?? ''} />;
  if (!sd.sessions || !ins) return <Spinner />;
  const refresh = () => { reload(); sd.reload(); };
  const recent = recentRanges(sd.sessions, me.id, today, org.settings.revision.recentDays);
  const pages = (xs: number[]) => groupPages(xs.sort((a, b) => a - b)).map(([a, b]) => (a === b ? `page ${a}` : `pages ${a}–${b}`)).join(', ');
  const goals = data.goals.filter(g => g.studentId === me.id);
  return <>
    {tab === 'home' && <>
      <PageTitle title={`Assalamu alaikum, ${me.name.split(' ')[0]}`} sub={<>{niceDate(today)} · {hijriDate(today)}</>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Streak" value={<span className="inline-flex items-center gap-1.5"><Flame size={20} className="text-brass-500" />{ins.streak}</span>} sub={`Best: ${ins.longest} days`} />
        <Stat label="Memorised" value={`${(ins.progress.percent * 100).toFixed(1)}%`} sub={`${ins.progress.pages} pages`} />
        <Stat label="Due today" value={ins.revision.today.length} sub="pages of Old revision" tone={ins.revision.overdue.length ? 'warn' : undefined} />
        <Stat label="Open assignments" value={ins.openAssignments.length} tone={ins.overdueAssignments.length ? 'bad' : undefined} />
      </div>
      <h2 className="mb-3 text-lg font-bold">Today’s plan</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <PlanCard icon={<BookOpen size={20} />} title="New" body={ins.nextNew ? formatRange(ins.nextNew) : 'All memorised'} note="Learn it, then read it to your teacher. Your teacher records New." />
        <PlanCard icon={<Repeat size={20} />} title="Recent" body={recent.length ? recent.map(formatRange).join(' · ') : 'Nothing new in the last week'} note={`Everything you learned in the last ${org.settings.revision.recentDays} days.`} action={recent.length ? <Button kind="secondary" onClick={() => setRec('recent')}><Plus size={16} />I revised this</Button> : null} />
        <PlanCard icon={<RotateCcw size={20} />} title="Old" body={ins.revision.today.length ? pages(ins.revision.today.map(r => r.page)) : 'Nothing due today'} note={ins.revision.overdue.length ? `${ins.revision.overdue.length} page${ins.revision.overdue.length > 1 ? 's are' : ' is'} overdue. Most overdue come first.` : 'Pages come back sooner if they had mistakes.'} action={ins.revision.today.length ? <Button onClick={() => setRec('old')}><Plus size={16} />I revised this</Button> : null} />
      </div>
      <Card className="mt-5"><CardHead title="Assignments" sub="Mark them done; your teacher reviews them" /><AssignmentList items={ins.openAssignments.concat(data.assignments.filter(a => a.studentId === me.id && a.status === 'completed'))} asStudent onChanged={reload} /></Card>
      <div className="mt-5"><Leaderboard limit={5} compact /></div>
      {ins.lastSession && <Card className="mt-5 p-5"><p className="text-xs font-bold uppercase text-ink-faint">Last session · {niceDate(ins.lastSession.date)}</p><p className="mt-1">{formatRange(ins.lastSession.range)} · {ins.lastSession.errorsMajor + ins.lastSession.errorsMinor} errors</p>{ins.lastSession.teacherNote && <p className="mt-1 text-pine-800"><b>Teacher:</b> {ins.lastSession.teacherNote}</p>}</Card>}
    </>}
    {tab === 'progress' && <><PageTitle title="My progress" /><div className="mb-5"><Leaderboard /></div><Overview ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={goals} today={today} settings={org.settings} /></>}
    {tab === 'history' && <><PageTitle title="My sessions" /><History student={me} sessions={sd.sessions} today={today} settings={org.settings} /></>}
    {tab === 'me' && <>
      <PageTitle title="My plan" action={<Button kind="secondary" onClick={() => setEdit(true)}><Pencil size={16} />Change</Button>} />
      <Card className="flex flex-col gap-2 p-5 text-[15px]">
        <p><b>New a day:</b> {me.dailyNewAyahs} ayahs</p>
        <p><b>Order:</b> {me.direction === 'back' ? 'From An-Nās backwards' : 'From Al-Fātiḥah forwards'}</p>
        <p><b>Goal:</b> {me.goal || '—'}</p>
        <p><b>Parent:</b> {me.guardianName || '—'} {me.guardianEmail && <span className="text-ink-faint">({me.guardianEmail}{me.notify ? ', gets emails' : ''})</span>}</p>
      </Card>
      <Card className="mt-4 flex items-start gap-3 p-5"><KeyRound size={18} className="mt-1 text-ink-faint" /><p className="text-[15px]"><b>Parent code:</b> <span className="font-mono tracking-widest">{me.parentCode}</span><br /><span className="text-sm text-ink-faint">Give this to a parent. They create an account and enter it to follow your progress. They cannot change anything.</span></p></Card>
      <p className="mt-4 text-sm text-ink-faint">Program: {org.name}. Only your teachers, you and linked parents can see your records.</p>
      {edit && <EditStudent st={me} asStudent onClose={() => setEdit(false)} onSaved={refresh} />}
    </>}
    {rec && <RecordSheet open onClose={() => setRec(null)} student={me} insight={ins} sessions={sd.sessions} asStudent initialType={rec} onSaved={refresh} />}
  </>;
}
function PlanCard({ icon, title, body, note, action }: { icon: React.ReactNode; title: string; body: string; note: string; action?: React.ReactNode }) {
  return <Card className="flex flex-col gap-2 p-5"><div className="flex items-center gap-2 text-pine-700">{icon}<h3 className="text-lg font-bold text-ink">{title}</h3></div><p className="text-[17px] font-bold">{body}</p><p className="text-sm text-ink-faint">{note}</p>{action && <div className="mt-auto pt-2">{action}</div>}</Card>;
}
function Onboarding({ create, onDone, name }: { create: (d: StudentDraft) => Promise<void>; onDone: () => Promise<void>; name: string }) {
  return <div className="mx-auto max-w-xl">
    <PageTitle title="Let’s set up your hifz" sub="Four quick questions, so your teacher has everything before your first lesson." />
    <StudentForm defaultName={name} onSubmit={async d => { try { await create(d); await onDone(); } catch (e) { throw new Error(friendly(e)); } }} />
    <p className="mt-3"><Pill>You can change these later</Pill></p>
  </div>;
}
