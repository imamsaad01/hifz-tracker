// Recite from memory while the phone listens (Tarteel-style memorisation mode). The passage starts hidden; each word
// appears as you say it: green when right, red when you said something else (it shows the right word), amber when
// skipped. The microphone stays on and follows you from ayah to ayah. Uses the browser's own speech recognition
// (free; Chrome, Edge and Safari). "Hear a sheikh" plays a reciter and drives the same follow-along, so anyone can see
// how it works without reciting. Every finished recitation is kept as a record with its marked words.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Lightbulb, RotateCcw, Headphones, BookOpen, History } from 'lucide-react';
import { follow, type WordState } from '../lib/reciteMatch';
import { fromAyahId, surahNameEn, pageOf, pageRange } from '../quran';
import { loadPage, openMushaf } from './Mushaf';
import { RECITERS, KEY as RECITER_KEY, ayahAudio } from './AyahPlayer';
import { useApp } from '../app/context';
import { useSpeech } from '../lib/useSpeech';
import { Button, Select, cx } from './ui';

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const SRClass = (): (new () => SR) | null => { const w = window as unknown as Record<string, unknown>; return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SR) | null; };
export const canRecite = () => typeof window !== 'undefined' && !!SRClass();
const isMark = (w: string) => /^[٠-٩۰-۹\d]+$/.test(w) || /^[۝۞]/.test(w);
const arNum = (n: number) => n.toLocaleString('ar-EG');
const name = (id: number) => { const a = fromAyahId(id); return `${surahNameEn(a.surah)} ${a.ayah}`; };
async function ayahText(id: number) { const p = pageOf(id); const t = await loadPage(p); return t[id - pageRange(p).start]; }

// ---- records (kept on this device; a student's results are also sent to their teacher as a self-test) ----
export interface ReciteRecord { at: string; start: number; end: number; words: number; right: number; demo: boolean; marks: Array<{ w: string; id: number; kind: 'wrong' | 'skipped' | 'hint' | 'vowel' }> }
const LOG = 'hifz-recite-log';
const readLog = (): ReciteRecord[] => { try { return JSON.parse(localStorage.getItem(LOG) ?? '[]'); } catch { return []; } };
export const writeLog = (r: ReciteRecord) => { try { localStorage.setItem(LOG, JSON.stringify([r, ...readLog()].slice(0, 40))); } catch { /* private mode */ } };
const score = (r: ReciteRecord) => Math.round((r.right / Math.max(1, r.words)) * 100);

