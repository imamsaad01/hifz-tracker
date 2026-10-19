// "What is next?" — the next new lesson from what is memorised, the direction and the daily amount.
import { TOTAL_AYAHS, TOTAL_PAGES, fromAyahId, surahRange, ayahCount, pageOf, pageRange, type Range } from '../quran';
import { unionRanges } from './progress';
import type { Direction } from './types';

const isIn = (u: Range[], id: number) => u.some(r => r.start <= id && id <= r.end);
/** First ayah not yet memorised, walking surah by surah in the student's direction (ayahs always go forwards inside a surah). */
export function nextNewStart(memorised: Range[], direction: Direction): number | null {
  const u = unionRanges(memorised);
  const order = direction === 'back' ? Array.from({ length: 114 }, (_, i) => 114 - i) : Array.from({ length: 114 }, (_, i) => i + 1);
  for (const s of order) { const r = surahRange(s); for (let id = r.start; id <= r.end; id++) if (!isIn(u, id)) return id; }
  return null;
}
/** Suggested range: from the next ayah, `daily` ayahs long, never past the end of that surah. */
export function suggestNew(memorised: Range[], direction: Direction, daily: number, pages?: number | null): Range | null {
  const start = nextNewStart(memorised, direction);
  if (start === null) return null;
  const { surah, ayah } = fromAyahId(start);
  const surahEnd = start + (ayahCount(surah) - ayah);
  if (pages) return { start, end: Math.min(pagesEnd(start, pages), surahEnd, TOTAL_AYAHS) };
  const end = Math.min(start + Math.max(1, daily) - 1, surahEnd, TOTAL_AYAHS);
  return { start, end };
}
/** Last ayah of a lesson `pages` pages long (½ to 5) starting at `start`, by the Madani mushaf pages. */
export function pagesEnd(start: number, pages: number): number {
  const p = pageOf(start); const pr = pageRange(p);
  if (pages < 1) return Math.max(start, Math.min(pr.end, start + Math.ceil((pr.end - pr.start + 1) * pages) - 1));
  const last = Math.min(TOTAL_PAGES, p + Math.round(pages) - 1);
  if (start === pr.start) return pageRange(last).end;
  // starting mid-page: take the same number of ayahs as those pages hold
  const count = pageRange(last).end - pr.start + 1;
  return Math.min(TOTAL_AYAHS, start + count - 1);
}
/** "1 page", "½ page", "3 ayahs" */
export const lessonSize = (st: { dailyNewAyahs: number; newPages?: number | null }) =>
  st.newPages ? (st.newPages === 0.5 ? '½ page' : `${st.newPages} page${st.newPages > 1 ? 's' : ''}`) : `${st.dailyNewAyahs} ayah${st.dailyNewAyahs > 1 ? 's' : ''}`;
