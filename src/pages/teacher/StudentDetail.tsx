import { WeakAyahsCard, RevisionReadOnly, weakAyahs } from '../../components/PartnerRevision';
import { WeeklyRevisionCard } from '../../components/WeeklyRevision';
import { weekSummary } from '../../lib/weekly';
import { sizeValue, parseSize, SIZE_OPTIONS } from '../../components/StudentForm';
import { QiraatTeacherPanel } from '../../components/Qiraat';
import { MemorisedModal } from '../../components/MemorisedPicker';
import { formatRange, surahNameEn } from '../../quran';
import { RevisionCheckCard, RevisionStartModal, startLabel } from '../../components/RevisionSelf';
import { useMemo, useState } from 'react';
import { Tile, Row } from '../../components/Rows';
import { ArrowLeft, Plus, ClipboardList, Target, Pencil, Archive, KeyRound, RefreshCw, Award } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { href, go } from '../../app/router';
import { insight } from '../../lib/insights';
import { METRIC_LABEL } from '../../lib/goals';
import { Button, Card, CardHead, Spinner, ErrorBox, Segmented, SubTabs, Modal, Field, Select, inputCls, Toggle, Confirm, useToast } from '../../components/ui';
import { Overview, History, MonthReport, TermReport } from '../../components/StudentReport';
import { PlanCard, ClassBadge } from '../../components/PlanCard';
import { AdabTaps, AdabSummary } from '../../components/Adab';
import { LevelBar, BadgeGrid } from '../../components/Motivation';
import { MessageThread } from '../../components/MessageThread';
import { ExamList } from './Exams';
import { certificatesFor } from '../Certificate';
import { classLabel, studentPlan, goalPct } from '../../lib/studentPlan';
import { points, level, badges } from '../../lib/motivation';
import type { ClassRow } from '../../api/data';
import { StandingCard, RevisionFormCard, missedLastWeek } from '../../components/StudentAttendance';
import { AssignmentForm } from '../../components/AssignmentForm';
import { AssignmentList } from '../../components/AssignmentList';
import { RecordSheet } from '../../components/RecordSheet';
import { PageTitle } from '../../components/Shell';
import { friendly } from '../../api/backend';
import type { Session, Student } from '../../lib/types';

