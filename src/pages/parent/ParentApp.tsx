// Parents: read-only view of their linked children, plus messages with the teacher.
import { DisplaySettings } from '../../components/DisplaySettings';
import { ParentWeekCard } from '../../components/WeeklyRevision';
import { WeakAyahsCard } from '../../components/PartnerRevision';
import { weekSummary } from '../../lib/weekly';
import { weekStart } from '../../lib/schedule';
import { useMemo, useState } from 'react';
import { Users, Award } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { href } from '../../app/router';
import { insight } from '../../lib/insights';
import { studentPlan, classLabel } from '../../lib/studentPlan';
import { points, level, badges } from '../../lib/motivation';
import { streakDetail } from '../../lib/progress';
import { Card, CardHead, Spinner, ErrorBox, Empty, Field, Select, Segmented } from '../../components/ui';
import { Overview, History, MonthReport } from '../../components/StudentReport';
import { AssignmentList } from '../../components/AssignmentList';
import { PageTitle } from '../../components/Shell';
import { Leaderboard } from '../../components/Leaderboard';
import { PlanCard, ClassBadge } from '../../components/PlanCard';
import { LevelBar, BadgeGrid } from '../../components/Motivation';
import { AnnouncementBoard } from '../../components/Announcements';
import { HalaqahChooser } from '../../components/HalaqahJoin';
import { QiraatStudentCard } from '../../components/Qiraat';
import { MyRevisionLog, startLabel } from '../../components/RevisionSelf';
import { startTour } from '../../components/Tour';
import { MessageThread } from '../../components/MessageThread';
import { AdabSummary } from '../../components/Adab';
import { ExamList } from '../teacher/Exams';
import { certificatesFor } from '../Certificate';
import { StandingCard, RevisionFormCard, RulesCard, AbsenceForm, missedLastWeek } from '../../components/StudentAttendance';
import { NotifyToggle } from '../../components/Notifications';
import { Button } from '../../components/ui';
import { CalendarX } from 'lucide-react';

