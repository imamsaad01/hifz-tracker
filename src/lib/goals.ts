import type { Session } from './types';
import type { Goal } from '../api/data';
import { addDays } from './dates';
import { pagesInRange } from '../quran';
import { streak } from './progress';
export const METRIC_LABEL: Record<string, string> = { new_ayahs: 'new ayahs', revision_pages: 'revision pages', streak_days: 'day streak', sessions: 'sessions', complete_juz: 'whole juz' };
export function goalWindow(g: Goal, today: string): [string, string] {
  if (g.period === 'daily') return [today, today];
  if (g.period === 'weekly') return [addDays(today, -6), today];
  if (g.period === 'monthly') return [addDays(today, -29), today];
  return [g.startsOn, g.endsOn ?? today];
}
/** how far a goal has got, from the student's sessions (never typed in) */
export function goalValue(g: Goal, sessions: Session[], today: string, juzDone: number): number {
  const [a, b] = goalWindow(g, today);
  const inWin = sessions.filter(s => s.studentId === g.studentId && s.date >= a && s.date <= b);
  switch (g.metric) {
    case 'new_ayahs': return inWin.filter(s => s.type === 'new').reduce((n, s) => n + s.range.end - s.range.start + 1, 0);
    case 'revision_pages': return inWin.filter(s => s.type !== 'new').reduce((n, s) => n + pagesInRange(s.range).length, 0);
    case 'sessions': return new Set(inWin.map(s => s.date)).size;
    case 'streak_days': return streak(sessions.filter(s => s.studentId === g.studentId).map(s => s.date), today);
    case 'complete_juz': return juzDone;
    default: return 0;
  }
}
