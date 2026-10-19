// Saves that could not reach the server wait here (on this device) and are retried automatically.
import { useEffect, useState } from 'react';
const KEY = 'hifz-outbox-v1';
export interface Pending { id: string; at: string; label: string; payload: Record<string, unknown> }
const read = (): Pending[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (x: Pending[]) => { try { localStorage.setItem(KEY, JSON.stringify(x)); } catch { /* storage blocked */ } window.dispatchEvent(new Event('hifz-outbox')); };
export const outbox = {
  list: read,
  add(label: string, payload: Record<string, unknown>) { write([...read(), { id: Math.random().toString(36).slice(2), at: new Date().toISOString(), label, payload }]); },
  remove(id: string) { write(read().filter(p => p.id !== id)); },
  async flush(send: (payload: Record<string, unknown>) => Promise<unknown>): Promise<number> {
    let sent = 0;
    for (const p of read()) { try { await send(p.payload); outbox.remove(p.id); sent++; } catch { break; } }
    return sent;
  },
};
export function useOutboxCount(): number {
  const [n, setN] = useState(() => read().length);
  useEffect(() => { const f = () => setN(read().length); window.addEventListener('hifz-outbox', f); window.addEventListener('storage', f); return () => { window.removeEventListener('hifz-outbox', f); window.removeEventListener('storage', f); }; }, []);
  return n;
}
export const isNetworkError = (e: unknown) => /Failed to fetch|NetworkError|network|Load failed/i.test(String((e as Error)?.message ?? e));
