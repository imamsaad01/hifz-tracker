// The views of one student that teachers, the student and parents all share. Everything here is computed from saved records.
import { useMemo, useState } from 'react';
import { Award, Download, Printer, Trash2 } from 'lucide-react';
import type { Milestone, RevisionItem, Session, Student, SessionType } from '../lib/types';
import { ERROR_LABEL, SESSION_LABEL } from '../lib/types';
import type { Goal } from '../api/data';
import type { StudentInsight } from '../lib/insights';
import { groupPages } from '../lib/revision';
import { goalValue, METRIC_LABEL } from '../lib/goals';
import { juzProgress } from '../lib/progress';
import { accuracy } from '../lib/scoring';
import { addDays, niceDate } from '../lib/dates';
import { downloadCsv } from '../lib/csv';
import { formatRange, fromAyahId, pagesInRange, surahNameEn } from '../quran';
import { Card, CardHead, Stat, Progress, Pill, Select, Button, Field, Empty, inputCls } from './ui';
import { JuzMap, PageMap, Timeline, DailyBars } from './quran';
import type { OrgSettings } from '../lib/types';

export const MILESTONE_LABEL: Record<string, string> = {
  first_page: 'First full page', juz_1: 'First juz', juz_5: '5 juz', juz_10: '10 juz', juz_15: 'Half the Qurʾān', juz_20: '20 juz', juz_25: '25 juz',
  quran_complete: 'The whole Qurʾān', sessions_100: '100 sessions', days_365: 'One year of hifz',
};
const pagesText = (items: RevisionItem[]) => (items.length === 1 ? 'page ' : 'pages ') + groupPages(items.map(i => i.page).sort((a, b) => a - b)).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');

