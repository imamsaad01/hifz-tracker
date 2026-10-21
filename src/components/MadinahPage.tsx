// The real Madinah muṣḥaf page: the King Fahd Complex (KFGQPC) page font for that page and its exact 15-line layout,
// the same data quran.com uses (api.quran.com v4, fonts from static.qurancdn.com). Each word is one glyph, so
// lines break and justify exactly as in the printed muṣḥaf. Pages are cached on the phone after the first visit.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { surahNameAr, ayahId } from '../quran';
import { cx } from './ui';

export type MarkKind = 'lesson' | 'revision' | 'weak' | 'small' | 'big';
type Word = { c: string; l: number; e: boolean; id: number; t: string; k: number };   // glyph, line, ayah-end marker, global ayah id, Uthmani text, word number in the ayah
export interface PageLayout { words: Word[]; starts: number[] }  // starts: surahs that begin on this page
const API = (p: number) => `https://api.quran.com/api/v4/verses/by_page/${p}?words=true&word_fields=code_v2,line_number,text_uthmani&fields=verse_key&per_page=50`;
const FONT = (p: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`;
const CACHE = 'hifz-mushaf-v3';
const mem = new Map<number, Promise<PageLayout>>();

async function getJson(url: string): Promise<unknown> {
  try { const c = await caches.open(CACHE); const hit = await c.match(url); if (hit) return hit.json(); const r = await fetch(url); if (!r.ok) throw new Error('offline'); c.put(url, r.clone()).catch(() => undefined); return r.json(); }
  catch (e) { if (typeof caches === 'undefined') { const r = await fetch(url); if (!r.ok) throw new Error('offline'); return r.json(); } throw e; }
}
type ApiWord = { code_v2: string; line_number: number; char_type_name: string; text_uthmani?: string };
type ApiVerse = { verse_key: string; words: ApiWord[] };
export function loadLayout(p: number): Promise<PageLayout> {
  if (!mem.has(p)) mem.set(p, (async () => {
    const j = await getJson(API(p)) as { verses: ApiVerse[] };
    const words: Word[] = []; const starts: number[] = [];
    for (const v of j.verses) {
      const [s, a] = v.verse_key.split(':').map(Number); const id = ayahId(s, a); if (a === 1) starts.push(s);
      let k = 0; for (const w of v.words) { const e = w.char_type_name === 'end'; words.push({ c: w.code_v2, l: w.line_number, e, id, t: w.text_uthmani ?? '', k: e ? -1 : k++ }); }
    }
    if (!words.length) throw new Error('empty');
    return { words, starts };
  })().catch(e => { mem.delete(p); throw e; }));
  return mem.get(p)!;
}
const fonts = new Map<number, Promise<void>>();
export function loadFont(p: number): Promise<void> {
  if (!fonts.has(p)) fonts.set(p, (async () => { const f = new FontFace(`qpc-v2-p${p}`, `url(${FONT(p)}) format("woff2")`, { display: 'block' }); await f.load(); document.fonts.add(f); })().catch(e => { fonts.delete(p); throw e; }));
  return fonts.get(p)!;
}
/** Warm the next and previous pages so turning feels instant */
export const prefetch = (p: number) => { for (const q of [p + 1, p - 1]) if (q >= 1 && q <= 604) { loadLayout(q).catch(() => undefined); loadFont(q).catch(() => undefined); } };

const MARK: Record<MarkKind, string> = {
  lesson: 'bg-emerald-200/55 dark:bg-emerald-400/20', revision: 'bg-sky-200/55 dark:bg-sky-400/20', weak: 'bg-amber-200/70 dark:bg-amber-400/25',
  small: 'bg-amber-300/75 dark:bg-amber-400/40', big: 'bg-red-300/75 dark:bg-red-500/40',
};

export type ReciteWord = { key: string; text: string };
export type ReciteView = { states: Map<string, 'hidden' | 'ok' | 'missed' | 'wrong' | 'fixed' | 'vowel' | 'peek'>; next: string | null };
/** how each word looks while reciting on the page (Tarteel-style memorisation mode) */
export const RS: Record<string, string> = {
  hidden: 'cursor-pointer text-transparent [text-shadow:0_0_0.38em_rgb(var(--ink)/0.42)]', peek: 'text-ink-faint',
  ok: 'rc-in text-ink', fixed: 'rc-in text-ink underline decoration-bad decoration-wavy decoration-1 underline-offset-[0.35em]',
  missed: 'bg-amber-200/80 text-ink dark:bg-amber-400/30', vowel: 'rc-in bg-violet-200/80 text-ink dark:bg-violet-400/30', wrong: 'shake bg-red-200/80 text-bad dark:bg-red-500/30',
};

/** Renders a page, or calls onFail so the caller can fall back to plain text (e.g. offline the first time). */
export function MadinahPage({ page, marks, onTap, hidden, revealed, onReveal, onFail, size = 'md', recite, onWords, onWordTap }: {
  page: number; marks?: Map<number, MarkKind>; onTap?: (id: number) => void; hidden?: boolean; revealed?: Set<number>; onReveal?: (id: number) => void; onFail: () => void; size?: 'sm' | 'md';
  recite?: ReciteView; onWords?: (w: ReciteWord[]) => void; onWordTap?: (key: string) => void;
}) {
  const [lay, setLay] = useState<PageLayout | null>(null);
  const box = useRef<HTMLDivElement>(null); const [fs, setFs] = useState(0);
  useEffect(() => {
    let live = true; setLay(null); setFs(0); setRatio(0);
    Promise.all([loadLayout(page), loadFont(page)]).then(([l]) => { if (live) { setLay(l); prefetch(page); onWords?.(l.words.filter(w => !w.e).map(w => ({ key: `${w.id}:${w.k}`, text: w.t }))); } }).catch(() => live && onFail());
    return () => { live = false; };
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fit the widest line to the width available. The widest line is measured once per page at a fixed size
  // (off-screen), then only the container width matters, so the text never jumps or "shakes" while settling.
  const [ratio, setRatio] = useState(0);     // widest line width ÷ font size
  useLayoutEffect(() => {
    if (!lay) return;
    const m = document.createElement('div');
    m.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;font-size:100px;font-family:qpc-v2-p${page}`;
    const byLine = new Map<number, string[]>(); lay.words.forEach(w => byLine.set(w.l, [...(byLine.get(w.l) ?? []), w.c]));
    let widest = 0;
    byLine.forEach(ws => { const sp = document.createElement('span'); sp.textContent = ws.join(' '); m.appendChild(sp); });
    document.body.appendChild(m);
    m.querySelectorAll('span').forEach(sp => { widest = Math.max(widest, (sp as HTMLElement).getBoundingClientRect().width); });
    m.remove();
    setRatio(widest / 100);
  }, [lay, page]);
  useLayoutEffect(() => {
    const el = box.current; if (!el || !ratio) return;
    let last = -1;
    const fit = () => { const w = el.clientWidth; if (Math.abs(w - last) < 2) return; last = w; setFs(Math.round(Math.min(size === 'sm' ? 30 : 40, Math.max(14, (w * 0.98) / ratio)) * 10) / 10); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [ratio, size]);
  if (!lay) return <div className="py-20 text-center text-sm text-ink-faint">Loading page {page}…</div>;
  const lines = new Map<number, Word[]>(); lay.words.forEach(w => lines.set(w.l, [...(lines.get(w.l) ?? []), w]));
  // surah title and basmalah sit on the empty lines just before a surah's first line
  const extra = new Map<number, { kind: 'title' | 'basmalah'; surah: number }>();
  for (const s of lay.starts) {
    const first = lay.words.find(w => w.id === ayahId(s, 1))!.l;
    if (s === 1) { extra.set(first - 1, { kind: 'title', surah: s }); continue; }
    if (s === 9) { extra.set(first - 1, { kind: 'title', surah: s }); continue; }
    extra.set(first - 1, { kind: 'basmalah', surah: s }); extra.set(first - 2, { kind: 'title', surah: s });
  }
  const maxLine = Math.max(15, ...lines.keys());
  const center = page <= 2;
  const hide = (id: number) => hidden && !revealed?.has(id);
  return <div ref={box} lang="ar" dir="rtl" aria-label={`Muṣḥaf page ${page}`} className={cx('select-none text-ink', center && 'py-6')} style={{ fontFamily: `qpc-v2-p${page}`, fontSize: fs ? `${fs}px` : '30px', lineHeight: 1.85, visibility: fs ? 'visible' : 'hidden' }}>
    {Array.from({ length: maxLine }, (_, i) => i + 1).map(n => {
      const ws = lines.get(n); const x = extra.get(n);
      if (!ws) {
        if (!x) return center ? null : <div key={n} style={{ height: '1.85em' }} />;
        return x.kind === 'title'
          ? <div key={n} className="flex items-center justify-center" style={{ height: '1.85em' }}><span className="flex h-[1.5em] w-full items-center justify-center rounded-lg border-[3px] border-double border-brass-500/70 bg-brass-100/40 font-quran text-[0.78em] leading-none dark:bg-brass-500/10">سُورَةُ {surahNameAr(x.surah)}</span></div>
          : <div key={n} className="flex items-center justify-center font-quran text-[0.86em] leading-none" style={{ height: '1.85em' }}>بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>;
      }
      return <div key={n} data-line className={cx('flex', center || ws.length < 3 ? 'justify-center gap-[0.15em]' : 'justify-between')} style={{ height: '1.85em', alignItems: 'center' }}>
        {ws.map((w, k) => { const m = marks?.get(w.id); const h = !w.e && hide(w.id); const key = `${w.id}:${w.k}`; const rs = recite && !w.e ? recite.states.get(key) ?? 'hidden' : null;
          return <span key={k} data-ayah={w.id} data-w={w.e ? undefined : key} role={onTap || hidden || recite ? 'button' : undefined}
            onClick={() => { if (recite) { if (!w.e) onWordTap?.(key); return; } if (hidden && !revealed?.has(w.id)) onReveal?.(w.id); else onTap?.(w.id); }}
            className={cx('rounded-[0.15em] px-[0.02em] transition-colors duration-300', !recite && m && MARK[m], (onTap || hidden) && 'cursor-pointer', h && 'text-transparent [text-shadow:0_0_0.35em_rgb(var(--ink)/0.5)]', w.e && 'text-brass-700 dark:text-brass-100', rs && RS[rs], recite?.next === key && 'rc-next')}>{w.c}</span>; })}
      </div>;
    })}
  </div>;
}
