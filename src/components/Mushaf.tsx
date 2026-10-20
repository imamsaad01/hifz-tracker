// The muṣḥaf: all 604 pages (Madinah order, Uthmani text from QuranEnc via quran-json, CC BY-SA 4.0), one small file per page.
// Opens full-screen from anywhere with openMushaf({ ... }); the lesson, revision and weak ayahs can be highlighted,
// "Hide the words" turns it into a recall test, and MushafPage can also be used inline (e.g. to tap mistakes on the page).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, EyeOff, Eye, BookOpen } from 'lucide-react';
import { fromAyahId, pageOf, pageRange, juzOf, surahNameAr, surahNameEn, surahFirstId, ayahId, TOTAL_PAGES, type Range } from '../quran';
import { AyahPlayer } from './AyahPlayer';
import { MadinahPage } from './MadinahPage';
import { cx } from './ui';

const cache = new Map<number, Promise<string[]>>();
export function loadPage(p: number): Promise<string[]> {
  if (!cache.has(p)) cache.set(p, fetch(`${import.meta.env.BASE_URL}mushaf/${p}.json`).then(r => { if (!r.ok) throw new Error('offline'); return r.json(); }).catch(e => { cache.delete(p); throw e; }));
  return cache.get(p)!;
}
// If the Qurʾān font could not load, swap the rarer Uthmani marks for common ones so nothing shows as a gap.
const fontOk = () => { try { return [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'Amiri Quran' && f.status === 'loaded'); } catch { return true; } };
const plain = (t: string) => t.replace(/ۡ/g, 'ْ').replace(/[ۖ-ۜ۞۩]/g, '');
const arNum = (n: number) => n.toLocaleString('ar-EG');

export type Mark = 'lesson' | 'revision' | 'weak' | 'small' | 'big';
const MARK_CLS: Record<Mark, string> = {
  lesson: 'bg-emerald-200/60 dark:bg-emerald-400/20', revision: 'bg-sky-200/60 dark:bg-sky-400/20', weak: 'bg-amber-200/70 dark:bg-amber-400/25',
  small: 'bg-amber-300/70 dark:bg-amber-400/40', big: 'bg-red-300/70 dark:bg-red-500/40',
};
export const MARK_LABEL: Record<Mark, string> = { lesson: 'Lesson', revision: 'Revision', weak: 'Weak ayah', small: 'Small mistake', big: 'Big mistake' };

/** One page of the muṣḥaf. Tap an ayah to call onTap (when given). */
type PageProps = { page: number; marks?: Map<number, Mark>; onTap?: (id: number) => void; hidden?: boolean; revealed?: Set<number>; onReveal?: (id: number) => void; size?: 'sm' | 'md' };
/** One page: the real Madinah page (KFGQPC font and 15-line layout) when it can be loaded, otherwise flowing Uthmani text. */
export function MushafPage(props: PageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [props.page]);
  return failed ? <TextPage {...props} /> : <MadinahPage {...props} onFail={() => setFailed(true)} />;
}
function TextPage({ page, marks, onTap, hidden, revealed, onReveal, size = 'md' }: PageProps) {
  const [text, setText] = useState<string[] | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { let live = true; setText(null); setErr(false); loadPage(page).then(t => { if (live) setText(t); }).catch(() => live && setErr(true));
    if (page < TOTAL_PAGES) loadPage(page + 1).catch(() => undefined); if (page > 1) loadPage(page - 1).catch(() => undefined); return () => { live = false; }; }, [page]);
  const first = pageRange(page).start;
  const [ok, setOk] = useState(fontOk);
  useEffect(() => { if (!ok) document.fonts?.load('24px "Amiri Quran"').then(() => setOk(fontOk())).catch(() => undefined); }, [ok]);
  if (err) return <p className="py-10 text-center text-sm text-ink-faint">This page needs a connection the first time. Try again when you are online.</p>;
  if (!text) return <div className="py-16 text-center text-sm text-ink-faint">Loading page {page}…</div>;
  return <div lang="ar" dir="rtl" className={cx('font-quran text-ink', size === 'sm' ? 'text-[21px] leading-[2.3]' : 'text-[24px] leading-[2.35] sm:text-[27px]')} style={{ textAlign: 'justify', textAlignLast: 'center' }}>
    {text.map((t, i) => {
      const id = first + i; const { surah, ayah } = fromAyahId(id); const m = marks?.get(id);
      const head = ayah === 1;
      const words = ok ? t : plain(t);
      const hide = hidden && !revealed?.has(id);
      return <span key={id}>
        {head && <span className="my-2 block text-center" dir="rtl">
          <span className="mx-auto block max-w-[320px] rounded-xl border-2 border-double border-brass-500/60 bg-brass-100/40 py-1 text-[0.85em] dark:bg-brass-500/10">سُورَةُ {surahNameAr(surah)}</span>
          {surah !== 1 && surah !== 9 && <span className="block text-[0.9em]">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</span>}
        </span>}
        <span role={onTap || hidden ? 'button' : undefined} tabIndex={onTap || hidden ? 0 : undefined} data-ayah={id}
          aria-label={onTap || hidden ? `${surahNameEn(surah)} ayah ${ayah}${m ? `, ${MARK_LABEL[m]}` : ''}` : undefined}
          onClick={() => { if (hide) onReveal?.(id); else onTap?.(id); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hide) onReveal?.(id); else onTap?.(id); } }}
          className={cx('rounded-md px-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]', m && MARK_CLS[m], (onTap || hidden) && 'cursor-pointer hover:bg-pine-100/60', hide && 'select-none text-transparent [text-shadow:0_0_14px_rgb(var(--ink)/0.45)]')}>
          {words}
        </span>
        <span className="mx-1 inline-block text-[0.7em] text-brass-500" aria-hidden>﴿{arNum(ayah)}﴾</span>{' '}
      </span>;
    })}
  </div>;
}

