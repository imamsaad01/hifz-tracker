import { useMemo, useState } from 'react';
import { UserPlus, Search, Users, Download } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useRoute, go, href } from '../../app/router';
import { insight } from '../../lib/insights';
import { niceDate } from '../../lib/dates';
import { downloadCsv } from '../../lib/csv';
import { formatRange } from '../../quran';
import { Button, Card, Pill, Progress, Spinner, ErrorBox, Empty, Modal, Select, inputCls, Field, useToast } from '../../components/ui';
import { StudentForm, type StudentDraft } from '../../components/StudentForm';
import { PageTitle } from '../../components/Shell';
import { friendly } from '../../api/backend';

export function Students() {
  const { org, today, api } = useOrg();
  const { data, error, reload } = useOrgData();
  const route = useRoute();
  const toast = useToast();
  const [q, setQ] = useState(''); const [cls, setCls] = useState('all'); const [sort, setSort] = useState('name');
  const ins = useMemo(() => data ? data.students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const adding = route[1] === 'new';
  const inClass = cls === 'all' ? null : new Set(data.classes.find(c => c.id === cls)?.studentIds ?? []);
  const list = ins.filter(i => i.student.name.toLowerCase().includes(q.toLowerCase()) && (!inClass || inClass.has(i.student.id)))
    .sort((a, b) => sort === 'progress' ? b.progress.ayahs - a.progress.ayahs : sort === 'attention' ? (b.reasons[0]?.severity ?? 0) - (a.reasons[0]?.severity ?? 0) : sort === 'last' ? (a.lastSession?.date ?? '').localeCompare(b.lastSession?.date ?? '') : a.student.name.localeCompare(b.student.name));
  const add = async (d: StudentDraft) => {
    try {
      const id = await api.createStudent({ orgId: org.id, forSelf: false, ...d });
      if (id && d.newPages) await api.updateStudent(id, { new_pages: d.newPages });
      if (d.qiraat && id) await api.setQiraat(id, d.qiraat);
      toast(`${d.name} added.`); await reload(); go('students', id);
    } catch (e) { throw new Error(friendly(e)); }
  };
  const exportAll = () => downloadCsv(`${org.name} students.csv`, list.map(i => ({ name: i.student.name, age_group: i.student.ageGroup ?? '', memorised_pct: (i.progress.percent * 100).toFixed(1), pages: i.progress.pages, juz: i.progress.juz, next_lesson: i.nextNew ? formatRange(i.nextNew) : '', last_session: i.lastSession?.date ?? '', streak: i.streak, overdue_pages: i.revision.overdue.length, accuracy_30d: i.avgAccuracy30 ?? '', attendance_30d: i.attendanceRate30 === null ? '' : Math.round(i.attendanceRate30 * 100), parent_email: i.student.guardianEmail ?? '' })));
  return <>
    <PageTitle title="Students" sub={`${data.students.length} active`} action={<div className="flex gap-2"><Button kind="secondary" onClick={exportAll} disabled={!list.length}><Download size={16} />CSV</Button><Button onClick={() => go('students', 'new')}><UserPlus size={18} />Add student</Button></div>} />
    <Card>
      <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="relative self-end"><Search size={16} className="absolute left-3 top-3.5 text-ink-faint" aria-hidden /><input className={`${inputCls} pl-9`} placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search by name" /></div>
        <Field label="Class">{id => <Select id={id} value={cls} onChange={setCls} options={[['all', 'All classes'], ...data.classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>
        <Field label="Sort">{id => <Select id={id} value={sort} onChange={setSort} options={[['name', 'Name'], ['attention', 'Needs attention'], ['progress', 'Most memorised'], ['last', 'Longest since last session']]} />}</Field>
      </div>
      {list.length ? <ul className="divide-y divide-line">{list.map(i => <li key={i.student.id}><a href={href('students', i.student.id)} className="grid gap-2 px-5 py-3.5 hover:bg-paper sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
        <span className="min-w-0"><b className="block">{i.student.name}{data.qiraat.profiles.some(p => p.studentId === i.student.id && p.active) && <span className="ml-2 rounded-full bg-brass-100 px-2 py-0.5 align-middle text-[11px] font-bold text-brass-700">Qirāʾāt</span>}</b><span className="text-sm text-ink-faint">{i.lastSession ? `Last session ${niceDate(i.lastSession.date)}` : 'No sessions yet'}{i.student.userId ? '' : ' · no account'}</span></span>
        <span className="flex items-center gap-2"><Progress value={i.progress.percent} label={`${i.student.name} memorised`} /><span className="w-24 shrink-0 text-right text-sm tabular-nums text-ink-soft">{i.progress.pages} pages</span></span>
        <span className="flex flex-wrap gap-1 sm:justify-end">{i.reasons.filter(r => r.severity >= 2).slice(0, 2).map(r => <Pill key={r.kind} tone={r.severity >= 3 ? 'red' : 'amber'}>{r.text}</Pill>)}{i.streak >= 3 && <Pill tone="green">{i.streak}-day streak</Pill>}</span>
      </a></li>)}</ul> : <Empty icon={<Users size={30} />} title={data.students.length ? 'No students match' : 'No students yet'}>{data.students.length ? 'Try a different name or class.' : <>Add a student, or share the student code <b className="font-mono">{org.joinCode}</b>.</>}</Empty>}
    </Card>
    <Modal open={adding} onClose={() => go('students')} title="Add a student" wide>
      <StudentForm byTeacher onSubmit={add} onCancel={() => go('students')} />
    </Modal>
  </>;
}
