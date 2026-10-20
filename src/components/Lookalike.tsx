// Lookalike ayahs (mutashābihāt): ayahs in a lesson that read almost the same as ayahs elsewhere.
// The list is worked out from the Qurʾān text itself (public/lookalike.json, made by comparing the words of every ayah),
// so it catches the common traps; "Compare" shows both with the words that differ highlighted.
import { useEffect, useMemo, useState } from 'react';
import { Shuffle, BookOpen } from 'lucide-react';
import { fromAyahId, surahNameEn, pageOf, pageRange, type Range } from '../quran';
import { loadPage, openMushaf } from './Mushaf';
import { Modal, cx } from './ui';

let data: Record<string, number[]> | null = null; let loading: Promise<Record<string, number[]>> | null = null;
const load = () => (data ? Promise.resolve(data) : (loading ??= fetch(`${import.meta.env.BASE_URL}lookalike.json`).then(r => r.json()).then(d => (data = d)).catch(() => { loading = null; return {}; })));
export function useLookalikes(range: Range | null | undefined) {
  const [d, setD] = useState(data);
  useEffect(() => { if (!d && range) load().then(setD); }, [d, range]);
  return useMemo(() => {
    if (!d || !range) return [];
    const out: Array<{ id: number; others: number[] }> = [];
    for (let id = range.start; id <= range.end && id - range.start < 400; id++) { const o = d[id]; if (o?.length) out.push({ id, others: o.filter(x => x < range.start || x > range.end).slice(0, 3) }); }
    return out.filter(x => x.others.length);
  }, [d, range]);
}
const name = (id: number) => { const a = fromAyahId(id); return `${surahNameEn(a.surah)} ${a.ayah}`; };

/** A small warning line with the lookalikes in a range, and a compare view */
export function LookalikeNote({ range, className }: { range: Range; className?: string }) {
  const list = useLookalikes(range);
  const [pair, setPair] = useState<[number, number] | null>(null);
  if (!list.length) return null;
  return <div className={cx('rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-400/30', className)}>
    <p className="flex items-center gap-1.5 font-bold"><Shuffle size={15} />Watch out: {list.length} ayah{list.length > 1 ? 's' : ''} here look{list.length > 1 ? '' : 's'} like others</p>
    <ul className="mt-1 flex flex-col gap-1">{list.slice(0, 4).map(x => <li key={x.id} className="flex flex-wrap items-center gap-x-2">
      <span><b>{name(x.id)}</b> ↔ {x.others.map(name).join(', ')}</span>
      <button type="button" onClick={() => setPair([x.id, x.others[0]])} className="min-h-[36px] font-bold underline underline-offset-2">Compare</button></li>)}
      {list.length > 4 && <li className="text-xs opacity-80">+{list.length - 4} more</li>}</ul>
    {pair && <Compare a={pair[0]} b={pair[1]} onClose={() => setPair(null)} />}
  </div>;
}

const norm = (t: string) => t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي');
async function ayahText(id: number) { const p = pageOf(id); const t = await loadPage(p); return t[id - pageRange(p).start]; }
function Compare({ a, b, onClose }: { a: number; b: number; onClose: () => void }) {
  const [t, setT] = useState<[string, string] | null>(null);
  useEffect(() => { Promise.all([ayahText(a), ayahText(b)]).then(([x, y]) => setT([x, y])).catch(() => setT(['', ''])); }, [a, b]);
  const mark = (x: string, y: string) => { const other = new Set(norm(y).split(/\s+/)); return x.split(/\s+/).map((w, i) => <span key={i} className={cx(!other.has(norm(w)) && 'rounded bg-amber-200/80 px-0.5 dark:bg-amber-400/30')}>{w} </span>); };
  return <Modal open onClose={onClose} title="Lookalike ayahs">
    {!t ? <p className="py-6 text-center text-sm text-ink-faint">Loading…</p> : <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">The highlighted words are the ones that differ. Read both aloud a few times and notice where each one is.</p>
      {([[a, t[0], t[1]], [b, t[1], t[0]]] as const).map(([id, x, y]) => <div key={id} className="rounded-xl bg-paper p-3 ring-1 ring-line">
        <p className="mb-1 flex items-center justify-between text-sm font-bold"><span>{name(id)} <span className="font-normal text-ink-faint">· page {pageOf(id)}</span></span>
          <button type="button" onClick={() => { onClose(); openMushaf({ ayah: id, marks: [[id, 'weak']], title: name(id) }); }} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-pine-700 hover:bg-pine-50"><BookOpen size={15} />Page</button></p>
        <p lang="ar" dir="rtl" className="font-quran text-2xl leading-[2.2]">{mark(x, y)}</p>
      </div>)}
    </div>}
  </Modal>;
}
