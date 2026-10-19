import { describe, it, expect } from 'vitest';
import { ayahId, fromAyahId, pageOf, juzOf, hizbOf, pageRange, juzRange, surahRange, formatRange, isValidRange, searchSurahs, TOTAL_AYAHS, ayahCount } from '../src/quran';
import { unionRanges, ayahsIn, memorisedPages, juzProgress, summary, streak, longestStreak } from '../src/lib/progress';
import { suggestNew, nextNewStart } from '../src/lib/suggest';
import { plan, defaultDailyPages, groupPages } from '../src/lib/revision';
import { accuracy, validScore, errorBand } from '../src/lib/scoring';
import { todayIn, addDays, isIsoDate } from '../src/lib/dates';
import { DEFAULT_SETTINGS, type RevisionItem } from '../src/lib/types';

describe('Qur\'an data', () => {
  it('has the Hafs totals', () => {
    expect(TOTAL_AYAHS).toBe(6236);
    expect(ayahCount(2)).toBe(286);
    expect(ayahCount(114)).toBe(6);
  });
  it('maps known positions in the Madinah mushaf', () => {
    expect(pageOf(ayahId(1, 1))).toBe(1);
    expect(pageOf(ayahId(2, 1))).toBe(2);
    expect(pageOf(ayahId(67, 1))).toBe(562);
    expect(juzOf(ayahId(67, 1))).toBe(29);
    expect(pageOf(ayahId(78, 1))).toBe(582);
    expect(juzOf(ayahId(2, 142))).toBe(2);
    expect(juzOf(ayahId(2, 141))).toBe(1);
    expect(pageOf(ayahId(114, 6))).toBe(604);
    expect(hizbOf(ayahId(1, 1))).toBe(1);
    expect(hizbOf(ayahId(114, 6))).toBe(60);
  });
  it('round-trips ayah ids', () => {
    for (const id of [1, 7, 8, 293, 3000, 6236]) { const { surah, ayah } = fromAyahId(id); expect(ayahId(surah, ayah)).toBe(id); }
  });
  it('rejects impossible ayahs and ranges', () => {
    expect(() => ayahId(1, 8)).toThrow();
    expect(() => ayahId(115, 1)).toThrow();
    expect(isValidRange({ start: 10, end: 5 })).toBe(false);
    expect(isValidRange({ start: 0, end: 5 })).toBe(false);
    expect(isValidRange({ start: 6236, end: 6237 })).toBe(false);
  });
  it('gives page and juz spans', () => {
    expect(pageRange(1)).toEqual({ start: 1, end: 7 });
    expect(juzRange(30).end).toBe(6236);
    expect(juzRange(30).start).toBe(ayahId(78, 1));
  });
  it('formats ranges', () => {
    expect(formatRange({ start: ayahId(67, 1), end: ayahId(67, 5) })).toBe('Al-Mulk 1–5');
    expect(formatRange(surahRange(112))).toBe('Al-Ikhlāṣ (whole surah)');
  });
  it('searches surahs by number and name', () => {
    expect(searchSurahs('67')).toEqual([67]);
    expect(searchSurahs('mulk')).toContain(67);
    expect(searchSurahs('ikhlas')).toContain(112);
  });
});

describe('progress', () => {
  const juz30 = juzRange(30);
  it('unions overlapping and touching ranges', () => {
    expect(unionRanges([{ start: 10, end: 20 }, { start: 21, end: 25 }, { start: 5, end: 12 }])).toEqual([{ start: 5, end: 25 }]);
    expect(ayahsIn([{ start: 1, end: 7 }, { start: 1, end: 7 }])).toBe(7);
  });
  it('counts whole pages and juz only when complete', () => {
    expect(memorisedPages([pageRange(1)])).toEqual([1]);
    expect(memorisedPages([{ start: 1, end: 6 }])).toEqual([]);
    expect(summary([juz30]).juz).toBe(1);
    expect(summary([juz30]).pages).toBe(23);
    expect(juzProgress([juz30])[29]).toBe(1);
    expect(summary([{ start: 1, end: 6236 }]).percent).toBe(1);
  });
  it('counts streaks', () => {
    const t = '2026-10-19';
    expect(streak(['2026-10-19', '2026-10-18', '2026-10-17', '2026-10-15'], t)).toBe(3);
    expect(streak(['2026-10-18', '2026-10-17'], t)).toBe(2);
    expect(streak(['2026-10-16'], t)).toBe(0);
    expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10'])).toBe(3);
  });
});

