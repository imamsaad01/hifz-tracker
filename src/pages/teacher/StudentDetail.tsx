import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, ClipboardList, Target, Pencil, Archive, KeyRound, RefreshCw } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { href, go } from '../../app/router';
import { insight } from '../../lib/insights';
import { METRIC_LABEL } from '../../lib/goals';
import { Button, Card, Spinner, ErrorBox, Segmented, Modal, Field, Select, inputCls, Toggle, Confirm, useToast } from '../../components/ui';
import { Overview, History, MonthReport } from '../../components/StudentReport';
import { AssignmentForm } from '../../components/AssignmentForm';
import { AssignmentList } from '../../components/AssignmentList';
import { RecordSheet } from '../../components/RecordSheet';
import { PageTitle } from '../../components/Shell';
import { friendly } from '../../api/backend';
import type { Session, Student } from '../../lib/types';

type Tab = 'overview' | 'history' | 'assignments' | 'report';
export function StudentDetail({ id }: { id: string }) {
  const { org, today, api } = useOrg();
  const { data, error, reload } = useOrgData();
  const sd = useStudentData(id);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [rec, setRec] = useState(false); const [assign, setAssign] = useState(false); const [goal, setGoal] = useState(false); const [edit, setEdit] = useState(false);
  const [archive, setArchive] = useState(false); const [del, setDel] = useState<Session | null>(null);
  const allIns = useMemo(() => data ? data.students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today]);
  const st = data?.students.find(s => s.id === id);
  const ins = useMemo(() => st && data && sd.sessions ? insight(st, sd.sessions, data.revision.get(st.id) ?? [], data.assignments, data.attendance, org.settings, today) : null, [st, data, sd.sessions, org.settings, today]);
  if (error || sd.error) return <ErrorBox message={(error ?? sd.error)!} onRetry={() => { reload(); sd.reload(); }} />;
  if (!data || !sd.sessions) return <Spinner />;
  if (!st || !ins) return <ErrorBox message="This student was not found, or has been archived." />;
  const refresh = () => { reload(); sd.reload(); };
  const goals = data.goals.filter(g => g.studentId === id);
  const assignments = data.assignments.filter(a => a.studentId === id).sort((a, b) => b.dueOn.localeCompare(a.dueOn));
  return <>
    <a href={href('students')} className="no-print mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink-faint hover:text-ink"><ArrowLeft size={16} />Students</a>
    <PageTitle title={st.name} sub={[st.ageGroup, st.goal && `Goal: ${st.goal}`, `${st.dailyNewAyahs} new ayahs a day`, st.direction === 'back' ? 'from An-Nās backwards' : 'from Al-Fātiḥah forwards'].filter(Boolean).join(' · ')}
      action={<div className="no-print flex flex-wrap gap-2"><Button onClick={() => setRec(true)}><Plus size={18} />Record</Button><Button kind="secondary" onClick={() => setAssign(true)}><ClipboardList size={16} />Assign</Button><Button kind="secondary" onClick={() => setGoal(true)}><Target size={16} />Goal</Button><Button kind="secondary" onClick={() => setEdit(true)}><Pencil size={16} />Edit</Button></div>} />
    <div className="no-print mb-5"><Segmented label="Section" value={tab} onChange={setTab} options={[['overview', 'Overview'], ['history', 'History'], ['assignments', 'Assignments'], ['report', 'Report']]} /></div>
    {tab === 'overview' && <Overview ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={goals} today={today} settings={org.settings} onDeleteGoal={async g => { try { await api.deleteGoal(g.id); toast('Goal removed.'); reload(); } catch (e) { toast(friendly(e), 'err'); } }} />}
    {tab === 'history' && <History student={st} sessions={sd.sessions} today={today} settings={org.settings} onDelete={setDel} />}
    {tab === 'assignments' && <Card><AssignmentList items={assignments} onChanged={reload} /></Card>}
    {tab === 'report' && <MonthReport student={st} ins={ins} sessions={sd.sessions} today={today} settings={org.settings} orgName={org.name} />}
    {tab === 'overview' && <Card className="no-print mt-5 flex flex-wrap items-center gap-3 px-5 py-4">
      <KeyRound size={18} className="text-ink-faint" /><span className="min-w-0 flex-1 text-sm"><b>Parent code:</b> <span className="font-mono tracking-widest">{st.parentCode}</span><br /><span className="text-ink-faint">A parent signs in with Google and enters this code to see {st.name.split(' ')[0]}’s progress (read-only).</span></span>
      <Button kind="quiet" onClick={async () => { try { await api.updateStudent(st.id, { parent_code: Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase() }); toast('New parent code made. The old one no longer works.'); reload(); } catch (e) { toast(friendly(e), 'err'); } }}><RefreshCw size={15} />New code</Button>
      <Button kind="quiet" onClick={() => setArchive(true)}><Archive size={15} />Archive student</Button>
    </Card>}
    <RecordSheet open={rec} onClose={() => setRec(false)} student={st} insight={ins} sessions={sd.sessions} onSaved={refresh} />
    {assign && <AssignmentForm open onClose={() => setAssign(false)} insights={allIns} fixedStudent={st.id} onSaved={reload} />}
    {goal && <GoalForm studentId={st.id} onClose={() => setGoal(false)} onSaved={reload} />}
    {edit && <EditStudent st={st} onClose={() => setEdit(false)} onSaved={refresh} />}
    <Confirm open={archive} onClose={() => setArchive(false)} danger title={`Archive ${st.name}?`} confirmLabel="Archive" body="They leave your lists and reminders. All records are kept and an admin can restore them." onConfirm={async () => { try { await api.updateStudent(st.id, { archived_at: new Date().toISOString() }); toast('Archived.'); go('students'); } catch (e) { toast(friendly(e), 'err'); } }} />
    <Confirm open={!!del} onClose={() => setDel(null)} danger title="Delete this session?" confirmLabel="Delete" body="If it was a new lesson, those ayahs are no longer counted as memorised. The deletion is kept in the audit log." onConfirm={async () => { try { await api.deleteSession(del!.id); toast('Session deleted.'); refresh(); } catch (e) { toast(friendly(e), 'err'); } }} />
  </>;
}

