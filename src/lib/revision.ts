// Old-revision planner. The database records when each page was last revised (record_session);
// this module decides what to show today. Two plans:
//  • cycle  — on revision days (e.g. Mon/Wed/Fri) take the next few pages in turn: weak pages first, then pages
//             never revised, then the longest since last revised. Over a few weeks everything comes round.
//  • spaced — each page comes back after its own interval (clean pages less often, weak pages sooner).
import type { OrgSettings, RevisionItem } from './types';
import { addDays, daysBetween } from './dates';

export interface Plan {
  today: RevisionItem[]; overdue: RevisionItem[]; soon: RevisionItem[]; weak: RevisionItem[]; capped: number;
  /** pages per revision day for this student */ perDay: number;
  /** today is a revision day */ isRevisionDay: boolean; nextRevisionDay: string | null;
  /** cycle plan: revision days needed to go through everything once */ cycleDays: number | null;
}
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Default daily old-revision volume for the spaced plan (matches the printed Hifz chart). */
export function defaultDailyPages(memorisedPages: number): number {
  if (memorisedPages === 0) return 0;
  if (memorisedPages <= 40) return 5;
  if (memorisedPages <= 100) return 10;
  if (memorisedPages <= 300) return 20;
  return 30;
}
/** Default for the cycle plan: 3 pages a revision day up to 5 juz memorised, 4 above. */
export function defaultCyclePages(memorisedPages: number): number {
  if (memorisedPages === 0) return 0;
  return memorisedPages <= 100 ? 3 : 4;
}
export function pagesPerDay(settings: OrgSettings['revision'], memorisedPages: number, studentOverride?: number | null): number {
  if (studentOverride) return studentOverride;
  if (settings.dailyOldPages) return settings.dailyOldPages;
  return settings.oldPlan === 'cycle' ? defaultCyclePages(memorisedPages) : defaultDailyPages(memorisedPages);
}
export function nextRevisionDay(days: number[], today: string, includeToday = false): string | null {
  if (!days.length) return null;
  for (let i = includeToday ? 0 : 1; i <= 7; i++) { const d = addDays(today, i); if (days.includes(weekday(d))) return d; }
  return null;
}

export function plan(items: RevisionItem[], settings: OrgSettings['revision'], today: string, memorisedPages = items.length, studentOverride?: number | null): Plan {
  const days = settings.days?.length ? settings.days : [0, 1, 2, 3, 4, 5, 6];
  const isDay = days.includes(weekday(today));
  const perDay = pagesPerDay(settings, memorisedPages, studentOverride);
  const weak = items.filter(i => i.lapses >= 2).sort((a, b) => b.lapses - a.lapses || a.page - b.page);
  const next = nextRevisionDay(days, today, false);

  if (settings.oldPlan === 'cycle') {
    // revised today already? those pages count toward today's set
    const doneToday = items.filter(i => i.lastReviewedOn === today);
    const order = items.filter(i => i.lastReviewedOn !== today).sort((a, b) => {
      const wa = a.lapses >= 2 ? 0 : 1, wb = b.lapses >= 2 ? 0 : 1;
      if (wa !== wb) return wa - wb;
      if (!a.lastReviewedOn !== !b.lastReviewedOn) return a.lastReviewedOn ? 1 : -1;
      return (a.lastReviewedOn ?? '').localeCompare(b.lastReviewedOn ?? '') || a.page - b.page;
    });
    const todayList = isDay ? [...doneToday, ...order.slice(0, Math.max(0, perDay - doneToday.length))] : [];
    const soon = isDay ? order.slice(Math.max(0, perDay - doneToday.length), Math.max(0, perDay - doneToday.length) + perDay) : order.slice(0, perDay);
    return { today: todayList, overdue: [], soon, weak, capped: 0, perDay, isRevisionDay: isDay, nextRevisionDay: next, cycleDays: perDay ? Math.ceil(items.length / perDay) : null };
  }

  const due = items.filter(i => i.dueOn <= today);
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || b.lapses - a.lapses || (a.lastReviewedOn ?? '').localeCompare(b.lastReviewedOn ?? '') || a.page - b.page);
  const todayList = isDay ? due.slice(0, perDay) : [];
  return {
    today: todayList,
    overdue: due.filter(i => daysBetween(i.dueOn, today) > 0),
    soon: items.filter(i => i.dueOn > today && daysBetween(today, i.dueOn) <= 3).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.page - b.page),
    weak, capped: Math.max(0, due.length - todayList.length), perDay, isRevisionDay: isDay, nextRevisionDay: next, cycleDays: null,
  };
}
/** Group consecutive pages into ranges for display ("pages 582–586"). */
export function groupPages(pages: number[]): Array<[number, number]> {
  const s = [...pages].sort((a, b) => a - b); const out: Array<[number, number]> = [];
  for (const p of s) { const last = out[out.length - 1]; if (last && p === last[1] + 1) last[1] = p; else out.push([p, p]); }
  return out;
}
