import { DEFAULT_RULES } from './rules';
// Domain types shared by the app. Database rows are mapped to these in src/api.
import type { Range } from '../quran';

export type Role = 'admin' | 'teacher' | 'student' | 'parent';
export type SessionType = 'new' | 'recent' | 'old' | 'juz_revision' | 'assessment' | 'catch_up' | 'review' | 'other';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';
export type AttendanceMode = 'in_person' | 'online';
export type ErrorSeverity = 'major' | 'minor';
export type ErrorCategory =
  | 'forgot_ayah' | 'added_missed_word' | 'word_substitution' | 'similar_ayah' | 'tajweed' | 'makharij'
  | 'harakah' | 'madd' | 'ghunnah' | 'waqf_ibtida' | 'fluency' | 'other';
export type AssignmentType = 'new' | 'revision' | 'listening' | 'tajweed' | 'other';
export type AssignmentStatus = 'assigned' | 'started' | 'completed' | 'reviewed';
export type Direction = 'back' | 'forward';

export interface OrgSettings {
  scoreScale: number;                       // 5 = 1–5 stars, 10 = 0–10
  revision: { recentDays: number; maxIntervalDays: number; weakThreshold: number; failThreshold: number; dailyOldPages: number | null; maxOverdueBeforeNew: number | null;
    /** 'cycle': go through all memorised pages in turn on revision days; 'spaced': each page returns on its own schedule */
    oldPlan: 'cycle' | 'spaced'; days: number[];
    /** phone reminder on revision days */ remind?: boolean; reminderTime?: string;
    /** evening nudge to log revision if nothing logged */ logRemind?: boolean; logReminderTime?: string;
    /** how the teacher hears about revision: a daily summary, each confirmed revision, or not at all */ teacherNotify?: 'daily' | 'each' | 'off' };
  accuracy: { major: number; minor: number };
  email: { enabled: boolean; onSession: boolean; lowRevision: boolean; weekly: boolean };
  leaderboard: { enabled: boolean; fullNames: boolean };
  motivation: { freezePerWeek: number };
  adab: { positive: string[]; negative: string[] };
  fees: { monthly: number | null; currency: string };
  attendance: { semesterStart: string | null; semesterEnd: string | null; freeAbsences: number; excusedAbsences: number };
  revisionForm: { slots: Array<{ key: string; label: string; day: number | null }>; allowedMisses: number };
  rulesText: string;
  /** false: a program with no parents — hides parent codes, parent fields and the parent step at sign-up */
  parentsEnabled: boolean;
  /** qira'at reminders: test eve/morning, daily matn lines, weekly weak-areas review */
  /** weekly summaries */ reports: { parentWeekly: boolean; teacherWeekly: boolean };
  qiraat: { testEveTime: string; testMorningTime: string; matnTime: string; weakDay: number; weakTime: string };
}
export interface Org { id: string; name: string; timezone: string; joinCode: string; settings: OrgSettings; role: Role; roles: Role[] }
export interface Student {
  id: string; orgId: string; userId: string | null; name: string; ageGroup: string | null; direction: Direction;
  dailyNewAyahs: number; goal: string | null; guardianName: string | null; guardianEmail: string | null; notify: boolean;
  startDate: string; archivedAt: string | null; memorized: Range[]; parentCode: string | null; oldPages: number | null; rulesAckAt: string | null;
  /** Old-revision cycle starts here (pages not revised since revisionStartOn go in page order from this page) */ revisionStartPage?: number | null; revisionStartOn?: string | null;
  /** new lesson size in pages (½–5); null = use dailyNewAyahs */ newPages?: number | null;
  /** out-of-order memorisers: where the next lesson starts, and surahs skipped for later */ nextFromSurah?: number | null; skippedSurahs?: number[];
}
export interface SessionError { id?: string; ayahId: number | null; category: ErrorCategory; severity: ErrorSeverity; note?: string | null }
export interface Session {
  id: string; orgId: string; studentId: string; date: string; type: SessionType; range: Range;
  errorsMajor: number; errorsMinor: number;
  scores: { tajweed: number | null; fluency: number | null; accuracy: number | null; tarteel: number | null; overall: number | null };
  attendance: AttendanceStatus; mode: AttendanceMode; teacherNote: string | null; studentNote: string | null; followUp: boolean;
  recordedBy: 'teacher' | 'student'; errors: SessionError[]; createdAt: string;
  /** teacher's check of revision the student logged */ checkStatus?: 'ok' | 'redo' | null; checkedAt?: string | null; checkNote?: string | null; selfLogged?: boolean; partnerStudentId?: string | null; partnerStatus?: 'pending' | 'confirmed' | null;
}
export interface RevisionItem { page: number; lastReviewedOn: string | null; intervalDays: number; lapses: number; dueOn: string }
export interface Assignment {
  id: string; studentId: string; type: AssignmentType; range: Range | null; dueOn: string; priority: 1 | 2 | 3;
  instructions: string | null; status: AssignmentStatus; feedback: string | null; createdAt: string;
}
export interface Milestone { code: string; achievedOn: string }

export const DEFAULT_SETTINGS: OrgSettings = {
  scoreScale: 5,
  revision: { recentDays: 7, maxIntervalDays: 30, weakThreshold: 2, failThreshold: 3, dailyOldPages: null, maxOverdueBeforeNew: null, oldPlan: 'spaced', days: [0, 1, 2, 3, 4, 5, 6], remind: true, reminderTime: '15:00', logRemind: true, logReminderTime: '20:30', teacherNotify: 'daily' },
  accuracy: { major: 10, minor: 3 },
  email: { enabled: true, onSession: true, lowRevision: true, weekly: false },
  leaderboard: { enabled: false, fullNames: false },
  motivation: { freezePerWeek: 1 },
  adab: { positive: ['On time', 'Focused', 'Good manners', 'Prepared', 'Helped others'], negative: ['Late', 'Not prepared', 'Distracted'] },
  fees: { monthly: null, currency: 'USD' },
  attendance: { semesterStart: null, semesterEnd: null, freeAbsences: 1, excusedAbsences: 2 },
  revisionForm: { slots: [{ key: 'after_lesson', label: 'After the lesson at the mosque', day: null }, { key: 'wed', label: 'Wednesday night', day: 3 }, { key: 'fri', label: 'Friday night', day: 5 }], allowedMisses: 1 },
  rulesText: DEFAULT_RULES,
  parentsEnabled: true,
  reports: { parentWeekly: true, teacherWeekly: true },
  qiraat: { testEveTime: '18:00', testMorningTime: '08:00', matnTime: '07:30', weakDay: 5, weakTime: '17:00' },
};
export const SESSION_LABEL: Record<SessionType, string> = {
  new: 'New lesson', recent: 'Recent revision', old: 'Old revision', juz_revision: 'Full juz revision', assessment: 'Assessment', catch_up: 'Catch-up', review: 'Review', other: 'Other',
};
export const ERROR_LABEL: Record<ErrorCategory, string> = {
  forgot_ayah: 'Forgot ayah', added_missed_word: 'Added / missed word', word_substitution: 'Word substitution', similar_ayah: 'Similar ayah confusion',
  tajweed: 'Tajweed', makharij: 'Makharij', harakah: 'Harakah', madd: 'Madd', ghunnah: 'Ghunnah', waqf_ibtida: 'Waqf / ibtidaʾ', fluency: 'Fluency', other: 'Other',
};