type Tab = 'overview' | 'history' | 'work' | 'messages' | 'report';
export function StudentDetail({ id, initialTab }: { id: string; initialTab?: string }) {
  const { org, today, api } = useOrg();
  const { data, error, reload } = useOrgData();
  const sd = useStudentData(id);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((['overview', 'history', 'work', 'messages', 'report'].includes(initialTab ?? '') ? initialTab : 'overview') as Tab);
  const [reportKind, setReportKind] = useState<'month' | 'term'>('month');
  const [rec, setRec] = useState(false); const [assign, setAssign] = useState(false); const [goal, setGoal] = useState(false); const [edit, setEdit] = useState(false); const [startOpen, setStartOpen] = useState(false); const [memOpen, setMemOpen] = useState(false);
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
  const beh = data.behaviour.filter(b => b.studentId === id);
  const cl = classLabel(st.id, data.classes, data.members, org.name);
  const plan = studentPlan(st, org.settings, today);
  const pts = points(sd.sessions, beh); const lvl = level(pts.total);
  const certs = certificatesFor(st, sd.milestones);
  return <>
    <a href={href('students')} className="no-print mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink-faint hover:text-ink"><ArrowLeft size={16} />Students</a>
    <PageTitle title={st.name} sub={[st.ageGroup, st.goal && `Goal: ${st.goal}`, st.direction === 'back' ? 'from An-Nās backwards' : 'from Al-Fātiḥah forwards'].filter(Boolean).join(' · ')}
      action={<div className="no-print grid w-full grid-cols-[1.3fr_1fr_1fr_44px] gap-2 sm:flex sm:w-auto"><Button className="px-2 sm:px-4" onClick={() => setRec(true)}><Plus size={18} />Record</Button><Button kind="secondary" className="px-2 text-sm sm:px-4" onClick={() => setAssign(true)}><ClipboardList size={16} className="hidden sm:block" />Assign</Button><Button kind="secondary" className="px-2 text-sm sm:px-4" onClick={() => setGoal(true)}><Target size={16} className="hidden sm:block" />Goal</Button><Button kind="secondary" className="w-11 shrink-0 px-0" aria-label="Edit student" title="Edit student" onClick={() => setEdit(true)}><Pencil size={16} /></Button></div>} />
    <div className="no-print mb-3"><ClassBadge title={cl.title} teacher={cl.teacher} /></div>
    <SubTabs label="Student sections" className="mb-5" active={tab} onChange={setTab} items={[{ key: 'overview', label: 'Overview' }, { key: 'history', label: 'History' }, { key: 'work', label: 'Tasks & tests' }, { key: 'messages', label: 'Messages' }, { key: 'report', label: 'Reports' }]} />
    {tab === 'overview' && <div className="flex flex-col gap-5">
      {/* 1. the summary, like a health app: four numbers and the goal */}
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Memorised" value={`${(ins.progress.percent * 100).toFixed(1)}%`} sub={`${ins.progress.juz} juz · ${ins.progress.pages} pages`} />
          <Tile label="Streak" value={`${ins.streak}`} unit={ins.streak === 1 ? 'day' : 'days'} sub={`Best ${ins.longest}`} />
          <Tile label="Accuracy" value={ins.avgAccuracy30 === null ? '—' : `${ins.avgAccuracy30}%`} sub="last 30 days" tone={ins.avgAccuracy30 === null ? undefined : ins.avgAccuracy30 >= 90 ? 'good' : ins.avgAccuracy30 >= 75 ? 'warn' : 'bad'} />
          <Tile label="Attendance" value={ins.attendanceRate30 === null ? '—' : `${Math.round(ins.attendanceRate30 * 100)}%`} sub="last 30 days" tone={ins.attendanceRate30 === null ? undefined : ins.attendanceRate30 >= 0.9 ? 'good' : ins.attendanceRate30 >= 0.75 ? 'warn' : 'bad'} />
        </div>
        {plan.goal && <div className="mt-4">
          <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm"><b>Goal: {plan.goal.label}</b><span className="text-ink-faint">{plan.goal.done ? 'reached. Mā shāʾ Allāh.' : `${plan.goal.remaining} ayahs to go${plan.goal.eta ? ` · about ${new Date(plan.goal.eta).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : ''}`}</span></p>
          <div className="h-2 overflow-hidden rounded-full bg-black/[.06]"><div className="h-full rounded-full bg-pine-600" style={{ width: `${goalPct(st, plan.goal)}%` }} /></div></div>}
      </Card>
      {/* 2. what happens next */}
      <Card className="flex flex-wrap items-center gap-3 px-5 py-4"><span className="min-w-0 flex-1 text-[15px]"><b>Next lesson:</b> {ins.nextNew ? formatRange(ins.nextNew) : 'all memorised'} <span className="text-ink-faint">· going {st.direction === 'back' ? 'backwards' : 'forwards'}{st.skippedSurahs?.length ? ` · skipped for later: ${st.skippedSurahs.map(n => surahNameEn(n)).join(', ')}` : ''}</span></span><Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => setMemOpen(true)}>Memorised & start</Button></Card>
      <Card className="flex flex-wrap items-center gap-3 px-5 py-4"><span className="min-w-0 flex-1 text-[15px]"><b>Old revision starts from:</b> {startLabel(st) ?? 'default order'}</span><Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => setStartOpen(true)}>Change</Button></Card>
      {startOpen && <RevisionStartModal student={st} onClose={() => setStartOpen(false)} onSaved={reload} />}
      {memOpen && <MemorisedModal student={st} byTeacher onClose={() => setMemOpen(false)} onSaved={reload} />}
      <div className="empty:hidden"><RevisionCheckCard data={data} onChanged={reload} studentId={st.id} /></div>
      {/* 3. everything else, one tap away */}
      <Card className="divide-y divide-line overflow-hidden">
        {(() => { const w = weekSummary(sd.sessions.filter(s => s.studentId === st.id), today, org.settings.revision.days?.length ? org.settings.revision.days : [0, 1, 2, 3, 4, 5, 6], ins.revision.perDay, false);
          return <Row title="Revision this week" value={w.target ? `${w.oldPages}/${w.target} Old pages` : `${w.oldPages} pages`} tone={w.target && w.percent >= 1 ? 'good' : w.missedDays ? 'warn' : undefined}>
            <WeeklyRevisionCard w={w} you={false} /><Card className="p-5"><h3 className="mb-2 font-bold">Confirmed by partners</h3><RevisionReadOnly sessions={sd.sessions} studentId={st.id} names={id => (data.students.find(x => x.id === id)?.name ?? 'partner').split(' ')[0]} /></Card></Row>; })()}
        {(() => { const n = weakAyahs(sd.sessions, st.id, today).length; return <Row title="Weak ayahs" value={n ? `${n}` : 'None'} tone={n ? 'warn' : 'good'}>{n ? <WeakAyahsCard sessions={sd.sessions} studentId={st.id} you={false} /> : <p className="text-sm text-ink-faint">No mistakes marked in the last 60 days.</p>}</Row>; })()}
        <Row title="Plan, juz map and charts" value={`${ins.progress.juz} juz`}><PlanCard plan={plan} you={false} /><Overview noStats ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={goals} today={today} settings={org.settings} onDeleteGoal={async g => { try { await api.deleteGoal(g.id); toast('Goal removed.'); reload(); } catch (e) { toast(friendly(e), 'err'); } }} /></Row>
        <Row title="Qirāʾāt" value=""><QiraatTeacherPanel student={st} data={data} onChanged={reload} /></Row>
        <Row title="Attendance and revision forms" value={ins.attendanceRate30 === null ? '' : `${Math.round(ins.attendanceRate30 * 100)}%`}><StandingCard studentId={st.id} you={false} revisionMissed={missedLastWeek(st.id, data.revisionForms, org.settings.revisionForm.slots, today)} /><RevisionFormCard student={st} forms={data.revisionForms} readOnly onChanged={reload} /></Row>
        <Row title="Adab, level and badges" value={lvl.name}>
          <Card><CardHead title="Adab & effort today" sub="Tap to give a point; tap again to undo" /><AdabTaps studentId={st.id} points={data.behaviour} onChanged={reload} /></Card>
          <div className="grid gap-5 xl:grid-cols-2"><Card className="p-5"><LevelBar total={pts.total} lvl={lvl} streak={ins.streak} freezes={org.settings.motivation.freezePerWeek} frozenDays={0} /></Card><AdabSummary points={beh} /></div>
          <BadgeGrid items={badges(sd.sessions, beh, sd.milestones, st.memorized)} />
      {certs.length > 0 && <Card><CardHead title="Certificates" sub="Open one to print or save as PDF" /><div className="flex flex-wrap gap-2 px-5 py-4">{certs.map(c => <a key={c.code} href={href('certificate', st.id, c.code)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brass-100 px-3 text-sm font-bold text-brass-700 hover:bg-brass-100/70"><Award size={16} />{c.title}</a>)}</div></Card>}
        </Row>
      </Card>
    </div>}
    {tab === 'history' && <History student={st} sessions={sd.sessions} today={today} settings={org.settings} onDelete={setDel} />}
    {tab === 'work' && <div className="flex flex-col gap-5"><Card><CardHead title="Assignments" /><AssignmentList items={assignments} onChanged={reload} /></Card><div><h2 className="mb-2 font-bold">Juz tests</h2><ExamList exams={data.exams} students={data.students} fixedStudent={st.id} onChanged={reload} /></div></div>}
    {tab === 'messages' && <MessageThread studentId={st.id} studentName={st.name} members={data.members} />}
    {tab === 'report' && <div className="flex flex-col gap-4">
      <div className="no-print"><Segmented label="Report" value={reportKind} onChange={setReportKind} options={[['month', 'Monthly report'], ['term', 'Term report card']]} /></div>
      {reportKind === 'month' ? <MonthReport student={st} ins={ins} sessions={sd.sessions} today={today} settings={org.settings} orgName={org.name} />
        : <TermReport student={st} ins={ins} sessions={sd.sessions} attendance={data.attendance} behaviour={data.behaviour} exams={data.exams} today={today} settings={org.settings} orgName={org.name} teacher={cl.teacher} />}
    </div>}
    {tab === 'overview' && <Card className="no-print mt-5 flex flex-wrap items-center gap-3 px-5 py-4">
      {org.settings.parentsEnabled ? <>
      <KeyRound size={18} className="text-ink-faint" /><span className="min-w-0 flex-1 text-sm"><b>Parent code:</b> <span className="font-mono tracking-widest">{st.parentCode}</span><br /><span className="text-ink-faint">A parent creates an account and enters this code to see {st.name.split(' ')[0]}’s progress (read-only).</span></span>
      <Button kind="quiet" onClick={async () => { try { await api.updateStudent(st.id, { parent_code: Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase() }); toast('New parent code made. The old one no longer works.'); reload(); } catch (e) { toast(friendly(e), 'err'); } }}><RefreshCw size={15} />New code</Button>
      </> : <span className="flex-1" />}
      <Button kind="quiet" onClick={() => setArchive(true)}><Archive size={15} />Archive student</Button>
    </Card>}
    <RecordSheet open={rec} onClose={() => setRec(false)} student={st} insight={ins} sessions={sd.sessions} onSaved={refresh} />
    {assign && <AssignmentForm open onClose={() => setAssign(false)} insights={allIns} fixedStudent={st.id} onSaved={reload} />}
    {goal && <GoalForm studentId={st.id} onClose={() => setGoal(false)} onSaved={reload} />}
    {edit && <EditStudent st={st} classes={data.classes} onClose={() => setEdit(false)} onSaved={refresh} />}
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
export function EditStudent({ st, onClose, onSaved, asStudent, classes = [] }: { st: Student; onClose: () => void; onSaved: () => void; asStudent?: boolean; classes?: ClassRow[] }) {
  const { api, org } = useOrg(); const toast = useToast();
  const [oldPages, setOldPages] = useState<number>(st.oldPages ?? 0);
  const curClass = classes.find(c => c.studentIds.includes(st.id))?.id ?? '';
  const [halaqah, setHalaqah] = useState(curClass);
  const [name, setName] = useState(st.name); const [age, setAge] = useState(st.ageGroup ?? '10–12'); const [size, setSize] = useState(sizeValue(st.dailyNewAyahs, st.newPages));
  const [dir, setDir] = useState(st.direction); const [goal, setGoal] = useState(st.goal ?? '');
  const [gName, setGName] = useState(st.guardianName ?? ''); const [gEmail, setGEmail] = useState(st.guardianEmail ?? ''); const [notify, setNotify] = useState(st.notify);
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length >= 2 && (!gEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(gEmail));
  return <Modal open onClose={onClose} title={asStudent ? 'My plan' : `Edit ${st.name}`} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!ok} onClick={async () => { setBusy(true); try { await api.updateStudent(st.id, { name: name.trim(), age_group: age, daily_new_ayahs: parseSize(size).ayahs ?? st.dailyNewAyahs, new_pages: parseSize(size).pages, direction: dir, goal: goal.trim(), guardian_name: gName.trim(), guardian_email: gEmail.trim() || null, notify: notify && !!gEmail.trim(), ...(asStudent ? {} : { old_pages: oldPages || null }) });
        if (!asStudent && halaqah !== curClass) {
          const from = classes.find(c => c.id === curClass); if (from) await api.setClassStudents(org.id, from.id, from.studentIds.filter(x => x !== st.id), from.studentIds);
          const to = classes.find(c => c.id === halaqah); if (to) await api.setClassStudents(org.id, to.id, [...to.studentIds, st.id], to.studentIds);
        } toast('Saved.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Save</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Name">{id => <input id={id} className={inputCls} value={name} maxLength={80} onChange={e => setName(e.target.value)} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Age">{id => <Select id={id} value={age} onChange={setAge} options={AGES.map(a => [a, a])} />}</Field>
        <Field label="New lesson size">{id => <Select id={id} value={size} onChange={setSize} options={SIZE_OPTIONS} />}</Field>
      </div>
      {!asStudent && classes.length > 0 && <Field label="Halaqah">{id => <Select id={id} value={halaqah} onChange={setHalaqah} options={[['', 'Not in a halaqah'], ...classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>}
      {!asStudent && <Field label="Old revision per revision day" hint="Automatic follows the program setting and how much is memorised.">{id => <Select id={id} value={oldPages} onChange={v => setOldPages(Number(v))} options={[[0, 'Automatic'], ...[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map(n => [n, `${n} page${n > 1 ? 's' : ''}`] as [number, string])]} />}</Field>}
      <Field label="Order">{id => <Select id={id} value={dir} onChange={v => setDir(v as 'back' | 'forward')} options={[['back', 'From An-Nās backwards (Juz 30 first)'], ['forward', 'From Al-Fātiḥah forwards']]} />}</Field>
      <Field label="Goal">{id => <input id={id} className={inputCls} value={goal} maxLength={80} onChange={e => setGoal(e.target.value)} />}</Field>
      {org.settings.parentsEnabled && <>
      <Field label="Parent name">{id => <input id={id} className={inputCls} value={gName} maxLength={80} onChange={e => setGName(e.target.value)} />}</Field>
      <Field label="Parent email" error={gEmail && !ok ? 'Check the email address' : null}>{id => <input id={id} type="email" className={inputCls} value={gEmail} onChange={e => setGEmail(e.target.value)} />}</Field>
      <Toggle on={notify} onChange={setNotify} label="Email the parent after each session" sub="Needs a parent email" />
      </>}
    </div>
  </Modal>;
}
