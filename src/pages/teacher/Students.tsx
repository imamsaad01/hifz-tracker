import { weekSummary, revSchedule } from '../../lib/weekly';
import { useMemo, useState } from 'react';
import { UserPlus, Search, Users, Download } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { useRoute, go, href } from '../../app/router';
import { insight } from '../../lib/insights';
import { niceDate } from '../../lib/dates';
import { downloadCsv } from '../../lib/csv';
import { formatRange } from '../../quran';
import { Button, Card, Progress, Spinner, ErrorBox, Empty, Modal, inputCls, useToast, SubTabs, cx } from '../../components/ui';
import { StudentForm, type StudentDraft } from '../../components/StudentForm';
import { PageTitle } from '../../components/Shell';
import { friendly } from '../../api/backend';

export function Students() {
  const { org, today, api } = useOrg();
  const { data, error, reload } = useOrgData();
  const route = useRoute();
  const toast = useToast();
  const [q, setQ] = useState(''); const [cls, setCls] = useState('all'); const [sort, setSort] = useState('attention');
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
      if (id && (d.nextFromSurah || d.skippedSurahs.length)) await api.setMemorisedSurahs(id, { nextFrom: d.nextFromSurah, skipped: d.skippedSurahs });
      if (d.qiraat && id) await api.setQiraat(id, d.qiraat);
      toast(`${d.name} added.`); await reload(); go('students', id);
    } catch (e) { throw new Error(friendly(e)); }
  };
  const exportAll = () => downloadCsv(`${org.name} students.csv`, list.map(i => ({ name: i.student.name, age_group: i.student.ageGroup ?? '', memorised_pct: (i.progress.percent * 100).toFixed(1), pages: i.progress.pages, juz: i.progress.juz, next_lesson: i.nextNew ? formatRange(i.nextNew) : '', last_session: i.lastSession?.date ?? '', streak: i.streak, overdue_pages: i.revision.overdue.length, accuracy_30d: i.avgAccuracy30 ?? '', attendance_30d: i.attendanceRate30 === null ? '' : Math.round(i.attendanceRate30 * 100), parent_email: i.student.guardianEmail ?? '' })));
  const status = (i: typeof ins[number]) => {
    const pend = data.sessions.some(x => x.studentId === i.student.id && x.type === 'new' && x.selfLogged && !x.checkStatus);
    const top = i.reasons.filter(r => r.severity >= 2).sort((a, b) => b.severity - a.severity)[0];
    if (top && top.severity >= 3) return { tone: 'bad' as const, text: top.text, rank: 3 };
    if (pend) return { tone: 'brass' as const, text: 'Lesson waiting for your sign-off', rank: 2 };
    if (top) return { tone: 'warn' as const, text: top.text, rank: 1 };
    return { tone: 'good' as const, text: i.lastSession ? `On track · last ${niceDate(i.lastSession.date)}` : 'No sessions yet', rank: 0 };
  };
  const ranked = sort === 'attention' ? [...list].sort((a, b) => status(b).rank - status(a).rank || a.student.name.localeCompare(b.student.name)) : list;
  const needs = list.filter(i => status(i).rank > 0).length;
  const DOT = { bad: 'bg-bad', brass: 'bg-brass-500', warn: 'bg-warn', good: 'bg-good' } as const;
  return <>
    <PageTitle title="Students" sub={`${data.students.length} active · ${needs} need you`} action={<div className="flex gap-2"><Button kind="secondary" className="w-11 px-0" aria-label="Download the list as CSV" title="Download CSV" onClick={exportAll} disabled={!list.length}><Download size={16} /></Button><Button onClick={() => go('students', 'new')}><UserPlus size={18} />Add student</Button></div>} />
    <div className="mb-3 flex flex-col gap-3">
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden /><input className={`${inputCls} pl-9`} placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search by name" /></div>
      <div className="flex flex-wrap items-center gap-2">
        {data.classes.length > 1 && <SubTabs label="Halaqah" className="mb-0" active={cls} onChange={setCls} items={[{ key: 'all', label: 'All' }, ...data.classes.map(c => ({ key: c.id, label: c.name }))]} />}
        <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} className="h-11 rounded-full bg-white px-4 text-sm font-bold text-ink-soft ring-1 ring-line"><option value="attention">Who needs me first</option><option value="name">Name</option><option value="progress">Most memorised</option><option value="last">Longest since last session</option></select>
      </div>
    </div>
    <Card>
      {ranked.length ? <ul className="divide-y divide-line">{ranked.map(i => { const st = status(i); const w = weekSummary(data.sessions.filter(x => x.studentId === i.student.id), today, revSchedule(org.settings.revision), i.revision.perDay, false);
        return <li key={i.student.id}><a href={href('students', i.student.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-paper sm:px-5">
          <span className="relative shrink-0"><span className="grid h-11 w-11 place-items-center rounded-full bg-pine-100 text-sm font-bold text-pine-800">{i.student.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><i className={cx('absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white', DOT[st.tone])} aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <b className="flex items-center gap-2 truncate">{i.student.name}{data.qiraat.profiles.some(p => p.studentId === i.student.id && p.active) && <span className="rounded-full bg-brass-100 px-2 py-0.5 text-[11px] font-bold text-brass-700">Qirāʾāt</span>}{!i.student.userId && <span className="text-xs font-normal text-ink-faint">no account</span>}</b>
            <span className={cx('block truncate text-sm', st.tone === 'good' ? 'text-ink-faint' : st.tone === 'bad' ? 'text-bad' : st.tone === 'brass' ? 'text-brass-700' : 'text-warn')}>{st.text}</span>
            <span className="mt-1 flex items-center gap-2"><Progress value={i.progress.percent} label={`${i.student.name} memorised`} /><span className="shrink-0 text-xs tabular-nums text-ink-faint">{i.progress.pages}p</span></span>
          </span>
          {w.target > 0 && <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', w.perWeek ? (w.oldDays >= w.perWeek ? 'bg-emerald-50 text-good' : 'bg-black/[.04] text-ink-soft') : w.percent >= 1 ? 'bg-emerald-50 text-good' : 'bg-black/[.04] text-ink-soft')} title="Old revision this week">{w.perWeek ? `${Math.min(w.oldDays, w.perWeek)}/${w.perWeek}` : `${w.oldPages}/${w.target}p`}</span>}
        </a></li>; })}</ul> : <Empty icon={<Users size={30} />} title={data.students.length ? 'No students match' : 'No students yet'}>{data.students.length ? 'Try a different name or halaqah.' : <>Add a student, or share the student code <b className="font-mono">{org.joinCode}</b>.</>}</Empty>}
    </Card>
    <p className="mt-2 px-1 text-xs text-ink-faint"><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-bad align-middle" />needs attention · <i className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-brass-500 align-middle" />to sign off · <i className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-warn align-middle" />keep an eye on · <i className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-good align-middle" />on track · the number on the right is Old revision this week</p>
    <Modal open={adding} onClose={() => go('students')} title="Add a student" wide>
      <StudentForm byTeacher onSubmit={add} onCancel={() => go('students')} />
    </Modal>
  </>;
}
