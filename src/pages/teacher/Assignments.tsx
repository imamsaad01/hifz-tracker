import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useRoute, go } from '../../app/router';
import { insight } from '../../lib/insights';
import { Button, Card, Spinner, ErrorBox, Field, Select } from '../../components/ui';
import { AssignmentForm } from '../../components/AssignmentForm';
import { AssignmentList } from '../../components/AssignmentList';
import { PageTitle } from '../../components/Shell';
import { ExamList } from './Exams';
import { RevisionForms } from './AttendancePage';
import { href } from '../../app/router';
import { cx } from '../../components/ui';

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
  const tabs = <nav aria-label="Work sections" className="no-print mb-5 flex gap-1">{([['', 'Assignments'], ['revision', 'Revision forms'], ['tests', 'Juz tests']] as const).map(([k, l]) => { const on = (route[1] === 'tests' || route[1] === 'revision' ? route[1] : '') === k; return <a key={k} href={k ? href('assignments', k) : href('assignments')} aria-current={on ? 'page' : undefined} className={cx('inline-flex min-h-[40px] items-center rounded-xl px-4 text-sm font-bold', on ? 'bg-pine-700 text-white' : 'bg-white text-ink-soft ring-1 ring-line')}>{l}</a>; })}</nav>;
  if (route[1] === 'revision') return <><PageTitle title="Revision forms" sub="Partner revision each week: who did it, with whom, and who needs a follow-up" />{tabs}<RevisionForms data={data} /></>;
  if (route[1] === 'tests') return <><PageTitle title="Juz tests" sub="Schedule a test when a juz is finished; record pass or retake" />{tabs}<ExamList exams={data.exams} students={data.students} onChanged={reload} /></>;
  return <>
    <PageTitle title="Assignments" sub={toReview ? `${toReview} waiting for your review` : 'Set work, then review it when students mark it done'} action={<Button onClick={() => go('assignments', 'new')} disabled={!data.students.length}><Plus size={18} />New assignment</Button>} />
    {tabs}
    <Card>
      <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2">
        <Field label="Show">{id => <Select id={id} value={show} onChange={setShow} options={[['open', 'Open'], ['overdue', 'Overdue'], ['review', 'Done — waiting for review'], ['done', 'Reviewed'], ['all', 'Everything']]} />}</Field>
        <Field label="Student">{id => <Select id={id} value={sid} onChange={setSid} options={[['all', 'All students'], ...data.students.map(s => [s.id, s.name] as [string, string])]} />}</Field>
      </div>
      <AssignmentList items={list} nameOf={nameOf} onChanged={reload} />
    </Card>
    {route[1] === 'new' && data.students.length > 0 && <AssignmentForm open onClose={() => go('assignments')} insights={ins} onSaved={reload} />}
  </>;
}
