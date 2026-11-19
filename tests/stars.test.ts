import { describe, it, expect } from 'vitest';
import { stars, starLevel, weekDays } from '../src/lib/stars';
import type { Session } from '../src/lib/types';

const s = (date: string, type: Session['type'], partner?: string): Session => ({ id: date + type, orgId: 'o', studentId: 'a', date, type, range: { start: 1, end: 7 }, errorsMajor: 0, errorsMinor: 0, scores: { tajweed: null, fluency: null, accuracy: null, tarteel: null, overall: null }, attendance: 'present', mode: 'in_person', teacherNote: null, studentNote: null, followUp: false, recordedBy: 'student', errors: [], createdAt: date, partnerStudentId: partner ?? null });

describe('stars', () => {
  it('gives one star per part per day, and a bonus when a friend listened', () => {
    const list = [s('2026-11-16', 'new'), s('2026-11-16', 'recent'), s('2026-11-16', 'recent'), s('2026-11-16', 'old', 'b'), s('2026-11-17', 'juz_revision'), { ...s('2026-11-17', 'old'), studentId: 'z' }];
    expect(stars(list, 'a')).toBe(3 + 1 + 1);
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
