// This week's revision, counted from what the student submitted (Monday–Sunday).
import type { Session } from './types';
import { pagesInRange } from '../quran';
import { addDays } from './dates';
import { weekStart } from './schedule';

export interface DayMark { date: string; dow: number; revisionDay: boolean; old: boolean; recent: boolean; isToday: boolean; future: boolean; missed: boolean }
export interface WeekSummary {
  start: string; oldPages: number; recentDays: number; newLessons: number; target: number; perDay: number;
  days: DayMark[]; missedDays: number; todayNeedsOld: boolean; todayNeedsRecent: boolean; percent: number;
}
const counts = (s: Session) => s.checkStatus !== 'redo' && !(s as { deletedAt?: string | null }).deletedAt;
export function weekSummary(studentSessions: Session[], today: string, revisionDays: number[], perDay: number, hasRecent: boolean, start = weekStart(today)): WeekSummary {
  const end = addDays(start, 6);
  const wk = studentSessions.filter(s => s.date >= start && s.date <= end && counts(s));
  const oldPages = new Set(wk.filter(s => s.type === 'old' || s.type === 'juz_revision').flatMap(s => pagesInRange(s.range)));
  const days: DayMark[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i); const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const old = wk.some(s => s.date === date && (s.type === 'old' || s.type === 'juz_revision'));
    const recent = wk.some(s => s.date === date && s.type === 'recent');
    const revisionDay = revisionDays.includes(dow);
    return { date, dow, revisionDay, old, recent, isToday: date === today, future: date > today, missed: revisionDay && date < today && !old };
  });
  const target = perDay * days.filter(d => d.revisionDay).length;
  const t = days.find(d => d.isToday);
  return {
    start, oldPages: oldPages.size, recentDays: days.filter(d => d.recent).length, newLessons: wk.filter(s => s.type === 'new').length, target, perDay, days,
    missedDays: days.filter(d => d.missed).length, todayNeedsOld: !!t && t.revisionDay && !t.old && perDay > 0, todayNeedsRecent: !!t && hasRecent && !t.recent,
    percent: target ? Math.min(1, oldPages.size / target) : 0,
  };
}
