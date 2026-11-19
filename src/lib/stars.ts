// Stars for the simple student home: one star for each part done on a day (New, Recent, Old),
// plus a bonus star when a friend listened to the Old revision. Worked out from saved records only.
import type { Session } from './types';
import { addDays } from './dates';

export type Part = 'new' | 'recent' | 'old';
export const partOf = (t: Session['type']): Part | null => (t === 'new' ? 'new' : t === 'recent' ? 'recent' : t === 'old' || t === 'juz_revision' ? 'old' : null);

/** Parts done on each date: Map<date, Set<part>> */
export function partsByDay(sessions: Session[], studentId: string): Map<string, Set<Part>> {
  const m = new Map<string, Set<Part>>();
  for (const s of sessions) {
    if (s.studentId !== studentId) continue;
    const p = partOf(s.type); if (!p) continue;
    const set = m.get(s.date) ?? new Set<Part>(); set.add(p); m.set(s.date, set);
  }
  return m;
}

export function stars(sessions: Session[], studentId: string): number {
  let n = 0; partsByDay(sessions, studentId).forEach(set => { n += set.size; });
  const bonusDays = new Set(sessions.filter(s => s.studentId === studentId && partOf(s.type) === 'old' && s.partnerStudentId).map(s => s.date));
  return n + bonusDays.size;
}

export const STARS_PER_LEVEL = 25;
export function starLevel(total: number): { level: number; into: number; need: number } {
  return { level: Math.floor(total / STARS_PER_LEVEL) + 1, into: total % STARS_PER_LEVEL, need: STARS_PER_LEVEL };
}

/** Monday to Sunday of this week: each day's date and how many parts were done. */
export function weekDays(sessions: Session[], studentId: string, today: string): Array<{ date: string; count: number }> {
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const mon = addDays(today, -wd); const by = partsByDay(sessions, studentId);
  return Array.from({ length: 7 }, (_, i) => { const d = addDays(mon, i); return { date: d, count: by.get(d)?.size ?? 0 }; });
}

/** Each level is a garden of 25 plants: every star plants one. Fill the garden, the next one opens. */
export const GARDENS: Array<{ name: string; plant: string }> = [
  { name: 'Seed', plant: '🌱' }, { name: 'Sprout', plant: '🌿' }, { name: 'Tulip', plant: '🌷' }, { name: 'Sunflower', plant: '🌻' },
  { name: 'Rose', plant: '🌹' }, { name: 'Blossom', plant: '🌸' }, { name: 'Palm', plant: '🌴' }, { name: 'Date palm', plant: '🌴' }, { name: 'Olive tree', plant: '🌳' }, { name: 'Great tree', plant: '🌳' },
];
export const garden = (level: number) => GARDENS[Math.min(level, GARDENS.length) - 1];

/** Streak goals to aim for next */
export const STREAK_GOALS = [3, 7, 14, 30, 50, 100, 200, 365];
export const nextStreakGoal = (days: number) => STREAK_GOALS.find(g => g > days) ?? days + 100;

/** A different cheer each time, so it never feels the same */
const CHEERS = ['Mā shāʾ Allāh, well done!', 'Bārak Allāhu fīk!', 'Your garden grew! 🌱', 'Another one done. Keep going!', 'A little every day. That is how hifz grows!', 'That was great!'];
export const cheer = (seed: number) => CHEERS[Math.abs(seed) % CHEERS.length];
