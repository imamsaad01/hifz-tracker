// Pull down from the top of any screen to refresh (the installed phone app has no browser refresh button).
// Screens listen with useRefresh(reload); if nothing is listening, the page reloads.
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';

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
export async function refreshAll(silent = false) {
  if (!listeners) { if (!silent) window.location.reload(); return; }
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

/** Quietly refresh after a minute of no use, or when coming back to the app after a minute away, with a small "Updated" note. */
const IDLE_MS = 60_000;
export function AutoRefresh() {
  const [note, setNote] = useState<null | 'busy' | 'done'>(null);
  useEffect(() => {
    let lastUse = Date.now(), lastRefresh = Date.now(), hiddenAt: number | null = null, running = false;
    let hideT: ReturnType<typeof setTimeout> | undefined;
    const busy = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!document.querySelector('[role="dialog"]') || !!a?.matches?.('input, textarea, select, [contenteditable="true"]');
    };
    const run = async () => {
      if (running || busy() || !navigator.onLine) return;
      running = true; setNote('busy');
      try { await refreshAll(true); lastRefresh = Date.now(); setNote('done'); clearTimeout(hideT); hideT = setTimeout(() => setNote(null), 2200); }
      catch { setNote(null); } finally { running = false; }
    };
    const used = () => { lastUse = Date.now(); };
    const tick = () => { if (document.visibilityState === 'visible' && Date.now() - lastUse >= IDLE_MS && Date.now() - lastRefresh >= IDLE_MS) run(); };
    const vis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= IDLE_MS) run();
      hiddenAt = null;
    };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;
    evs.forEach(e => window.addEventListener(e, used, { passive: true }));
    document.addEventListener('visibilitychange', vis); window.addEventListener('online', run);
    const t = setInterval(tick, 10_000);
    return () => { evs.forEach(e => window.removeEventListener(e, used)); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', run); clearInterval(t); clearTimeout(hideT); };
  }, []);
  if (!note) return null;
  return <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center pt-[calc(env(safe-area-inset-top)+64px)]">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-pine-800 shadow-lg ring-1 ring-line backdrop-blur animate-[fadein_.2s_ease-out]">
      {note === 'busy' ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} className="text-good" />}
      {note === 'busy' ? 'Updating…' : `Up to date · ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
    </span>
  </div>;
}
