// The student's own app: today's plan, progress and rewards, sessions, messages and their plan.
import { PartnerRequestsCard } from '../../components/PartnerRevision';
import { weekSummary, revSchedule } from '../../lib/weekly';
import { useMemo, useState } from 'react';
import { Pencil, Award, Sparkles, LogOut, History as HistoryIcon, MessageCircle } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { href } from '../../app/router';
import { insight, recentRanges } from '../../lib/insights';
import { groupPages } from '../../lib/revision';
import { niceDate } from '../../lib/dates';
import { formatRange } from '../../quran';
import { streakDetail } from '../../lib/progress';
import { studentPlan, classLabel } from '../../lib/studentPlan';
import { badges } from '../../lib/motivation';
import type { SessionType } from '../../lib/types';
import { Button, Card, CardHead, Spinner, ErrorBox, Pill } from '../../components/ui';
import { History } from '../../components/StudentReport';
import { StreakCalendar } from '../../components/ProgressViz';
import { Row, LinkRow, Group } from '../../components/Rows';
import { getTheme, getTextSize } from '../../lib/display';
import { JuzMap } from '../../components/quran';
import { JuzCelebration } from '../../components/Motion';
import { juzProgress } from '../../lib/progress';
import { RecordSheet, defaultRange } from '../../components/RecordSheet';
import { SimpleToday, type PartCard } from '../../components/SimpleToday';
import { STARS_PER_LEVEL, garden2, starLevel, stars, steadfast, weekDays } from '../../lib/stars';
import { GardenCard, StreakCard, RewardsCard } from '../../components/Garden';
import { MyLessons } from '../../components/MyLessons';
import { StudentForm, type StudentDraft } from '../../components/StudentForm';
import { PageTitle } from '../../components/Shell';
import { PlanCard } from '../../components/PlanCard';
import { BadgeGrid } from '../../components/Motivation';
import { HalaqahChooser } from '../../components/HalaqahJoin';
import { startTour } from '../../components/Tour';
import { DisplaySettings } from '../../components/DisplaySettings';
import { MemorisedModal } from '../../components/MemorisedPicker';
import { RevisionStartModal, startLabel, SubmitLessonModal } from '../../components/RevisionSelf';
import { ProfileModal, profileOf } from '../../components/Qiraat';
import { riwayatSummary } from '../../lib/qiraat';
import type { OrgData } from '../../app/useOrgData';
import type { Student } from '../../lib/types';
import { MessageThread } from '../../components/MessageThread';
import { certificatesFor } from '../Certificate';
import { EditStudent } from '../teacher/StudentDetail';
import { friendly } from '../../api/backend';
import { CheckInCard, RulesCard } from '../../components/StudentAttendance';
import { NotifyToggle } from '../../components/Notifications';

