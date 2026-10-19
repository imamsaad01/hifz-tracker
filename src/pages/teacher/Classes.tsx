// Classes group students and hold the attendance register.
import { useState } from 'react';
import { Plus, Users, Pencil, CalendarCheck } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { addDays, niceDate } from '../../lib/dates';
import { Button, Card, CardHead, Spinner, ErrorBox, Empty, Modal, Field, Select, inputCls, Segmented, useToast, cx } from '../../components/ui';
import { PageTitle } from '../../components/Shell';
import { useRoute, href } from '../../app/router';
import { LiveClass } from './LiveClass';
import { CalendarView } from './Calendar';
import { friendly } from '../../api/backend';
import type { ClassRow } from '../../api/data';
import type { OrgData } from '../../app/useOrgData';

const STATUS: Array<[string, string]> = [['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['excused', 'Excused']];
export function Classes() {
  const { data, error, reload } = useOrgData();
  const route = useRoute();
  const tab = route[1] === 'live' ? 'live' : route[1] === 'calendar' ? 'calendar' : 'halaqahs';
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  return <>
    <PageTitle title={tab === 'live' ? 'Live class' : tab === 'calendar' ? 'Calendar' : 'Halaqahs'} sub={tab === 'live' ? 'One student at a time. Record, and the next one is up.' : tab === 'calendar' ? 'Class days, holidays, tests and events' : 'Groups, teachers and attendance'} />
    <nav aria-label="Class sections" className="no-print mb-5 flex gap-1 overflow-x-auto">{([['halaqahs', 'Halaqahs'], ['live', 'Live class'], ['calendar', 'Calendar']] as const).map(([k, l]) => <a key={k} href={href('classes', k)} aria-current={tab === k ? 'page' : undefined} className={cx('inline-flex min-h-[40px] shrink-0 items-center rounded-xl px-4 text-sm font-bold', tab === k ? 'bg-pine-700 text-white' : 'bg-white text-ink-soft ring-1 ring-line')}>{l}</a>)}</nav>
    {tab === 'live' && <LiveClass data={data} reload={reload} />}
    {tab === 'calendar' && <CalendarView events={data.events} exams={data.exams} students={data.students} classes={data.classes} onChanged={reload} />}
    {tab === 'halaqahs' && <Halaqahs data={data} reload={reload} />}
  </>;
}
function Halaqahs({ data, reload }: { data: OrgData; reload: () => void }) {
  const [edit, setEdit] = useState<ClassRow | 'new' | null>(null);
  const [register, setRegister] = useState<ClassRow | 'all' | null>(null);
  const teacherName = (uid: string | null) => data.members.find(m => m.userId === uid)?.displayName ?? '—';
  return <>
    <div className="mb-4 flex flex-wrap justify-end gap-2"><Button kind="secondary" onClick={() => setRegister('all')} disabled={!data.students.length}><CalendarCheck size={16} />Attendance</Button><Button onClick={() => setEdit('new')}><Plus size={18} />New halaqah</Button></div>
    {data.classes.length ? <div className="grid gap-4 md:grid-cols-2">{data.classes.map(c => <Card key={c.id}>
      <CardHead title={c.name} sub={[c.schedule, `Teacher: ${teacherName(c.teacherUserId)}`].filter(Boolean).join(' · ')} action={<Button kind="quiet" onClick={() => setEdit(c)} aria-label={`Edit ${c.name}`}><Pencil size={16} /></Button>} />
      <p className="px-5 pt-2 text-sm text-ink-soft">{c.studentIds.length ? c.studentIds.map(id => data.students.find(s => s.id === id)?.name).filter(Boolean).join(', ') : 'No students yet.'}</p>
      {c.notes && <p className="px-5 pt-1 text-sm text-ink-faint">{c.notes}</p>}
      <div className="px-5 py-4"><Button kind="secondary" onClick={() => setRegister(c)} disabled={!c.studentIds.length}><CalendarCheck size={16} />Take attendance</Button></div>
    </Card>)}</div> : <Card><Empty icon={<Users size={30} />} title="No halaqahs yet" action={<Button onClick={() => setEdit("new")}><Plus size={18} />New halaqah</Button>}>A halaqah is a group with its own teacher. Students see “Halaqah · Teacher” on their screens.</Empty></Card>}
    {edit && <ClassForm data={data} cls={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    {register && <Register data={data} cls={register === 'all' ? null : register} onClose={() => setRegister(null)} onSaved={reload} />}
  </>;
}

function ClassForm({ data, cls, onClose, onSaved }: { data: OrgData; cls: ClassRow | null; onClose: () => void; onSaved: () => void }) {
  const { api, org, user } = useOrg(); const toast = useToast();
  const staff = data.members.filter(m => m.role === 'admin' || m.role === 'teacher');
  const [name, setName] = useState(cls?.name ?? ''); const [teacher, setTeacher] = useState(cls?.teacherUserId ?? user?.id ?? '');
  const [schedule, setSchedule] = useState(cls?.schedule ?? 'Mon–Thu after Maghrib'); const [notes, setNotes] = useState(cls?.notes ?? '');
  const [ids, setIds] = useState<string[]>(cls?.studentIds ?? []); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      let id = cls?.id;
      if (cls) await api.updateClass(cls.id, { name: name.trim(), teacher_user_id: teacher || null, schedule: schedule || null, notes: notes || null });
      else id = (await api.createClass(org.id, { name: name.trim(), teacherUserId: teacher || null, schedule, startsOn: null, notes })).id as string;
      await api.setClassStudents(org.id, id!, ids, cls?.studentIds ?? []);
      toast('Class saved.'); onSaved(); onClose();
    } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title={cls ? `Edit ${cls.name}` : 'New class'} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={name.trim().length < 2} onClick={save}>Save</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Name">{id => <input id={id} className={inputCls} value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. Weekday Hifz" />}</Field>
      <Field label="Teacher">{id => <Select id={id} value={teacher} onChange={setTeacher} options={[['', 'No one yet'], ...staff.map(m => [m.userId, m.displayName ?? 'Teacher'] as [string, string])]} />}</Field>
      <Field label="When">{id => <Select id={id} value={schedule} onChange={setSchedule} options={['Mon–Thu after Maghrib', 'Mon–Fri after school', 'Weekends', 'Saturday and Sunday mornings', 'Daily before Fajr', 'Online, flexible'].map(x => [x, x] as [string, string])} />}</Field>
      <Field label="Notes (optional)">{id => <input id={id} className={inputCls} value={notes} maxLength={200} onChange={e => setNotes(e.target.value)} />}</Field>
      <fieldset><legend className="mb-2 text-sm font-bold">Students</legend>
        <div className="grid gap-1 sm:grid-cols-2">{data.students.map(s => <label key={s.id} className="flex min-h-[44px] items-center gap-3 rounded-xl px-2 hover:bg-pine-50"><input type="checkbox" className="h-5 w-5 accent-pine-700" checked={ids.includes(s.id)} onChange={e => setIds(x => e.target.checked ? [...x, s.id] : x.filter(y => y !== s.id))} />{s.name}</label>)}</div>
      </fieldset>
    </div>
  </Modal>;
}

function Register({ data, cls, onClose, onSaved }: { data: OrgData; cls: ClassRow | null; onClose: () => void; onSaved: () => void }) {
  const { api, org, today } = useOrg(); const toast = useToast();
  const [date, setDate] = useState(today); const [mode, setMode] = useState<'in_person' | 'online'>('in_person');
  const students = data.students.filter(s => !cls || cls.studentIds.includes(s.id));
  const initial = (d: string) => Object.fromEntries(students.map(s => [s.id, data.attendance.find(a => a.studentId === s.id && a.date === d)?.status ?? 'present']));
  const [marks, setMarks] = useState<Record<string, string>>(() => initial(today));
  const [busy, setBusy] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const save = async () => {
    setBusy(true);
    try { for (const s of students) await api.saveAttendance(org.id, s.id, date, marks[s.id], mode); toast(`Attendance saved for ${niceDate(date)}.`); onSaved(); onClose(); }
    catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} wide title={`Attendance${cls ? ` · ${cls.name}` : ''}`} footer={<div className="flex items-center justify-end gap-2"><span className="mr-auto text-sm text-ink-faint">{Object.values(marks).filter(v => v === 'present' || v === 'late').length}/{students.length} present</span><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Save</Button></div>}>
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <Field label="Day">{id => <Select id={id} value={date} onChange={d => { setDate(d); setMarks(initial(d)); }} options={days.map(d => [d, d === today ? `Today · ${niceDate(d)}` : niceDate(d)])} />}</Field>
      <Segmented label="Where" value={mode} onChange={setMode} options={[['in_person', 'In person'], ['online', 'Online']]} />
    </div>
    <p className="mb-2 text-sm text-ink-faint">Everyone starts as present. Tap to change.</p>
    <ul className="flex flex-col divide-y divide-line">{students.map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
      <b className="min-w-0 flex-1 basis-40">{s.name}</b>
      <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} attendance`}>{STATUS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={marks[s.id] === v} onClick={() => setMarks(m => ({ ...m, [s.id]: v }))}
        className={cx('min-h-[40px] rounded-lg px-3 text-sm font-bold ring-1 ring-inset', marks[s.id] === v ? (v === 'absent' ? 'bg-bad text-white ring-bad' : v === 'present' ? 'bg-pine-700 text-white ring-pine-700' : 'bg-brass-500 text-white ring-brass-500') : 'bg-white text-ink-soft ring-line')}>{l}</button>)}</div>
    </li>)}</ul>
  </Modal>;
}
