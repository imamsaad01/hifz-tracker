import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useRoute, go } from '../../app/router';
import { insight } from '../../lib/insights';
import { Button, Card, Spinner, ErrorBox, SubNav, SubTabs } from '../../components/ui';
import { AssignmentForm } from '../../components/AssignmentForm';
import { AssignmentList } from '../../components/AssignmentList';
import { PageTitle } from '../../components/Shell';
import { ExamList } from './Exams';
import { RevisionForms } from './AttendancePage';
import { href } from '../../app/router';

export function Assignments() {
  const { org, today } = useOrg();
  const { data, error, reload } = useOrgData();
  const route = useRoute();
  const [show, setShow] = useState('open'); const [sid, setSid] = useState('all');
  const ins = useMemo(() => data ? data.students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const nameOf = (id: string) => data.students.find(s => s.id === id)?.name ?? 'Archived student';
  const list = data.assignments.filter(a => (sid === 'all' || a.studentId === sid) && (
    show === 'open' ? a.status === 'assigned' || a.status === 'started' : show === 'overdue' ? (a.status === 'assigned' || a.status === 'started') && a.dueOn < today : show === 'review' ? a.status === 'completed' : show === 'done' ? a.status === 'reviewed' : true))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.priority - b.priority);
  const toReview = data.assignments.filter(a => a.status === 'completed').length;
  const tabs = <SubNav label="Task sections" active={(route[1] === 'tests' || route[1] === 'revision' ? route[1] : '') as '' | 'revision' | 'tests'} href={k => (k ? href('assignments', k) : href('assignments'))}
    items={[{ key: '', label: 'Assignments' }, { key: 'revision', label: 'Revision forms' }, { key: 'tests', label: 'Juz tests' }]} />;
  if (route[1] === 'revision') return <><PageTitle title="Revision forms" sub="Partner revision each week: who did it, with whom, and who needs a follow-up" />{tabs}<RevisionForms data={data} /></>;
  if (route[1] === 'tests') return <><PageTitle title="Juz tests" sub="Schedule a test when a juz is finished; record pass or retake" />{tabs}<ExamList exams={data.exams} students={data.students} onChanged={reload} /></>;
  return <>
    <PageTitle title="Assignments" sub={toReview ? `${toReview} waiting for your review` : 'Set work, then review it when students mark it done'} action={<Button onClick={() => go('assignments', 'new')} disabled={!data.students.length}><Plus size={18} />New assignment</Button>} />
    {tabs}
    <Card>
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:px-5">
        <SubTabs label="Show" className="mb-0" active={show} onChange={setShow} items={[{ key: 'open', label: 'Open' }, { key: 'overdue', label: 'Overdue' }, { key: 'review', label: 'To review' }, { key: 'done', label: 'Reviewed' }, { key: 'all', label: 'All' }]} />
        <select aria-label="Student" value={sid} onChange={e => setSid(e.target.value)} className="h-11 self-start rounded-full bg-white px-4 text-sm font-bold text-ink-soft ring-1 ring-line"><option value="all">All students</option>{data.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <AssignmentList items={list} nameOf={nameOf} onChanged={reload} />
    </Card>
    {route[1] === 'new' && data.students.length > 0 && <AssignmentForm open onClose={() => go('assignments')} insights={ins} onSaved={reload} />}
  </>;
}