// ---------- full-screen reader ----------
type Opts = { page?: number; ayah?: number; marks?: Array<[number, Mark]>; title?: string };
const listeners = new Set<(o: Opts) => void>();
/** Open the muṣḥaf from anywhere: at a page or an ayah, with optional highlights. */
export const openMushaf = (o: Opts = {}) => listeners.forEach(l => l(o));
/** Highlights for a range (every ayah in it) */
export const rangeMarks = (r: Range, m: Mark): Array<[number, Mark]> => Array.from({ length: r.end - r.start + 1 }, (_, i) => [r.start + i, m]);
const LAST = 'hifz-mushaf-page';

export function MushafHost() {
  const [o, setO] = useState<Opts | null>(null);
  useEffect(() => { const l = (x: Opts) => setO(x); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return o ? <Reader opts={o} onClose={() => setO(null)} /> : null;
}

function Reader({ opts, onClose }: { opts: Opts; onClose: () => void }) {
  const start = opts.page ?? (opts.ayah ? pageOf(opts.ayah) : opts.marks?.length ? pageOf(opts.marks[0][0]) : Number((() => { try { return localStorage.getItem(LAST); } catch { return null; } })() ?? 1));
  const [page, setPage] = useState(Math.min(TOTAL_PAGES, Math.max(1, start)));
  const [hidden, setHidden] = useState(false); const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [listen, setListen] = useState(false);
  const marks = useMemo(() => new Map(opts.marks ?? []), [opts.marks]);
  const go = useCallback((p: number) => { const n = Math.min(TOTAL_PAGES, Math.max(1, p)); setPage(n); setRevealed(new Set()); setListen(false); try { localStorage.setItem(LAST, String(n)); } catch { /* */ } }, []);
  const x0 = useRef<{ x: number; y: number } | null>(null); const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') go(page + 1); if (e.key === 'ArrowRight') go(page - 1); };
    window.addEventListener('keydown', k); return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k); };
  }, [page, go, onClose]);
  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
    if (opts.ayah && pageOf(opts.ayah) === page) setTimeout(() => box.current?.querySelector(`[data-ayah="${opts.ayah}"]`)?.scrollIntoView({ block: 'center' }), 250);
  }, [page, opts.ayah]);
  const r = pageRange(page); const a = fromAyahId(r.start); const b = fromAyahId(r.end);
  const surahs = a.surah === b.surah ? surahNameEn(a.surah) : `${surahNameEn(a.surah)} – ${surahNameEn(b.surah)}`;
  const onPageMarks = [...marks.entries()].filter(([id]) => id >= r.start && id <= r.end);
  const kinds = [...new Set([...marks.values()])];
  return createPortal(<div className="fixed inset-0 z-50 flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label={`Muṣḥaf page ${page}`}>
    <header className="flex items-center gap-2 border-b border-line bg-white px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close the muṣḥaf" className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft hover:bg-black/5"><X size={20} /></button>
      <div className="min-w-0 flex-1 text-center"><p className="truncate font-bold">{opts.title ?? surahs}</p><p className="text-xs text-ink-faint">Page {page} · Juz {juzOf(r.start)}{opts.title ? ` · ${surahs}` : ''}</p></div>
      <button type="button" onClick={() => { setHidden(h => !h); setRevealed(new Set()); }} aria-pressed={hidden} aria-label={hidden ? "Show words" : "Hide words"} className={cx('flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold', hidden ? 'bg-pine-700 text-white' : 'text-ink-soft hover:bg-black/5')}>
        {hidden ? <Eye size={17} /> : <EyeOff size={17} />}<span className="hidden sm:inline">{hidden ? 'Show words' : 'Hide words'}</span></button>
    </header>
    <div ref={box} className="flex-1 overflow-y-auto overscroll-contain" data-no-pull
      onPointerDown={e => { x0.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={e => { const s = x0.current; x0.current = null; if (!s) return; const dx = e.clientX - s.x; if (Math.abs(dx) > 70 && Math.abs(e.clientY - s.y) < 50) go(dx > 0 ? page + 1 : page - 1); }}>
      <div className="mx-auto max-w-2xl px-4 py-4">
        {hidden && <p className="mb-3 rounded-xl bg-pine-50 px-3 py-2 text-center text-sm text-pine-800">Recite from memory. Tap an ayah to check it.</p>}
        <div className="rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-brass-500/25 sm:px-8">
          <MushafPage page={page} marks={marks} hidden={hidden} revealed={revealed} onReveal={id => setRevealed(s => new Set(s).add(id))} />
          <p className="mt-2 text-center text-sm text-ink-faint">{page}</p>
        </div>
        {kinds.length > 0 && <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">{kinds.map(k => <span key={k} className="inline-flex items-center gap-1.5"><i className={cx('h-3 w-5 rounded', MARK_CLS[k])} />{MARK_LABEL[k]}</span>)}
          {onPageMarks.length === 0 && <span className="text-ink-faint">· none on this page</span>}</p>}
        <div className="mt-4">{listen ? <AyahPlayer range={r} compact /> : <button type="button" onClick={() => setListen(true)} className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-pine-700 hover:bg-pine-50"><BookOpen size={16} />Listen to this page</button>}</div>
      </div>
    </div>
    <footer className="flex items-center gap-2 border-t border-line bg-white px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
      <button type="button" onClick={() => go(page + 1)} disabled={page >= TOTAL_PAGES} aria-label="Next page" className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft hover:bg-black/5 disabled:opacity-30"><ChevronLeft size={22} /></button>
      <JumpTo page={page} go={go} />
      <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page" className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft hover:bg-black/5 disabled:opacity-30"><ChevronRight size={22} /></button>
    </footer>
  </div>, document.body);
}

function JumpTo({ page, go }: { page: number; go: (p: number) => void }) {
  const s = fromAyahId(pageRange(page).start).surah;
  const sel = 'h-11 min-w-0 flex-1 rounded-xl bg-paper px-2 text-sm font-bold text-ink ring-1 ring-line';
  return <div className="flex min-w-0 flex-1 gap-2">
    <select aria-label="Go to surah" className={sel} value={s} onChange={e => go(pageOf(surahFirstId(Number(e.target.value))))}>
      {Array.from({ length: 114 }, (_, i) => <option key={i} value={i + 1}>{i + 1}. {surahNameEn(i + 1)}</option>)}</select>
    <select aria-label="Go to juz" className={cx(sel, 'max-w-[92px]')} value={juzOf(pageRange(page).start)} onChange={e => { const j = Number(e.target.value); for (let p = 1; p <= TOTAL_PAGES; p++) if (juzOf(pageRange(p).start) === j) { go(p); break; } }}>
      {Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>Juz {i + 1}</option>)}</select>
    <select aria-label="Go to page" className={cx(sel, 'max-w-[86px]')} value={page} onChange={e => go(Number(e.target.value))}>
      {Array.from({ length: TOTAL_PAGES }, (_, i) => <option key={i} value={i + 1}>p. {i + 1}</option>)}</select>
  </div>;
}

/** Small "open in the muṣḥaf" link used next to a range */
export function MushafLink({ range, marks, title, label = 'Open in muṣḥaf', className }: { range: Range; marks?: Array<[number, Mark]>; title?: string; label?: string; className?: string }) {
  return <button type="button" onClick={() => openMushaf({ ayah: range.start, marks: marks ?? rangeMarks(range, 'lesson'), title })}
    className={cx('inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-pine-700 ring-1 ring-inset ring-pine-600/30 hover:bg-pine-50', className)}><BookOpen size={16} />{label}</button>;
}
export { ayahId };
