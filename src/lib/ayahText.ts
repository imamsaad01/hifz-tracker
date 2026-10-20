// Opening words of every ayah (Uthmani text from QuranEnc, CC BY-SA 4.0), loaded once on demand (~90 KB).
import { useEffect, useState } from 'react';
let data: string[] | null = null; let loading: Promise<string[]> | null = null;
/** Swap the rarer Uthmani marks for common ones so every phone font can draw them (no gaps). */
const tidy = (t: string) => t.replace(/\u06E1/g, '\u0652').replace(/[\u06D6-\u06DC\u06DE\u06E9]/g, '').replace(/\s+…/, ' …');
export function loadAyahStarts(): Promise<string[]> {
  if (data) return Promise.resolve(data);
  loading ??= fetch(`${import.meta.env.BASE_URL}ayah-start.json`).then(r => (r.ok ? r.json() : [])).then((d: string[]) => (data = d.map(tidy))).catch(() => (loading = null, [] as string[]));
  return loading;
}
export function useAyahStarts() {
  const [d, setD] = useState<string[] | null>(data);
  useEffect(() => { if (!d) loadAyahStarts().then(x => setD(x.length ? x : null)); }, [d]);
  return d;
}
