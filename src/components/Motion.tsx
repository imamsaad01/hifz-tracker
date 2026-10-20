// Small motion helpers: numbers that count up when they appear.
import { useEffect, useRef, useState } from 'react';

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
