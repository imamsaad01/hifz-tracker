// Review planner (V1). The database updates each page's interval after a session (record_session);
// this module only decides what to show: due today, overdue, due soon, weak — and how much fits today.
// Swap `plan` for a smarter model later; screens only depend on the returned shape.
import type { OrgSettings, RevisionItem } from './types';
import { daysBetween } from './dates';

export interface Plan { today: RevisionItem[]; overdue: RevisionItem[]; soon: RevisionItem[]; weak: RevisionItem[]; capped: number }
/** Default daily old-revision volume from how many pages are memorised (matches the printed Hifz chart). */
export function defaultDailyPages(memorisedPages: number): number {
  if (memorisedPages === 0) return 0;
  if (memorisedPages <= 40) return 5;
  if (memorisedPages <= 100) return 10;
  if (memorisedPages <= 300) return 20;
  return 30;
}
export function plan(items: RevisionItem[], settings: OrgSettings['revision'], today: string, memorisedPages = items.length): Plan {
  const cap = settings.dailyOldPages ?? defaultDailyPages(memorisedPages);
  const due = items.filter(i => i.dueOn <= today);
  // most overdue first, then weakest (more lapses), then oldest review, then mushaf order
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || b.lapses - a.lapses || (a.lastReviewedOn ?? '').localeCompare(b.lastReviewedOn ?? '') || a.page - b.page);
  const todayList = due.slice(0, cap);
  return {
    today: todayList,
    overdue: due.filter(i => daysBetween(i.dueOn, today) > 0),
    soon: items.filter(i => i.dueOn > today && daysBetween(today, i.dueOn) <= 3).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.page - b.page),
    weak: items.filter(i => i.lapses >= 2).sort((a, b) => b.lapses - a.lapses || a.page - b.page),
    capped: Math.max(0, due.length - todayList.length),
  };
}
/** Group consecutive pages into ranges for display ("pages 582–586"). */
export function groupPages(pages: number[]): Array<[number, number]> {
  const s = [...pages].sort((a, b) => a - b); const out: Array<[number, number]> = [];
  for (const p of s) { const last = out[out.length - 1]; if (last && p === last[1] + 1) last[1] = p; else out.push([p, p]); }
  return out;
}