export function StudentApp({ tab }: { tab: string }) {
  const { org, today, user, api, refreshSession, backend } = useOrg();
  const { data, error, reload } = useOrgData();
  const me = data?.students.find(s => s.userId === user?.id) ?? null;
  const sd = useStudentData(me?.id ?? null);
  const [rec, setRec] = useState<SessionType | null>(null); const [recDate, setRecDate] = useState<string | undefined>(); const [edit, setEdit] = useState(false);
  const [startOpen, setStartOpen] = useState(false); const [submitNew, setSubmitNew] = useState(false); const [memOpen, setMemOpen] = useState(false);
  const ins = useMemo(() => me && data && sd.sessions ? insight(me, sd.sessions, data.revision.get(me.id) ?? [], data.assignments, data.attendance, org.settings, today) : null, [me, data, sd.sessions, org.settings, today]);
  if (error || sd.error) return <ErrorBox message={(error ?? sd.error)!} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (!me) return <Onboarding onDone={async () => { await reload(); await refreshSession(); }} create={async d => { const id = await api.createStudent({ orgId: org.id, forSelf: true, ...d }); if (id && d.newPages) await api.updateStudent(id, { new_pages: d.newPages }); if (id && (d.nextFromSurah || d.skippedSurahs.length)) await api.setMemorisedSurahs(id, { nextFrom: d.nextFromSurah, skipped: d.skippedSurahs }); if (d.qiraat && id) await api.setQiraat(id, d.qiraat); }} name={user?.name ?? ''} />;
  if (!sd.sessions || !ins) return <Spinner />;
  const refresh = () => { reload(); sd.reload(); };
  const recent = recentRanges(sd.sessions, me.id, today, org.settings.revision.recentDays);
  const pages = (xs: number[]) => groupPages([...xs].sort((a, b) => a - b)).map(([a, b]) => (a === b ? `page ${a}` : `pages ${a}–${b}`)).join(', ');
  const cl = classLabel(me.id, data.classes, data.members, org.name);
  const myClassIds = data.classes.filter(c => c.studentIds.includes(me.id)).map(c => c.id);
  const plan = studentPlan(me, org.settings, today, [...new Set(data.classes.filter(c => c.studentIds.includes(me.id)).flatMap(c => c.slots.map(x => x.day)))]);
  const weekRev = weekSummary(sd.sessions.filter(s => s.studentId === me.id), today, revSchedule(org.settings.revision), ins.revision.perDay, recent.length > 0);
  const beh = data.behaviour.filter(b => b.studentId === me.id);
  const sk = streakDetail(sd.sessions.map(s => s.date), today, org.settings.motivation.freezePerWeek);
  const juzDone = juzProgress(me.memorized).flatMap((v, i) => (v >= 1 ? [i + 1] : []));
  const todays = sd.sessions.filter(s => s.date === today);
  const pendingNew = sd.sessions.find(s => s.type === 'new' && (s.selfLogged || s.recordedBy === 'student') && !s.checkStatus) ?? null;
  // New lessons are heard in class: due on the halaqah's own day(s). Old revision follows the program's rule (fixed days, or N times a week at their own time).
  const lessonDays = [...new Set(data.classes.filter(c => myClassIds.includes(c.id)).flatMap(c => c.slots.map(sl => sl.day)))];
  const isLessonDay = !lessonDays.length || lessonDays.includes(new Date(`${today}T12:00:00Z`).getUTCDay());
  const perWeek = org.settings.revision.perWeek ?? null;
  const ring = [
    { label: 'New lesson', due: !!ins.nextNew && isLessonDay, done: todays.some(s => s.type === 'new' && (!s.selfLogged || s.checkStatus === 'ok')), color: '#047857' },
    { label: 'Recent revision', due: recent.length > 0, done: todays.some(s => s.type === 'recent'), color: '#B8893B' },
    { label: 'Old revision', due: ins.revision.isRevisionDay && ins.revision.today.length > 0, done: todays.some(s => s.type === 'old' || s.type === 'juz_revision'), color: '#0369A1' },
  ];
  ring.forEach(r => { if (r.done) r.due = true; }); // something done today always counts, even on a rest day
  const certs = certificatesFor(me, sd.milestones, Math.floor(stars(sd.sessions ?? [], me.id) / STARS_PER_LEVEL));
  return <>
    {tab === 'home' && (() => {
      const newDone = todays.find(x => x.type === 'new');
      const doneWk = Math.min(weekRev.oldDays, perWeek ?? 0); const oldWeekDone = !!perWeek && doneWk >= perWeek && !ring[2].done;
      const oldDue = ins.revision.isRevisionDay && ins.revision.today.length > 0;
      const recentSpan = recent.length ? { start: Math.min(...recent.map(r => r.start)), end: Math.max(...recent.map(r => r.end)) } : null;
      const newRange = pendingNew?.range ?? (ring[0].done && newDone ? newDone.range : ins.nextNew) ?? null;
      const cards: PartCard[] = [
        { key: 'new', range: newRange, what: newRange ? formatRange(newRange) : '', state: pendingNew ? 'waiting' : ring[0].done ? 'done' : ins.nextNew ? 'todo' : 'rest', restText: 'All memorised!', doneText: pendingNew ? 'Teacher will check it' : 'Done!' },
        { key: 'recent', range: recentSpan, what: recent.map(formatRange).join(' · '), state: !recent.length ? 'rest' : ring[1].done ? 'done' : 'todo', restText: 'Nothing new this week' },
        { key: 'old', range: oldDue ? defaultRange('old', me, ins, sd.sessions, today) : null, what: oldDue ? pages(ins.revision.today.map(r => r.page)) : '', state: oldWeekDone ? 'done' : ring[2].done ? 'done' : oldDue ? 'todo' : 'rest',
          doneText: oldWeekDone ? `All ${perWeek} done this week!` : perWeek ? `${doneWk} of ${perWeek} this week` : 'Done!', restText: ins.revision.nextRevisionDay ? `Next: ${niceDate(ins.revision.nextRevisionDay)}` : 'Nothing today' },
      ];
      const gd = garden2(sd.sessions, me.id); const st = gd.stars;
      // Before anything is logged today, show the streak they keep by doing one part today (not a scary 0).
      const liveStreak = todays.length ? sk.days : Math.max(0, streakDetail([...sd.sessions.map(s => s.date), today], today, org.settings.motivation.freezePerWeek).days - 1);
      return <>
        {!myClassIds.length && <div className="mb-5"><HalaqahChooser student={me} data={data} onChanged={reload} /></div>}
        <JuzCelebration who={me.id} completed={juzDone} />
        <SimpleToday student={me} name={me.name.split(' ')[0]} cards={cards} stars={st} seeds={gd.seeds} streak={liveStreak} level={starLevel(st)} week={weekDays(sd.sessions, me.id, today)} today={today} revisionForms={data.revisionForms} onSaved={refresh} />
        <div className="mx-auto mt-6 max-w-md empty:hidden"><NotifyToggle compact kid /></div>
        <div className="mx-auto mt-6 max-w-md"><MyLessons sessions={sd.sessions} studentId={me.id} next={pendingNew ? null : ins.nextNew} /></div>
        {/* below the three buttons: things to answer once in a while */}
        <div className="mx-auto mt-6 max-w-md empty:hidden"><PartnerRequestsCard /></div>
        {!me.rulesAckAt && org.settings.rulesText.trim() && <div className="mx-auto mt-5 max-w-md"><RulesCard compact text={org.settings.rulesText} ackAt={me.rulesAckAt} onAck={async () => { try { await api.ackRules(me.id); reload(); } catch (e) { void e; } }} /></div>}
        <div className="mx-auto mt-5 max-w-md empty:hidden"><CheckInCard student={me} classes={data.classes} attendance={data.attendance} absences={data.absences} onChanged={reload} /></div>
      </>; })()}
    {tab === 'progress' && (() => { const gd = garden2(sd.sessions, me.id); const st = gd.stars;
      return <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="text-2xl font-bold">My garden</h1>
      <GardenCard stars={st} seeds={gd.seeds} level={starLevel(st)} />
      <RewardsCard stars={st} juzTests={data.exams.filter(x => x.studentId === me.id && x.status === 'passed').length} steady={steadfast(sd.sessions, me.id, today, sk.days)} streak={sk.days} classId={myClassIds[0] ?? null} />
      <StreakCard days={sk.days} best={ins.longest} />
      <Card className="p-5"><StreakCalendar dates={sd.sessions.filter(x => x.studentId === me.id).map(x => x.date)} frozen={sk.frozen} today={today} /></Card>
      <Card><CardHead title="My Qurʾān" sub={`${ins.progress.juz} juz · ${ins.progress.pages} pages memorised`} /><div className="px-5 pb-5 pt-3"><JuzMap ranges={me.memorized} /></div></Card>
      {certs.length > 0 && <div className="flex flex-wrap gap-2">{certs.map(c => <a key={c.code} href={href('certificate', me.id, c.code)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#FFF4D6] px-4 font-bold text-[#9A5B00]"><Award size={18} />{c.title}</a>)}</div>}
      <BadgeGrid items={badges(sd.sessions, beh, sd.milestones, me.memorized)} />
    </div>; })()}
    {tab === 'history' && <><PageTitle title="My sessions" /><History student={me} sessions={sd.sessions} today={today} settings={org.settings} /></>}
    {tab === 'messages' && <><PageTitle title="Messages" sub="With your teacher" /><MessageThread studentId={me.id} studentName={me.name} members={data.members} /></>}
    {tab === 'me' && <div className="flex flex-col gap-6">
      <Card className="flex items-center gap-4 p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-pine-700 text-lg font-bold text-white">{me.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
        <span className="min-w-0 flex-1"><b className="block text-xl leading-tight">{me.name}</b><span className="block text-sm text-ink-soft">{cl.title}{cl.teacher ? ` · ${cl.teacher}` : ''}</span></span>
        <Button kind="secondary" className="w-11 shrink-0 px-0" aria-label="Edit my details" title="Edit my details" onClick={() => setEdit(true)}><Pencil size={16} /></Button>
      </Card>
      <Group title="My hifz">
        <LinkRow title="What I’ve memorised" value={`${ins.progress.pages} pages`} onClick={() => setMemOpen(true)} />
        <LinkRow title="Each lesson" value={me.newPages ? `${me.newPages === 0.5 ? '½' : me.newPages} page${me.newPages > 1 ? 's' : ''}` : `${me.dailyNewAyahs} ayahs`} onClick={() => setEdit(true)} />
        <Row title="My halaqah" value={cl.title}><HalaqahChooser student={me} data={data} onChanged={reload} /></Row>
        <LinkRow title="My sessions" icon={HistoryIcon} onClick={() => { window.location.hash = '/history'; }} />
        <LinkRow title="Messages with my teacher" icon={MessageCircle} onClick={() => { window.location.hash = '/messages'; }} />
      </Group>
      <Group title="This phone">
        <Row title="Notifications" value=""><NotifyToggle /></Row>
        <LinkRow title="Sign out" icon={LogOut} onClick={() => backend.signOut()} />
      </Group>
      <details className="group rounded-2xl border border-line bg-white dark:bg-paper">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center px-5 font-bold text-ink-soft"><span className="flex-1">Settings</span><span className="transition group-open:rotate-180">▾</span></summary>
        <div className="flex flex-col gap-5 border-t border-line p-3">
          <Group title="Plan">
            <LinkRow title="Goal" value={me.goal || 'Not set'} onClick={() => setEdit(true)} />
            <LinkRow title="Direction" value={me.direction === 'back' ? 'Backwards from An-Nās' : 'Forwards from Al-Fātiḥah'} onClick={() => setEdit(true)} />
            <LinkRow title="Old revision starts from" value={startLabel(me) ?? 'Default order'} onClick={() => setStartOpen(true)} />
            <Row title="My full plan" value={ins.nextNew ? `Next: ${formatRange(ins.nextNew)}` : ''}><PlanCard plan={plan} /></Row>
            <Row title="Qirāʾāt" value=""><QiraatMine student={me} data={data} onChanged={reload} /></Row>
            <Row title="Class expectations" value={me.rulesAckAt ? 'Agreed' : 'Not yet'} tone={me.rulesAckAt ? 'good' : 'warn'}><RulesCard compact text={org.settings.rulesText} ackAt={me.rulesAckAt} onAck={async () => { try { await api.ackRules(me.id); reload(); } catch (e) { void e; } }} /></Row>
            {org.settings.parentsEnabled && <Row title="Parent" value={me.guardianName || ''}><p className="text-[15px]">{me.guardianName || '—'} {me.guardianEmail && <span className="text-ink-faint">({me.guardianEmail})</span>}</p>{me.parentCode && <p className="text-[15px]"><b>Parent code:</b> <span className="font-mono tracking-widest">{me.parentCode}</span></p>}</Row>}
          </Group>
          <Group title="Display">
            <Row title="Display" value={`${{ auto: 'Auto', light: 'Light', dark: 'Dark' }[getTheme()]} · ${{ normal: 'Normal text', large: 'Large text', xl: 'Extra large text' }[getTextSize()]}`}><DisplaySettings /></Row>
            <LinkRow title="Take the app tour" icon={Sparkles} onClick={startTour} />
          </Group>
        </div>
      </details>
      <p className="px-1 text-sm text-ink-faint">Only you and your teachers{org.settings.parentsEnabled ? ' (and a linked parent)' : ''} can see your records.</p>
      {memOpen && <MemorisedModal student={me} onClose={() => setMemOpen(false)} onSaved={refresh} />}
      {edit && <EditStudent st={me} asStudent onClose={() => setEdit(false)} onSaved={refresh} />}
    </div>}
    {startOpen && <RevisionStartModal student={me} onClose={() => setStartOpen(false)} onSaved={refresh} />}
    {submitNew && ins?.nextNew && me && <SubmitLessonModal student={me} suggested={ins.nextNew} onClose={() => setSubmitNew(false)} onSaved={refresh} />}
    {rec && <RecordSheet open onClose={() => { setRec(null); setRecDate(undefined); }} student={me} insight={ins} sessions={sd.sessions} asStudent initialType={rec} initialDate={recDate} revisionForms={data.revisionForms} onSaved={refresh} />}
  </>;
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
