// Qur'an structure helpers. All data comes from data.generated.ts (quran-meta, see SOURCE).
// Every range in the app is a pair of global ayah ids (1..6236), inclusive.
import { SURAHS, TOTAL_AYAHS, PAGE_STARTS, JUZ_STARTS, RUB_STARTS, SOURCE } from './data.generated';

export { TOTAL_AYAHS, SOURCE };
export const TOTAL_PAGES = PAGE_STARTS.length; // 604
export type AyahId = number;
export interface Range { start: AyahId; end: AyahId }
export interface SurahAyah { surah: number; ayah: number }

export const surahCount = SURAHS.length;
export const surahNameEn = (s: number) => SURAHS[s - 1][0];
export const surahNameAr = (s: number) => SURAHS[s - 1][1];
export const ayahCount = (s: number) => SURAHS[s - 1][2];
export const surahFirstId = (s: number) => SURAHS[s - 1][3];
export const surahLastId = (s: number) => surahFirstId(s) + ayahCount(s) - 1;
export const surahRange = (s: number): Range => ({ start: surahFirstId(s), end: surahLastId(s) });

export const isValidSurah = (s: number) => Number.isInteger(s) && s >= 1 && s <= 114;
export const isValidAyahId = (id: number) => Number.isInteger(id) && id >= 1 && id <= TOTAL_AYAHS;
export const isValidRange = (r: Range) => isValidAyahId(r.start) && isValidAyahId(r.end) && r.start <= r.end;

export function ayahId(surah: number, ayah: number): AyahId {
  if (!isValidSurah(surah) || !Number.isInteger(ayah) || ayah < 1 || ayah > ayahCount(surah)) throw new RangeError(`No ayah ${surah}:${ayah}`);
  return surahFirstId(surah) + ayah - 1;
}
/** binary search: index of the last start <= id */
function bucket(starts: readonly number[], id: number) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= id) lo = mid; else hi = mid - 1; }
  return lo;
}
export function fromAyahId(id: AyahId): SurahAyah {
  if (!isValidAyahId(id)) throw new RangeError(`No ayah id ${id}`);
  const firsts = SURAHS.map(s => s[3]);
  const i = bucket(firsts, id);
  return { surah: i + 1, ayah: id - firsts[i] + 1 };
}
export const pageOf = (id: AyahId) => bucket(PAGE_STARTS, id) + 1;
export const juzOf = (id: AyahId) => bucket(JUZ_STARTS, id) + 1;
export const rubOf = (id: AyahId) => bucket(RUB_STARTS, id) + 1;
export const hizbOf = (id: AyahId) => Math.ceil(rubOf(id) / 4);
const spanOf = (starts: readonly number[], n: number): Range => ({ start: starts[n - 1], end: n < starts.length ? starts[n] - 1 : TOTAL_AYAHS });
export const pageRange = (p: number) => spanOf(PAGE_STARTS, p);
export const juzRange = (j: number) => spanOf(JUZ_STARTS, j);
export const pagesInRange = (r: Range): number[] => { const out: number[] = []; for (let p = pageOf(r.start); p <= pageOf(r.end); p++) out.push(p); return out; };
export const rangeLength = (r: Range) => r.end - r.start + 1;

/** "Al-Mulk 1–5", "An-Naba' 1 – An-Nazi'at 10" */
export function formatRange(r: Range): string {
  const a = fromAyahId(r.start), b = fromAyahId(r.end);
  if (a.surah === b.surah) {
    if (a.ayah === 1 && b.ayah === ayahCount(a.surah)) return `${surahNameEn(a.surah)} (whole surah)`;
    return a.ayah === b.ayah ? `${surahNameEn(a.surah)} ${a.ayah}` : `${surahNameEn(a.surah)} ${a.ayah}–${b.ayah}`;
  }
  return `${surahNameEn(a.surah)} ${a.ayah} – ${surahNameEn(b.surah)} ${b.ayah}`;
}
export const formatPages = (r: Range) => { const a = pageOf(r.start), b = pageOf(r.end); return a === b ? `page ${a}` : `pages ${a}–${b}`; };

/** search surahs by number or name (accent-insensitive) */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯʿʾ'’ʿʾ-]/g, '').toLowerCase();
export function searchSurahs(q: string): number[] {
  const t = fold(q.trim());
  if (!t) return SURAHS.map((_, i) => i + 1);
  if (/^\d+$/.test(t)) { const n = Number(t); return isValidSurah(n) ? [n] : []; }
  return SURAHS.map((s, i) => [i + 1, fold(s[0])] as const).filter(([, n]) => n.includes(t) || n.replace(/^(al|an|ar|as|ash|at|ad|adh|az|ath)/, '').includes(t)).map(([n]) => n);
}
