// Pull down from the top of any screen to refresh (the installed phone app has no browser refresh button).
// Screens listen with useRefresh(reload); if nothing is listening, the page reloads.
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const EVENT = 'hifz-refresh';
let listeners = 0;
export function useRefresh(reload: () => unknown) {
  const ref = useRef(reload); ref.current = reload;
  useEffect(() => {
    const h = (e: Event) => { const p = Promise.resolve(ref.current()); (e as CustomEvent<Promise<unknown>[]>).detail?.push(p); };
    window.addEventListener(EVENT, h); listeners++;
    return () => { window.removeEventListener(EVENT, h); listeners--; };
  }, []);
}
export async function refreshAll() {
  if (!listeners) { window.location.reload(); return; }
  const waits: Promise<unknown>[] = [];
  window.dispatchEvent(new CustomEvent(EVENT, { detail: waits }));
  await Promise.allSettled([...waits, new Promise(r => setTimeout(r, 600))]);
}

const TRIGGER = 70; const MAX = 110;
export function PullToRefresh() {
  const [pull, setPull] = useState(0); const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null); const dist = useRef(0); const busyRef = useRef(false);
  useEffect(() => {
    const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;
    const down = (e: TouchEvent) => {
      if (busyRef.current || e.touches.length !== 1 || !atTop()) { start.current = null; return; }
      const t = e.target as Element | null;
      if (t?.closest('[role="dialog"], input, textarea, select, [data-no-pull]')) { start.current = null; return; }
      start.current = e.touches[0].clientY; dist.current = 0;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || !atTop()) { dist.current = 0; setPull(0); return; }
      dist.current = Math.min(MAX, dy * 0.5); setPull(dist.current);
      if (e.cancelable && dy > 8) e.preventDefault(); // stop the page bouncing while we pull
    };
    const up = async () => {
      if (start.current === null) return; start.current = null;
      if (dist.current >= TRIGGER) {
        busyRef.current = true; setBusy(true); setPull(TRIGGER);
        try { await refreshAll(); } finally { busyRef.current = false; setBusy(false); setPull(0); }
      } else setPull(0);
      dist.current = 0;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up); window.addEventListener('touchcancel', up);
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); window.removeEventListener('touchcancel', up); };
  }, []);
  if (!pull && !busy) return null;
  const ready = pull >= TRIGGER;
  return <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-[env(safe-area-inset-top)]" style={{ transform: `translateY(${Math.max(0, pull - 30)}px)`, transition: start.current === null ? 'transform 200ms' : undefined }}>
    <span className="mt-2 grid h-10 w-10 place-items-center rounded-full bg-white text-pine-700 shadow-lg ring-1 ring-line">
      <RefreshCw size={18} className={busy ? 'animate-spin' : undefined} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: ready ? 1 : 0.5 }} />
      <span className="sr-only">{busy ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
    </span>
  </div>;
}
