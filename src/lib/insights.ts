// Derived facts about a student, computed from loaded records. Used by dashboards; tested in tests/insights.test.ts.
import type { Assignment, OrgSettings, RevisionItem, Session, Student } from './types';
import { summary, streak, longestStreak, type ProgressSummary } from './progress';
import { plan, type Plan } from './revision';
import { suggestNew } from './suggest';
import { daysBetween, addDays } from './dates';
import { accuracy } from './scoring';
import { pagesInRange, type Range } from '../quran';
import type { Attendance } from '../api/data';

export interface Reason { kind: 'no_session' | 'errors' | 'overdue_revision' | 'overdue_assignment' | 'repeated_errors' | 'absent' | 'follow_up'; text: string; severity: 1 | 2 | 3 }
export interface StudentInsight {
  student: Student; progress: ProgressSummary; streak: number; longest: number; lastSession: Session | null; daysSinceSession: number | null;
  recordedToday: boolean; attendanceToday: string | null; revision: Plan; nextNew: Range | null; openAssignments: Assignment[]; overdueAssignments: Assignment[];
  avgAccuracy30: number | null; avgOverall30: number | null; attendanceRate30: number | null; newAyahs7: number; repeatedErrorAyahs: number[]; reasons: Reason[];
}

export function insight(st: Student, sessions: Session[], items: RevisionItem[], assignments: Assignment[], attendance: Attendance[], s: OrgSettings, today: string): StudentInsight {
  const mine = sessions.filter(x => x.studentId === st.id);              // newest first
  const progress = summary(st.memorized);
  const last = mine[0] ?? null;
  const dates = mine.map(x => x.date);
  const rev = plan(items, s.revision, today, progress.pages, st.oldPages);
  const open = assignments.filter(a => a.studentId === st.id && (a.status === 'assigned' || a.status === 'started'));
  const overdueA = open.filter(a => a.dueOn < today);
  const since30 = addDays(today, -30), since7 = addDays(today, -6);
  const recent30 = mine.filter(x => x.date >= since30);
  const acc = recent30.map(x => accuracy(x.errorsMajor, x.errorsMinor, pagesInRange(x.range).length, s.accuracy));
  const overall = recent30.map(x => x.scores.overall).filter((v): v is number => v !== null);
  const att = attendance.filter(a => a.studentId === st.id && a.date >= since30);
  const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
  const errorAyahs = new Map<number, number>();
  recent30.forEach(x => x.errors.forEach(e => { if (e.ayahId) errorAyahs.set(e.ayahId, (errorAyahs.get(e.ayahId) ?? 0) + 1); }));
  const repeated = [...errorAyahs.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const todayAtt = attendance.find(a => a.studentId === st.id && a.date === today)?.status ?? null;
  const daysSince = last ? daysBetween(last.date, today) : null;

  const reasons: Reason[] = [];
  if (daysSince === null) reasons.push({ kind: 'no_session', text: 'No sessions yet', severity: 1 });
  else if (daysSince >= 3) reasons.push({ kind: 'no_session', text: `No session for ${daysSince} days`, severity: daysSince >= 7 ? 3 : 2 });
  if (last && last.errorsMajor + last.errorsMinor >= s.revision.failThreshold) reasons.push({ kind: 'errors', text: `${last.errorsMajor + last.errorsMinor} errors last time`, severity: 2 });
  if (rev.overdue.length >= 5) reasons.push({ kind: 'overdue_revision', text: `${rev.overdue.length} pages overdue`, severity: rev.overdue.length >= 15 ? 3 : 2 });
  if (overdueA.length) reasons.push({ kind: 'overdue_assignment', text: `${overdueA.length} assignment${overdueA.length > 1 ? 's' : ''} overdue`, severity: 2 });
  if (repeated.length) reasons.push({ kind: 'repeated_errors', text: `Repeats errors on ${repeated.length} ayah${repeated.length > 1 ? 's' : ''}`, severity: 1 });
  if (todayAtt === 'absent') reasons.push({ kind: 'absent', text: 'Absent today', severity: 1 });
  if (last?.followUp) reasons.push({ kind: 'follow_up', text: 'Marked for follow-up', severity: 2 });

  return {
    student: st, progress, streak: streak(dates, today, s.motivation?.freezePerWeek ?? 0), longest: Math.max(longestStreak(dates), streak(dates, today, s.motivation?.freezePerWeek ?? 0)), lastSession: last, daysSinceSession: daysSince,
    recordedToday: mine.some(x => x.date === today && x.recordedBy === 'teacher'), attendanceToday: todayAtt, revision: rev,
    nextNew: suggestNew(st.memorized, st.direction, st.dailyNewAyahs), openAssignments: open, overdueAssignments: overdueA,
    avgAccuracy30: acc.length ? Math.round(acc.reduce((a, b) => a + b, 0) / acc.length) : null,
    avgOverall30: overall.length ? Math.round((overall.reduce((a, b) => a + b, 0) / overall.length) * 10) / 10 : null,
    attendanceRate30: att.length ? present / att.length : null,
    newAyahs7: mine.filter(x => x.type === 'new' && x.date >= since7).reduce((a, x) => a + x.range.end - x.range.start + 1, 0),
    repeatedErrorAyahs: repeated, reasons: reasons.sort((a, b) => b.severity - a.severity),
  };
}
/** The recent-revision range: everything learned as New in the last `days` days, as one or more ranges */
export function recentRanges(sessions: Session[], studentId: string, today: string, days: number): Range[] {
  const since = addDays(today, -days);
  const rs = sessions.filter(x => x.studentId === studentId && x.type === 'new' && x.date >= since).map(x => x.range).sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of rs) { const l = out[out.length - 1]; if (l && r.start <= l.end + 1) l.end = Math.max(l.end, r.end); else out.push({ ...r }); }
  return out;
}
