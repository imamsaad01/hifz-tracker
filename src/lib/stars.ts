// Seeds and stars. Tapping "I did it" plants a seed. It grows into a star only when someone heard it:
//  • a revision partner confirmed it → 1 star
//  • the teacher recorded it or signed it off → 1 star, or a golden star (2) with no mistakes
//  • the teacher marked it "redo" → the seed wilts (nothing)
// One value per part per day (the best one), so logging the same part twice earns nothing extra.
import type { Session } from './types';
import { addDays } from './dates';

export type Part = 'new' | 'recent' | 'old';
export const partOf = (t: Session['type']): Part | null => (t === 'new' ? 'new' : t === 'recent' ? 'recent' : t === 'old' || t === 'juz_revision' ? 'old' : null);

export type Grow = 'seed' | 'star' | 'gold' | 'wilted';
export function growth(s: Session): Grow {
  if (s.checkStatus === 'redo') return 'wilted';
  const clean = s.errorsMajor + s.errorsMinor === 0;
  if (!s.selfLogged && s.recordedBy === 'teacher') return clean ? 'gold' : 'star';
  if (s.partnerStatus === 'confirmed') return 'star';
  if (s.checkStatus === 'ok') return clean ? 'gold' : 'star';
  return 'seed';
}
const VALUE: Record<Grow, number> = { wilted: 0, seed: 0, star: 1, gold: 2 };
const RANK: Record<Grow, number> = { wilted: 0, seed: 1, star: 2, gold: 3 };

/** The best result for each part on each day: Map<date, Map<part, grow>> */
export function partsByDay(sessions: Session[], studentId: string): Map<string, Map<Part, Grow>> {
  const m = new Map<string, Map<Part, Grow>>();
  for (const s of sessions) {
    if (s.studentId !== studentId) continue;
    const p = partOf(s.type); if (!p) continue;
    const day = m.get(s.date) ?? new Map<Part, Grow>(); const g = growth(s); const had = day.get(p);
    if (!had || RANK[g] > RANK[had]) day.set(p, g);
    m.set(s.date, day);
  }
  return m;
}

/** Stars earned (heard by someone) and seeds still waiting to grow */
export function garden2(sessions: Session[], studentId: string): { stars: number; seeds: number; gold: number } {
  let stars = 0, seeds = 0, gold = 0;
  partsByDay(sessions, studentId).forEach(day => day.forEach(g => { stars += VALUE[g]; if (g === 'seed') seeds++; if (g === 'gold') gold++; }));
  return { stars, seeds, gold };
}
export const stars = (sessions: Session[], studentId: string) => garden2(sessions, studentId).stars;

export const STARS_PER_LEVEL = 25;
export function starLevel(total: number): { level: number; into: number; need: number } {
  return { level: Math.floor(total / STARS_PER_LEVEL) + 1, into: total % STARS_PER_LEVEL, need: STARS_PER_LEVEL };
}

/** Monday to Sunday of this week: each day's date and how many parts were done. */
export function weekDays(sessions: Session[], studentId: string, today: string): Array<{ date: string; count: number }> {
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const mon = addDays(today, -wd); const by = partsByDay(sessions, studentId);
  return Array.from({ length: 7 }, (_, i) => { const d = addDays(mon, i); return { date: d, count: [...(by.get(d)?.values() ?? [])].filter(g => g !== 'wilted').length }; });
}

/** "Steadfast": a 30-day streak, and in each of the last 4 weeks at least 2 Old revisions a partner confirmed */
export function steadfast(sessions: Session[], studentId: string, today: string, streakDays: number): { earned: boolean; weeksOk: number } {
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; const thisMon = addDays(today, -wd);
  let weeksOk = 0;
  for (let w = 1; w <= 4; w++) {
    const from = addDays(thisMon, -7 * w), to = addDays(from, 6);
    const days = new Set(sessions.filter(s => s.studentId === studentId && partOf(s.type) === 'old' && s.partnerStatus === 'confirmed' && s.date >= from && s.date <= to).map(s => s.date));
    if (days.size >= 2) weeksOk++;
  }
  return { earned: streakDays >= 30 && weeksOk === 4, weeksOk };
}

/** Rewards that are worked for. The teacher gives the real-world part in class. */
export const PRIZE_BOX = ['A sticker sheet', 'A Qurʾān bookmark', 'A new pencil or pen', 'A small notebook', 'A treat from the jar', 'Choose the closing duʿāʾ', 'Sit in the front row', 'Lead the class recitation'];
/** Each halaqah's stars add up over the month. About 20 heard stars per student: 2 lessons and 3 partner revisions a week gets there. */
export const CLASS_TREAT = 'Pizza and games after class';
export const classTreatTarget = (students: number) => Math.max(60, Math.ceil((20 * Math.max(1, students)) / 10) * 10);

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
