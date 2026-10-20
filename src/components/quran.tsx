// Qur'an-aware inputs and displays: range selector, juz and page maps, scores, timeline.
import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import {
  ayahCount, ayahId, fromAyahId, surahNameAr, surahNameEn, formatRange, formatPages, pageRange, juzRange, pageOf, juzOf,
  TOTAL_PAGES, isValidRange, type Range,
} from '../quran';
import { juzProgress, memorisedPages, unionRanges } from '../lib/progress';
import { SESSION_LABEL, ERROR_LABEL, type Session, type RevisionItem } from '../lib/types';
import { niceDate } from '../lib/dates';
import { Field, Segmented, Select, cx, Pill } from './ui';
import { openMushaf } from './Mushaf';

const surahOpts: Array<[number, string]> = Array.from({ length: 114 }, (_, i) => [i + 1, `${i + 1}. ${surahNameEn(i + 1)} · ${surahNameAr(i + 1)}`]);
const ayahOpts = (s: number, from = 1): Array<[number, string]> => Array.from({ length: ayahCount(s) - from + 1 }, (_, i) => [from + i, `Ayah ${from + i}`]);
const pageOpts = (from = 1): Array<[number, string]> => Array.from({ length: TOTAL_PAGES - from + 1 }, (_, i) => [from + i, `Page ${from + i}`]);

/** Choose a range: From surah · ayah → To surah · ayah (can cross surahs), or by pages, or by juz. A reversed choice is swapped, so it is always valid. */
export function RangePicker({ value, onChange, label = 'Qur’an range' }: { value: Range; onChange: (r: Range) => void; label?: string }) {
  const [mode, setMode] = useState<'surah' | 'page' | 'juz'>('surah');
  const a = fromAyahId(value.start), b = fromAyahId(value.end);
  const set = (x: number, y: number) => onChange(x <= y ? { start: x, end: y } : { start: y, end: x });
  return <fieldset className="flex flex-col gap-3">
    <legend className="sr-only">{label}</legend>
    <Segmented label="Choose by" value={mode} onChange={setMode} options={[['surah', 'Surah · ayah'], ['page', 'Pages'], ['juz', 'Juz']]} />
    {mode === 'surah' && <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1.7fr_1fr] gap-2">
        <Field label="From surah">{id => <Select id={id} value={a.surah} onChange={sn => set(ayahId(sn, 1), Math.max(value.end, ayahId(sn, 1)))} options={surahOpts} />}</Field>
        <Field label="Ayah">{id => <Select id={id} value={a.ayah} onChange={v => set(ayahId(a.surah, v), Math.max(value.end, ayahId(a.surah, v)))} options={ayahOpts(a.surah)} />}</Field>
      </div>
      <div className="grid grid-cols-[1.7fr_1fr] gap-2">
        <Field label="To surah">{id => <Select id={id} value={b.surah} onChange={sn => set(value.start, ayahId(sn, sn === a.surah ? Math.max(a.ayah, ayahCount(sn)) : ayahCount(sn)))} options={surahOpts.filter(([n]) => n >= a.surah)} />}</Field>
        <Field label="Ayah">{id => <Select id={id} value={b.ayah} onChange={v => set(value.start, ayahId(b.surah, v))} options={ayahOpts(b.surah, b.surah === a.surah ? a.ayah : 1)} />}</Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <QuickBtn onClick={() => set(ayahId(a.surah, 1), ayahId(a.surah, ayahCount(a.surah)))}>Whole of {surahNameEn(a.surah)}</QuickBtn>
        {b.surah !== a.surah && <QuickBtn onClick={() => set(ayahId(a.surah, 1), ayahId(b.surah, ayahCount(b.surah)))}>Whole surahs {a.surah}–{b.surah}</QuickBtn>}
        <QuickBtn onClick={() => set(pageRange(pageOf(value.start)).start, pageRange(pageOf(value.end)).end)}>Round to full pages</QuickBtn>
      </div>
    </div>}
    {mode === 'page' && <div className="grid grid-cols-2 gap-2">
      <Field label="From page">{id => <Select id={id} value={pageOf(value.start)} onChange={p => onChange({ start: pageRange(p).start, end: Math.max(pageRange(p).end, pageRange(Math.max(p, pageOf(value.end))).end) })} options={pageOpts()} />}</Field>
      <Field label="To page">{id => <Select id={id} value={pageOf(value.end)} onChange={p => onChange({ start: value.start, end: pageRange(p).end })} options={pageOpts(pageOf(value.start))} />}</Field>
    </div>}
    {mode === 'juz' && <div className="grid grid-cols-2 gap-2">
      <Field label="From juz">{id => <Select id={id} value={juzOf(value.start)} onChange={j => onChange({ start: juzRange(j).start, end: Math.max(juzRange(j).end, value.end) })} options={Array.from({ length: 30 }, (_, i) => [i + 1, `Juz ${i + 1}`] as [number, string])} />}</Field>
      <Field label="To juz">{id => <Select id={id} value={juzOf(value.end)} onChange={j => onChange({ start: value.start, end: juzRange(j).end })} options={Array.from({ length: 31 - juzOf(value.start) }, (_, i) => [juzOf(value.start) + i, `Juz ${juzOf(value.start) + i}`] as [number, string])} />}</Field>
    </div>}
    <RangeLabel range={value} />
  </fieldset>;
}
const QuickBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button type="button" onClick={onClick} className="min-h-[44px] rounded-full bg-white px-3 text-sm font-bold text-pine-800 ring-1 ring-inset ring-line hover:bg-pine-50">{children}</button>;
export function RangeLabel({ range, compact }: { range: Range; compact?: boolean }) {
  if (!isValidRange(range)) return <p className="text-sm font-bold text-bad">That range is not valid.</p>;
  const s = fromAyahId(range.start).surah;
  return <p className={cx('flex flex-wrap items-baseline gap-x-2 text-ink', compact ? 'text-sm' : 'rounded-xl bg-pine-50 px-3 py-2 text-[15px]')}>
    <b>{formatRange(range)}</b><span className="text-ink-faint">· {formatPages(range)} · {range.end - range.start + 1} ayahs</span>
    {!compact && <span className="ml-auto font-quran text-xl leading-none text-pine-800" lang="ar" dir="rtl">{surahNameAr(s)}</span>}
  </p>;
}

