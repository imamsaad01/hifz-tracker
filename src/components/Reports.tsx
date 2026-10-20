// Weekly and monthly reports: one student (teacher, or the student themself) and the whole class.
// Pick Weekly or Monthly, step back through earlier periods, then print / save as PDF or download a CSV.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer, Download } from 'lucide-react';
import type { OrgSettings, Session, Student } from '../lib/types';
import type { StudentInsight } from '../lib/insights';
import type { Attendance, ClassRow } from '../api/data';
import { accuracy } from '../lib/scoring';
import { addDays, niceDate } from '../lib/dates';
import { weekStart } from '../lib/schedule';
import { downloadCsv } from '../lib/csv';
import { pagesInRange, formatRange } from '../quran';
import { Card, Button, SubTabs, inputCls, cx } from './ui';
import { Timeline } from './quran';
import { sessionRows } from './StudentReport';
import { Tile } from './Rows';

export type Kind = 'week' | 'month';
export interface Period { start: string; end: string; label: string; short: string }
const monthEnd = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export function periodAt(kind: Kind, today: string, back: number): Period {
  if (kind === 'week') {
    const start = addDays(weekStart(today), -7 * back); const end = addDays(start, 6);
    return { start, end, label: `Week of ${niceDate(start)}`, short: back === 0 ? 'This week' : back === 1 ? 'Last week' : `Week of ${niceDate(start)}` };
  }
  const [y, m] = today.slice(0, 7).split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 - back, 1));
  const ym = d.toISOString().slice(0, 7); const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start: `${ym}-01`, end: monthEnd(ym), label, short: back === 0 ? 'This month' : label };
}
const valid = (s: Session) => s.checkStatus !== 'redo';
/** The numbers for one student over a period */
export function studentNumbers(sessions: Session[], attendance: Attendance[], studentId: string, p: Period, settings: OrgSettings, today: string) {
  const list = sessions.filter(s => s.studentId === studentId && s.date >= p.start && s.date <= p.end && valid(s));
  const nw = list.filter(s => s.type === 'new' && (!s.selfLogged || s.checkStatus === 'ok'));
  const old = list.filter(s => s.type === 'old' || s.type === 'juz_revision');
  const oldDays = new Set(old.map(s => s.date)).size;
  const weeks = Math.max(1, Math.round((Math.min(+new Date(p.end), +new Date(today)) - +new Date(p.start)) / 6048e5 + 0.49));
  const perWeek = settings.revision.perWeek ?? (settings.revision.days?.length ?? 7);
  const acc = list.map(s => accuracy(s.errorsMajor, s.errorsMinor, pagesInRange(s.range).length, settings.accuracy));
  const att = attendance.filter(a => a.studentId === studentId && a.date >= p.start && a.date <= p.end);
  const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
  return {
    list, newLessons: nw.length, newAyahs: nw.reduce((n, s) => n + s.range.end - s.range.start + 1, 0),
    oldDays, oldTarget: perWeek * weeks, oldPages: new Set(old.flatMap(s => pagesInRange(s.range))).size,
    partner: list.filter(s => s.partnerStatus === 'confirmed').length,
    mistakes: list.reduce((n, s) => n + s.errorsMajor + s.errorsMinor, 0),
    accuracy: acc.length ? Math.round(acc.reduce((a, b) => a + b, 0) / acc.length) : null,
    present, classes: att.length,
  };
}

function PeriodBar({ kind, setKind, back, setBack, p }: { kind: Kind; setKind: (k: Kind) => void; back: number; setBack: (n: number) => void; p: Period }) {
  return <div className="no-print flex flex-wrap items-center gap-2">
    <SubTabs label="Report" className="mb-0" active={kind} onChange={k => { setKind(k); setBack(0); }} items={[{ key: 'week', label: 'Weekly' }, { key: 'month', label: 'Monthly' }]} />
    <div className="flex items-center gap-1 rounded-full bg-white px-1 ring-1 ring-line">
      <button type="button" onClick={() => setBack(back + 1)} disabled={back >= (kind === 'week' ? 51 : 23)} aria-label="Earlier" className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-black/5 disabled:opacity-30"><ChevronLeft size={18} /></button>
      <span className="min-w-[96px] text-center text-sm font-bold">{p.short}</span>
      <button type="button" onClick={() => setBack(Math.max(0, back - 1))} disabled={back === 0} aria-label="Later" className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-black/5 disabled:opacity-30"><ChevronRight size={18} /></button>
    </div>
  </div>;
}
const printBtn = () => window.self === window.top && <Button kind="secondary" onClick={() => window.print()}><Printer size={16} /><span className="hidden sm:inline">Print or save as</span> PDF</Button>;