export function Recite({ ids, onAt, studentId }: { ids: number[]; onAt?: (k: number) => void; studentId?: string }) {
  const { api } = useApp();
  const [texts, setTexts] = useState<Array<string | null>>(() => ids.map(() => null));
  useEffect(() => { let live = true; Promise.all(ids.map(x => ayahText(x).catch(() => ''))).then(t => live && setTexts(t)); return () => { live = false; }; }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = texts.every(t => t !== null);
  const flat = useMemo(() => ready ? texts.flatMap((t, ai) => (t ?? '').split(/\s+/).filter(w => w && !isMark(w)).map(w => ({ w, ai }))) : [], [ready, texts]);
  const words = useMemo(() => flat.map(x => x.w), [flat]);

  const sp = useSpeech();
  const [demoHeard, setHeard] = useState<string[]>([]); const [mode, setMode] = useState<'off' | 'mic' | 'sheikh'>('off'); const [err, setErr] = useState('');
  const [hints, setHints] = useState<Set<number>>(new Set()); const [log, setLog] = useState<ReciteRecord[]>(readLog);
  const [slip, setSlip] = useState(true);
  const [reciter, setReciter] = useState(() => { try { return localStorage.getItem(RECITER_KEY) || RECITERS[0][0]; } catch { return RECITERS[0][0]; } });
  const done = useRef<string[]>([]); const want = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null); const timers = useRef<number[]>([]); const demo = useRef(false); const sawWrong = useRef<Set<number>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  const heard = mode === 'mic' || (mode === 'off' && sp.heard.length) ? sp.heard : demoHeard;
  const { states, next } = follow(words, heard);
  states.forEach((s, k) => { if (s === 'wrong') sawWrong.current.add(k); });
  const complete = words.length > 0 && next >= words.length;
  const at = complete ? texts.length - 1 : (flat[next]?.ai ?? 0);
  const wrongNow = states.includes('wrong');
  const on = mode !== 'off';

  const clearDemo = () => { timers.current.forEach(t => clearTimeout(t)); timers.current = []; audio.current?.pause(); };
  const stop = () => { want.current = false; sp.stop(); clearDemo(); setMode('off'); };
  useEffect(() => { if (mode === 'mic' && !sp.on) setMode('off'); }, [sp.on]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { want.current = false; clearDemo(); }, []);
  useEffect(() => { onAt?.(at); const b = box.current; const el = b?.querySelector<HTMLElement>(`[data-ai="${at}"]`); if (b && el) b.scrollTo({ top: Math.max(0, el.offsetTop - b.offsetTop - 12), behavior: 'smooth' }); }, [at]);   // scroll only the page box, never the dialog // eslint-disable-line react-hooks/exhaustive-deps

  // when the passage is finished: stop, buzz, and keep a record
  useEffect(() => {
    if (!complete) return;
    stop(); try { navigator.vibrate?.([15, 40, 15]); } catch { /* */ }
    const marks: ReciteRecord['marks'] = [];
    states.forEach((s, k) => { const id = ids[flat[k].ai]; if (s === 'missed') marks.push({ w: words[k], id, kind: 'skipped' }); else if (s === 'vowel') marks.push({ w: words[k], id, kind: 'vowel' }); else if (s === 'fixed' || sawWrong.current.has(k)) marks.push({ w: words[k], id, kind: 'wrong' }); else if (hints.has(k)) marks.push({ w: words[k], id, kind: 'hint' }); });
    const r: ReciteRecord = { at: new Date().toISOString(), start: ids[0], end: ids[ids.length - 1], words: words.length, right: words.length - marks.length, demo: demo.current, marks };
    writeLog(r); setLog(readLog());
    if (studentId && !demo.current) api.saveRecall({ studentId, start: r.start, end: r.end, total: ids.length, peeked: [...new Set(marks.map(m => m.id))] }).catch(() => undefined);
  }, [complete]); // eslint-disable-line react-hooks/exhaustive-deps

  const showPage = () => box.current?.parentElement?.scrollIntoView({ block: 'start', behavior: 'smooth' });   // bring the page into view when it starts
  const reset = () => { stop(); done.current = []; setHeard([]); sp.reset(); setHints(new Set()); sawWrong.current = new Set(); demo.current = false; };
  const startMic = () => { reset(); setErr(''); showPage(); setMode('mic'); sp.start(); };
  // "Hear a sheikh": play each ayah and feed its words in time with the audio, through the same follow-along.
  const startSheikh = () => {
    reset(); demo.current = true; setErr(''); setMode('sheikh'); showPage();
    try { localStorage.setItem(RECITER_KEY, reciter); } catch { /* */ }
    const said: string[] = []; const say = (w: string) => { said.push(w); setHeard([...said]); };
    const slipAt = slip && words.length > 6 ? Math.min(words.length - 2, Math.max(3, Math.floor(words.length * 0.4))) : -1;
    let g = 0;
    const playAyah = (ai: number) => {
      if (ai >= texts.length) return;
      const mine = flat.filter(x => x.ai === ai).map(x => x.w); const base = g; g += mine.length;
      const el = audio.current ?? (audio.current = new Audio()); el.src = ayahAudio(reciter, ids[ai]);
      const schedule = (dur: number) => {
        const total = mine.reduce((n, w) => n + w.length + 3, 0); let t = 0.25;
        mine.forEach((w, j) => {
          t += ((w.length + 3) / total) * dur * 0.88;
          const k = base + j;
          if (k === slipAt) { timers.current.push(window.setTimeout(() => { say('خطأ'); say('سهو'); }, t * 1000 - 200)); t += 1.1; }
          timers.current.push(window.setTimeout(() => say(w), t * 1000));
        });
        return t;
      };
      let started = false;
      const fallback = () => { if (started) return; started = true; const t = schedule(Math.max(2.5, mine.length * 0.55)); timers.current.push(window.setTimeout(() => playAyah(ai + 1), t * 1000 + 400)); };
      el.onloadedmetadata = () => { if (started) return; started = true; el.play().then(() => { schedule(el.duration || mine.length * 0.6); }).catch(() => { started = false; fallback(); }); };
      el.onended = () => playAyah(ai + 1);
      el.onerror = () => { setErr('The sheikh’s audio could not load, so the words are shown at reading pace.'); fallback(); };
      timers.current.push(window.setTimeout(() => { if (!started) fallback(); }, 4000));
    };
    playAyah(0);
  };

  if (!ready) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>;
  if (!words.length) return <p className="py-6 text-center text-sm text-ink-faint">This needs a connection the first time.</p>;
  const pct = Math.round((next / words.length) * 100);
  const last = complete ? log[0] : null;
  let g = 0;
  return <div className="flex flex-col gap-4">
    {/* the page: muṣḥaf paper with a double brass frame */}
    <div className="relative overflow-hidden rounded-2xl bg-[#FFFDF7] p-1.5 shadow-card ring-1 ring-brass-500/40 dark:bg-[rgb(var(--paper))]">
      <div className="h-1 overflow-hidden rounded-full bg-brass-100/60"><div className="h-full rounded-full bg-gradient-to-l from-pine-600 to-brass-500 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
      <div ref={box} lang="ar" dir="rtl" className="max-h-[40dvh] overflow-y-auto rounded-xl border-2 border-double border-brass-500/50 px-3 py-3 text-center font-quran text-[26px] leading-[2.25]">
        {texts.map((_, ai) => { const mine = flat.filter(x => x.ai === ai); const from = g; g += mine.length;
          return <p key={ai} data-ai={ai} className={cx('rounded-xl px-1 transition-all duration-500', ai < at && !complete && 'opacity-55', ai === at && on && 'bg-pine-50/70 dark:bg-pine-400/10')}>
            {mine.map((x, j) => { const k = from + j; const st: WordState = states[k]; const peek = hints.has(k) && st === 'hidden';
              return <span key={k} className={cx('mx-[0.1em] inline-block rounded-md px-0.5 transition-all duration-300',
                st === 'ok' && 'fly-in text-pine-800 dark:text-pine-100', st === 'missed' && 'bg-amber-200/70 text-warn dark:bg-amber-400/25', st === 'vowel' && 'fly-in bg-violet-200/80 text-violet-900 dark:bg-violet-400/30 dark:text-violet-100',
                st === 'wrong' && 'shake bg-red-100 text-bad ring-2 ring-bad/50 dark:bg-red-500/20', st === 'fixed' && 'text-pine-800 underline decoration-bad decoration-wavy decoration-1 underline-offset-[10px] dark:text-pine-100',
                st === 'hidden' && !peek && 'select-none text-transparent [text-shadow:0_0_0.42em_rgb(var(--ink)/0.42)]', peek && 'text-ink-faint', k === next && on && 'ring-2 ring-brass-500/60')}>{x.w}</span>; })}
            <span className="relative mx-1 inline-grid h-[1.15em] w-[1.15em] place-items-center align-middle text-[0.62em] text-brass-700 dark:text-brass-100" aria-label={`end of ayah ${fromAyahId(ids[ai]).ayah}`}>
              <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="1" opacity=".6" /></svg>
              <span className="relative leading-none">{arNum(fromAyahId(ids[ai]).ayah)}</span>
            </span>
          </p>; })}
      </div>
    </div>

    <p className={cx('text-center text-sm', wrongNow ? 'font-bold text-bad' : 'text-ink-soft')} aria-live="polite">
      {complete ? '' : wrongNow ? 'Not quite. The red word is what comes next; say it again.' : mode === 'sheikh' ? 'Listening to the sheikh. Watch the words appear as he recites.' : mode === 'mic' ? 'Listening… keep going, it moves to the next ayah by itself.' : `Recite ${texts.length > 1 ? `all ${texts.length} ayahs` : 'the ayah'} from memory, or hear a sheikh first.`}
    </p>

    {complete && last ? <ResultCard r={last} onAgain={reset} /> : <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={mode === 'mic' ? stop : startMic} disabled={mode === 'sheikh' || !canRecite()} aria-label={mode === 'mic' ? 'Stop listening' : 'Start reciting'} aria-pressed={mode === 'mic'}
          className={cx('relative grid h-20 w-20 place-items-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-40', mode === 'mic' ? 'bg-bad' : 'bg-gradient-to-br from-pine-600 to-pine-800')}>
          {mode === 'mic' ? <span className="flex h-8 items-end gap-1" aria-hidden>{[0, 1, 2, 3].map(b => <span key={b} className="wave-bar w-1.5 rounded-full bg-white" style={{ animationDelay: `${b * 0.12}s` }} />)}</span> : <Mic size={30} />}
        </button>
        <div className="flex flex-col gap-1.5">
          <Button kind="secondary" disabled={next >= words.length || mode === 'sheikh'} onClick={() => setHints(h => new Set(h).add(next))}><Lightbulb size={16} />Hint</Button>
          {(heard.length > 0 || on) && <Button kind="quiet" onClick={reset}><RotateCcw size={16} />Start over</Button>}
        </div>
      </div>
      {!canRecite() && <p className="text-center text-xs text-ink-faint">Reciting into the microphone needs Chrome, Edge or Safari. “Hear a sheikh” works everywhere.</p>}
      {/* hear a sheikh: a demonstration through the same follow-along */}
      <div className="w-full rounded-2xl bg-paper p-3 ring-1 ring-line">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Headphones size={16} className="text-pine-700" />Hear a sheikh</p>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'sheikh' ? <Button kind="danger" onClick={stop}><Square size={14} />Stop</Button> : <Button kind="secondary" disabled={mode === 'mic'} onClick={startSheikh}><Headphones size={16} />Play and follow</Button>}
          <Select aria-label="Sheikh" className="!min-h-[44px] !w-auto text-sm" value={reciter} onChange={setReciter} options={RECITERS} />
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={slip} onChange={e => setSlip(e.target.checked)} className="h-5 w-5 accent-[#215549]" />Include a practice slip</label>
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">See how it marks a recitation: the words light up with the sheikh, and the practice slip shows a red correction.</p>
      </div>
    </div>}
    {(err || sp.err) && <p className="text-center text-sm text-warn">{sp.err || err}</p>}
    <p className="text-center text-xs text-ink-faint">Ayah {at + 1} of {texts.length} · {next}/{words.length} words{mode !== 'sheikh' ? ' · uses your browser’s speech recognition, so it may miss some words' : ''}.</p>
    {!on && <RecordList log={complete ? log.slice(1) : log} />}
  </div>;
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 30; const c = 2 * Math.PI * r; const tone = pct >= 95 ? '#2F7D5B' : pct >= 80 ? '#C79A45' : '#C2412D';
  return <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden className="shrink-0 -rotate-90"><circle cx="38" cy="38" r={r} fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="7" />
    <circle cx="38" cy="38" r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} style={{ ['--len' as string]: (c * pct) / 100 }} className="ring-draw" /></svg>;
}
const KIND = { wrong: ['Corrected', 'bg-red-50 text-bad ring-bad/30 dark:bg-red-500/10'], skipped: ['Skipped', 'bg-amber-50 text-warn ring-warn/30 dark:bg-amber-400/10'], hint: ['Hint', 'bg-sky-50 text-sky-800 ring-sky-300 dark:bg-sky-400/10 dark:text-sky-100'], vowel: ['Long vowel', 'bg-violet-50 text-violet-800 ring-violet-300 dark:bg-violet-400/10 dark:text-violet-100'] } as const;
function Marks({ r }: { r: ReciteRecord }) {
  if (!r.marks.length) return null;
  return <div className="flex flex-wrap gap-1.5">{r.marks.slice(0, 12).map((m, i) => <button key={i} type="button" title={`${KIND[m.kind][0]} · ${name(m.id)}`} onClick={() => openMushaf({ ayah: m.id, marks: [[m.id, m.kind === 'wrong' ? 'small' : 'weak']], title: `${KIND[m.kind][0]}: ${name(m.id)}` })}
    className={cx('inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ring-1 ring-inset', KIND[m.kind][1])}><span lang="ar" dir="rtl" className="font-quran text-lg font-normal leading-none">{m.w}</span>{KIND[m.kind][0]}</button>)}</div>;
}
function ResultCard({ r, onAgain }: { r: ReciteRecord; onAgain: () => void }) {
  const p = score(r);
  return <div className="pop flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line dark:bg-transparent">
    <div className="flex items-center gap-4">
      <div className="relative"><ScoreRing pct={p} /><span className="absolute inset-0 grid place-items-center text-lg font-bold tabular-nums">{p}%</span></div>
      <div className="min-w-0">
        <p className="text-lg font-bold">{r.marks.length === 0 ? 'Perfect, from memory!' : p >= 90 ? 'Strong recitation' : p >= 75 ? 'Good, keep polishing' : 'Needs more repetition'}</p>
        <p className="text-sm text-ink-soft">{name(r.start)}{r.end !== r.start ? ` – ${fromAyahId(r.end).ayah}` : ''} · {r.right}/{r.words} words{r.demo ? ' · sheikh demo' : ''}</p>
      </div>
    </div>
    <Marks r={r} />
    <div className="flex flex-wrap gap-2"><Button onClick={onAgain}><RotateCcw size={16} />Recite again</Button>
      {r.marks.length > 0 && <Button kind="secondary" onClick={() => openMushaf({ ayah: r.marks[0].id, marks: r.marks.map(m => [m.id, m.kind === 'wrong' ? 'small' : 'weak']), title: 'Marked in this recitation' })}><BookOpen size={16} />See marks on the page</Button>}</div>
  </div>;
}
function RecordList({ log }: { log: ReciteRecord[] }) {
  const [all, setAll] = useState(false);
  if (!log.length) return null;
  return <div className="flex flex-col gap-2">
    <p className="flex items-center gap-2 text-sm font-bold"><History size={16} className="text-pine-700" />Your recitations</p>
    <ul className="flex flex-col gap-2">{(all ? log : log.slice(0, 4)).map((r, i) => { const p = score(r);
      return <li key={i} className="flex flex-col gap-2 rounded-xl bg-paper p-3 ring-1 ring-line">
        <div className="flex items-center gap-3"><span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white', p >= 95 ? 'bg-good' : p >= 80 ? 'bg-brass-500' : 'bg-bad')}>{p}</span>
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{name(r.start)}{r.end !== r.start ? ` – ${fromAyahId(r.end).ayah}` : ''}</p>
            <p className="text-xs text-ink-faint">{new Date(r.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {r.marks.length ? `${r.marks.length} marked` : 'no marks'}{r.demo ? ' · sheikh demo' : ''}</p></div></div>
        <Marks r={r} />
      </li>; })}</ul>
    {log.length > 4 && <button type="button" onClick={() => setAll(!all)} className="min-h-[44px] self-start text-sm font-bold text-pine-700">{all ? 'Show fewer' : `Show all ${log.length}`}</button>}
  </div>;
}
