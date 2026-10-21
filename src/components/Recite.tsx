// Recite from memory while the phone listens (Tarteel-style memorisation mode). The ayah starts hidden; each word
// appears as you say it, green when right, amber when it was skipped. Uses the browser's own speech recognition
// (free; Chrome, Edge and Safari). It is a practice aid, not a judge: the teacher still hears the lesson.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Lightbulb, RotateCcw } from 'lucide-react';
import { follow } from '../lib/reciteMatch';
import { Button, cx } from './ui';

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const SRClass = (): (new () => SR) | null => { const w = window as unknown as Record<string, unknown>; return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SR) | null; };
export const canRecite = () => typeof window !== 'undefined' && !!SRClass();

export function Recite({ text, onNext }: { text: string | null; onNext?: () => void }) {
  const words = useMemo(() => (text ?? '').split(/\s+/).filter(w => w && !/^[٠-٩۰-۹\d]+$/.test(w) && !/^[۝۞]/.test(w)), [text]);
  const [heard, setHeard] = useState<string[]>([]); const [on, setOn] = useState(false); const [err, setErr] = useState('');
  const [hints, setHints] = useState<Set<number>>(new Set());
  const rec = useRef<SR | null>(null); const done = useRef<string[]>([]); const want = useRef(false);
  const { states, next } = follow(words, heard);
  const complete = words.length > 0 && next >= words.length;
  const missed = states.filter(s => s === 'missed').length; const fixed = states.filter(s => s === 'fixed').length; const wrongNow = states.includes('wrong');
  const stop = () => { want.current = false; rec.current?.stop(); setOn(false); };
  useEffect(() => () => { want.current = false; rec.current?.abort(); }, []);
  useEffect(() => { if (complete) { stop(); try { navigator.vibrate?.([15, 40, 15]); } catch { /* */ } } }, [complete]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = () => {
    const C = SRClass(); if (!C) return; setErr('');
    const r = new C(); r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true;
    let sess: string[] = [];   // final words of this listening run (Chrome stops every so often; we restart and keep them)
    r.onresult = e => { const fin: string[] = []; let live = ''; for (let k = 0; k < e.results.length; k++) { const t = e.results[k][0].transcript; if (e.results[k].isFinal) fin.push(t); else live += ` ${t}`; }
      sess = fin.join(' ').split(/\s+/).filter(Boolean); setHeard([...done.current, ...sess, ...live.split(/\s+/)].filter(Boolean)); };
    r.onend = () => { done.current = [...done.current, ...sess]; sess = []; if (want.current) { try { r.start(); } catch { setOn(false); } } else setOn(false); };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { want.current = false; setErr('Allow the microphone for this site to use Recite.'); } else if (e.error === 'network') { want.current = false; setErr('Recite needs an internet connection.'); } };
    rec.current = r; want.current = true; try { r.start(); setOn(true); } catch { setErr('Could not start the microphone.'); }
  };
  const reset = () => { stop(); done.current = []; setHeard([]); setHints(new Set()); };
  if (!canRecite()) return <p className="py-6 text-center text-sm text-ink-faint">Recite needs a browser that can listen, such as Chrome or Safari. Try it on your phone.</p>;
  if (text === null) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>;
  if (!words.length) return <p className="py-6 text-center text-sm text-ink-faint">This needs a connection the first time.</p>;
  return <div className="flex flex-col items-center gap-4">
    <p className={cx('text-center text-sm', wrongNow ? 'font-bold text-bad' : 'text-ink-soft')}>{complete ? '' : wrongNow ? 'Not quite. The red word is what comes next; say it again.' : on ? 'Listening… recite the ayah from memory.' : 'Tap the microphone and recite from memory. Words appear as you say them.'}</p>
    <p lang="ar" dir="rtl" className="w-full rounded-xl bg-paper p-3 text-center font-quran text-[26px] leading-[2.2] ring-1 ring-line">
      {words.map((w, k) => { const st = states[k]; const peek = hints.has(k) && st === 'hidden';
        return <span key={k} className={cx('mx-[0.12em] inline-block rounded px-0.5 transition-all duration-300', st === 'ok' && 'fly-in text-good', st === 'missed' && 'bg-amber-200/70 text-warn dark:bg-amber-400/25', st === 'wrong' && 'shake bg-red-100 text-bad ring-2 ring-bad/50 dark:bg-red-500/20', st === 'fixed' && 'text-good underline decoration-bad decoration-wavy decoration-1 underline-offset-[10px]', st === 'hidden' && !peek && 'select-none text-transparent [text-shadow:0_0_0.4em_rgb(var(--ink)/0.45)]', peek && 'text-ink-faint', k === next && on && 'ring-2 ring-pine-600/40')}>{w}</span>; })}
    </p>
    {complete ? <div className="flex flex-col items-center gap-3">
      <p className="pop text-lg font-bold text-good">{missed === 0 && fixed === 0 && hints.size === 0 ? 'Perfect, from memory!' : `Done${fixed ? ` · ${fixed} corrected` : ''}${missed ? ` · ${missed} skipped` : ''}${hints.size ? ` · ${hints.size} hint${hints.size > 1 ? 's' : ''}` : ''}`}</p>
      <div className="flex gap-2"><Button kind="secondary" onClick={reset}><RotateCcw size={16} />Again</Button>{onNext && <Button onClick={onNext}>Next ayah</Button>}</div>
    </div> : <div className="flex items-center gap-3">
      <button type="button" onClick={on ? stop : start} aria-label={on ? 'Stop listening' : 'Start reciting'} aria-pressed={on}
        className={cx('relative grid h-20 w-20 place-items-center rounded-full text-white shadow-lg transition active:scale-95', on ? 'bg-bad' : 'bg-pine-700')}>
        {on && <span className="absolute inset-0 animate-ping rounded-full bg-bad/40" />}{on ? <MicOff size={30} /> : <Mic size={30} />}
      </button>
      <div className="flex flex-col gap-1">
        <Button kind="secondary" disabled={next >= words.length} onClick={() => setHints(h => new Set(h).add(next))}><Lightbulb size={16} />Hint</Button>
        {heard.length > 0 && <Button kind="quiet" onClick={reset}><RotateCcw size={16} />Start over</Button>}
      </div>
    </div>}
    {err && <p className="text-sm text-bad">{err}</p>}
    <p className="text-center text-xs text-ink-faint">{next}/{words.length} words · uses your browser’s speech recognition, so it may miss some words. Your teacher still hears the lesson.</p>
  </div>;
}
