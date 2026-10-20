// Small motion helpers: numbers that count up when they appear.
import { useEffect, useRef, useState } from 'react';
import { cx } from './ui';

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

/** "94%", "12", "3/5", "1.5": the leading number counts up from 0 once; anything else is shown as is. */
export function CountUp({ value, ms = 800 }: { value: React.ReactNode; ms?: number }) {
  const s = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : null;
  const m = s?.match(/^(\d+(?:\.\d+)?)(.*)$/s);
  const target = m ? Number(m[1]) : 0; const dec = m?.[1].includes('.') ? m[1].split('.')[1].length : 0;
  const [v, setV] = useState(() => (m && !reduced() ? 0 : target));
  const from = useRef(0);
  useEffect(() => {
    if (!m || reduced()) { setV(target); return; }
    const start = performance.now(); const a = from.current; let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - k, 3); setV(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <>{value}</>;
  return <><span aria-hidden>{v.toFixed(dec)}{m[2]}</span><span className="sr-only">{s}</span></>;
}

/** A streak flame that grows and warms with the streak, and flickers. */
export function StreakFlame({ days, size = 16 }: { days: number; size?: number }) {
  const k = Math.min(1, Math.log2(1 + Math.max(0, days)) / 5);       // 0 → 1 by about 30 days
  const px = Math.round(size * (1 + k * 0.9));
  const color = days <= 0 ? 'rgb(var(--ink) / .3)' : k < 0.45 ? '#C79A45' : k < 0.75 ? '#E07B2A' : '#D9472B';
  return <span aria-hidden className={cx('relative inline-grid place-items-center', days > 0 && 'flame')} style={{ width: px, height: px, ['--glow' as string]: color }}>
    <svg viewBox="0 0 24 24" width={px} height={px}><path d="M12 2c1 3.5 4.5 5.5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.6 2-4.6.3 1.6 1.1 2.6 2 2.9C11 8 11 5 12 2Z" fill={color} /><path d="M12 13c.6 1.3 2 2 2 3.5a2 2 0 0 1-4 0c0-1 .6-1.7 1.2-2.2.2.6.5.9.8 1-.2-1 0-1.6 0-2.3Z" fill="#FFE3A3" opacity={days > 0 ? 0.95 : 0} /></svg>
  </span>;
}

/** Full-screen celebration when a student completes a juz (shown once per juz, per device). */
export function JuzCelebration({ completed, who }: { completed: number[]; who: string }) {
  const key = `hifz-juz-done-${who}`;
  const [show, setShow] = useState<number | null>(null);
  useEffect(() => {
    let seen: number[] | null = null; try { const v = localStorage.getItem(key); seen = v ? JSON.parse(v) : null; } catch { return; }
    const fresh = seen ? completed.filter(j => !seen!.includes(j)) : [];
    try { localStorage.setItem(key, JSON.stringify(completed)); } catch { /* */ }
    if (fresh.length) setShow(fresh[fresh.length - 1]);
  }, [completed.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (show === null) return; try { navigator.vibrate?.([20, 60, 20, 60, 40]); } catch { /* */ } const t = setTimeout(() => setShow(null), 6000); return () => clearTimeout(t); }, [show]);
  if (show === null) return null;
  const bits = Array.from({ length: 36 }, (_, i) => i);
  return <div role="status" className="fixed inset-0 z-[80] grid place-items-center bg-black/45 backdrop-blur-[2px] celebrate-in" onClick={() => setShow(null)}>
    {bits.map(i => <span key={i} aria-hidden className="confetti" style={{ left: `${(i * 37) % 100}%`, background: ['#215549', '#C79A45', '#4FA88E', '#E9D9B6', '#D9472B'][i % 5], animationDelay: `${(i % 9) * 0.12}s`, ['--drift' as string]: `${((i * 53) % 120) - 60}px`, ['--spin' as string]: `${(i * 97) % 720}deg` }} />)}
    <div className="celebrate-card relative mx-6 max-w-sm rounded-3xl bg-white px-7 py-8 text-center shadow-2xl dark:bg-[rgb(var(--paper))]">
      <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-pine-700 text-3xl font-bold text-white shadow-lg celebrate-badge">{show}</div>
      <p className="text-xs font-bold uppercase tracking-widest text-brass-700 dark:text-brass-100">Juz complete</p>
      <h2 className="mt-1 text-2xl font-bold">Juz {show} is memorised!</h2>
      <p className="mt-2 text-ink-soft">Mā shāʾ Allāh. May Allah make it firm in your heart. Keep revising it so it stays strong.</p>
      <p className="mt-4 text-xs text-ink-faint">Tap anywhere to continue</p>
    </div>
  </div>;
}