export function Overview({ ins, sessions, milestones, goals, today, onDeleteGoal, noStats }: {
  ins: StudentInsight; sessions: Session[]; milestones: Milestone[]; goals: Goal[]; today: string; settings?: OrgSettings; onDeleteGoal?: (g: Goal) => void; noStats?: boolean;
}) {
  const st = ins.student;
  const juzDone = juzProgress(st.memorized).filter(x => x >= 1).length;
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map(d => ({ date: d, value: sessions.filter(s => s.date === d).reduce((n, s) => n + pagesInRange(s.range).length, 0) }));
  const cats = useMemo(() => { const m = new Map<string, number>(); sessions.filter(s => s.date >= addDays(today, -30)).forEach(s => s.errors.forEach(e => m.set(e.category, (m.get(e.category) ?? 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [sessions, today]);
  const catMax = Math.max(1, ...cats.map(c => c[1]));
  return <div className="flex flex-col gap-5">
    {!noStats && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Memorised" value={`${(ins.progress.percent * 100).toFixed(1)}%`} sub={`${ins.progress.pages} pages · ${ins.progress.juz} juz`} />
      <Stat label="Streak" value={`${ins.streak} day${ins.streak === 1 ? '' : 's'}`} sub={`Best: ${ins.longest}`} />
      <Stat label="Accuracy (30 days)" value={ins.avgAccuracy30 === null ? '—' : `${ins.avgAccuracy30}%`} sub="from errors per page" />
      <Stat label="Attendance (30 days)" value={ins.attendanceRate30 === null ? '—' : `${Math.round(ins.attendanceRate30 * 100)}%`} sub={`${ins.newAyahs7} new ayahs this week`} />
    </div>}
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><CardHead title="Revision today" sub={`${ins.revision.perDay} page${ins.revision.perDay === 1 ? '' : 's'} per revision day · ${ins.revision.cycleDays ? 'weak pages first, then in turn' : 'most overdue first'}`} />
        <div className="flex flex-col gap-3 px-5 py-4 text-[15px]">
          <p><b>Next new lesson:</b> {ins.nextNew ? formatRange(ins.nextNew) : 'Everything is memorised. Mā shāʾ Allāh.'}</p>
          <p><b>Old revision today:</b> {!ins.revision.isRevisionDay ? `rest day${ins.revision.nextRevisionDay ? ` · next on ${niceDate(ins.revision.nextRevisionDay)}` : ''}` : ins.revision.today.length ? pagesText(ins.revision.today) : 'nothing due'}{ins.revision.capped ? <span className="text-ink-faint"> (+{ins.revision.capped} more waiting)</span> : null}</p>
          {ins.revision.overdue.length > 0 && <p className="text-warn"><b>Overdue:</b> {pagesText(ins.revision.overdue)}{ins.revision.overdue.every(o => ins.revision.today.some(t => t.page === o.page)) ? ' (included above)' : ''}</p>}
          {ins.revision.weak.length > 0 && <p className="text-bad"><b>Weak:</b> {pagesText(ins.revision.weak)}</p>}
          {ins.revision.soon.length > 0 && <p className="text-ink-soft"><b>{ins.revision.cycleDays ? 'Next in turn:' : 'Coming up (3 days):'}</b> {pagesText(ins.revision.soon)}</p>}
        </div></Card>
      <Card className="pb-4"><CardHead title="Pages read, last 30 days" /><div className="px-5 pt-3"><DailyBars days={days} label="pages a day" /></div></Card>
    </div>
    <Card><CardHead title="Juz" sub="Filled when every ayah of the juz is memorised" /><div className="px-5 py-4"><JuzMap ranges={st.memorized} /></div></Card>
    <Card><CardHead title="All 604 pages" sub="Madinah mushaf (Hafs)" /><div className="px-5 py-4"><PageMap ranges={st.memorized} items={[...ins.revision.today, ...ins.revision.overdue, ...ins.revision.soon, ...ins.revision.weak]} today={today} /></div></Card>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><CardHead title="Mistakes, last 30 days" sub="From tagged errors" />
        {cats.length ? <ul className="flex flex-col gap-2 px-5 py-4">{cats.map(([c, n]) => <li key={c} className="grid grid-cols-[150px_1fr_28px] items-center gap-2 text-sm"><span>{ERROR_LABEL[c as keyof typeof ERROR_LABEL]}</span><Progress value={n / catMax} label={ERROR_LABEL[c as keyof typeof ERROR_LABEL]} /><b className="text-right tabular-nums">{n}</b></li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-faint">No tagged mistakes.</p>}
        {ins.repeatedErrorAyahs.length > 0 && <p className="border-t border-line px-5 py-3 text-sm"><b>Repeated at:</b> {ins.repeatedErrorAyahs.slice(0, 12).map(id => { const a = fromAyahId(id); return `${surahNameEn(a.surah)} ${a.surah}:${a.ayah}`; }).join(' · ')}</p>}
      </Card>
      <Card><CardHead title="Goals" sub="Progress is counted from saved sessions" />
        {goals.length ? <ul className="flex flex-col gap-3 px-5 py-4">{goals.map(g => { const v = goalValue(g, sessions, today, juzDone); return <li key={g.id}>
          <div className="flex items-center gap-2 text-sm"><b className="flex-1">{g.target} {METRIC_LABEL[g.metric]} · {g.period}</b><span className="tabular-nums">{Math.min(v, g.target)}/{g.target}</span>{onDeleteGoal && <button type="button" aria-label="Delete goal" onClick={() => onDeleteGoal(g)} className="text-ink-faint hover:text-bad"><Trash2 size={15} /></button>}</div>
          <Progress className="mt-1.5" value={v / g.target} label={`${METRIC_LABEL[g.metric]} goal`} /></li>; })}</ul> : <p className="px-5 py-4 text-sm text-ink-faint">No goals set.</p>}
      </Card>
    </div>
    <Card><CardHead title="Milestones" />
      {milestones.length ? <ul className="flex flex-wrap gap-2 px-5 py-4">{milestones.sort((a, b) => a.achievedOn.localeCompare(b.achievedOn)).map(m => <li key={m.code}><Pill tone="brass"><Award size={13} />{MILESTONE_LABEL[m.code] ?? m.code} · {niceDate(m.achievedOn)}</Pill></li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-faint">The first milestone is one full page.</p>}
    </Card>
  </div>;
}

const TYPES: Array<[string, string]> = [['all', 'All types'], ...Object.entries(SESSION_LABEL)];
const PERIODS: Array<[string, string]> = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last year'], ['all', 'All time']];
export function sessionRows(list: Session[], name: string, settings: OrgSettings) {
  return list.map(s => ({ date: s.date, student: name, type: SESSION_LABEL[s.type], range: formatRange(s.range), pages: pagesInRange(s.range).length, errors_major: s.errorsMajor, errors_minor: s.errorsMinor,
    accuracy_pct: accuracy(s.errorsMajor, s.errorsMinor, pagesInRange(s.range).length, settings.accuracy), tajweed: s.scores.tajweed ?? '', fluency: s.scores.fluency ?? '', overall: s.scores.overall ?? '',
    attendance: s.attendance, mode: s.mode, mistakes: s.errors.map(e => ERROR_LABEL[e.category]).join('; '), teacher_note: s.teacherNote ?? '', student_note: s.studentNote ?? '', recorded_by: s.recordedBy }));
}
export function History({ student, sessions, today, settings, onDelete }: { student: Student; sessions: Session[]; today: string; settings: OrgSettings; onDelete?: (s: Session) => void }) {
  const [type, setType] = useState('all'); const [period, setPeriod] = useState('90');
  const list = sessions.filter(s => (type === 'all' || s.type === (type as SessionType)) && (period === 'all' || s.date >= addDays(today, -Number(period))));
  return <Card>
    <div className="no-print grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Type">{id => <Select id={id} value={type} onChange={setType} options={TYPES} />}</Field>
      <Field label="Period">{id => <Select id={id} value={period} onChange={setPeriod} options={PERIODS} />}</Field>
      <Button kind="secondary" disabled={!list.length} onClick={() => downloadCsv(`${student.name} sessions.csv`, sessionRows(list, student.name, settings))}><Download size={16} />CSV</Button>
    </div>
    <div className="px-5 py-5">{list.length ? <Timeline sessions={list} onDelete={onDelete} /> : <Empty title="Nothing in this period" />}</div>
  </Card>;
}

/** A printable month: totals, the sessions, and the teacher's notes. Print to PDF from the browser. */
export function MonthReport({ student, ins, sessions, today, settings, orgName }: { student: Student; ins: StudentInsight; sessions: Session[]; today: string; settings: OrgSettings; orgName: string }) {
  const months = useMemo(() => { const out: string[] = []; let d = today.slice(0, 7); for (let i = 0; i < 12; i++) { out.push(d); const [y, m] = d.split('-').map(Number); d = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; } return out; }, [today]);
  const [month, setMonth] = useState(months[0]);
  const list = sessions.filter(s => s.date.startsWith(month));
  const nw = list.filter(s => s.type === 'new'); const rv = list.filter(s => s.type !== 'new');
  const acc = list.map(s => accuracy(s.errorsMajor, s.errorsMinor, pagesInRange(s.range).length, settings.accuracy));
  const label = new Date(`${month}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <div className="flex flex-col gap-4">
    <div className="no-print flex flex-wrap items-end gap-3">
      <Field label="Month" className="min-w-[200px]">{id => <Select id={id} value={month} onChange={setMonth} options={months.map(m => [m, new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })])} />}</Field>
      {window.self === window.top && <Button kind="secondary" onClick={() => window.print()}><Printer size={16} />Print or save as PDF</Button>}
      <Button kind="secondary" disabled={!list.length} onClick={() => downloadCsv(`${student.name} ${month}.csv`, sessionRows(list, student.name, settings))}><Download size={16} />CSV</Button>
    </div>
    <Card className="p-6 print:border-0 print:shadow-none">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{orgName} · Monthly hifz report</p>
      <h2 className="mt-1 text-2xl font-bold">{student.name} — {label}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Sessions', new Set(list.map(s => s.date)).size + ' days'], ['New ayahs', nw.reduce((n, s) => n + s.range.end - s.range.start + 1, 0)], ['Pages revised', rv.reduce((n, s) => n + pagesInRange(s.range).length, 0)], ['Accuracy', acc.length ? Math.round(acc.reduce((a, b) => a + b, 0) / acc.length) + '%' : '—']].map(([l, v]) =>
          <div key={l} className="rounded-xl border border-line p-3"><p className="text-xs font-bold uppercase text-ink-faint">{l}</p><p className="text-xl font-bold">{v}</p></div>)}
      </div>
      <p className="mt-4 text-[15px]"><b>Total memorised:</b> {(ins.progress.percent * 100).toFixed(1)}% ({ins.progress.pages} pages, {ins.progress.juz} juz). <b>Next:</b> {ins.nextNew ? formatRange(ins.nextNew) : '—'}</p>
      <div className="mt-5">{list.length ? <Timeline sessions={list} /> : <p className="text-sm text-ink-faint">No sessions this month.</p>}</div>
      <p className="mt-6 text-xs text-ink-faint">Accuracy is calculated from the number of errors per page ({settings.accuracy.major} points per major, {settings.accuracy.minor} per minor). It reflects what the teacher recorded, not an automatic judgement of recitation.</p>
    </Card>
  </div>;
}

/** Term report card: progress, attendance, adab, tests and a teacher comment, printable. */
export function TermReport({ student, ins, sessions, attendance, behaviour, exams, today, settings, orgName, teacher }: {
  student: Student; ins: StudentInsight; sessions: Session[]; attendance: Array<{ studentId: string; date: string; status: string }>; behaviour: Array<{ studentId: string; date: string; category: string; value: number }>;
  exams: Array<{ studentId: string; title: string; scheduledOn: string; status: string; score: number | null }>; today: string; settings: OrgSettings; orgName: string; teacher: string | null;
}) {
  const [from, setFrom] = useState(addDays(today, -89)); const [to, setTo] = useState(today); const [comment, setComment] = useState('');
  const list = sessions.filter(s => s.date >= from && s.date <= to);
  const att = attendance.filter(a => a.studentId === student.id && a.date >= from && a.date <= to);
  const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
  const beh = behaviour.filter(b => b.studentId === student.id && b.date >= from && b.date <= to);
  const ex = exams.filter(e => e.studentId === student.id && e.scheduledOn >= from && e.scheduledOn <= to && e.status !== 'scheduled');
  const acc = list.map(s => accuracy(s.errorsMajor, s.errorsMinor, pagesInRange(s.range).length, settings.accuracy));
  const newAyahs = list.filter(s => s.type === 'new').reduce((n, s) => n + s.range.end - s.range.start + 1, 0);
  const revPages = list.filter(s => s.type !== 'new').reduce((n, s) => n + pagesInRange(s.range).length, 0);
  const by = new Map<string, number>(); beh.forEach(b => by.set(b.category, (by.get(b.category) ?? 0) + b.value));
  const grade = (a: number | null) => a === null ? '—' : a >= 95 ? 'Excellent' : a >= 85 ? 'Very good' : a >= 75 ? 'Good' : a >= 60 ? 'Fair' : 'Needs work';
  const avg = acc.length ? Math.round(acc.reduce((a, b) => a + b, 0) / acc.length) : null;
  return <div className="flex flex-col gap-4">
    <div className="no-print grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="From">{id => <input id={id} type="date" className={inputCls} value={from} max={to} onChange={e => setFrom(e.target.value)} />}</Field>
      <Field label="To">{id => <input id={id} type="date" className={inputCls} value={to} min={from} max={today} onChange={e => setTo(e.target.value)} />}</Field>
      {window.self === window.top && <Button kind="secondary" onClick={() => window.print()}><Printer size={16} />Print or save as PDF</Button>}
    </div>
    <Field label="Teacher’s comment (printed on the report, not saved)" className="no-print">{id => <textarea id={id} className={`${inputCls} min-h-[80px] py-2`} maxLength={800} value={comment} onChange={e => setComment(e.target.value)} placeholder="e.g. Strong memorisation and steady revision. Focus next term on madd and waqf." />}</Field>
    <Card className="p-6 print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-pine-700 pb-3"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{orgName} · Report card</p><h2 className="mt-1 text-2xl font-bold">{student.name}</h2></div><p className="text-right text-sm text-ink-soft">{niceDate(from)} – {niceDate(to)}{teacher ? <><br />Teacher: {teacher}</> : null}</p></div>
      <table className="mt-4 w-full text-[15px]"><tbody>
        {[['Memorised in total', `${(ins.progress.percent * 100).toFixed(1)}% · ${ins.progress.pages} pages · ${ins.progress.juz} juz`], ['New this period', `${newAyahs} ayahs`], ['Revision this period', `${revPages} pages`], ['Accuracy', `${avg ?? '—'}${avg !== null ? '%' : ''} · ${grade(avg)}`], ['Attendance', att.length ? `${present} of ${att.length} days (${Math.round((present / att.length) * 100)}%)` : '—'],
          ['Adab & effort', by.size ? [...by.entries()].map(([c, n]) => `${c} ${n > 0 ? '+' : ''}${n}`).join(' · ') : '—'], ['Tests', ex.length ? ex.map(e => `${e.title}: ${e.status}${e.score !== null ? ` (${e.score}%)` : ''}`).join(' · ') : '—']]
          .map(([k, v]) => <tr key={k} className="border-b border-line"><th className="w-48 py-2 pr-3 text-left align-top font-bold text-ink-soft">{k}</th><td className="py-2">{v}</td></tr>)}
      </tbody></table>
      {comment && <div className="mt-4 rounded-xl bg-paper p-4"><p className="text-xs font-bold uppercase text-ink-faint">Teacher’s comment</p><p className="mt-1 whitespace-pre-line">{comment}</p></div>}
      <div className="mt-10 grid grid-cols-2 gap-8 text-sm"><p className="border-t border-ink/40 pt-1">Teacher’s signature</p><p className="border-t border-ink/40 pt-1">Parent’s signature</p></div>
    </Card>
  </div>;
}
