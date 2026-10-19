import { describe, it, expect } from 'vitest';
import { suggestNew, pagesEnd, lessonSize } from '../src/lib/suggest';
import { plan } from '../src/lib/revision';
import { DEFAULT_SETTINGS, type RevisionItem } from '../src/lib/types';
import { pageRange, pageOf, ayahId, surahRange } from '../src/quran';

describe('lesson size in pages', () => {
  it('1 page from the top of a page ends at the end of that page', () => {
    const p = pageRange(10);
    expect(pagesEnd(p.start, 1)).toBe(p.end);
    expect(pagesEnd(p.start, 2)).toBe(pageRange(11).end);
  });
  it('half a page is about half its ayahs', () => {
    const p = pageRange(10); const end = pagesEnd(p.start, 0.5);
    expect(end).toBeGreaterThanOrEqual(p.start); expect(end).toBeLessThan(p.end);
  });
  it('never runs past the end of the surah', () => {
    const r = suggestNew([], 'forward', 3, 5)!; // Al-Fātiḥah is one page
    expect(r).toEqual(surahRange(1));
  });
  it('labels', () => { expect(lessonSize({ dailyNewAyahs: 3, newPages: 0.5 })).toBe('½ page'); expect(lessonSize({ dailyNewAyahs: 3, newPages: null })).toBe('3 ayahs'); });
});

describe('revision start point', () => {
  const s = { ...DEFAULT_SETTINGS.revision, oldPlan: 'cycle' as const, days: [0, 1, 2, 3, 4, 5, 6], dailyOldPages: 3 };
  const items: RevisionItem[] = Array.from({ length: 23 }, (_, i) => ({ page: 582 + i, lastReviewedOn: '2026-10-01', intervalDays: 7, lapses: 0, dueOn: '2026-10-08' }));
  it('starts from the chosen page and wraps round', () => {
    const start = pageOf(ayahId(100, 1));
    const p = plan(items, s, '2026-10-19', 23, null, { page: start, on: '2026-10-15' });
    expect(p.today.map(x => x.page)).toEqual([start, start + 1, start + 2]);
  });
  it('after revising, continues in order from where it got to', () => {
    const start = 600;
    const done = items.map(i => (i.page >= 600 && i.page <= 602 ? { ...i, lastReviewedOn: '2026-10-17' } : i));
    const p = plan(done, s, '2026-10-19', 23, null, { page: start, on: '2026-10-15' });
    expect(p.today.map(x => x.page)).toEqual([603, 604, 582]);
  });
});
