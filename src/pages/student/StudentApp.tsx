// The student's own app: today's plan, progress and rewards, sessions, messages and their plan.
import { WeeklyRevisionCard } from '../../components/WeeklyRevision';
import { weekSummary } from '../../lib/weekly';
import { InfoTip } from '../../components/InfoTip';
import type { GlossaryKey } from '../../lib/glossary';
import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw, Repeat, Plus, Pencil, KeyRound, Award, CalendarDays, Sparkles } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { href } from '../../app/router';
import { insight, recentRanges } from '../../lib/insights';
import { groupPages } from '../../lib/revision';
import { niceDate, hijriDate, addDays } from '../../lib/dates';
import { formatRange, surahNameEn } from '../../quran';
import { streakDetail } from '../../lib/progress';
import { studentPlan, classLabel } from '../../lib/studentPlan';
import { points, level, badges } from '../../lib/motivation';
import type { SessionType } from '../../lib/types';
import { Button, Card, CardHead, Spinner, ErrorBox, Pill } from '../../components/ui';
import { Overview, History } from '../../components/StudentReport';
import { AssignmentList } from '../../components/AssignmentList';
import { RecordSheet } from '../../components/RecordSheet';
import { Leaderboard } from '../../components/Leaderboard';
import { StudentForm, type StudentDraft } from '../../components/StudentForm';
import { PageTitle } from '../../components/Shell';
import { PlanCard, ClassBadge } from '../../components/PlanCard';
import { DailyRing, LevelBar, BadgeGrid } from '../../components/Motivation';
import { AyahPlayer } from '../../components/AyahPlayer';
import { AnnouncementBoard } from '../../components/Announcements';
import { HalaqahChooser } from '../../components/HalaqahJoin';
import { startTour } from '../../components/Tour';
import { MemorisedModal } from '../../components/MemorisedPicker';
import { MyRevisionLog, RevisionStartModal, startLabel, SubmitLessonModal } from '../../components/RevisionSelf';
import { QiraatStudentCard, ProfileModal, profileOf } from '../../components/Qiraat';
import { riwayatSummary } from '../../lib/qiraat';
import type { OrgData } from '../../app/useOrgData';
import type { Student } from '../../lib/types';
import { MessageThread } from '../../components/MessageThread';
import { AdabSummary } from '../../components/Adab';
import { ExamList } from '../teacher/Exams';
import { KIND } from '../teacher/Calendar';
import { certificatesFor } from '../Certificate';
import { EditStudent } from '../teacher/StudentDetail';
import { friendly } from '../../api/backend';
import { CheckInCard, StandingCard, RevisionFormCard, RulesCard, missedLastWeek } from '../../components/StudentAttendance';
import { NotifyToggle } from '../../components/Notifications';

