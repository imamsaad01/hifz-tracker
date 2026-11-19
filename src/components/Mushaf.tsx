// The muṣḥaf: all 604 pages (Madinah order, Uthmani text from QuranEnc via quran-json, CC BY-SA 4.0), one small file per page.
// Opens full-screen from anywhere with openMushaf({ ... }); the lesson, revision and weak ayahs can be highlighted,
// "Hide the words" turns it into a recall test, and MushafPage can also be used inline (e.g. to tap mistakes on the page).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, BookOpen, Search } from 'lucide-react';
import { fromAyahId, pageOf, pageRange, juzOf, surahNameAr, surahNameEn, surahFirstId, ayahId, TOTAL_PAGES, type Range } from '../quran';
import { AyahPlayer } from './AyahPlayer';
import { useRecite, ReciteBar } from './ReciteOnPage';
import { MadinahPage, RS, type ReciteView, type ReciteWord } from './MadinahPage';
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
type PageProps = { page: number; marks?: Map<number, Mark>; onTap?: (id: number) => void; hidden?: boolean; revealed?: Set<number>; onReveal?: (id: number) => void; size?: 'sm' | 'md'; recite?: ReciteView; onWords?: (w: ReciteWord[]) => void; onWordTap?: (key: string) => void };
const isMarkWord = (w: string) => /^[\u06D6-\u06ED\u0660-\u0669]+$/.test(w);
/** One page: the real Madinah page (KFGQPC font and 15-line layout) when it can be loaded, otherwise flowing Uthmani text. */
export function MushafPage(props: PageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [props.page]);
  return failed ? <TextPage {...props} /> : <MadinahPage {...props} onFail={() => setFailed(true)} />;
}
function TextPage({ page, marks, onTap, hidden, revealed, onReveal, size = 'md', recite, onWords, onWordTap }: PageProps) {
  const [text, setText] = useState<string[] | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { let live = true; setText(null); setErr(false); loadPage(page).then(t => { if (live) { setText(t); const f = pageRange(page).start; onWords?.(t.flatMap((a, i) => a.split(/\s+/).filter(w => w && !isMarkWord(w)).map((w, k) => ({ key: `${f + i}:${k}`, text: w })))); } }).catch(() => live && setErr(true));
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
          {recite ? (() => { let k = 0; return words.split(/\s+/).filter(Boolean).map((w, j) => { if (isMarkWord(w)) return <span key={j}>{w} </span>; const key = `${id}:${k++}`; const rs = recite.states.get(key) ?? 'hidden';
            return <span key={j}><span data-w={key} onClick={e => { e.stopPropagation(); onWordTap?.(key); }} className={cx('rounded transition-colors duration-300', RS[rs], recite.next === key && 'rc-next')}>{w}</span> </span>; }); })() : words}
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
  useEffect(() => { const c = () => setO(null); window.addEventListener('hashchange', c); return () => window.removeEventListener('hashchange', c); }, []);
  return o ? <Reader opts={o} onClose={() => setO(null)} /> : null;
}

/** The muṣḥaf as its own page (#/mushaf/562): open to anyone, no sign-in needed. */
export function MushafReaderPage({ page }: { page?: number }) { return <Reader opts={{ page }} onClose={() => { window.location.hash = '/'; }} />; }
function Reader({ opts, onClose }: { opts: Opts; onClose: () => void }) {
  const start = opts.page ?? (opts.ayah ? pageOf(opts.ayah) : opts.marks?.length ? pageOf(opts.marks[0][0]) : Number((() => { try { return localStorage.getItem(LAST); } catch { return null; } })() ?? 1));
  const [page, setPage] = useState(Math.min(TOTAL_PAGES, Math.max(1, start)));
  const [hidden, setHidden] = useState(false); const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [listen, setListen] = useState(false);
  const rc = useRecite(page);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [drag, setDrag] = useState(0); const [turn, setTurn] = useState<'l' | 'r' | null>(null);
  const [chrome, setChrome] = useState(true); const [goto, setGoto] = useState(false);
  const marks = useMemo(() => { const m = new Map(opts.marks ?? []); if (playingAyah) m.set(playingAyah, 'lesson'); return m; }, [opts.marks, playingAyah]);
  const go = useCallback((p: number) => { const n = Math.min(TOTAL_PAGES, Math.max(1, p)); setPage(n); setRevealed(new Set()); setListen(false); try { localStorage.setItem(LAST, String(n)); } catch { /* */ } }, []);
  const x0 = useRef<{ x: number; y: number; t: number } | null>(null); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { rc.onPageDone.current = () => { if (page < TOTAL_PAGES) { setTurn('r'); go(page + 1); } }; });
  // keep the word being recited in view
  useEffect(() => { if (!rc.view?.next) return; const el = box.current?.querySelector<HTMLElement>(`[data-w="${rc.view.next}"]`); const b = box.current; if (el && b) { const r = el.getBoundingClientRect(), br = b.getBoundingClientRect(); if (r.bottom > br.bottom - 140 || r.top < br.top + 40) b.scrollBy({ top: r.top - br.top - br.height / 3, behavior: 'smooth' }); } }, [rc.view?.next]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') { setTurn('r'); go(page + 1); } if (e.key === 'ArrowRight') { setTurn('l'); go(page - 1); } };
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
  const tapToggle = (_e: React.PointerEvent) => { void setChrome; };
  return createPortal(<div className="fixed inset-0 z-50 flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label={`Muṣḥaf page ${page}`}>
    {chrome && <header className="flex items-center gap-2 border-b border-line bg-white/95 px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))] backdrop-blur dark:bg-paper/95">
      <button type="button" onClick={onClose} className="flex h-12 shrink-0 items-center gap-1 rounded-2xl px-3 text-base font-bold text-ink hover:bg-black/5"><ChevronLeft size={22} />Back</button>
      <span className="min-w-0 flex-1 text-center"><span className="block truncate text-lg font-bold">{opts.title ?? surahs}</span><span className="block text-sm text-ink-faint">Page {page}{opts.title ? ` · ${surahs}` : ''}</span></span>
      <button type="button" onClick={() => setGoto(true)} className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-pine-50 px-3 text-base font-bold text-pine-800"><Search size={18} />Find</button>
    </header>}
    <div ref={box} className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain" data-no-pull style={{ touchAction: 'pan-y pinch-zoom' }}
      onPointerDown={e => { x0.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
      onPointerMove={e => { const s = x0.current; if (!s) return; const dx = e.clientX - s.x; if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.2) setDrag(dx); }}
      onPointerCancel={() => { x0.current = null; setDrag(0); }}
      onPointerUp={e => { const s = x0.current; x0.current = null; setDrag(0); if (!s) return; const dx = e.clientX - s.x, dy = e.clientY - s.y; const fast = Math.abs(dx) > 35 && Date.now() - s.t < 300;
        if ((Math.abs(dx) > 60 || fast) && Math.abs(dx) > Math.abs(dy) * 1.2) { const to = dx > 0 ? page + 1 : page - 1; if (to >= 1 && to <= TOTAL_PAGES) { setTurn(dx > 0 ? 'r' : 'l'); go(to); } return; }
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) tapToggle(e); }}>
      <div key={page} className={cx('mx-auto w-full max-w-2xl px-1.5 pb-6 pt-2 sm:px-4 sm:pt-4', turn === 'r' ? 'page-turn-r' : turn === 'l' ? 'page-turn-l' : '')}
        style={drag ? { transform: `translateX(${drag * 0.85}px)`, opacity: 1 - Math.min(0.3, Math.abs(drag) / 1000), transition: 'none' } : undefined}>
        {hidden && !rc.active && <p className="mb-2 rounded-xl bg-pine-50 px-3 py-2 text-center text-sm text-pine-800">Recite from memory. Tap an ayah to check it.</p>}
        <div className="px-1 py-1 sm:rounded-2xl sm:bg-white sm:px-8 sm:py-3 sm:shadow-card sm:ring-1 sm:ring-brass-500/25">
          <MushafPage page={page} marks={marks} hidden={hidden && !rc.active} revealed={revealed} onReveal={id => setRevealed(s => new Set(s).add(id))} recite={rc.view ?? undefined} onWords={rc.setWords} onWordTap={rc.peek} />
          <p className="mt-1 text-center text-sm text-ink-faint">{page}</p>
        </div>
        {kinds.length > 0 && <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">{kinds.map(k => <span key={k} className="inline-flex items-center gap-1.5"><i className={cx('h-3 w-5 rounded', MARK_CLS[k])} />{MARK_LABEL[k]}</span>)}
          {onPageMarks.length === 0 && <span className="text-ink-faint">· none on this page</span>}</p>}
        <p className="mt-3 text-center text-sm text-ink-faint">Swipe to turn the page 👆</p>
      </div>
    </div>
    {rc.active ? <ReciteBar rc={rc} page={page} /> : chrome && <footer className="flex flex-col gap-2 border-t border-line bg-white/95 px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur dark:bg-paper/95">
      {listen && <div className="flex justify-center"><AyahPlayer range={r} compact onAyah={setPlayingAyah} /></div>}
      <div className="grid grid-cols-3 gap-2">
        <BigTool on={listen} onClick={() => setListen(l => !l)} icon="🔊" label={listen ? 'Stop' : 'Listen'} />
        <BigTool onClick={rc.begin} icon="🎤" label="Recite" strong />
        <BigTool on={hidden} onClick={() => { setHidden(h => !h); setRevealed(new Set()); }} icon={hidden ? '👀' : '🙈'} label={hidden ? 'Show' : 'Hide'} />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setTurn('r'); go(page + 1); }} disabled={page >= TOTAL_PAGES} className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-black/[.05] text-base font-bold text-ink disabled:opacity-30 dark:bg-white/10"><ChevronLeft size={22} />Next page</button>
        <button type="button" onClick={() => { setTurn('l'); go(page - 1); }} disabled={page <= 1} className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-black/[.05] text-base font-bold text-ink disabled:opacity-30 dark:bg-white/10">Back a page<ChevronRight size={22} /></button>
      </div>
    </footer>}
    {goto && <div className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => setGoto(false)}>
      <div className="w-full rounded-t-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-3xl" onClick={e => e.stopPropagation()} role="dialog" aria-label="Go to">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Find a surah</h2><button type="button" onClick={() => setGoto(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5"><X size={20} /></button></div>
        <JumpTo page={page} go={p => { go(p); setGoto(false); }} />
      </div>
    </div>}
  </div>, document.body);
}

