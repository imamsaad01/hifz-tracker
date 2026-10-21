// Recite from memory right on the muṣḥaf page (like Tarteel's memorisation mode, without leaving the page):
// the page's words are hidden, the microphone stays open, and each word appears in place as it is said:
// red with the right word when something else was said, amber when skipped. When the page is finished it turns
// to the next page by itself and keeps listening. Tap a hidden word to peek at it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Lightbulb, X, RotateCcw } from 'lucide-react';
import { follow } from '../lib/reciteMatch';
import { useSpeech, canListen } from '../lib/useSpeech';
import { writeLog, type ReciteRecord } from './Recite';
import type { ReciteView, ReciteWord } from './MadinahPage';
import { cx } from './ui';

export function useRecite(page: number) {
  const sp = useSpeech();
  const [active, setActive] = useState(false);
  const [words, setWordsState] = useState<{ page: number; list: ReciteWord[] }>({ page: 0, list: [] });
  const [base, setBase] = useState(0); const [hints, setHints] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ page: number; right: number; total: number; fixed: number; missed: number; vowel: number } | null>(null);
  const wrongSeen = useRef<Set<number>>(new Set()); const onPageDone = useRef<() => void>(() => undefined); const finished = useRef(-1);
  const list = words.page === page ? words.list : [];
  const cur = sp.heard.slice(base);
  const f = useMemo(() => follow(list.map(w => w.text), cur), [list, cur.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps
  f.states.forEach((s, k) => { if (s === 'wrong') wrongSeen.current.add(k); });
  const complete = list.length > 0 && f.next >= list.length;
  // a new page: start matching from what is heard next, clear peeks
  useEffect(() => { setHints(new Set()); wrongSeen.current = new Set(); }, [page]);
  useEffect(() => {
    if (!active || !complete || finished.current === page) return;
    finished.current = page;
    const marks: ReciteRecord['marks'] = []; let fixed = 0, missed = 0, vowel = 0;
    f.states.forEach((s, k) => { const id = Number(list[k].key.split(':')[0]); const w = list[k].text;
      if (s === 'missed') { missed++; marks.push({ w, id, kind: 'skipped' }); } else if (s === 'vowel') { vowel++; marks.push({ w, id, kind: 'vowel' }); } else if (s === 'fixed' || wrongSeen.current.has(k)) { fixed++; marks.push({ w, id, kind: 'wrong' }); } else if (hints.has(list[k].key)) marks.push({ w, id, kind: 'hint' }); });
    const ids = list.map(w => Number(w.key.split(':')[0]));
    writeLog({ at: new Date().toISOString(), start: Math.min(...ids), end: Math.max(...ids), words: list.length, right: list.length - marks.length, demo: false, marks });
    setSummary({ page, right: list.length - marks.length, total: list.length, fixed, missed, vowel });
    try { navigator.vibrate?.([15, 50, 15]); } catch { /* */ }
    const used = base + f.used;
    const t = window.setTimeout(() => { setBase(used); onPageDone.current(); }, 900);
    return () => clearTimeout(t);
  }, [complete, active, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!summary) return; const t = setTimeout(() => setSummary(null), 4000); return () => clearTimeout(t); }, [summary]);

  const states = new Map<string, 'hidden' | 'ok' | 'missed' | 'wrong' | 'fixed' | 'vowel' | 'peek'>();
  list.forEach((w, k) => { const s = f.states[k]; states.set(w.key, s === 'hidden' && hints.has(w.key) ? 'peek' : s); });
  const view: ReciteView | null = active ? { states, next: sp.on && !complete ? list[f.next]?.key ?? null : null } : null;
  const setWords = useCallback((l: ReciteWord[]) => setWordsState({ page, list: l }), [page]);
  const begin = () => { sp.reset(); setBase(0); setHints(new Set()); finished.current = -1; wrongSeen.current = new Set(); setActive(true); sp.start(); };
  const end = () => { sp.stop(); setActive(false); };
  const restartPage = () => { setBase(sp.heard.length); setHints(new Set()); wrongSeen.current = new Set(); finished.current = -1; };
  const peek = (key?: string) => setHints(h => new Set(h).add(key ?? list[f.next]?.key ?? ''));
  return { active, begin, end, view, setWords, peek, restartPage, onPageDone, sp, next: f.next, total: list.length, wrongNow: f.states.includes('wrong'), vowelNow: f.states.includes('vowel'), summary };
}

export function ReciteBar({ rc, page }: { rc: ReturnType<typeof useRecite>; page: number }) {
  const { sp } = rc; const pct = rc.total ? Math.round((rc.next / rc.total) * 100) : 0;
  return <footer className="relative border-t border-line bg-white px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] dark:bg-[rgb(var(--paper))]">
    <div className="absolute inset-x-0 top-0 h-1 bg-brass-100/60"><div className="h-full bg-gradient-to-l from-pine-600 to-brass-500 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
    {rc.summary && <div role="status" className="pop absolute inset-x-3 -top-14 flex items-center justify-center gap-2 rounded-xl bg-pine-800 px-3 py-2.5 text-sm font-bold text-white shadow-card">
      Page {rc.summary.page} · {rc.summary.right}/{rc.summary.total} words{rc.summary.fixed ? ` · ${rc.summary.fixed} corrected` : ''}{rc.summary.missed ? ` · ${rc.summary.missed} skipped` : ''}{rc.summary.vowel ? ` · ${rc.summary.vowel} long vowel${rc.summary.vowel > 1 ? 's' : ''} to check` : ''}</div>}
    <div className="flex items-center gap-3">
      <button type="button" onClick={sp.on ? sp.stop : sp.start} aria-label={sp.on ? 'Pause listening' : 'Carry on listening'} aria-pressed={sp.on}
        className={cx('relative grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-lg transition active:scale-95', sp.on ? 'bg-bad' : 'bg-gradient-to-br from-pine-600 to-pine-800')}>
        {sp.on ? <span className="flex h-6 items-end gap-[3px]" aria-hidden>{[0, 1, 2, 3].map(b => <span key={b} className={cx('w-1 rounded-full bg-white', sp.live ? 'wave-bar' : 'h-1/3 opacity-60')} style={{ animationDelay: `${b * 0.12}s` }} />)}</span> : <Mic size={24} />}
      </button>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className={cx('truncate text-sm font-bold', rc.wrongNow ? 'text-bad' : 'text-ink')}>{sp.err ? sp.err : rc.wrongNow ? 'Not quite: the red word comes next' : sp.on ? (sp.live ? 'Listening… recite from memory' : 'Getting the microphone ready…') : 'Paused'}</p>
        <p className="text-xs text-ink-faint">{rc.vowelNow ? <b className="text-violet-700 dark:text-violet-300">Purple: check the long vowel · </b> : null}Page {page} · {rc.next}/{rc.total} words · tap a word to peek</p>
      </div>
      <button type="button" onClick={() => rc.peek()} aria-label="Hint: show the next word" className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft ring-1 ring-line hover:bg-black/5"><Lightbulb size={18} /></button>
      <button type="button" onClick={rc.restartPage} aria-label="Start this page again" className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft ring-1 ring-line hover:bg-black/5"><RotateCcw size={18} /></button>
      <button type="button" onClick={rc.end} aria-label="Finish reciting" className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft ring-1 ring-line hover:bg-black/5">{sp.on ? <Square size={16} /> : <X size={18} />}</button>
    </div>
    {!canListen() && <p className="mt-1 text-center text-xs text-bad">Listening needs Chrome, Edge or Safari.</p>}
  </footer>;
}
