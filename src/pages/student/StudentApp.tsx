// The student's own app: today's plan, progress and rewards, sessions, messages and their plan.
import { PartnerRequestsCard, WeakAyahsCard, weakAyahs } from '../../components/PartnerRevision';
import { WeeklyRevisionCard } from '../../components/WeeklyRevision';
import { weekSummary, revSchedule } from '../../lib/weekly';
import { InfoTip } from '../../components/InfoTip';
import type { GlossaryKey } from '../../lib/glossary';
import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw, Repeat, Plus, Pencil, Award, Sparkles, CheckCircle2, Clock3, ChevronDown, LogOut } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useStudentData } from '../../app/useStudentData';
import { href } from '../../app/router';
import { insight, recentRanges } from '../../lib/insights';
import { groupPages, nextRevisionDay } from '../../lib/revision';
import { niceDate, hijriDate, addDays } from '../../lib/dates';
import { formatRange, pageRange, type Range } from '../../quran';
import { RecallTestButton } from '../../components/RecallTest';
import { MushafLink, rangeMarks, type Mark } from '../../components/Mushaf';
import { LookalikeNote } from '../../components/Lookalike';
import { PracticeButton } from '../../components/Practice';
import { streakDetail } from '../../lib/progress';
import { studentPlan, classLabel, goalPct } from '../../lib/studentPlan';
import { points, level, badges } from '../../lib/motivation';
import type { SessionType } from '../../lib/types';
import { Button, Card, CardHead, Spinner, ErrorBox, Pill, cx, SubTabs } from '../../components/ui';
import { Overview, History } from '../../components/StudentReport';
import { Rings, StreakCalendar } from '../../components/ProgressViz';
import { StudentPeriodReport } from '../../components/Reports';
import { WhatIf } from '../../components/WhatIf';
import { Row, LinkRow, Group } from '../../components/Rows';
import { getTheme, getTextSize } from '../../lib/display';
import { JuzMap } from '../../components/quran';
import { StreakFlame, JuzCelebration } from '../../components/Motion';
import { juzProgress } from '../../lib/progress';
import { AssignmentList } from '../../components/AssignmentList';
import { RecordSheet } from '../../components/RecordSheet';
import { Leaderboard } from '../../components/Leaderboard';
import { StudentForm, type StudentDraft } from '../../components/StudentForm';
import { PageTitle } from '../../components/Shell';
import { PlanCard, ClassBadge } from '../../components/PlanCard';
import { LevelBar, BadgeGrid } from '../../components/Motivation';
import { AyahPlayer } from '../../components/AyahPlayer';
import { AnnouncementBoard } from '../../components/Announcements';
import { HalaqahChooser } from '../../components/HalaqahJoin';
import { startTour } from '../../components/Tour';
import { DisplaySettings } from '../../components/DisplaySettings';
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
import { CheckInCard, StandingCard, RulesCard, missedLastWeek } from '../../components/StudentAttendance';
import { NotifyToggle } from '../../components/Notifications';