function JumpTo({ page, go }: { page: number; go: (p: number) => void }) {
  const [q, setQ] = useState('');
  const cur = fromAyahId(pageRange(page).start).surah;
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f'ʿʾ‘’-]/g, '').replace(/\s+/g, '');
  const list = Array.from({ length: 114 }, (_, i) => i + 1).filter(n => !q.trim() || String(n) === q.trim() || norm(surahNameEn(n)).includes(norm(q)));
  const juzPage = (j: number) => { for (let p = 1; p <= TOTAL_PAGES; p++) if (juzOf(pageRange(p).start) === j) return p; return 1; };
  return <div className="flex min-h-0 flex-col gap-3">
    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a surah name or number" aria-label="Find a surah"
      className="h-14 w-full rounded-2xl bg-paper px-4 text-lg ring-2 ring-line focus:outline-none focus:ring-pine-600" />
    <ul className="-mx-1 max-h-[46dvh] overflow-y-auto overscroll-contain px-1">{list.map(n => <li key={n}>
      <button type="button" onClick={() => go(pageOf(surahFirstId(n)))} className={cx('flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-pine-50', n === cur && 'bg-pine-50')}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-sm font-bold tabular-nums ring-1 ring-line dark:bg-paper">{n}</span>
        <span className="min-w-0 flex-1 truncate text-lg font-bold">{surahNameEn(n)}</span>
        <span className="font-quran text-2xl" dir="rtl">{surahNameAr(n)}</span>
      </button></li>)}
      {!list.length && <li className="p-4 text-center text-ink-faint">No surah found. Try another spelling.</li>}</ul>
    <p className="text-sm font-bold text-ink-soft">Or pick a juz</p>
    <div className="grid grid-cols-6 gap-1.5">{Array.from({ length: 30 }, (_, i) => i + 1).map(j => <button key={j} type="button" onClick={() => go(juzPage(j))} className={cx('h-11 rounded-xl text-base font-bold tabular-nums ring-1 ring-line', juzOf(pageRange(page).start) === j ? 'bg-pine-700 text-white ring-pine-700' : 'bg-white dark:bg-paper')}>{j}</button>)}</div>
  </div>;
}

function BigTool({ icon, label, onClick, on, strong }: { icon: string; label: string; onClick: () => void; on?: boolean; strong?: boolean }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={cx('flex h-16 flex-col items-center justify-center rounded-2xl text-base font-bold leading-tight shadow-[inset_0_-5px_0_rgba(0,0,0,.12)] active:scale-[.97]',
    strong ? 'bg-pine-700 text-white' : on ? 'bg-[#FFD23F] text-[#1B2433]' : 'bg-pine-50 text-pine-800')}><span className="text-2xl leading-none" aria-hidden>{icon}</span>{label}</button>;
}

/** Small "open in the muṣḥaf" link used next to a range */
export function MushafLink({ range, marks, title, label = 'Open in muṣḥaf', className }: { range: Range; marks?: Array<[number, Mark]>; title?: string; label?: string; className?: string }) {
  return <button type="button" onClick={() => openMushaf({ ayah: range.start, marks: marks ?? rangeMarks(range, 'lesson'), title })}
    className={cx('inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-pine-700 ring-1 ring-inset ring-pine-600/30 hover:bg-pine-50', className)}><BookOpen size={16} />{label}</button>;
}
export { ayahId };