describe('suggestions', () => {
  it('starts with An-Nas when going backwards from nothing', () => {
    expect(suggestNew([], 'back', 3)).toEqual({ start: ayahId(114, 1), end: ayahId(114, 3) });
  });
  it('continues inside the current surah and stops at its end', () => {
    const mem = [surahRange(114), { start: ayahId(113, 1), end: ayahId(113, 3) }];
    expect(suggestNew(mem, 'back', 5)).toEqual({ start: ayahId(113, 4), end: ayahId(113, 5) });
  });
  it('goes forwards from Al-Fatihah', () => {
    expect(nextNewStart([surahRange(1)], 'forward')).toBe(ayahId(2, 1));
  });
  it('returns null when everything is memorised', () => {
    expect(suggestNew([{ start: 1, end: 6236 }], 'back', 3)).toBeNull();
  });
});

describe('revision planner', () => {
  const s = DEFAULT_SETTINGS.revision;
  const item = (page: number, dueOn: string, lapses = 0): RevisionItem => ({ page, dueOn, lapses, intervalDays: 1, lastReviewedOn: null });
  it('puts overdue and weak pages first and caps the day', () => {
    const items = [item(582, '2026-10-19'), item(583, '2026-10-10', 1), item(584, '2026-10-17', 3), item(585, '2026-10-25'), ...Array.from({ length: 10 }, (_, i) => item(560 + i, '2026-10-19'))];
    const p = plan(items, s, '2026-10-19', 14);
    expect(p.today[0].page).toBe(583);
    expect(p.today[1].page).toBe(584);
    expect(p.today).toHaveLength(5);
    expect(p.capped).toBe(8);
    expect(p.overdue.map(i => i.page)).toEqual([583, 584]);
    expect(p.weak.map(i => i.page)).toEqual([584]);
    expect(p.soon).toHaveLength(0);
  });
  it('uses the hifz chart default volume', () => {
    expect([0, 20, 60, 200, 500].map(defaultDailyPages)).toEqual([0, 5, 10, 20, 30]);
  });
  it('groups pages into runs', () => {
    expect(groupPages([585, 582, 583, 590])).toEqual([[582, 583], [585, 585], [590, 590]]);
  });
});

describe('scores and dates', () => {
  it('computes accuracy', () => {
    expect(accuracy(0, 0, 1, DEFAULT_SETTINGS.accuracy)).toBe(100);
    expect(accuracy(1, 2, 1, DEFAULT_SETTINGS.accuracy)).toBe(84);
    expect(accuracy(20, 0, 1, DEFAULT_SETTINGS.accuracy)).toBe(0);
  });
  it('validates scores on the chosen scale', () => {
    expect(validScore(5, 5)).toBe(true);
    expect(validScore(0, 5)).toBe(false);
    expect(validScore(0, 10)).toBe(true);
    expect(validScore(11, 10)).toBe(false);
    expect(errorBand(3, DEFAULT_SETTINGS.revision)).toBe('fail');
  });
  it('computes today in a time zone', () => {
    const late = new Date('2026-10-20T02:30:00Z');
    expect(todayIn('America/New_York', late)).toBe('2026-10-19');
    expect(todayIn('Asia/Karachi', late)).toBe('2026-10-20');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isIsoDate('2026-02-30')).toBe(false);
  });
});

import { streakDetail } from '../src/lib/progress';
import { plan as planOld, defaultCyclePages } from '../src/lib/revision';
import { DEFAULT_SETTINGS as DS } from '../src/lib/types';
describe('streak freeze', () => {
  it('bridges one missed day per week when allowed', () => {
    const dates = ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16'];          // missed Wed 14th
    expect(streakDetail(dates, '2026-10-16', 0).days).toBe(2);
    const d = streakDetail(dates, '2026-10-16', 1);
    expect(d.days).toBe(4); expect(d.frozen).toEqual(['2026-10-14']);
  });
});
describe('cycle plan', () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ page: 582 + i, lastReviewedOn: i < 5 ? '2026-10-01' : null, intervalDays: 7, lapses: i === 10 ? 2 : 0, dueOn: '2026-10-01' }));
  const s = { ...DS.revision, oldPlan: 'cycle' as const, days: [1, 3, 5] };
  it('gives 3 pages on Mon/Wed/Fri: weak first, then never revised', () => {
    const p = planOld(items, s, '2026-10-19', 23);                              // Monday
    expect(p.isRevisionDay).toBe(true); expect(p.perDay).toBe(3);
    expect(p.today.map(x => x.page)).toEqual([592, 587, 588]);
    expect(p.cycleDays).toBe(8);
  });
  it('gives nothing on other days and names the next revision day', () => {
    const p = planOld(items, s, '2026-10-20', 23);                              // Tuesday
    expect(p.today).toHaveLength(0); expect(p.nextRevisionDay).toBe('2026-10-21');
  });
  it('uses 4 pages above 5 juz, and a teacher override wins', () => {
    expect(defaultCyclePages(100)).toBe(3); expect(defaultCyclePages(101)).toBe(4);
    expect(planOld(items, s, '2026-10-19', 23, 6).today).toHaveLength(6);
  });
});
