// Progress is always computed from memorised ranges against the Qur'an tables.
import { TOTAL_AYAHS, TOTAL_PAGES, pageRange, juzRange, type Range } from '../quran';
import { daysBetween, addDays } from './dates';

/** Merge overlapping or touching ranges; result sorted. */
export function unionRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(r => r.start <= r.end).map(r => ({ ...r })).sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end); else out.push(r);
  }
  return out;
}
export const ayahsIn = (ranges: Range[]) => unionRanges(ranges).reduce((a, r) => a + r.end - r.start + 1, 0);
export function covers(ranges: Range[], target: Range): boolean {
  return unionRanges(ranges).some(r => r.start <= target.start && r.end >= target.end);
}
/** Ayahs of `target` that are inside `ranges` */
export function overlap(ranges: Range[], target: Range): number {
  return unionRanges(ranges).reduce((a, r) => a + Math.max(0, Math.min(r.end, target.end) - Math.max(r.start, target.start) + 1), 0);
}
export function memorisedPages(ranges: Range[]): number[] {
  const u = unionRanges(ranges); const out: number[] = [];
  for (let p = 1; p <= TOTAL_PAGES; p++) if (covers(u, pageRange(p))) out.push(p);
  return out;
}
export function juzProgress(ranges: Range[]): number[] {
  const u = unionRanges(ranges);
  return Array.from({ length: 30 }, (_, i) => { const r = juzRange(i + 1); return overlap(u, r) / (r.end - r.start + 1); });
}
export interface ProgressSummary { ayahs: number; pages: number; juz: number; percent: number }
export function summary(ranges: Range[]): ProgressSummary {
  const ayahs = ayahsIn(ranges);
  return { ayahs, pages: memorisedPages(ranges).length, juz: juzProgress(ranges).filter(x => x >= 1).length, percent: ayahs / TOTAL_AYAHS };
}
/** Consecutive days with at least one session, ending today (or yesterday if today has none yet). */
export function streak(dates: string[], today: string): number {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1), n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
export function longestStreak(dates: string[]): number {
  const days = [...new Set(dates)].sort();
  let best = 0, run = 0;
  days.forEach((d, i) => { run = i > 0 && daysBetween(days[i - 1], d) === 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}