export function StudentApp({ tab }: { tab: string }) {
  const { org, today, user, api, refreshSession } = useOrg();
  const { data, error, reload } = useOrgData();
  const me = data?.students.find(s => s.userId === user?.id) ?? null;
  const sd = useStudentData(me?.id ?? null);
  const [rec, setRec] = useState<SessionType | null>(null); const [recDate, setRecDate] = useState<string | undefined>(); const [edit, setEdit] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [startOpen, setStartOpen] = useState(false); const [submitNew, setSubmitNew] = useState(false); const [memOpen, setMemOpen] = useState(false);
  const ins = useMemo(() => me && data && sd.sessions ? insight(me, sd.sessions, data.revision.get(me.id) ?? [], data.assignments, data.attendance, org.settings, today) : null, [me, data, sd.sessions, org.settings, today]);
  if (error || sd.error) return <ErrorBox message={(error ?? sd.error)!} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (!me) return <Onboarding onDone={async () => { setJustJoined(true); await reload(); await refreshSession(); }} create={async d => { const id = await api.createStudent({ orgId: org.id, forSelf: true, ...d }); if (id && d.newPages) await api.updateStudent(id, { new_pages: d.newPages }); if (id && (d.nextFromSurah || d.skippedSurahs.length)) await api.setMemorisedSurahs(id, { nextFrom: d.nextFromSurah, skipped: d.skippedSurahs }); if (d.qiraat && id) await api.setQiraat(id, d.qiraat); }} name={user?.name ?? ''} />;
  if (!sd.sessions || !ins) return <Spinner />;
  const refresh = () => { reload(); sd.reload(); };
  const recent = recentRanges(sd.sessions, me.id, today, org.settings.revision.recentDays);
  const pages = (xs: number[]) => groupPages([...xs].sort((a, b) => a - b)).map(([a, b]) => (a === b ? `page ${a}` : `pages ${a}–${b}`)).join(', ');
  const goals = data.goals.filter(g => g.studentId === me.id);
  const cl = classLabel(me.id, data.classes, data.members, org.name);
  const myClassIds = data.classes.filter(c => c.studentIds.includes(me.id)).map(c => c.id);
  const plan = studentPlan(me, org.settings, today);
  const weekRev = weekSummary(sd.sessions.filter(s => s.studentId === me.id), today, org.settings.revision.days?.length ? org.settings.revision.days : [0, 1, 2, 3, 4, 5, 6], ins.revision.perDay, recent.length > 0);
  const beh = data.behaviour.filter(b => b.studentId === me.id);
  const pts = points(sd.sessions, beh); const lvl = level(pts.total);
  const sk = streakDetail(sd.sessions.map(s => s.date), today, org.settings.motivation.freezePerWeek);
  const todays = sd.sessions.filter(s => s.date === today);
  const pendingNew = sd.sessions.find(s => s.type === 'new' && (s.selfLogged || s.recordedBy === 'student') && !s.checkStatus) ?? null;
  const ring = [
    { label: 'New lesson', due: !!ins.nextNew && ins.revision.isRevisionDay, done: todays.some(s => s.type === 'new' && (!s.selfLogged || s.checkStatus === 'ok')), color: '#047857' },
    { label: 'Recent revision', due: recent.length > 0, done: todays.some(s => s.type === 'recent'), color: '#B8893B' },
    { label: 'Old revision', due: ins.revision.isRevisionDay && ins.revision.today.length > 0, done: todays.some(s => s.type === 'old' || s.type === 'juz_revision'), color: '#0369A1' },
  ];
  const week = addDays(today, 14);
  const events = data.events.filter(e => (!e.classId || myClassIds.includes(e.classId)) && e.startsOn <= week && (e.endsOn ?? e.startsOn) >= today);
  const tests = data.exams.filter(x => x.studentId === me.id && x.status === 'scheduled' && x.scheduledOn >= today);
  const certs = certificatesFor(me, sd.milestones);
  return <>
    {tab === 'home' && <>
      <PageTitle title={`Assalamu alaikum, ${me.name.split(' ')[0]}`} sub={<>{niceDate(today)} · {hijriDate(today)}</>} />
      <div className="mb-5" data-tour="halaqah"><ClassBadge title={cl.title} teacher={cl.teacher} /></div>
      {!myClassIds.length && <div className="mb-5"><HalaqahChooser student={me} data={data} onChanged={reload} /></div>}
      <div className="mb-5 empty:hidden" data-tour="announcements"><AnnouncementBoard items={data.announcements} classes={data.classes} studentClassIds={myClassIds} onChanged={reload} limit={3} fresh /></div>
      <div className="mb-5" data-tour="week"><WeeklyRevisionCard w={weekRev} onLog={(t, d) => { setRecDate(d); setRec(t); }} /></div>
      <div className="mb-5 empty:hidden" data-tour="qiraat"><QiraatStudentCard student={me} data={data} onChanged={reload} /></div>
      {!me.rulesAckAt && org.settings.rulesText.trim() && <div className="mb-5"><RulesCard text={org.settings.rulesText} ackAt={me.rulesAckAt} onAck={async () => { try { await api.ackRules(me.id); reload(); } catch (e) { void e; } }} /></div>}
      <div className="mb-5" data-tour="checkin"><CheckInCard student={me} classes={data.classes} attendance={data.attendance} absences={data.absences} onChanged={reload} /></div>
      <div className="mb-5 empty:hidden" data-tour="notify"><NotifyToggle /></div>
      {(justJoined || sd.sessions.length < 3) && <div className="mb-5"><p className="mb-2 flex items-center gap-2 font-bold text-pine-800"><Sparkles size={18} />{justJoined ? 'Welcome! Here is the plan made for you from what you already know.' : 'Your plan'}</p><PlanCard plan={plan} /></div>}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="mb-3 text-lg font-bold">Today</h2><DailyRing parts={ring} /></Card>
        <Card className="p-5"><LevelBar total={pts.total} lvl={lvl} streak={sk.days} freezes={org.settings.motivation.freezePerWeek} frozenDays={sk.frozen.length} /></Card>
      </div>
      {(events.length > 0 || tests.length > 0) && <Card className="mb-5"><CardHead title={<span className="inline-flex items-center gap-2"><CalendarDays size={18} className="text-pine-700" />Coming up</span>} />
        <ul className="mt-2 divide-y divide-line">{tests.map(x => <li key={x.id} className="px-5 py-2.5"><b>{x.title}</b> <span className="text-ink-faint">· {niceDate(x.scheduledOn)}{x.examiner ? ` · with ${x.examiner}` : ''}</span></li>)}
          {events.map(e => <li key={e.id} className="flex items-center gap-2 px-5 py-2.5"><i className={`h-2.5 w-2.5 rounded-full ${KIND[e.kind][1]}`} /><b>{e.title}</b><span className="text-ink-faint">· {niceDate(e.startsOn)}{e.endsOn ? ` – ${niceDate(e.endsOn)}` : ''}</span></li>)}</ul></Card>}
      <div className="mb-5"><RevisionFormCard student={me} forms={data.revisionForms} onChanged={reload} /></div>
      <div className="mb-5"><StandingCard studentId={me.id} revisionMissed={missedLastWeek(me.id, data.revisionForms, org.settings.revisionForm.slots, today)} /></div>
      <h2 className="mb-3 text-lg font-bold">Today’s plan <span className="text-sm font-normal text-ink-faint">· what to read today</span></h2>
      <div className="grid gap-4 lg:grid-cols-3" data-tour="today-plan">
        <PlanTile tip="new" icon={<BookOpen size={20} />} title="New lesson" body={pendingNew ? formatRange(pendingNew.range) : ins.nextNew ? formatRange(ins.nextNew) : 'All memorised'}
          note={pendingNew ? 'Submitted. Waiting for your teacher to sign it off.' : 'Learn it, then tap “I memorised it”. It counts once your teacher signs it off.'}
          action={ins.nextNew && !pendingNew ? <div className="flex flex-col gap-2"><Button onClick={() => setSubmitNew(true)}><Plus size={16} />I memorised it</Button><AyahPlayer range={ins.nextNew} /></div> : null} />
        <PlanTile tip="recent" icon={<Repeat size={20} />} title="Recent revision" body={recent.length ? recent.map(formatRange).join(' · ') : 'No new lessons in the last week'} note={`Read today: every new lesson from the last ${org.settings.revision.recentDays} days.`} action={recent.length ? <Button kind="secondary" onClick={() => setRec('recent')}><Plus size={16} />I revised this</Button> : null} />
        <PlanTile tip="old" icon={<RotateCcw size={20} />} title="Old revision" body={!ins.revision.isRevisionDay ? 'Rest day' : ins.revision.today.length ? pages(ins.revision.today.map(r => r.page)) : 'Nothing due today'}
          note={!ins.revision.isRevisionDay ? (ins.revision.nextRevisionDay ? `Next Old revision: ${niceDate(ins.revision.nextRevisionDay)}${ins.revision.soon.length ? ` (${pages(ins.revision.soon.map(r => r.page))})` : ''}` : '') : ins.revision.weak.length ? 'Weak pages come first.' : `${ins.revision.perDay} pages each revision day, in turn.`}
          action={ins.revision.isRevisionDay && ins.revision.today.length ? <Button onClick={() => setRec('old')}><Plus size={16} />I revised this</Button> : null} />
      </div>
      <div className="mt-5" data-tour="revision-log"><MyRevisionLog studentId={me.id} sessions={sd.sessions} start={startLabel(me)} onStart={() => setStartOpen(true)} /></div>
      {startOpen && <RevisionStartModal student={me} onClose={() => setStartOpen(false)} onSaved={refresh} />}
      <Card className="mt-5"><CardHead title="Assignments" sub="Mark them done; your teacher reviews them" /><AssignmentList items={ins.openAssignments.concat(data.assignments.filter(a => a.studentId === me.id && a.status === 'completed'))} asStudent onChanged={reload} /></Card>
      <div className="mt-5"><Leaderboard limit={5} compact /></div>
      {ins.lastSession && <Card className="mt-5 p-5"><p className="text-xs font-bold uppercase text-ink-faint">Last session · {niceDate(ins.lastSession.date)}</p><p className="mt-1">{formatRange(ins.lastSession.range)} · {ins.lastSession.errorsMajor + ins.lastSession.errorsMinor} errors</p>{ins.lastSession.teacherNote && <p className="mt-1 text-pine-800"><b>Teacher:</b> {ins.lastSession.teacherNote}</p>}</Card>}
    </>}
    {tab === 'progress' && <div className="flex flex-col gap-5">
      <PageTitle title="My progress" />
      <Card className="p-5"><LevelBar total={pts.total} lvl={lvl} streak={sk.days} freezes={org.settings.motivation.freezePerWeek} frozenDays={sk.frozen.length} /></Card>
      <BadgeGrid items={badges(sd.sessions, beh, sd.milestones, me.memorized)} />
      {certs.length > 0 && <Card><CardHead title="My certificates" sub="Open one to print or save" /><div className="flex flex-wrap gap-2 px-5 py-4">{certs.map(c => <a key={c.code} href={href('certificate', me.id, c.code)} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-brass-100 px-3 text-sm font-bold text-brass-700"><Award size={16} />{c.title}</a>)}</div></Card>}
      <Leaderboard />
      {tests.length + data.exams.filter(x => x.studentId === me.id).length > 0 && <div><h2 className="mb-2 font-bold">My juz tests</h2><ExamList exams={data.exams} students={data.students} fixedStudent={me.id} onChanged={reload} /></div>}
      <AdabSummary points={beh} title="Adab & effort from your teacher" />
      <Overview ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={goals} today={today} />
    </div>}
    {tab === 'history' && <><PageTitle title="My sessions" /><History student={me} sessions={sd.sessions} today={today} settings={org.settings} /></>}
    {tab === 'messages' && <><PageTitle title="Messages" sub="With your teacher" /><MessageThread studentId={me.id} studentName={me.name} members={data.members} /></>}
    {tab === 'me' && <>
      <PageTitle title="My plan" action={<Button kind="secondary" onClick={() => setEdit(true)}><Pencil size={16} />Change</Button>} />
      <div className="mb-4"><ClassBadge title={cl.title} teacher={cl.teacher} /></div>
      <PlanCard plan={plan} />
      <Card className="mt-4 flex flex-wrap items-center gap-3 p-5"><span className="min-w-0 flex-1"><b className="block">What I’ve memorised</b><span className="text-sm text-ink-soft">Next lesson: {ins.nextNew ? formatRange(ins.nextNew) : 'all memorised'}{me.skippedSurahs?.length ? ` · skipped for later: ${me.skippedSurahs.map(n => surahNameEn(n)).join(', ')}` : ''}</span></span><Button kind="secondary" onClick={() => setMemOpen(true)}>Change</Button></Card>
      {memOpen && <MemorisedModal student={me} onClose={() => setMemOpen(false)} onSaved={refresh} />}
      <div className="mt-4"><HalaqahChooser student={me} data={data} onChanged={reload} /></div>
      <div className="mt-4"><QiraatMine student={me} data={data} onChanged={reload} /></div>
      <Card className="mt-4 flex flex-col gap-2 p-5 text-[15px]">
        <p><b>Order:</b> {me.direction === 'back' ? 'From An-Nās backwards' : 'From Al-Fātiḥah forwards'}</p>
        <p><b>Goal:</b> {me.goal || '—'}</p>
        <p><b>Parent:</b> {me.guardianName || '—'} {me.guardianEmail && <span className="text-ink-faint">({me.guardianEmail}{me.notify ? ', gets emails' : ''})</span>}</p>
      </Card>
      <Card className="mt-4 flex items-start gap-3 p-5"><KeyRound size={18} className="mt-1 text-ink-faint" /><p className="text-[15px]"><b>Parent code:</b> <span className="font-mono tracking-widest">{me.parentCode}</span><br /><span className="text-sm text-ink-faint">Give this to a parent. They create an account and enter it to follow your progress. They cannot change anything.</span></p></Card>
      <div className="mt-4"><RulesCard text={org.settings.rulesText} ackAt={me.rulesAckAt} onAck={async () => { try { await api.ackRules(me.id); reload(); } catch (e) { void e; } }} /></div>
      <div className="mt-4"><NotifyToggle /></div>
      <Button kind="secondary" className="mt-4" onClick={startTour}><Sparkles size={16} />Take the app tour again</Button>
      <p className="mt-4 text-sm text-ink-faint">Only your teachers, you and linked parents can see your records.</p>
      {edit && <EditStudent st={me} asStudent onClose={() => setEdit(false)} onSaved={refresh} />}
    </>}
    {submitNew && ins?.nextNew && me && <SubmitLessonModal student={me} suggested={ins.nextNew} onClose={() => setSubmitNew(false)} onSaved={refresh} />}
    {rec && <RecordSheet open onClose={() => { setRec(null); setRecDate(undefined); }} student={me} insight={ins} sessions={sd.sessions} asStudent initialType={rec} initialDate={recDate} onSaved={refresh} />}
  </>;
}
function PlanTile({ icon, title, body, note, action, tip }: { icon: React.ReactNode; title: string; body: string; note: string; action?: React.ReactNode; tip?: GlossaryKey }) {
  return <Card className="flex flex-col gap-2 p-5"><div className="flex items-center gap-2 text-pine-700">{icon}<h3 className="text-lg font-bold text-ink">{title}</h3>{tip && <InfoTip k={tip} />}</div><p className="text-[17px] font-bold">{body}</p>{note && <p className="text-sm text-ink-faint">{note}</p>}{action && <div className="mt-auto pt-2">{action}</div>}</Card>;
}
function Onboarding({ create, onDone, name }: { create: (d: StudentDraft) => Promise<void>; onDone: () => Promise<void>; name: string }) {
  return <div className="mx-auto max-w-xl">
    <PageTitle title="Let’s set up your hifz" sub="A few quick questions. Your plan is made from your answers." />
    <StudentForm defaultName={name} onSubmit={async d => { try { await create(d); await onDone(); } catch (e) { throw new Error(friendly(e)); } }} />
    <p className="mt-3"><Pill>You can change these later</Pill></p>
  </div>;
}

/** My plan → qira'at: turn it on, or change riwayat / jamʿ / matn */
function QiraatMine({ student, data, onChanged }: { student: Student; data: OrgData; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const p = profileOf(data, student.id); const on = !!p?.active;
  return <Card className="flex flex-wrap items-center gap-3 p-5">
    <span className="min-w-0 flex-1"><b className="block">Qirāʾāt</b><span className="text-sm text-ink-soft">{on && p ? `${p.mode === 'jam' && p.riwayat.length > 1 ? 'Jamʿ' : 'Ifrād'} · ${riwayatSummary(p.riwayat)}` : 'Do you read the qirāʾāt to your teacher? Choose your riwāyāt here.'}</span></span>
    <Button kind="secondary" onClick={() => setOpen(true)}>{on ? 'Change' : 'Set up'}</Button>
    {open && <ProfileModal student={student} profile={p} onClose={() => setOpen(false)} onSaved={onChanged} />}
  </Card>;
}
