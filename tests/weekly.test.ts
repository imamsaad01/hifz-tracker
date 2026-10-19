import { describe, it, expect } from 'vitest';
import { weekSummary } from '../src/lib/weekly';
import { pageRange } from '../src/quran';
import type { Session } from '../src/lib/types';

const ses = (date: string, type: Session['type'], p1: number, p2: number, extra: Partial<Session> = {}): Session => ({
  id: date + type + p1, orgId: 'o', studentId: 's', date, type, range: { start: pageRange(p1).start, end: pageRange(p2).end }, errorsMajor: 0, errorsMinor: 0,
  scores: { tajweed: null, fluency: null, accuracy: null, tarteel: null, overall: null }, attendance: 'present', mode: 'in_person', teacherNote: null, studentNote: null, followUp: false,
  recordedBy: 'student', errors: [], createdAt: date, ...extra,
});
describe('weekly revision', () => {
  // week of Mon 2026-10-19; revision days Mon/Wed/Fri; 3 pages a day → target 9
  const days = [1, 3, 5];
  it('counts distinct Old pages, ignores redo, flags missed days', () => {
    const w = weekSummary([ses('2026-10-19', 'old', 582, 584), ses('2026-10-19', 'old', 584, 585), ses('2026-10-21', 'old', 590, 592, { checkStatus: 'redo' })], '2026-10-22', days, 3, true);
    expect(w.target).toBe(9); expect(w.oldPages).toBe(4); expect(w.missedDays).toBe(1);
  });
  it('asks to log today on a revision day', () => {
    const w = weekSummary([], '2026-10-23', days, 3, false);
    expect(w.todayNeedsOld).toBe(true);
  });
});
