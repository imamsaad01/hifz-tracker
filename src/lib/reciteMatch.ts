// Follow a recitation word by word (the idea behind Tarteel's memorisation mode): compare what the phone heard
// with the ayah's words, in order, allowing for small speech-recognition differences.
/** Arabic letters only: no tashkeel or Qurʾānic marks; alifs, hamzas, yā/alif maqṣūra and tāʾ marbūṭa unified. */
export function bare(w: string): string {
  return w.normalize('NFKD')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآا]/g, 'ا').replace(/[ؤ]/g, 'و').replace(/[ئى]/g, 'ي').replace(/ء/g, '').replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, '');
}
function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
export const similar = (heard: string, want: string) => { const a = bare(heard), b = bare(want); if (!a || !b) return false; if (a === b) return true; const m = Math.max(a.length, b.length); return 1 - lev(a, b) / m >= (m <= 3 ? 0.66 : 0.6); };

export type WordState = 'hidden' | 'ok' | 'missed' | 'wrong' | 'fixed';
/** Walk the heard words through the expected words. A heard word may match up to `look` words ahead; words jumped over
 *  are "missed". Two heard words in a row that fit nothing mean the reciter said something else here: that word is
 *  shown in red ("wrong") so they can correct it; once they then say it right it becomes "fixed". */
export function follow(expected: string[], heard: string[], look = 3): { states: WordState[]; next: number } {
  const states: WordState[] = expected.map(() => 'hidden'); let i = 0; let off = 0;
  for (const h of heard) {
    if (i >= expected.length) break;
    if (!bare(h)) continue;
    let hit = false;
    for (let k = 0; k <= look && i + k < expected.length; k++) {
      if (similar(h, expected[i + k])) { for (let m = i; m < i + k; m++) states[m] = 'missed'; states[i + k] = states[i + k] === 'wrong' && k === 0 ? 'fixed' : 'ok'; i = i + k + 1; hit = true; break; }
    }
    if (hit) off = 0; else if (++off >= 2) states[i] = 'wrong';
  }
  return { states, next: i };
}