/** One student's weekly or monthly report */
export function StudentPeriodReport({ student, ins, sessions, attendance, settings, orgName, today, you, initialKind = 'week' }: {
  student: Student; ins: StudentInsight; sessions: Session[]; attendance: Attendance[]; settings: OrgSettings; orgName: string; today: string; you?: boolean; initialKind?: Kind;
}) {
  const [kind, setKind] = useState<Kind>(initialKind); const [back, setBack] = useState(0); const [comment, setComment] = useState('');
  const p = periodAt(kind, today, back);
  const n = studentNumbers(sessions, attendance, student.id, p, settings, today);
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><PeriodBar kind={kind} setKind={setKind} back={back} setBack={setBack} p={p} />
      <div className="no-print flex gap-2">{printBtn()}<Button kind="secondary" disabled={!n.list.length} onClick={() => downloadCsv(`${student.name} ${p.start} to ${p.end}.csv`, sessionRows(n.list, student.name, settings))}><Download size={16} />CSV</Button></div></div>
    <Card className="p-6 print:border-0 print:shadow-none">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{orgName} · {kind === 'week' ? 'Weekly' : 'Monthly'} hifz report</p>
      <h2 className="mt-1 text-2xl font-bold">{student.name}</h2>
      <p className="text-sm text-ink-soft">{p.label} · {niceDate(p.start)} – {niceDate(p.end)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="New lessons" value={`${n.newLessons}`} sub={`${n.newAyahs} ayahs signed off`} />
        <Tile label="Old revision" value={`${n.oldDays}`} unit={`of ${n.oldTarget}`} sub={`${n.oldPages} pages`} tone={n.oldDays >= n.oldTarget ? 'good' : n.oldDays >= n.oldTarget * 0.66 ? 'warn' : 'bad'} />
        <Tile label="Partner checked" value={`${n.partner}`} sub="revisions confirmed" />
        <Tile label="Mistakes" value={`${n.mistakes}`} sub="marked by partner or teacher" />
        <Tile label="Accuracy" value={n.accuracy === null ? '—' : `${n.accuracy}%`} tone={n.accuracy === null ? undefined : n.accuracy >= 90 ? 'good' : n.accuracy >= 75 ? 'warn' : 'bad'} />
        <Tile label="Attendance" value={n.classes ? `${n.present}/${n.classes}` : '—'} sub="classes" />
      </div>
      <p className="mt-4 text-[15px]"><b>Memorised so far:</b> {(ins.progress.percent * 100).toFixed(1)}% ({ins.progress.pages} pages, {ins.progress.juz} juz){ins.nextNew ? <> · <b>Next lesson:</b> {formatRange(ins.nextNew)}</> : null}</p>
      <div className="mt-5">{n.list.length ? <Timeline sessions={n.list} /> : <p className="text-sm text-ink-faint">Nothing logged in this {kind}.</p>}</div>
      {!you && <div className="mt-5"><label className="mb-1 block text-sm font-bold" htmlFor="rep-comment">Teacher’s comment <span className="font-normal text-ink-faint">(printed, not saved)</span></label>
        <textarea id="rep-comment" rows={3} className={cx(inputCls, 'print:border-0 print:p-0')} value={comment} onChange={e => setComment(e.target.value)} placeholder="Mā shāʾ Allāh, steady revision this week…" /></div>}
    </Card>
  </div>;
}

/** The whole class (or one halaqah) for a week or a month: one row per student */
export function ClassPeriodReport({ students, ins, sessions, attendance, classes, settings, orgName, today }: {
  students: Student[]; ins: StudentInsight[]; sessions: Session[]; attendance: Attendance[]; classes: ClassRow[]; settings: OrgSettings; orgName: string; today: string;
}) {
  const [kind, setKind] = useState<Kind>('week'); const [back, setBack] = useState(0); const [cls, setCls] = useState('all');
  const p = periodAt(kind, today, back);
  const who = students.filter(s => cls === 'all' || classes.find(c => c.id === cls)?.studentIds.includes(s.id));
  const rows = useMemo(() => who.map(s => ({ s, i: ins.find(x => x.student.id === s.id), n: studentNumbers(sessions, attendance, s.id, p, settings, today) }))
    .sort((a, b) => (a.n.oldDays / Math.max(1, a.n.oldTarget)) - (b.n.oldDays / Math.max(1, b.n.oldTarget)) || a.s.name.localeCompare(b.s.name)), [who, ins, sessions, attendance, p.start, p.end, settings, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = { lessons: rows.reduce((n, r) => n + r.n.newLessons, 0), ayahs: rows.reduce((n, r) => n + r.n.newAyahs, 0), onTrack: rows.filter(r => r.n.oldDays >= r.n.oldTarget).length,
    present: rows.reduce((n, r) => n + r.n.present, 0), classesN: rows.reduce((n, r) => n + r.n.classes, 0) };
  const csv = () => downloadCsv(`${orgName} ${kind === 'week' ? 'weekly' : 'monthly'} report ${p.start}.csv`, rows.map(r => ({
    student: r.s.name, from: p.start, to: p.end, new_lessons: r.n.newLessons, new_ayahs: r.n.newAyahs, old_revisions: r.n.oldDays, old_target: r.n.oldTarget, old_pages: r.n.oldPages,
    partner_checked: r.n.partner, mistakes: r.n.mistakes, accuracy: r.n.accuracy ?? '', classes_present: r.n.present, classes: r.n.classes, memorised_pages: r.i?.progress.pages ?? '' })));
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2"><PeriodBar kind={kind} setKind={setKind} back={back} setBack={setBack} p={p} />
        {classes.length > 1 && <select aria-label="Halaqah" value={cls} onChange={e => setCls(e.target.value)} className="no-print h-11 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-line"><option value="all">All halaqahs</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</div>
      <div className="no-print flex gap-2">{printBtn()}<Button kind="secondary" disabled={!rows.length} onClick={csv}><Download size={16} />CSV</Button></div>
    </div>
    <Card className="p-5 print:border-0 print:shadow-none">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{orgName} · {kind === 'week' ? 'Weekly' : 'Monthly'} class report{cls !== 'all' ? ` · ${classes.find(c => c.id === cls)?.name}` : ''}</p>
      <h2 className="mt-1 text-xl font-bold">{p.label}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="New lessons" value={`${tot.lessons}`} sub={`${tot.ayahs} ayahs`} />
        <Tile label="On track with revision" value={`${tot.onTrack}`} unit={`of ${rows.length}`} tone={tot.onTrack === rows.length ? 'good' : 'warn'} />
        <Tile label="Attendance" value={tot.classesN ? `${Math.round((tot.present / tot.classesN) * 100)}%` : '—'} />
        <Tile label="Students" value={`${rows.length}`} />
      </div>
      <div className="-mx-5 mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase text-ink-faint"><th className="px-5 py-2">Student</th><th className="px-2">New</th><th className="px-2">Old revision</th><th className="px-2">Pages</th><th className="px-2">Partner</th><th className="px-2">Mistakes</th><th className="px-2">Accuracy</th><th className="px-5">Present</th></tr></thead>
        <tbody>{rows.map(({ s, n }) => <tr key={s.id} className="border-b border-line last:border-0">
          <td className="px-5 py-2.5 font-bold">{s.name}</td>
          <td className="px-2 tabular-nums">{n.newLessons}{n.newAyahs ? <span className="text-ink-faint"> · {n.newAyahs}a</span> : ''}</td>
          <td className={cx('px-2 font-bold tabular-nums', n.oldDays >= n.oldTarget ? 'text-good' : n.oldDays === 0 ? 'text-bad' : 'text-warn')}>{n.oldDays}/{n.oldTarget}</td>
          <td className="px-2 tabular-nums">{n.oldPages}</td><td className="px-2 tabular-nums">{n.partner}</td><td className="px-2 tabular-nums">{n.mistakes}</td>
          <td className="px-2 tabular-nums">{n.accuracy === null ? '—' : `${n.accuracy}%`}</td><td className="px-5 tabular-nums">{n.classes ? `${n.present}/${n.classes}` : '—'}</td></tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-xs text-ink-faint">Sorted with the students furthest behind on Old revision first. “Old revision” counts days with Old revision against the goal ({settings.revision.perWeek ? `${settings.revision.perWeek} a week` : 'the revision days'}).</p>
    </Card>
  </div>;
}