/** 1–5 stars, or 0–10 buttons, depending on the organization's scale */
export function ScoreInput({ label, value, onChange, scale }: { label: string; value: number | null; onChange: (v: number | null) => void; scale: number }) {
  const opts = scale === 5 ? [1, 2, 3, 4, 5] : Array.from({ length: scale + 1 }, (_, i) => i);
  return <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
    <span className="w-20 text-[13px] font-bold text-ink-soft">{label}</span>
    <div className="flex flex-wrap gap-1">
      {opts.map(n => scale === 5
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onChange(value === n ? null : n)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-brass-100">
            <Star size={24} className={value !== null && n <= value ? 'fill-brass-500 text-brass-500' : 'text-black/25'} /></button>
        : <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? null : n)} className={cx('h-10 min-w-[40px] rounded-lg border text-sm font-bold', value === n ? 'border-pine-700 bg-pine-700 text-white' : 'border-line bg-white')}>{n}</button>)}
    </div>
  </div>;
}

/** 30 juz tiles, filled by how much of each is memorised */
export function JuzMap({ ranges }: { ranges: Range[] }) {
  const p = useMemo(() => juzProgress(ranges), [ranges]);
  return <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10" role="list" aria-label="Juz memorised">
    {p.map((v, i) => <button type="button" key={i} role="listitem" onClick={() => openMushaf({ ayah: juzRange(i + 1).start, title: `Juz ${i + 1}` })} aria-label={`Juz ${i + 1}: ${Math.round(v * 100)}% memorised. Open in the muṣḥaf`} title={`Juz ${i + 1}: ${Math.round(v * 100)}%`}
      style={{ animationDelay: `${i * 22}ms` }}
      className={cx('juz-grow relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg border text-center transition hover:-translate-y-0.5 hover:shadow-card active:scale-95', v >= 1 ? 'border-pine-700 bg-pine-700 text-white' : v > 0 ? 'border-pine-600/40 bg-white text-ink' : 'border-line bg-white text-ink-faint')}>
      {v > 0 && v < 1 && <span className="absolute inset-x-0 bottom-0 bg-pine-100" style={{ height: `${Math.max(6, v * 100)}%` }} />}
      <span className="relative text-[10px] font-bold uppercase opacity-70">Juz</span><span className="relative text-base font-bold leading-none">{i + 1}</span>
    </button>)}
  </div>;
}

/** All 604 pages: memorised, due, overdue, weak */
export function PageMap({ ranges, items, today }: { ranges: Range[]; items: RevisionItem[]; today: string }) {
  const mem = useMemo(() => new Set(memorisedPages(ranges)), [ranges]);
  const byPage = useMemo(() => new Map(items.map(i => [i.page, i])), [items]);
  const partial = useMemo(() => { const s = new Set<number>(); unionRanges(ranges).forEach(r => { s.add(pageOf(r.start)); s.add(pageOf(r.end)); }); return s; }, [ranges]);
  const color = (p: number) => {
    const it = byPage.get(p);
    if (it && it.lapses >= 2) return 'bg-bad/80';
    if (it && it.dueOn < today) return 'bg-warn/80';
    if (it && it.dueOn === today) return 'bg-brass-500';
    if (mem.has(p)) return 'bg-pine-600';
    if (partial.has(p)) return 'bg-pine-100';
    return 'bg-black/[.06]';
  };
  return <div>
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(40, minmax(0, 1fr))' }} role="img" aria-label={`${mem.size} of 604 pages memorised`}>
      {Array.from({ length: TOTAL_PAGES }, (_, i) => <span key={i} title={`Page ${i + 1}`} className={cx('aspect-square rounded-[2px]', color(i + 1))} />)}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {[['bg-pine-600', 'Memorised'], ['bg-brass-500', 'Due today'], ['bg-warn/80', 'Overdue'], ['bg-bad/80', 'Weak'], ['bg-pine-100', 'Part of a page']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><i className={cx('inline-block h-3 w-3 rounded-sm', c)} />{l}</span>)}
    </div>
  </div>;
}

