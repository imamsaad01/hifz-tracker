// Playful practice for a lesson: "Repeat" (tap the bead for each recitation, it springs along the string)
// and "Word order" (the ayah's words are shuffled; tap them in order and they fly into place).
import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, RotateCcw, Check } from 'lucide-react';
import { fromAyahId, surahNameEn, pageOf, pageRange, type Range } from '../quran';
import { loadPage } from './Mushaf';
import { Button, Modal, SubTabs, cx } from './ui';

export function PracticeButton({ range, label = 'Practise' }: { range: Range; label?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button kind="secondary" onClick={() => setOpen(true)}><Gamepad2 size={16} />{label}</Button>
    {open && <Practice range={range} onClose={() => setOpen(false)} />}
  </>;
}

function Practice({ range, onClose }: { range: Range; onClose: () => void }) {
  const [tab, setTab] = useState<'repeat' | 'order'>('repeat');
  const ids = useMemo(() => Array.from({ length: Math.min(range.end - range.start + 1, 60) }, (_, i) => range.start + i), [range]);
  const [i, setI] = useState(0); const id = ids[i]; const a = fromAyahId(id);
  return <Modal open onClose={onClose} title="Practise">
    <div className="flex flex-col gap-4">
      <SubTabs label="Game" className="mb-0" active={tab} onChange={setTab} items={[{ key: 'repeat', label: 'Repeat' }, { key: 'order', label: 'Word order' }]} />
      <div className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 ring-1 ring-line">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="h-11 min-w-[44px] rounded-lg px-2 text-sm font-bold text-pine-700 disabled:opacity-30">‹ Prev</button>
        <b>{surahNameEn(a.surah)} {a.ayah}</b>
        <button type="button" disabled={i >= ids.length - 1} onClick={() => setI(i + 1)} className="h-11 min-w-[44px] rounded-lg px-2 text-sm font-bold text-pine-700 disabled:opacity-30">Next ›</button>
      </div>
      {tab === 'repeat' ? <Beads key={`r${id}`} id={id} /> : <WordOrder key={`o${id}`} id={id} onNext={i < ids.length - 1 ? () => setI(i + 1) : undefined} />}
    </div>
  </Modal>;
}

async function ayahText(id: number) { const p = pageOf(id); const t = await loadPage(p); return t[id - pageRange(p).start]; }
function useAyah(id: number) { const [t, setT] = useState<string | null>(null); useEffect(() => { let live = true; ayahText(id).then(x => live && setT(x)).catch(() => live && setT('')); return () => { live = false; }; }, [id]); return t; }

/** Tap once per recitation. 10 beads; each tap slides one bead across with a spring and a ripple. */
function Beads({ id }: { id: number }) {
  const goal = 10; const key = `hifz-reps-${new Date().toISOString().slice(0, 10)}-${id}`;
  const [n, setN] = useState(() => { try { return Number(localStorage.getItem(key) ?? 0); } catch { return 0; } });
  const [pulse, setPulse] = useState(0);
  const text = useAyah(id);
  const tap = () => { const v = Math.min(goal, n + 1); setN(v); setPulse(p => p + 1); try { localStorage.setItem(key, String(v)); } catch { /* */ } try { navigator.vibrate?.(12); } catch { /* */ } };
  const done = n >= goal;
  return <div className="flex flex-col items-center gap-4">
    {text ? <p lang="ar" dir="rtl" className="line-clamp-3 text-center font-quran text-2xl leading-[2.1]">{text}</p> : <p className="text-sm text-ink-faint">Recite the ayah from memory each time.</p>}
    <div className="relative h-14 w-full max-w-[340px]" aria-hidden>
      <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded bg-brass-500/40" />
      {Array.from({ length: goal }, (_, k) => { const moved = k < n;
        return <span key={k} className="bead absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full shadow-sm"
          style={{ left: moved ? `calc(${(k / (goal - 1)) * 45}% )` : `calc(55% + ${(k / (goal - 1)) * 40}% - 14px)`, background: moved ? 'radial-gradient(circle at 35% 30%, #4FA88E, #215549)' : 'radial-gradient(circle at 35% 30%, #F1DFB6, #B8893B)' }} />; })}
    </div>
    <button type="button" onClick={tap} disabled={done} aria-label={`Count a recitation, ${n} of ${goal}`}
      className={cx('relative grid h-28 w-28 place-items-center rounded-full text-3xl font-bold text-white shadow-lg transition active:scale-95', done ? 'bg-good' : 'bg-pine-700')}>
      {!done && <span key={pulse} className="ripple absolute inset-0 rounded-full" />}
      {done ? <Check size={40} /> : n}
    </button>
    <p className="text-sm text-ink-soft" aria-live="polite">{done ? 'Ten times. Mā shāʾ Allāh! Move to the next ayah.' : `${goal - n} to go. Tap after each recitation.`}</p>
    {n > 0 && <button type="button" onClick={() => { setN(0); try { localStorage.removeItem(key); } catch { /* */ } }} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-ink-faint"><RotateCcw size={14} />Start again</button>}
  </div>;
}

/** The ayah's words, shuffled. Tap them in order; right words fly up into the line, wrong ones shake. */
function WordOrder({ id, onNext }: { id: number; onNext?: () => void }) {
  const text = useAyah(id);
  const words = useMemo(() => (text ?? '').split(/\s+/).filter(Boolean), [text]);
  const shuffled = useMemo(() => { const a = words.map((w, k) => ({ w, k })); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }, [words]);
  const [used, setUsed] = useState<number[]>([]); const [shake, setShake] = useState<number | null>(null); const [miss, setMiss] = useState(0);
  if (text === null) return <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>;
  if (!words.length) return <p className="py-6 text-center text-sm text-ink-faint">This game needs a connection the first time.</p>;
  if (words.length < 3) return <p className="py-6 text-center text-sm text-ink-faint">This ayah is too short for the game. Try the next one.</p>;
  const done = used.length === words.length;
  // a tile is right if its word is the next word (repeated words can be tapped in any of their places)
  const pick = (k: number) => { if (used.includes(k)) return; if (words[k] === words[used.length]) { setUsed(u => [...u, k]); try { navigator.vibrate?.(8); } catch { /* */ } } else { setShake(k); setMiss(m => m + 1); setTimeout(() => setShake(null), 400); } };
  return <div className="flex flex-col gap-4">
    <div lang="ar" dir="rtl" className="min-h-[96px] rounded-xl bg-pine-50 p-3 text-center font-quran text-2xl leading-[2.1] ring-1 ring-pine-600/20">
      {words.slice(0, used.length).map((w, x) => <span key={x} className="fly-in inline-block px-1">{w}</span>)}
      {!done && <span className="mx-1 inline-block h-6 w-10 animate-pulse rounded bg-pine-600/20 align-middle" />}
    </div>
    {!done ? <div lang="ar" dir="rtl" className="flex flex-wrap justify-center gap-2">{shuffled.map(({ w, k }) => used.includes(k) ? null :
      <button key={k} type="button" onClick={() => pick(k)} className={cx('min-h-[48px] rounded-xl bg-white px-3 font-quran text-xl shadow-card ring-1 ring-line transition active:scale-95', shake === k && 'shake ring-bad')}>{w}</button>)}</div>
      : <div className="flex flex-col items-center gap-3"><p className="pop text-lg font-bold text-good">{miss === 0 ? 'Perfect order!' : `Done with ${miss} slip${miss > 1 ? 's' : ''}.`}</p>
        <div className="flex gap-2"><Button kind="secondary" onClick={() => { setUsed([]); setMiss(0); }}><RotateCcw size={16} />Again</Button>{onNext && <Button onClick={onNext}>Next ayah</Button>}</div></div>}
  </div>;
}
