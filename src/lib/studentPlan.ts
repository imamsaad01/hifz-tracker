// A student's personal plan, worked out from what they have memorised and the program's settings.
import { lessonSize } from './suggest';
import type { OrgSettings, Student } from './types';
import type { ClassRow, Member } from '../api/data';
import { juzRange, TOTAL_AYAHS, type Range, pagesInRange } from '../quran';
import { overlap, summary } from './progress';
import { DAY_NAMES, pagesPerDay } from './revision';
import { addDays } from './dates';

/** the ayah range a goal string refers to, in the student's direction */
export function goalTarget(goal: string | null, direction: 'back' | 'forward'): { label: string; target: Range } | null {
  if (!goal) return null;
  const juzSpan = (n: number): Range => direction === 'back' ? { start: juzRange(31 - n).start, end: TOTAL_AYAHS } : { start: 1, end: juzRange(n).end };
  const g = goal.toLowerCase();
  if (g.includes('juz 30') || g.includes('juz ʿamma') || g.includes('juz amma')) return { label: 'Juz 30', target: juzRange(30) };
  if (g.includes('29 and 30')) return { label: 'Juz 29–30', target: { start: juzRange(29).start, end: TOTAL_AYAHS } };
  if (g.includes('26–30') || g.includes('26-30')) return { label: 'Juz 26–30', target: { start: juzRange(26).start, end: TOTAL_AYAHS } };
  if (g.startsWith('5 juz')) return { label: '5 juz', target: juzSpan(5) };
  if (g.startsWith('10 juz')) return { label: '10 juz', target: juzSpan(10) };
  if (g.includes('half')) return { label: 'Half the Qurʾān', target: juzSpan(15) };
  if (g.includes('whole')) return { label: 'The whole Qurʾān', target: { start: 1, end: TOTAL_AYAHS } };
  return null;
}

export interface StudentPlan {
  newPerDay: number; newText: string; classDays: string[]; recentDays: number; oldPerDay: number; oldPlan: 'cycle' | 'spaced';
  cycleWeeks: number | null; /** when Old revision happens, in words */ revWhen: string; goal: { label: string; remaining: number; weeks: number | null; eta: string | null; done: boolean } | null;
}
/** lessonDays: the student's halaqah day(s); new lessons are heard then. Without it, the revision days are used. */
export function studentPlan(st: Student, s: OrgSettings, today: string, lessonDays?: number[]): StudentPlan {
  const revDays = s.revision.days?.length ? s.revision.days : [0, 1, 2, 3, 4, 5, 6];
  const days = lessonDays?.length ? lessonDays : revDays;
  const revPerWeek = s.revision.perWeek ?? revDays.length;
  const mem = summary(st.memorized);
  const oldPerDay = pagesPerDay(s.revision, mem.pages, st.oldPages);
  const cycleWeeks = s.revision.oldPlan === 'cycle' && oldPerDay ? Math.max(1, Math.ceil(mem.pages / oldPerDay / revPerWeek)) : null;
  const gt = goalTarget(st.goal, st.direction);
  let goal: StudentPlan['goal'] = null;
  if (gt) {
    const total = gt.target.end - gt.target.start + 1;
    const remaining = Math.max(0, total - overlap(st.memorized, gt.target));
    const perPage = total / Math.max(1, pagesInRange(gt.target).length);          // ayahs a page in this goal (short surahs have more)
    const perWeek = (st.newPages ? st.newPages * perPage : st.dailyNewAyahs) * days.length;
    const weeks = remaining && perWeek ? Math.ceil(remaining / perWeek) : remaining ? null : 0;
    goal = { label: gt.label, remaining, weeks, eta: weeks ? addDays(today, weeks * 7) : null, done: remaining === 0 };
  }
  return { newPerDay: st.dailyNewAyahs, newText: lessonSize(st), classDays: [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DAY_NAMES[d]), recentDays: s.revision.recentDays, revWhen: s.revision.perWeek ? `${s.revision.perWeek} times a week, any days` : revDays.length === 7 ? 'every day' : [...revDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DAY_NAMES[d]).join(', '), oldPerDay, oldPlan: s.revision.oldPlan, cycleWeeks, goal };
}

/** "Weekday Hifz · Sh Saad" — the student's halaqah(s) and teacher; falls back to the program and its admin */
export function classLabel(studentId: string, classes: ClassRow[], members: Member[], programName: string): { title: string; teacher: string | null } {
  const mine = classes.filter(c => c.studentIds.includes(studentId));
  const nameOf = (uid: string | null) => members.find(m => m.userId === uid)?.displayName ?? null;
  if (mine.length) return { title: mine.map(c => c.name).join(' · '), teacher: [...new Set(mine.map(c => nameOf(c.teacherUserId)).filter(Boolean))].join(', ') || null };
  const admin = members.find(m => m.role === 'admin');
  return { title: programName, teacher: admin?.displayName ?? null };
}

/** How far through their own goal (not the whole Qur'an) */
export function goalPct(st: Student, g: { remaining: number; done: boolean }) {
  if (g.done) return 100; const t = goalTarget(st.goal, st.direction)?.target; if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - g.remaining / (t.end - t.start + 1)) * 100)));
}