const TYPE_TONE: Record<string, 'pine' | 'brass' | 'slate'> = { new: 'pine', recent: 'brass', old: 'slate' };
export function SessionLine({ s, showStudent, onDelete }: { s: Session; showStudent?: string; onDelete?: () => void }) {
  const total = s.errorsMajor + s.errorsMinor;
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap items-center gap-2">
      {showStudent && <b className="text-ink">{showStudent}</b>}
      <Pill tone={TYPE_TONE[s.type] ?? 'slate'}>{SESSION_LABEL[s.type]}</Pill>
      <span className="text-[15px] text-ink">{formatRange(s.range)}</span>
      <Pill tone={total >= 3 ? 'red' : total === 2 ? 'amber' : 'green'}>{total} error{total === 1 ? '' : 's'}{s.errorsMajor ? ` · ${s.errorsMajor} major` : ''}</Pill>
      {s.scores.overall !== null && <span className="inline-flex items-center gap-1 text-sm font-bold text-brass-700"><Star size={14} className="fill-brass-500 text-brass-500" />{s.scores.overall}</span>}
      {s.attendance !== 'present' && <Pill tone="amber">{s.attendance}</Pill>}
      {s.mode === 'online' && <Pill>online</Pill>}
      {s.recordedBy === 'student' && <Pill>self-recorded</Pill>}
      {s.followUp && <Pill tone="red">follow up</Pill>}
      {onDelete && <button type="button" onClick={onDelete} className="ml-auto text-xs font-bold text-ink-faint underline hover:text-bad">Delete</button>}
    </div>
    {s.errors.length > 0 && <p className="text-sm text-ink-soft">{s.errors.map(e => `${ERROR_LABEL[e.category]}${e.ayahId ? ` (${fromAyahId(e.ayahId).surah}:${fromAyahId(e.ayahId).ayah})` : ''}`).join(' · ')}</p>}
    {s.teacherNote && <p className="text-sm text-ink"><b className="text-pine-800">Teacher:</b> {s.teacherNote}</p>}
    {s.studentNote && <p className="text-sm text-ink-soft"><b>Student:</b> {s.studentNote}</p>}
  </div>;
}
export function Timeline({ sessions, nameOf, onDelete }: { sessions: Session[]; nameOf?: (id: string) => string; onDelete?: (s: Session) => void }) {
  const byDay = useMemo(() => { const m = new Map<string, Session[]>(); sessions.forEach(s => m.set(s.date, [...(m.get(s.date) ?? []), s])); return [...m.entries()]; }, [sessions]);
  if (!sessions.length) return <p className="px-1 py-6 text-center text-sm text-ink-faint">No sessions recorded yet.</p>;
  return <ol className="flex flex-col gap-5">
    {byDay.map(([day, list]) => <li key={day} className="grid gap-2 sm:grid-cols-[110px_1fr]">
      <p className="text-sm font-bold text-ink-soft">{niceDate(day)}</p>
      <ul className="flex flex-col gap-3 border-l-2 border-line pl-4">{list.map(s => <li key={s.id}><SessionLine s={s} showStudent={nameOf?.(s.studentId)} onDelete={onDelete ? () => onDelete(s) : undefined} /></li>)}</ul>
    </li>)}
  </ol>;
}

/** a small bar chart: one bar per day */
export function DailyBars({ days, label }: { days: Array<{ date: string; value: number }>; label: string }) {
  const max = Math.max(1, ...days.map(d => d.value));
  return <figure>
    <div className="flex h-28 items-end gap-1" role="img" aria-label={`${label}: ${days.map(d => `${d.date} ${d.value}`).join(', ')}`}>
      {days.map(d => <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${niceDate(d.date)}: ${d.value}`}>
        <div className={cx('w-full rounded-t', d.value ? 'bg-pine-600' : 'bg-black/[.06]')} style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} />
      </div>)}
    </div>
    <figcaption className="mt-1 flex justify-between text-[11px] text-ink-faint"><span>{niceDate(days[0]?.date ?? '')}</span><span>{label}</span><span>{niceDate(days[days.length - 1]?.date ?? '')}</span></figcaption>
  </figure>;
}
