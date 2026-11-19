import { describe, it, expect } from 'vitest';
import { stars, starLevel, weekDays, garden2 } from '../src/lib/stars';
import type { Session } from '../src/lib/types';

const s = (date: string, type: Session['type'], partner?: string): Session => ({ id: date + type, orgId: 'o', studentId: 'a', date, type, range: { start: 1, end: 7 }, errorsMajor: 0, errorsMinor: 0, scores: { tajweed: null, fluency: null, accuracy: null, tarteel: null, overall: null }, attendance: 'present', mode: 'in_person', teacherNote: null, studentNote: null, followUp: false, recordedBy: 'student', errors: [], createdAt: date, partnerStudentId: partner ?? null, selfLogged: true });

describe('stars', () => {
  it('a tap is only a seed; it grows when someone heard it', () => {
    const list = [
      s('2026-11-16', 'new'),                                                     // seed
      { ...s('2026-11-16', 'recent'), partnerStatus: 'confirmed' as const },       // partner heard: 1
      { ...s('2026-11-16', 'recent'), partnerStatus: 'confirmed' as const },       // same part same day: no extra
      { ...s('2026-11-17', 'old'), selfLogged: false, recordedBy: 'teacher' as const },  // teacher, clean: 2
      { ...s('2026-11-18', 'old'), selfLogged: true, checkStatus: 'ok' as const, errorsMinor: 1 }, // signed off with a mistake: 1
      { ...s('2026-11-19', 'old'), selfLogged: true, checkStatus: 'redo' as const }, // wilted
      { ...s('2026-11-17', 'old'), studentId: 'z', selfLogged: false },            // someone else
    ];
    expect(garden2(list, 'a')).toEqual({ stars: 4, seeds: 1, gold: 1 });
    expect(stars(list, 'a')).toBe(4);
  });
  it('levels every 25 stars', () => {
    expect(starLevel(0)).toEqual({ level: 1, into: 0, need: 25 });
    expect(starLevel(31)).toEqual({ level: 2, into: 6, need: 25 });
  });
  it('lays out Monday to Sunday of this week', () => {
    const w = weekDays([s('2026-11-16', 'new'), s('2026-11-16', 'old'), s('2026-11-19', 'recent')], 'a', '2026-11-19');
    expect(w.map(d => d.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(w.map(d => d.count)).toEqual([2, 0, 0, 1, 0, 0, 0]);
  });
});
