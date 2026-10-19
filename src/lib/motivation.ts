// Points, levels and badges. Everything is worked out from saved records, so nothing can be "claimed" by hand.
// Points reward consistency, the same idea as the leaderboard: showing up, revising, clean pages, good adab.
// New lessons give no points, so going faster than the plan never wins.
import type { Milestone, Session } from './types';
import type { BehaviourPoint } from '../api/data';
import { pagesInRange } from '../quran';
import { longestStreak } from './progress';
import { juzProgress } from './progress';
import type { Range } from '../quran';

export function points(sessions: Session[], behaviour: BehaviourPoint[]): { total: number; days: number; revised: number; clean: number; adab: number } {
  const byDay = new Map<string, { rev: number; clean: number }>();
  sessions.forEach(s => {
    const d = byDay.get(s.date) ?? { rev: 0, clean: 0 };
    if (s.type !== 'new') { const p = pagesInRange(s.range).length; d.rev += p; if (s.errorsMajor + s.errorsMinor === 0) d.clean += p; }
    byDay.set(s.date, d);
  });
  let revised = 0, clean = 0;
  byDay.forEach(d => { revised += Math.min(20, d.rev); clean += Math.min(20, d.clean); });
  const adab = behaviour.reduce((n, b) => n + (b.value > 0 ? 5 : 0), 0);
  return { total: byDay.size * 10 + revised * 2 + clean + adab, days: byDay.size, revised, clean, adab };
}

export const LEVELS: Array<[number, string]> = [
  [0, 'Starter'], [100, 'Steady'], [250, 'Consistent'], [500, 'Dedicated'], [900, 'Strong'],
  [1500, 'Focused'], [2500, 'Excellent'], [4000, 'Outstanding'], [6000, 'Exemplary'], [9000, 'Inspiring'],
];
export function level(total: number) {
  let i = 0; while (i + 1 < LEVELS.length && total >= LEVELS[i + 1][0]) i++;
  const [from, name] = LEVELS[i]; const next = LEVELS[i + 1];
  return { n: i + 1, name, from, to: next?.[0] ?? null, nextName: next?.[1] ?? null, progress: next ? (total - from) / (next[0] - from) : 1 };
}

export interface Badge { id: string; name: string; how: string; earned: boolean; icon: 'flame' | 'book' | 'star' | 'check' | 'heart' | 'medal' }
export function badges(sessions: Session[], behaviour: BehaviourPoint[], milestones: Milestone[], memorized: Range[]): Badge[] {
  const dates = sessions.map(s => s.date);
  const best = longestStreak(dates);
  const p = points(sessions, behaviour);
  const has = (c: string) => milestones.some(m => m.code === c);
  const juzDone = juzProgress(memorized).filter(x => x >= 1).length;
  const perfectWeeks = (() => { const wk = new Map<string, Set<string>>(); dates.forEach(d => { const dt = new Date(`${d}T12:00:00Z`); const mon = new Date(dt); mon.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); const k = mon.toISOString().slice(0, 10); (wk.get(k) ?? wk.set(k, new Set()).get(k)!).add(d); }); return [...wk.values()].filter(s => s.size >= 5).length; })();
  return [
    { id: 'first_page', name: 'First page', how: 'Memorise one full page', earned: has('first_page'), icon: 'book' },
    { id: 'juz', name: 'First juz', how: 'Memorise a whole juz', earned: juzDone >= 1, icon: 'medal' },
    { id: 'juz5', name: 'Five juz', how: 'Memorise 5 whole juz', earned: juzDone >= 5, icon: 'medal' },
    { id: 's7', name: 'Week streak', how: '7 days in a row', earned: best >= 7, icon: 'flame' },
    { id: 's30', name: 'Month streak', how: '30 days in a row', earned: best >= 30, icon: 'flame' },
    { id: 's100', name: '100-day streak', how: '100 days in a row', earned: best >= 100, icon: 'flame' },
    { id: 'clean25', name: 'Clean reader', how: '25 pages revised with no mistakes', earned: p.clean >= 25, icon: 'check' },
    { id: 'clean100', name: 'Polished', how: '100 pages revised with no mistakes', earned: p.clean >= 100, icon: 'check' },
    { id: 'rev100', name: 'Reviser', how: '100 pages of revision', earned: p.revised >= 100, icon: 'star' },
    { id: 'week5', name: 'Full week', how: '5 or more days with a session in one week', earned: perfectWeeks >= 1, icon: 'star' },
    { id: 'adab10', name: 'Good adab', how: '10 adab points from your teacher', earned: behaviour.filter(b => b.value > 0).length >= 10, icon: 'heart' },
    { id: 'sessions100', name: '100 sessions', how: '100 recorded sessions', earned: sessions.length >= 100, icon: 'star' },
  ];
}
