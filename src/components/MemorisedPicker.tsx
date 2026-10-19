// For students who memorised out of order: tap the surahs memorised, choose where the next lesson starts.
// Surahs not memorised that come before the start point are "skipped for later" (they come last).
import { useMemo, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useOrg } from '../app/context';
import type { Student, Direction } from '../lib/types';
import { surahOrder } from '../lib/suggest';
import { unionRanges } from '../lib/progress';
import { ayahCount, ayahId, surahNameEn, surahNameAr, surahRange, juzOf, surahFirstId, type Range } from '../quran';
import { friendly } from '../api/backend';
import { Button, Field, Modal, Segmented, Select, cx, useToast } from './ui';

export interface MemorisedValue { direction: Direction; surahs: number[]; partial: { surah: number; ayahs: number } | null; nextFrom: number | null }
const ALL = Array.from({ length: 114 }, (_, i) => i + 1);
const orderOf = (d: Direction) => (d === 'back' ? [...ALL].reverse() : ALL);

/** surahs not memorised that the student has already passed (between the start of their direction and the next lesson) */
export function skippedFor(v: MemorisedValue): number[] {
  if (!v.nextFrom) return [];
  const order = orderOf(v.direction); const have = new Set(v.surahs); const stop = order.indexOf(v.nextFrom);
  const lastMem = Math.max(-1, ...order.map((s, i) => (have.has(s) ? i : -1)));
  // only gaps inside what they have covered: before the start point and not after the furthest memorised surah
  return order.slice(0, stop).filter((s, i) => !have.has(s) && i < Math.max(stop, lastMem + 1)).sort((a, b) => a - b);
}
/** sensible start: the first surah not memorised after the furthest memorised one, in their direction */
export function defaultNextFrom(direction: Direction, surahs: number[]): number | null {
  const order = orderOf(direction); const have = new Set(surahs);
  const last = Math.max(-1, ...order.map((s, i) => (have.has(s) ? i : -1)));
  return order.slice(last + 1).find(s => !have.has(s)) ?? order.find(s => !have.has(s)) ?? null;
}
export function toRanges(v: MemorisedValue): Range[] {
  const r = v.surahs.map(surahRange);
  if (v.partial && v.partial.ayahs > 0 && !v.surahs.includes(v.partial.surah)) r.push({ start: ayahId(v.partial.surah, 1), end: ayahId(v.partial.surah, v.partial.ayahs) });
  return r;
}
/** read back from what is stored for a student */
export function fromStudent(st: Student): MemorisedValue {
  const u = unionRanges(st.memorized); const covered = (a: number, b: number) => u.some(r => r.start <= a && b <= r.end);
  const surahs = ALL.filter(s => { const r = surahRange(s); return covered(r.start, r.end); });
  let partial: MemorisedValue['partial'] = null;
  for (const s of ALL) { if (surahs.includes(s)) continue; const r = surahRange(s); let n = 0; while (n < ayahCount(s) && covered(r.start, r.start + n)) n++; if (n > 0) { partial = { surah: s, ayahs: n }; break; } }
  return { direction: st.direction, surahs, partial, nextFrom: st.nextFromSurah ?? null };
}