function GoalForm({ studentId, onClose, onSaved }: { studentId: string; onClose: () => void; onSaved: () => void }) {
  const { api, org, today } = useOrg(); const toast = useToast();
  const [metric, setMetric] = useState('new_ayahs'); const [period, setPeriod] = useState('weekly'); const [target, setTarget] = useState(20); const [busy, setBusy] = useState(false);
  const targets = metric === 'complete_juz' ? [1, 2, 3, 5, 10, 15, 30] : metric === 'streak_days' ? [3, 5, 7, 14, 30, 60, 100] : metric === 'sessions' ? [3, 4, 5, 6, 10, 20] : [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200];
  return <Modal open onClose={onClose} title="Set a goal" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={async () => { setBusy(true); try { await api.createGoal(org.id, { studentId, period: metric === 'streak_days' || metric === 'complete_juz' ? 'custom' : period, metric, target, startsOn: today }); toast('Goal set.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Save goal</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Goal">{id => <Select id={id} value={metric} onChange={v => { setMetric(v); setTarget(v === 'complete_juz' ? 1 : v === 'streak_days' ? 7 : v === 'sessions' ? 5 : 20); }} options={Object.entries(METRIC_LABEL).map(([k, v]) => [k, v[0].toUpperCase() + v.slice(1)])} />}</Field>
      {metric !== 'streak_days' && metric !== 'complete_juz' && <Field label="Every">{id => <Select id={id} value={period} onChange={setPeriod} options={[['daily', 'Day'], ['weekly', 'Week (last 7 days)'], ['monthly', 'Month (last 30 days)']]} />}</Field>}
      <Field label="Target">{id => <Select id={id} value={target} onChange={v => setTarget(Number(v))} options={targets.map(t => [t, `${t} ${METRIC_LABEL[metric]}`])} />}</Field>
    </div>
  </Modal>;
}

const AGES = ['Under 7', '7–9', '10–12', '13–15', '16–18', 'Adult'];
const DAILY = [1, 2, 3, 4, 5, 7, 10, 15, 20];
export function EditStudent({ st, onClose, onSaved, asStudent }: { st: Student; onClose: () => void; onSaved: () => void; asStudent?: boolean }) {
  const { api } = useOrg(); const toast = useToast();
  const [name, setName] = useState(st.name); const [age, setAge] = useState(st.ageGroup ?? '10–12'); const [daily, setDaily] = useState(st.dailyNewAyahs);
  const [dir, setDir] = useState(st.direction); const [goal, setGoal] = useState(st.goal ?? '');
  const [gName, setGName] = useState(st.guardianName ?? ''); const [gEmail, setGEmail] = useState(st.guardianEmail ?? ''); const [notify, setNotify] = useState(st.notify);
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length >= 2 && (!gEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(gEmail));
  return <Modal open onClose={onClose} title={asStudent ? 'My plan' : `Edit ${st.name}`} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!ok} onClick={async () => { setBusy(true); try { await api.updateStudent(st.id, { name: name.trim(), age_group: age, daily_new_ayahs: daily, direction: dir, goal: goal.trim(), guardian_name: gName.trim(), guardian_email: gEmail.trim() || null, notify: notify && !!gEmail.trim() }); toast('Saved.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Save</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Name">{id => <input id={id} className={inputCls} value={name} maxLength={80} onChange={e => setName(e.target.value)} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Age">{id => <Select id={id} value={age} onChange={setAge} options={AGES.map(a => [a, a])} />}</Field>
        <Field label="New ayahs a day">{id => <Select id={id} value={daily} onChange={v => setDaily(Number(v))} options={DAILY.map(d => [d, `${d} ayah${d > 1 ? 's' : ''}`])} />}</Field>
      </div>
      <Field label="Order">{id => <Select id={id} value={dir} onChange={v => setDir(v as 'back' | 'forward')} options={[['back', 'From An-Nās backwards (Juz 30 first)'], ['forward', 'From Al-Fātiḥah forwards']]} />}</Field>
      <Field label="Goal">{id => <input id={id} className={inputCls} value={goal} maxLength={80} onChange={e => setGoal(e.target.value)} />}</Field>
      <Field label="Parent name">{id => <input id={id} className={inputCls} value={gName} maxLength={80} onChange={e => setGName(e.target.value)} />}</Field>
      <Field label="Parent email" error={gEmail && !ok ? 'Check the email address' : null}>{id => <input id={id} type="email" className={inputCls} value={gEmail} onChange={e => setGEmail(e.target.value)} />}</Field>
      <Toggle on={notify} onChange={setNotify} label="Email the parent after each session" sub="Needs a parent email" />
    </div>
  </Modal>;
}
