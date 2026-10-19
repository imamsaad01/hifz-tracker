// Parents: read-only view of their linked children.
import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { insight } from '../../lib/insights';
import { Card, Spinner, ErrorBox, Empty, Field, Select, Segmented } from '../../components/ui';
import { Overview, History, MonthReport } from '../../components/StudentReport';
import { AssignmentList } from '../../components/AssignmentList';
import { PageTitle } from '../../components/Shell';
import { Leaderboard } from '../../components/Leaderboard';

export function ParentApp() {
  const { org, today } = useOrg();
  const { data, error, reload } = useOrgData();
  const [pick, setPick] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'history' | 'report'>('overview');
  const child = data?.students.find(s => s.id === pick) ?? data?.students[0] ?? null;
  const sd = useStudentData(child?.id ?? null);
  const ins = useMemo(() => child && data && sd.sessions ? insight(child, sd.sessions, data.revision.get(child.id) ?? [], data.assignments, data.attendance, org.settings, today) : null, [child, data, sd.sessions, org.settings, today]);
  if (error || sd.error) return <ErrorBox message={(error ?? sd.error)!} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (!child) return <Card><Empty icon={<Users size={30} />} title="No children linked yet">Ask the teacher for your child’s 10-character parent code, sign out, and join with it.</Empty></Card>;
  if (!sd.sessions || !ins) return <Spinner />;
  return <>
    <PageTitle title={child.name} sub={`${org.name} · read-only`} />
    <div className="no-print mb-5 grid gap-3 sm:grid-cols-[1fr_2fr] sm:items-end">
      {data.students.length > 1 ? <Field label="Child">{id => <Select id={id} value={child.id} onChange={setPick} options={data.students.map(s => [s.id, s.name])} />}</Field> : <span />}
      <Segmented label="Section" value={tab} onChange={setTab} options={[['overview', 'Progress'], ['history', 'Sessions'], ['report', 'Monthly report']]} />
    </div>
    {tab === 'overview' && <>
      <Overview ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={data.goals.filter(g => g.studentId === child.id)} today={today} settings={org.settings} />
      <div className="mt-5"><Leaderboard limit={5} compact /></div>
      <Card className="mt-5"><h2 className="px-5 pt-4 font-bold">Assignments</h2><AssignmentList items={ins.openAssignments} onChanged={reload} /></Card>
    </>}
    {tab === 'history' && <History student={child} sessions={sd.sessions} today={today} settings={org.settings} />}
    {tab === 'report' && <MonthReport student={child} ins={ins} sessions={sd.sessions} today={today} settings={org.settings} orgName={org.name} />}
  </>;
}