export function MemorisedPicker({ value, onChange, you = 'you' }: { value: MemorisedValue; onChange: (v: MemorisedValue) => void; you?: string }) {
  const order = orderOf(value.direction); const have = new Set(value.surahs);
  const set = (p: Partial<MemorisedValue>) => onChange({ ...value, ...p });
  const toggle = (s: number) => { const n = have.has(s) ? value.surahs.filter(x => x !== s) : [...value.surahs, s]; set({ surahs: n, nextFrom: value.nextFrom && n.includes(value.nextFrom) ? defaultNextFrom(value.direction, n) : value.nextFrom ?? defaultNextFrom(value.direction, n) }); };
  const quick = (juz: number) => { const inJuz = ALL.filter(s => juzOf(surahFirstId(s)) === juz); const all = inJuz.every(s => have.has(s)); const n = all ? value.surahs.filter(s => !inJuz.includes(s)) : [...new Set([...value.surahs, ...inJuz])]; set({ surahs: n, nextFrom: defaultNextFrom(value.direction, n) }); };
  const skipped = skippedFor(value);
  const start = value.nextFrom;
  return <div className="flex flex-col gap-4">
    <Field label="Which way are the lessons going?">{id => <Select id={id} value={value.direction} onChange={d => set({ direction: d, nextFrom: defaultNextFrom(d, value.surahs) })} options={[['back', 'Backwards: from An-Nās towards Al-Baqarah'], ['forward', 'Forwards: from Al-Fātiḥah towards An-Nās']]} />}</Field>
    <div>
      <p className="mb-1.5 text-[13px] font-bold text-ink-soft">Tap every surah {you === 'you' ? 'you have' : 'they have'} memorised fully <span className="font-normal text-ink-faint">({value.surahs.length} chosen)</span></p>
      <div className="mb-2 flex flex-wrap gap-1.5">{[30, 29, 28, 27, 26, 1].map(j => <button key={j} type="button" onClick={() => quick(j)} className="min-h-[34px] rounded-full bg-white px-3 text-xs font-bold text-ink-soft ring-1 ring-line hover:bg-pine-50">Juz {j}</button>)}
        {value.surahs.length > 0 && <button type="button" onClick={() => set({ surahs: [], nextFrom: defaultNextFrom(value.direction, []) })} className="min-h-[34px] rounded-full px-3 text-xs font-bold text-bad">Clear</button>}</div>
      <ul className="grid max-h-[340px] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain rounded-xl bg-paper p-2 ring-1 ring-line sm:grid-cols-3" data-no-pull>{order.map(s => {
        const on = have.has(s); const isStart = s === start; const sk = skipped.includes(s);
        return <li key={s}><button type="button" aria-pressed={on} onClick={() => toggle(s)}
          className={cx('flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-left text-sm ring-1 ring-inset', on ? 'bg-pine-700 font-bold text-white ring-pine-700' : isStart ? 'bg-brass-100 font-bold text-brass-700 ring-brass-500' : sk ? 'bg-amber-50 text-warn ring-warn/30' : 'bg-white text-ink-soft ring-line')}>
          <span className="w-7 shrink-0 text-right tabular-nums opacity-80">{s}</span><span className="min-w-0 flex-1 truncate">{surahNameEn(s)}</span>{on && <Check size={14} />}{isStart && !on && <span className="text-[10px] uppercase">next</span>}
        </button></li>;
      })}</ul>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Next new lesson starts from" hint="The surah being memorised now">{id => <Select id={id} value={start ?? 0} onChange={v => set({ nextFrom: v || null, partial: value.partial && value.partial.surah === v ? value.partial : null })}
        options={[[0, 'Automatic'] as [number, string], ...order.filter(s => !have.has(s)).map(s => [s, `${s}. ${surahNameEn(s)} · ${surahNameAr(s)}`] as [number, string])]} />}</Field>
      {start && <Field label={`Part of ${surahNameEn(start)} already memorised?`}>{id => <Select id={id} value={value.partial?.surah === start ? value.partial.ayahs : 0} onChange={n => set({ partial: n ? { surah: start, ayahs: n } : null })}
        options={[[0, 'None of it yet'] as [number, string], ...Array.from({ length: ayahCount(start) - 1 }, (_, i) => [i + 1, `Ayahs 1–${i + 1}`] as [number, string])]} />}</Field>}
    </div>
    {skipped.length > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-warn"><b>Skipped for later ({skipped.length}):</b> {skipped.map(s => surahNameEn(s)).join(', ')}. These come after the rest, so they are not forgotten.</p>}
  </div>;
}

/** Edit memorised surahs / starting point after sign-up (student's My plan, or the teacher) */
export function MemorisedModal({ student, onClose, onSaved, byTeacher }: { student: Student; onClose: () => void; onSaved: () => void; byTeacher?: boolean }) {
  const { api } = useOrg(); const toast = useToast();
  const init = useMemo(() => fromStudent(student), [student]);
  const [v, setV] = useState<MemorisedValue>({ ...init, nextFrom: init.nextFrom ?? defaultNextFrom(init.direction, init.surahs) });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'order' | 'start'>('start');
  const save = async () => {
    setBusy(true);
    try {
      await api.setMemorisedSurahs(student.id, { ...(mode === 'order' ? {} : { surahs: v.surahs, partial: v.partial }), skipped: skippedFor(v), nextFrom: v.nextFrom, direction: v.direction });
      toast('Saved. The next lesson and revision follow this now.'); onSaved(); onClose();
    } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  const next = surahOrder(v.direction, { from: v.nextFrom, skipped: skippedFor(v) }).find(s => !v.surahs.includes(s));
  return <Modal open wide onClose={onClose} title={byTeacher ? `Memorised & next lesson: ${student.name}` : 'What I have memorised'} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}><Save size={16} />Save</Button></div>}>
    <div className="flex flex-col gap-4">
      <Segmented label="What to change" value={mode} onChange={setMode} options={[['start', 'Memorised surahs & start'], ['order', 'Only where the next lesson starts']]} />
      <MemorisedPicker value={v} onChange={setV} you={byTeacher ? 'they' : 'you'} />
      {next && <p className="text-sm text-ink-soft">Next new lesson: <b>{surahNameEn(next)}</b>{v.direction === 'back' ? ', then going backwards' : ', then going forwards'}.</p>}
      {mode === 'order' && <p className="text-xs text-ink-faint">Memorised surahs stay as they are; only the starting point, direction and skipped list are saved.</p>}
    </div>
  </Modal>;
}
