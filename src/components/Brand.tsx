import { useEffect, useState } from 'react';
import { cx } from './ui';
export function Brand({ small, light, iconOnly }: { small?: boolean; light?: boolean; iconOnly?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <svg width={small ? 30 : 38} height={small ? 30 : 38} viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill={light ? '#FFFFFF' : '#215549'} /><path d="M14 19c7-3 13-2 18 2 5-4 11-5 18-2v27c-7-3-13-2-18 2-5-4-11-5-18-2z" fill="none" stroke={light ? '#215549' : '#E9D9B6'} strokeWidth="3.5" strokeLinejoin="round" /><path d="M32 21v27" stroke={light ? '#215549' : '#E9D9B6'} strokeWidth="3.5" /></svg>
    {!iconOnly && <span className={cx('whitespace-nowrap font-bold', small ? 'text-[17px]' : 'text-xl', light ? 'text-white' : 'text-ink')}>Hifz Tracker</span>}
  </div>;
}

/** The logo as the home button: the book flips open, a glow ring pulses, a shine sweeps the name and a few sparks fly. */
export function BrandLink({ home, small, iconOnly }: { home: string; small?: boolean; iconOnly?: boolean }) {
  const [n, setN] = useState(0); const [play, setPlay] = useState(false);
  useEffect(() => { if (!play) return; const t = setTimeout(() => setPlay(false), 950); return () => clearTimeout(t); }, [play, n]);
  const go = (e: React.MouseEvent) => {
    setN(x => x + 1); setPlay(true);
    if (location.hash === home || (!location.hash && home === '#/')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    try { navigator.vibrate?.(8); } catch { /* */ }
  };
  return <a href={home} onClick={go} aria-label="Hifz Tracker, go to home" className={cx('brand-link group relative inline-flex min-h-[44px] items-center rounded-xl pr-1 outline-offset-4', play && 'brand-go')} key={n}>
    <span className="brand-icon relative grid place-items-center">
      <Brand small={small} iconOnly />
      <span aria-hidden className="brand-ring pointer-events-none absolute inset-0 rounded-[10px]" />
      {play && [0, 1, 2, 3, 4, 5].map(k => <span key={k} aria-hidden className="brand-spark pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-brass-500" style={{ ['--a' as string]: `${k * 60 + 15}deg` }} />)}
    </span>
    {!iconOnly && <span className={cx('brand-name ml-2.5 whitespace-nowrap font-bold text-ink', small ? 'text-[17px]' : 'text-xl')}>Hifz Tracker</span>}
  </a>;
}
