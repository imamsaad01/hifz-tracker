// "What is next?" — the next new lesson from what is memorised, the direction and the daily amount.
import { TOTAL_AYAHS, fromAyahId, surahRange, ayahCount, type Range } from '../quran';
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
export function suggestNew(memorised: Range[], direction: Direction, daily: number): Range | null {
  const start = nextNewStart(memorised, direction);
  if (start === null) return null;
  const { surah, ayah } = fromAyahId(start);
  const end = Math.min(start + Math.max(1, daily) - 1, start + (ayahCount(surah) - ayah), TOTAL_AYAHS);
  return { start, end };
}
