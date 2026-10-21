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
// the skeleton also drops long alifs: the muṣḥaf spells some words differently from everyday Arabic (ٱلصَّلَوٰةَ / الصلاة)
const skel = (w: string) => w.replace(/ا/g, '').replace(/^ال/, '');
export const similar = (heard: string, want: string) => {
  const a = bare(heard), b = bare(want); if (!a || !b) return false; if (a === b) return true;
  const m = Math.max(a.length, b.length); if (1 - lev(a, b) / m >= (m <= 3 ? 0.66 : 0.6)) return true;
  const x = skel(a), y = skel(b); const n = Math.max(x.length, y.length); return n >= 2 && 1 - lev(x, y) / n >= 0.75;
};

export type WordState = 'hidden' | 'ok' | 'missed' | 'wrong' | 'fixed' | 'vowel';

// ---- vowel-length check (madd) ----
// The phone's recogniser writes no harakaat, but long vowels are letters (ا و ي), so a madd cut short ("قل" for قَالَ)
// or a long vowel added where there is none shows up. We only flag a word when the ONLY difference is such a long
// vowel, so ordinary recognition noise is not blamed on the reciter.
type Ch = { c: string; madd: boolean };
const VOWEL = /[\u064B-\u0650]/;
/** The letters actually pronounced, marking which are long vowels. Silent letters (۟ ۠) are dropped; small waaw/yaa (ۥ ۦ) count as long vowels. */
export function spoken(w: string): Ch[] {
  const out: Ch[] = []; const t = w.normalize('NFC'); let prevVowel = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i]; if (!/[\u0621-\u064A\u0671]/.test(c)) continue;
    let j = i + 1; let marks = ''; while (j < t.length && /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(t[j])) marks += t[j++];
    if (/[\u06DF\u06E0]/.test(marks)) { continue; }                       // written but not read
    const base = c.replace(/[ٱأإآ]/, 'ا').replace('ى', 'ي').replace('ة', 'ه').replace(/[ؤئ]/, 'ء');
    const bare = !VOWEL.test(marks) && !/[\u0651\u0652\u06E1]/.test(marks);
    const madd = bare && ((base === 'ا' && c === 'ا' && prevVowel === '\u064E') || (base === 'و' && prevVowel === '\u064F') || (base === 'ي' && prevVowel === '\u0650'));
    if (base !== 'ء' || /[\u064B-\u0650]/.test(marks)) out.push({ c: base === 'ء' ? 'ء' : base, madd });
    if (/\u06E5/.test(marks)) out.push({ c: 'و', madd: true });
    if (/\u06E6/.test(marks)) out.push({ c: 'ي', madd: true });
    const v = marks.match(/[\u064E\u064F\u0650]/); prevVowel = v ? v[0] : (madd ? prevVowel : '');
  }
  return out;
}
const heardLetters = (h: string) => bare(h).replace(/ء/g, '').split('');
/** 'short' = a long vowel was cut, 'long' = a long vowel was added, null = fine (or not sure) */
export function maddSlip(heard: string, want: string): 'short' | 'long' | null {
  const e = spoken(want).filter(x => x.c !== 'ء'); const h = heardLetters(heard);
  if (e.length < 2 || h.length < 2) return null;
  // edit-distance alignment with a back-trace
  const n = e.length, m = h.length; const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (e[i - 1].c === h[j - 1] ? 0 : 1));
  let i = n, j = m; let short = 0, long = 0, other = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (e[i - 1].c === h[j - 1] ? 0 : 1)) { if (e[i - 1].c !== h[j - 1]) other++; i--; j--; }
    else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { if (e[i - 1].madd) short++; else if (e[i - 1].c === 'ا') { /* an alif the recogniser often leaves out */ } else other++; i--; }
    else { if (h[j - 1] === 'و' || h[j - 1] === 'ي') long++; else if (h[j - 1] !== 'ا') other++; j--; }   // an extra ا is usually just spelling (ٰ)
  }
  if (other) return null;
  return short ? 'short' : long ? 'long' : null;
}
/** Walk the heard words through the expected words. A heard word may match up to `look` words ahead; words jumped over
 *  are "missed". Two heard words in a row that fit nothing mean the reciter said something else here: that word is
 *  shown in red ("wrong") so they can correct it; once they then say it right it becomes "fixed". */
export function follow(expected: string[], heard: string[], look = 3): { states: WordState[]; next: number; used: number } {
  const states: WordState[] = expected.map(() => 'hidden'); let i = 0; let off = 0; let used = 0;
  for (let hi = 0; hi < heard.length; hi++) { const h = heard[hi];
    if (i >= expected.length) break;
    if (!bare(h)) continue;
    let hit = false;
    for (let k = 0; k <= look && i + k < expected.length; k++) {
      if (similar(h, expected[i + k])) { for (let m = i; m < i + k; m++) states[m] = 'missed'; states[i + k] = states[i + k] === 'wrong' && k === 0 ? 'fixed' : maddSlip(h, expected[i + k]) ? 'vowel' : 'ok'; i = i + k + 1; hit = true; used = hi + 1; break; }
    }
    if (hit) off = 0; else if (++off >= 2) states[i] = 'wrong';
  }
  return { states, next: i, used };
}