type Tab = 'overview' | 'history' | 'messages' | 'report';
export function ParentApp() {
  const { org, today } = useOrg();
  const { data, error, reload } = useOrgData();
  const [pick, setPick] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [absent, setAbsent] = useState(false);
  const child = data?.students.find(s => s.id === pick) ?? data?.students[0] ?? null;
  const sd = useStudentData(child?.id ?? null);
  const ins = useMemo(() => child && data && sd.sessions ? insight(child, sd.sessions, data.revision.get(child.id) ?? [], data.assignments, data.attendance, org.settings, today) : null, [child, data, sd.sessions, org.settings, today]);
  if (error || sd.error) return <ErrorBox message={(error ?? sd.error)!} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (!child) return <Card><Empty icon={<Users size={30} />} title="No children linked yet">Ask the teacher for your child’s 10-character parent code, sign out, and join with it.</Empty></Card>;
  if (!sd.sessions || !ins) return <Spinner />;
  const cl = classLabel(child.id, data.classes, data.members, org.name);
  const classIds = data.classes.filter(c => c.studentIds.includes(child.id)).map(c => c.id);
  const beh = data.behaviour.filter(b => b.studentId === child.id);
  const pts = points(sd.sessions, beh); const sk = streakDetail(sd.sessions.map(s => s.date), today, org.settings.motivation.freezePerWeek);
  const certs = certificatesFor(child, sd.milestones);
  return <>
    <PageTitle title={child.name} sub="Read-only" />
    <div className="mb-4"><ClassBadge title={cl.title} teacher={cl.teacher} /></div>
    <div className="no-print mb-5 grid gap-3 sm:grid-cols-[1fr_2fr] sm:items-end">
      {data.students.length > 1 ? <Field label="Child">{id => <Select id={id} value={child.id} onChange={setPick} options={data.students.map(s => [s.id, s.name])} />}</Field> : <span />}
      <Segmented label="Section" value={tab} onChange={setTab} options={[['overview', 'Progress'], ['history', 'Sessions'], ['messages', 'Messages'], ['report', 'Report']]} />
    </div>
    {tab === 'overview' && <div className="flex flex-col gap-5">
      {(() => { const ws = weekStart(today); const mine = sd.sessions.filter(x => x.studentId === child.id);
        const w = weekSummary(mine, today, org.settings.revision.days?.length ? org.settings.revision.days : [0, 1, 2, 3, 4, 5, 6], ins.revision.perDay, false);
        const att = data.attendance.filter(a => a.studentId === child.id && a.date >= ws);
        const note = mine.filter(x => x.date >= ws && x.teacherNote).sort((a, b) => b.date.localeCompare(a.date))[0]?.teacherNote ?? null;
        return <ParentWeekCard name={child.name} w={w} newLessons={mine.filter(x => x.date >= ws && x.type === 'new' && (!x.selfLogged || x.checkStatus === 'ok')).length} present={att.filter(a => a.status === 'present' || a.status === 'late').length} classes={att.length} note={note} />; })()}
      <div className="empty:hidden"><WeakAyahsCard sessions={sd.sessions} studentId={child.id} you={false} /></div>
      <div className="empty:hidden" data-tour="announcements"><AnnouncementBoard items={data.announcements} classes={data.classes} studentClassIds={classIds} onChanged={reload} limit={3} fresh /></div>
      {!classIds.length && <HalaqahChooser student={child} data={data} onChanged={reload} forChild />}
      <div className="flex flex-wrap gap-2" data-tour="absence"><Button kind="secondary" onClick={() => setAbsent(true)}><CalendarX size={16} />Report an absence</Button><Button kind="quiet" onClick={startTour}>App tour</Button></div>
      <div className="empty:hidden" data-tour="notify"><NotifyToggle /></div>
      <StandingCard studentId={child.id} you={false} revisionMissed={missedLastWeek(child.id, data.revisionForms, org.settings.revisionForm.slots, today)} />
      <RevisionFormCard student={child} forms={data.revisionForms} readOnly onChanged={reload} />
      <div className="empty:hidden" data-tour="qiraat"><QiraatStudentCard student={child} data={data} onChanged={reload} readOnly /></div>
      <div data-tour="revision-log"><MyRevisionLog studentId={child.id} sessions={sd.sessions} start={startLabel(child)} /></div>
      {ins.openAssignments.length > 0 && <Card><h2 className="px-5 pt-4 font-bold">Assignments</h2><AssignmentList items={ins.openAssignments} onChanged={reload} /></Card>}
      <details className="group rounded-2xl border border-line bg-white shadow-card">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 px-5 font-bold text-ink-soft"><span className="flex-1">More: plan, progress charts, badges, tests</span><span className="text-ink-faint transition group-open:rotate-180">▾</span></summary>
        <div className="flex flex-col gap-5 border-t border-line p-4">
      <PlanCard plan={studentPlan(child, org.settings, today)} you={false} />
      <div className="grid gap-5 xl:grid-cols-2"><Card className="p-5"><LevelBar total={pts.total} lvl={level(pts.total)} streak={sk.days} freezes={org.settings.motivation.freezePerWeek} frozenDays={sk.frozen.length} /></Card><AdabSummary points={beh} /></div>
      <Overview ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={data.goals.filter(g => g.studentId === child.id)} today={today} />
      <BadgeGrid items={badges(sd.sessions, beh, sd.milestones, child.memorized)} />
      {certs.length > 0 && <Card><CardHead title="Certificates" /><div className="flex flex-wrap gap-2 px-5 py-4">{certs.map(c => <a key={c.code} href={href('certificate', child.id, c.code)} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-brass-100 px-3 text-sm font-bold text-brass-700"><Award size={16} />{c.title}</a>)}</div></Card>}
      {data.exams.some(x => x.studentId === child.id) && <div><h2 className="mb-2 font-bold">Juz tests</h2><ExamList exams={data.exams} students={data.students} fixedStudent={child.id} onChanged={reload} /></div>}
          <Leaderboard limit={5} compact />
        </div>
      </details>
      <RulesCard compact text={org.settings.rulesText} ackAt={null} />
      <DisplaySettings />
    </div>}
    {absent && <AbsenceForm student={child} classes={data.classes} absences={data.absences} onClose={() => setAbsent(false)} onSaved={reload} />}
    {tab === 'history' && <History student={child} sessions={sd.sessions} today={today} settings={org.settings} />}
    {tab === 'messages' && <MessageThread studentId={child.id} studentName={child.name} members={data.members} />}
    {tab === 'report' && <MonthReport student={child} ins={ins} sessions={sd.sessions} today={today} settings={org.settings} orgName={org.name} />}
  </>;
}