export function StudentApp({ tab }: { tab: string }) {
  const { org, today, user, api, refreshSession, backend } = useOrg();
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
  const plan = studentPlan(me, org.settings, today, [...new Set(data.classes.filter(c => c.studentIds.includes(me.id)).flatMap(c => c.slots.map(x => x.day)))]);
  const weekRev = weekSummary(sd.sessions.filter(s => s.studentId === me.id), today, revSchedule(org.settings.revision), ins.revision.perDay, recent.length > 0);
  const beh = data.behaviour.filter(b => b.studentId === me.id);
  const pts = points(sd.sessions, beh); const lvl = level(pts.total);
  const sk = streakDetail(sd.sessions.map(s => s.date), today, org.settings.motivation.freezePerWeek);
  const juzDone = juzProgress(me.memorized).flatMap((v, i) => (v >= 1 ? [i + 1] : []));
  const todays = sd.sessions.filter(s => s.date === today);
  const pendingNew = sd.sessions.find(s => s.type === 'new' && (s.selfLogged || s.recordedBy === 'student') && !s.checkStatus) ?? null;
  // New lessons are heard in class: due on the halaqah's own day(s). Old revision follows the program's rule (fixed days, or N times a week at their own time).
  const lessonDays = [...new Set(data.classes.filter(c => myClassIds.includes(c.id)).flatMap(c => c.slots.map(sl => sl.day)))];
  const isLessonDay = !lessonDays.length || lessonDays.includes(new Date(`${today}T12:00:00Z`).getUTCDay());
  const nextLesson = lessonDays.length ? nextRevisionDay(lessonDays, today, false) : null;
  const perWeek = org.settings.revision.perWeek ?? null;
  const ring = [
    { label: 'New lesson', due: !!ins.nextNew && isLessonDay, done: todays.some(s => s.type === 'new' && (!s.selfLogged || s.checkStatus === 'ok')), color: '#047857' },
    { label: 'Recent revision', due: recent.length > 0, done: todays.some(s => s.type === 'recent'), color: '#B8893B' },
    { label: 'Old revision', due: ins.revision.isRevisionDay && ins.revision.today.length > 0, done: todays.some(s => s.type === 'old' || s.type === 'juz_revision'), color: '#0369A1' },
  ];
  ring.forEach(r => { if (r.done) r.due = true; }); // something done today always counts, even on a rest day
  const week = addDays(today, 14);
  const events = data.events.filter(e => (!e.classId || myClassIds.includes(e.classId)) && e.startsOn <= week && (e.endsOn ?? e.startsOn) >= today);
  const tests = data.exams.filter(x => x.studentId === me.id && x.status === 'scheduled' && x.scheduledOn >= today);
  const certs = certificatesFor(me, sd.milestones);
  const weakList = weakAyahs(sd.sessions, me.id, today); const weakCount = weakList.length;
  const weakMarks = weakList.map(w => [w.ayahId, 'weak'] as [number, Mark]);
  return <>
    {tab === 'home' && <>
      <PageTitle title={`Assalamu alaikum, ${me.name.split(' ')[0]}`} sub={<>{niceDate(today)} · {hijriDate(today)}</>} />
      <div className="mb-5" data-tour="halaqah"><ClassBadge title={cl.title} teacher={cl.teacher} /></div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
      <div className="min-w-0">
      {/* 1. things that need doing now */}
      {!myClassIds.length && <div className="mb-5"><HalaqahChooser student={me} data={data} onChanged={reload} /></div>}
      {!me.rulesAckAt && org.settings.rulesText.trim() && <div className="mb-5"><RulesCard compact text={org.settings.rulesText} ackAt={me.rulesAckAt} onAck={async () => { try { await api.ackRules(me.id); reload(); } catch (e) { void e; } }} /></div>}
      <div className="mb-5 empty:hidden" data-tour="partner"><PartnerRequestsCard /></div>
      {(justJoined || sd.sessions.length < 3) && <div className="mb-5"><p className="mb-2 flex items-center gap-2 font-bold text-pine-800"><Sparkles size={18} />{justJoined ? 'Welcome! Here is the plan made for you from what you already know.' : 'Your plan'}</p><PlanCard plan={plan} /></div>}
      {ring.some(r => r.due) ? ring.every(r => !r.due || r.done) && <DoneToday name={me.name.split(' ')[0]} streak={sk.days} />
        : <div role="status" className="mb-5 rounded-2xl bg-pine-50 px-5 py-4 text-pine-900 ring-1 ring-pine-600/20 dark:text-pine-100"><p className="flex items-center gap-2 font-bold"><CheckCircle2 size={20} />Nothing is due today</p><p className="text-sm opacity-85">A free day. Rest, or practise your last lesson.</p></div>}
      <JuzCelebration who={me.id} completed={juzDone} />
      {/* 2. today's reading */}
      <div data-tour="today-plan"><TodayPath studentId={me.id} steps={[
        { key: 'new', practice: pendingNew?.range ?? (ring[0].done ? todays.find(x => x.type === 'new')?.range : ins.nextNew) ?? null, tip: 'new', icon: <BookOpen size={18} />, title: 'New lesson', body: pendingNew ? formatRange(pendingNew.range) : ring[0].done ? formatRange(todays.find(x => x.type === 'new')!.range) : ins.nextNew ? formatRange(ins.nextNew) : 'All memorised',
          state: pendingNew ? 'waiting' : ring[0].done ? 'done' : ring[0].due ? 'todo' : 'none',
          note: pendingNew ? 'Submitted. Your teacher signs it off in class.' : !ring[0].due && ins.nextNew ? `New lessons are heard in your halaqah${nextLesson ? `, next on ${niceDate(nextLesson)}` : ''}. Learn it before then and submit it when it’s ready.` : 'Listen, learn it, test yourself, then tap “I memorised it”.',
          action: ins.nextNew && !pendingNew ? <div className="flex flex-col gap-2"><div className="flex flex-wrap gap-2"><Button onClick={() => setSubmitNew(true)}><Plus size={16} />I memorised it</Button><RecallTestButton studentId={me.id} range={ins.nextNew} /><MushafLink range={ins.nextNew} title="New lesson" marks={[...rangeMarks(ins.nextNew, 'lesson'), ...weakMarks]} /></div><LookalikeNote range={ins.nextNew} /><AyahPlayer range={ins.nextNew} /></div>
            : pendingNew ? <RecallTestButton studentId={me.id} range={pendingNew.range} label="Test yourself before class" /> : null },
        { key: 'recent', practice: recent.length ? { start: Math.min(...recent.map(r => r.start)), end: Math.max(...recent.map(r => r.end)) } : null, tip: 'recent', icon: <Repeat size={18} />, title: 'Recent revision', body: recent.length ? recent.map(formatRange).join(' · ') : 'No new lessons in the last week',
          state: !recent.length ? 'none' : ring[1].done ? 'done' : 'todo',
          note: `Every new lesson from the last ${org.settings.revision.recentDays} days, read once today.`,
          action: recent.length ? <div className="flex flex-wrap gap-2"><Button onClick={() => setRec('recent')}><Plus size={16} />I revised this</Button><RecallTestButton studentId={me.id} range={{ start: Math.min(...recent.map(r => r.start)), end: Math.max(...recent.map(r => r.end)) }} /><MushafLink range={recent[0]} title="Recent revision" marks={[...recent.flatMap(r => rangeMarks(r, 'revision')), ...weakMarks]} /></div> : null },
        (() => { const doneWk = Math.min(weekRev.oldDays, perWeek ?? 0); const weekDone = !!perWeek && doneWk >= perWeek && !ring[2].done; const due = ins.revision.isRevisionDay && ins.revision.today.length > 0;
          return { key: 'old', tip: 'old' as GlossaryKey, icon: <RotateCcw size={18} />, title: perWeek ? `Old revision · ${doneWk} of ${perWeek}` : 'Old revision',
          body: weekDone ? `All ${perWeek} done this week` : due ? pages(ins.revision.today.map(r => r.page)) : ins.revision.nextRevisionDay ? `Next: ${niceDate(ins.revision.nextRevisionDay)}` : 'Nothing due',
          state: (weekDone ? 'done' : !due ? 'none' : ring[2].done ? 'done' : 'todo') as Step['state'],
          note: <span className="flex flex-col gap-2">{perWeek && <WeekDots done={doneWk} of={perWeek} />}<span>{weekDone ? `Mā shāʾ Allāh. Your next ${perWeek} start on Monday.` : `Read these pages to your partner, then tap the button. ${perWeek ? `${perWeek} times a week, on any days you like.` : ''}`}</span></span>,
          action: due ? <div className="flex flex-wrap gap-2"><Button onClick={() => setRec('old')}><Plus size={16} />{perWeek ? `I did revision ${Math.min(doneWk + 1, perWeek)} of ${perWeek}` : 'I revised this'}</Button><MushafLink range={firstRun(ins.revision.today.map(r => r.page))} title="Old revision" marks={[...ins.revision.today.flatMap(r => rangeMarks(pageRange(r.page), 'revision')), ...weakMarks]} /></div> : null }; })(),
      ]} /></div>
      <div className="mt-5 empty:hidden" data-tour="checkin"><CheckInCard student={me} classes={data.classes} attendance={data.attendance} absences={data.absences} onChanged={reload} /></div>
      <div className="mt-5 empty:hidden" data-tour="announcements"><AnnouncementBoard items={data.announcements} classes={data.classes} studentClassIds={myClassIds} onChanged={reload} limit={2} fresh /></div>
      </div>
      {/* side column on wide screens; below on phones */}
      <aside className="mt-5 lg:mt-0">
      <div className="mb-5 empty:hidden" data-tour="notify"><NotifyToggle compact /></div>
      <div className="mb-5 empty:hidden" data-tour="qiraat"><QiraatStudentCard student={me} data={data} onChanged={reload} /></div>
      {startOpen && <RevisionStartModal student={me} onClose={() => setStartOpen(false)} onSaved={refresh} />}
      {/* 4. one notebook with tabs instead of a long scroll */}
      <div data-tour="revision-log"><Notebook initial={ins.openAssignments.length ? 'work' : 'soon'} tabs={[
        { key: 'soon', label: `Coming up${events.length + tests.length ? ` · ${events.length + tests.length}` : ''}`, node: <Card>{events.length + tests.length ? <ul className="divide-y divide-line">{tests.map(x => <li key={x.id} className="px-5 py-3"><b>{x.title}</b> <span className="text-ink-faint">· {niceDate(x.scheduledOn)}{x.examiner ? ` · with ${x.examiner}` : ''}</span></li>)}
          {events.map(e => <li key={e.id} className="flex items-center gap-2 px-5 py-3"><i className={`h-2.5 w-2.5 rounded-full ${KIND[e.kind][1]}`} /><b>{e.title}</b><span className="text-ink-faint">· {niceDate(e.startsOn)}{e.endsOn ? ` – ${niceDate(e.endsOn)}` : ''}</span></li>)}</ul>
          : <p className="p-5 text-sm text-ink-faint">Nothing in the next two weeks.</p>}</Card> },
        ...(ins.openAssignments.length ? [{ key: 'work', label: `Assignments · ${ins.openAssignments.length}`, node: <Card><CardHead title="Assignments" sub="Mark them done; your teacher reviews them" /><AssignmentList items={ins.openAssignments} asStudent onChanged={reload} /></Card> }] : []),
      ]} /></div>
      </aside>
      </div>
      {/* 5. everything else, folded away */}
      <details className="group mt-5 rounded-2xl border border-line bg-white shadow-card">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 px-5 font-bold text-ink-soft"><span className="flex-1">More: streak, standing, leaderboard</span><span className="text-ink-faint transition group-open:rotate-180">▾</span></summary>
        <div className="flex flex-col gap-5 border-t border-line p-4">
          <div>
            <Card className="p-5"><LevelBar total={pts.total} lvl={lvl} streak={sk.days} freezes={org.settings.motivation.freezePerWeek} frozenDays={sk.frozen.length} /></Card>
          </div>
          <StandingCard studentId={me.id} revisionMissed={missedLastWeek(me.id, data.revisionForms, org.settings.revisionForm.slots, today)} />
          {data.assignments.some(a => a.studentId === me.id && a.status === 'completed') && <Card><CardHead title="Finished assignments" /><AssignmentList items={data.assignments.filter(a => a.studentId === me.id && a.status === 'completed')} asStudent onChanged={reload} /></Card>}
          <Leaderboard limit={5} compact />
          {ins.lastSession && <Card className="p-5"><p className="text-xs font-bold uppercase text-ink-faint">Last session · {niceDate(ins.lastSession.date)}</p><p className="mt-1">{formatRange(ins.lastSession.range)} · {ins.lastSession.errorsMajor + ins.lastSession.errorsMinor} errors</p>{ins.lastSession.teacherNote && <p className="mt-1 text-pine-800"><b>Teacher:</b> {ins.lastSession.teacherNote}</p>}</Card>}
        </div>
      </details>
    </>}
    {tab === 'progress' && (() => {
      const due = ring.filter(r => r.due); const doneN = due.filter(r => r.done).length;
      const gp = plan.goal ? goalPct(me, plan.goal) : Math.round(ins.progress.percent * 100);
      const myTests = tests.length + data.exams.filter(x => x.studentId === me.id).length;
      return <div className="flex flex-col gap-5">
      <PageTitle title="My progress" sub={plan.goal ? `Goal: ${plan.goal.label}` : undefined} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><Rings parts={[
          { label: plan.goal ? 'Goal' : 'Qurʾān', value: gp / 100, detail: plan.goal?.done ? 'Reached!' : `${gp}%${plan.goal?.eta ? ` · by ${new Date(plan.goal.eta).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}`, color: 'rgb(var(--good))' },
          { label: 'This week', value: weekRev.target ? weekRev.oldPages / weekRev.target : 0, detail: weekRev.target ? `${weekRev.oldPages} of ${weekRev.target} Old pages` : `${weekRev.oldPages} pages`, color: '#C08A2E' },
          { label: 'Today', value: due.length ? doneN / due.length : 1, detail: due.length ? `${doneN} of ${due.length} done` : 'Rest day', color: '#3B82C4' },
        ]} /></Card>
        <Card className="p-5"><div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="font-bold">Streak</h2><p className="flex items-center gap-1.5 text-sm"><StreakFlame days={sk.days} size={20} /><b className="text-2xl text-pine-700">{sk.days}</b> day{sk.days === 1 ? '' : 's'} <span className="text-ink-faint">· best {ins.longest}</span></p></div>
          <StreakCalendar dates={sd.sessions.filter(x => x.studentId === me.id).map(x => x.date)} frozen={sk.frozen} today={today} /></Card>
      </div>
      <Card className="p-5"><LevelBar total={pts.total} lvl={lvl} streak={sk.days} freezes={org.settings.motivation.freezePerWeek} frozenDays={sk.frozen.length} /></Card>
      <WeeklyRevisionCard w={weekRev} onLog={(t, d) => { setRecDate(d); setRec(t); }} />
      <Card><CardHead title="Your Qurʾān" sub={`${ins.progress.juz} juz · ${ins.progress.pages} pages memorised`} /><div className="px-5 pb-5 pt-3"><JuzMap ranges={me.memorized} /></div></Card>
      <BadgeGrid items={badges(sd.sessions, beh, sd.milestones, me.memorized)} />
      <Card className="divide-y divide-line overflow-hidden">
        {certs.length > 0 && <Row title="My certificates" value={`${certs.length}`}><div className="flex flex-wrap gap-2">{certs.map(c => <a key={c.code} href={href('certificate', me.id, c.code)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brass-100 px-3 text-sm font-bold text-brass-700"><Award size={16} />{c.title}</a>)}</div></Row>}
        {plan.goal && !plan.goal.done && <Row title="When will I finish?" value={plan.goal.eta ? new Date(plan.goal.eta).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}><WhatIf student={me} remaining={plan.goal.remaining} baseWeeks={plan.goal.weeks} lessonsPerWeek={Math.max(1, lessonDays.length)} today={today} /></Row>}
        <Row title="My revision log" value=""><MyRevisionLog studentId={me.id} sessions={sd.sessions} start={startLabel(me)} onStart={() => setStartOpen(true)} /></Row>
        <Row title="Weak ayahs" value={weakCount ? String(weakCount) : ''}>{weakCount ? <WeakAyahsCard sessions={sd.sessions} studentId={me.id} /> : <p className="text-sm text-ink-faint">No mistakes marked in the last 60 days. Mā shāʾ Allāh.</p>}</Row>
        <Row title="My weekly and monthly report" value=""><StudentPeriodReport you student={me} ins={ins} sessions={sd.sessions} attendance={data.attendance} today={today} settings={org.settings} orgName={org.name} /></Row>
        <Row title="Leaderboard" value=""><Leaderboard /></Row>
        {myTests > 0 && <Row title="My juz tests" value={`${myTests}`}><ExamList exams={data.exams} students={data.students} fixedStudent={me.id} onChanged={reload} /></Row>}
        <Row title="Adab from your teacher" value={`${beh.filter(b => b.value > 0).length} good marks`}><AdabSummary points={beh} title="Adab & effort from your teacher" /></Row>
        <Row title="Charts and all 604 pages" value=""><Overview noStats ins={ins} sessions={sd.sessions} milestones={sd.milestones} goals={goals} today={today} /></Row>
      </Card>
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
        <LinkRow title="What I’ve memorised" value={`${ins.progress.pages} pages${me.skippedSurahs?.length ? ` · ${me.skippedSurahs.length} skipped` : ''}`} onClick={() => setMemOpen(true)} />
        <LinkRow title="Each lesson" value={me.newPages ? `${me.newPages === 0.5 ? '½' : me.newPages} page${me.newPages > 1 ? 's' : ''}` : `${me.dailyNewAyahs} ayahs`} onClick={() => setEdit(true)} />
        <LinkRow title="Goal" value={me.goal || 'Not set'} onClick={() => setEdit(true)} />
        <LinkRow title="Direction" value={me.direction === 'back' ? 'Backwards from An-Nās' : 'Forwards from Al-Fātiḥah'} onClick={() => setEdit(true)} />
        <LinkRow title="Old revision starts from" value={startLabel(me) ?? 'Default order'} onClick={() => setStartOpen(true)} />
        <Row title="My full plan" value={ins.nextNew ? `Next: ${formatRange(ins.nextNew)}` : ''}><PlanCard plan={plan} /></Row>
      </Group>
      <Group title="Halaqah and qirāʾāt">
        <Row title="My halaqah" value={cl.title}><HalaqahChooser student={me} data={data} onChanged={reload} /></Row>
        <Row title="Qirāʾāt" value=""><QiraatMine student={me} data={data} onChanged={reload} /></Row>
        <Row title="Class expectations" value={me.rulesAckAt ? 'Agreed' : 'Not yet'} tone={me.rulesAckAt ? 'good' : 'warn'}><RulesCard compact text={org.settings.rulesText} ackAt={me.rulesAckAt} onAck={async () => { try { await api.ackRules(me.id); reload(); } catch (e) { void e; } }} /></Row>
        {org.settings.parentsEnabled && <Row title="Parent" value={me.guardianName || ''}><p className="text-[15px]">{me.guardianName || '—'} {me.guardianEmail && <span className="text-ink-faint">({me.guardianEmail})</span>}</p>{me.parentCode && <p className="text-[15px]"><b>Parent code:</b> <span className="font-mono tracking-widest">{me.parentCode}</span></p>}</Row>}
      </Group>
      <Group title="This phone">
        <Row title="Notifications" value=""><NotifyToggle /></Row>
        <Row title="Display" value={`${{ auto: 'Auto', light: 'Light', dark: 'Dark' }[getTheme()]} · ${{ normal: 'Normal text', large: 'Large text', xl: 'Extra large text' }[getTextSize()]}`}><DisplaySettings /></Row>
        <LinkRow title="Take the app tour" icon={Sparkles} onClick={startTour} />
        <LinkRow title="Sign out" icon={LogOut} onClick={() => backend.signOut()} />
      </Group>
      <p className="px-1 text-sm text-ink-faint">Only you and your teachers{org.settings.parentsEnabled ? ' (and a linked parent)' : ''} can see your records.</p>
      {memOpen && <MemorisedModal student={me} onClose={() => setMemOpen(false)} onSaved={refresh} />}
      {edit && <EditStudent st={me} asStudent onClose={() => setEdit(false)} onSaved={refresh} />}
    </div>}
    {submitNew && ins?.nextNew && me && <SubmitLessonModal student={me} suggested={ins.nextNew} onClose={() => setSubmitNew(false)} onSaved={refresh} />}
    {rec && <RecordSheet open onClose={() => { setRec(null); setRecDate(undefined); }} student={me} insight={ins} sessions={sd.sessions} asStudent initialType={rec} initialDate={recDate} revisionForms={data.revisionForms} onSaved={refresh} />}
  </>;
}
/** Old revision this week: one circle per time, filled when done */
function WeekDots({ done, of }: { done: number; of: number }) {
  return <span className="flex items-center gap-1.5" aria-label={`${done} of ${of} revisions this week`}>{Array.from({ length: of }, (_, i) => <span key={i} className={cx('grid h-8 w-8 place-items-center rounded-full text-sm font-bold', i < done ? 'bg-pine-700 text-white' : 'border-2 border-dashed border-pine-600/40 text-pine-700')}>{i < done ? <CheckCircle2 size={15} /> : i + 1}</span>)}</span>;
}
/** The first run of back-to-back pages, as a range (today's Old revision may jump around) */
const firstRun = (pages: number[]) => { const p = [...new Set(pages)].sort((a, b) => a - b); let e = 0; while (e + 1 < p.length && p[e + 1] === p[e] + 1) e++; return { start: pageRange(p[0]).start, end: pageRange(p[e]).end }; };

/** Shown once every part of today's reading is logged. The burst plays the first time each day. */
function DoneToday({ name, streak }: { name: string; streak: number }) {
  const { today } = useOrg();
  const [fresh] = useState(() => { try { const k = 'hifz-done-day'; const first = localStorage.getItem(k) !== today; localStorage.setItem(k, today); return first; } catch { return false; } });
  return <div role="status" className={cx('relative mb-5 overflow-hidden rounded-2xl bg-pine-700 px-5 py-4 text-white shadow-card', fresh && 'done-pop')}>
    {fresh && <span aria-hidden className="done-burst" />}
    <p className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 size={22} />All done for today, {name}!</p>
    <p className="text-sm text-white/85">New lesson and revision are logged. Mā shāʾ Allāh.{streak > 1 ? ` That is ${streak} days in a row.` : ''}</p>
  </div>;
}

/** A row of tabs over one card: the extras live here instead of in a long scroll. Remembers the last tab. */
function Notebook({ tabs, initial }: { tabs: Array<{ key: string; label: string; node: React.ReactNode }>; initial: string }) {
  const [t, setT] = useState(() => { try { const v = localStorage.getItem('hifz-notebook'); return v && tabs.some(x => x.key === v) ? v : initial; } catch { return initial; } });
  const cur = tabs.find(x => x.key === t) ?? tabs[0];
  const pick = (k: string) => { setT(k); try { localStorage.setItem('hifz-notebook', k); } catch { /* */ } };
  return <div>
    <SubTabs label="More for you" className="mb-3" active={cur.key} onChange={pick} items={tabs.map(x => ({ key: x.key, label: x.label }))} />
    <div role="tabpanel">{cur.node}</div>
  </div>;
}

type Step = { practice?: Range | null; key: string; tip?: GlossaryKey; icon: React.ReactNode; title: string; body: string; note: React.ReactNode; action: React.ReactNode; state: 'todo' | 'done' | 'waiting' | 'none' };
/** Today as one short path: the next thing to do is open with its buttons; finished and later steps stay folded. */
function TodayPath({ steps, studentId }: { steps: Step[]; studentId?: string }) {
  const due = steps.filter(s => s.state !== 'none'); const doneN = due.filter(s => s.state !== 'todo').length;
  const current = steps.find(s => s.state === 'todo')?.key ?? null;
  const [open, setOpen] = useState<string | null>(null);
  const isOpen = (k: string) => (open ?? current) === k;
  return <Card className="overflow-hidden">
    <div className="flex items-center gap-3 px-5 pb-3 pt-4">
      <h2 className="flex-1 text-lg font-bold">Today</h2>
      {due.length > 0 && <span className="text-sm font-bold text-pine-700">{doneN} of {due.length} done</span>}
    </div>
    {due.length > 0 && <div className="mx-5 mb-2 h-1.5 overflow-hidden rounded-full bg-black/[.06]"><div className="h-full rounded-full bg-pine-600 transition-all duration-500" style={{ width: `${(doneN / due.length) * 100}%` }} /></div>}
    <ol>{steps.map((st, k) => { const o = isOpen(st.key); const last = k === steps.length - 1;
      return <li key={st.key} className="relative">
        {!last && <span aria-hidden className={cx('absolute left-[37px] top-[46px] bottom-0 w-0.5', st.state === 'done' || st.state === 'waiting' ? 'bg-pine-600/40' : 'bg-line')} />}
        <button type="button" onClick={() => setOpen(o ? '__none' : st.key)} aria-expanded={o} className="flex w-full items-center gap-3 px-5 py-3 text-left">
          <span className={cx('relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full ring-2', st.state === 'done' ? 'bg-pine-600 text-white ring-pine-600' : st.state === 'waiting' ? 'bg-brass-100 text-brass-500 ring-brass-500/50' : st.key === current ? 'bg-white text-pine-700 ring-pine-600' : 'bg-white text-ink-faint ring-line')}>
            {st.state === 'done' ? <CheckCircle2 size={18} /> : st.state === 'waiting' ? <Clock3 size={17} /> : st.icon}</span>
          <span className="min-w-0 flex-1"><span className={cx('flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide', st.key === current ? 'text-pine-700' : 'text-ink-faint')}>{st.title}{st.key === current && <span className="rounded-full bg-pine-700 px-2 py-px text-[10px] text-white">Next</span>}{st.state === 'waiting' && <span className="normal-case tracking-normal">· waiting for sign-off</span>}</span>
            <span className={cx('block truncate text-[16px] font-bold', st.state === 'none' ? 'text-ink-faint' : st.state === 'done' ? 'text-ink-soft' : 'text-ink')}>{st.body}</span></span>
          <ChevronDown size={18} className={cx('shrink-0 text-ink-faint transition', o && 'rotate-180')} />
        </button>
        {o && <div className="flex flex-col gap-3 pb-4 pl-[68px] pr-5">
          {st.note && <p className="flex items-start gap-1 text-sm text-ink-soft">{st.note}{st.tip && <InfoTip k={st.tip} />}</p>}
          {st.state !== 'done' && st.action}
          {st.state === 'done' && <p className="text-sm font-bold text-good">Logged today. Mā shāʾ Allāh.</p>}
          {st.practice && <div><PracticeButton range={st.practice} studentId={studentId} label="Practise: recite, repeat and word order" /></div>}
        </div>}
      </li>; })}</ol>
  </Card>;
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
