// Typed reads and writes. Screens call these; these call the Backend. No screen builds queries itself.
import type { Backend, Filter } from './backend';
import { DEFAULT_SETTINGS, type Assignment, type AssignmentStatus, type AssignmentType, type Milestone, type Org, type OrgSettings, type RevisionItem, type Role, type Session, type SessionError, type Student } from '../lib/types';
import type { Range } from '../quran';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface Membership { orgId: string; role: Role; extraRoles: Role[]; displayName: string | null }
export interface Member { userId: string; role: Role; extraRoles: Role[]; displayName: string | null; createdAt: string }
export interface Slot { day: number; start: string; end: string }
export interface ClassRow { id: string; name: string; teacherUserId: string | null; schedule: string | null; startsOn: string | null; endsOn: string | null; notes: string | null; studentIds: string[];
  slots: Slot[]; location: 'mosque' | 'online' | 'both'; checkinOpenMin: number; lateAfterMin: number; requireCode: boolean }
export interface AbsenceRequest { id: string; studentId: string; date: string; kind: 'free' | 'excuse'; reason: string | null; status: 'pending' | 'approved' | 'declined'; createdAt: string }
export interface JoinRequest { id: string; classId: string; studentId: string; status: 'pending' | 'approved' | 'declined' | 'cancelled'; note: string | null; createdAt: string; decidedAt: string | null }
export interface QiraatProfile { studentId: string; active: boolean; riwayat: string[]; mode: 'ifrad' | 'jam'; matn: string | null; matnDailyLines: number; classGoal: string | null }
export interface QiraatMistake { text: string; riwayah?: string | null }
export interface QiraatTest { id: string; studentId: string; kind: 'farsh' | 'usul'; surah: number | null; bab: string | null; title: string; riwayat: string[]; scheduledOn: string | null; takenOn: string | null; status: 'scheduled' | 'done'; result: string | null; mistakes: QiraatMistake[]; note: string | null; createdAt: string }
export interface KhatmahMark { studentId: string; track: string; surah: number; doneOn: string }
export interface MatnEntry { id: string; studentId: string; matn: string; lineFrom: number; lineTo: number; kind: 'memorised' | 'recited'; date: string }
export interface QiraatData { profiles: QiraatProfile[]; tests: QiraatTest[]; khatmah: KhatmahMark[]; matn: MatnEntry[] }
export interface RevisionCheckin { id: string; studentId: string; weekStart: string; slot: string; done: boolean; partner: string | null; pages: string | null; recorded: boolean; recordingLink: string | null; note: string | null }
export interface Standing { absences: number; free: number; extra: number; unnotified: number; excused: number; over: number }
export interface Attendance { studentId: string; date: string; status: string; mode: string; source?: string; checkedInAt?: string | null; note?: string | null }
export interface Goal { id: string; studentId: string; period: string; metric: string; target: number; startsOn: string; endsOn: string | null }
export interface Notice { id: string; studentId: string | null; to: string | null; template: string | null; status: string; error: string | null; createdAt: string }
export interface BoardRow { studentId: string; name: string; days: number; pages: number; clean: number; points: number; isMe: boolean }
export interface Announcement { id: string; classId: string | null; title: string; body: string | null; pinned: boolean; createdBy: string | null; createdAt: string }
export interface Message { id: string; studentId: string; sender: string; senderName: string | null; body: string; createdAt: string }
export interface BehaviourPoint { id: string; studentId: string; date: string; category: string; value: number; note: string | null; createdAt: string }
export interface CalEvent { id: string; classId: string | null; startsOn: string; endsOn: string | null; title: string; kind: 'class' | 'holiday' | 'exam' | 'event'; notes: string | null }
export interface Exam { id: string; studentId: string; title: string; juz: number | null; range: Range | null; scheduledOn: string; examiner: string | null; status: 'scheduled' | 'passed' | 'retake' | 'missed'; score: number | null; notes: string | null }
export interface Application { id: string; name: string; ageGroup: string | null; contact: string; memorised: string | null; message: string | null; status: 'new' | 'contacted' | 'accepted' | 'declined'; createdAt: string }
export interface FeeRecord { id: string; studentId: string; month: string; amount: number; paidOn: string | null; method: string | null; note: string | null }
export interface AuditRow { id: number; actor: string | null; action: string; entity: string; entityId: string | null; at: string }

export function mergeSettings(s: Row | null | undefined): OrgSettings {
  const x = s ?? {};
  return {
    scoreScale: Number(x.scoreScale ?? DEFAULT_SETTINGS.scoreScale),
    revision: { ...DEFAULT_SETTINGS.revision, ...(x.revision ?? {}) },
    accuracy: { ...DEFAULT_SETTINGS.accuracy, ...(x.accuracy ?? {}) },
    email: { ...DEFAULT_SETTINGS.email, ...(x.email ?? {}) },
    leaderboard: { ...DEFAULT_SETTINGS.leaderboard, ...(x.leaderboard ?? {}) },
    motivation: { ...DEFAULT_SETTINGS.motivation, ...(x.motivation ?? {}) },
    adab: { ...DEFAULT_SETTINGS.adab, ...(x.adab ?? {}) },
    fees: { ...DEFAULT_SETTINGS.fees, ...(x.fees ?? {}) },
    attendance: { ...DEFAULT_SETTINGS.attendance, ...(x.attendance ?? {}) },
    revisionForm: { ...DEFAULT_SETTINGS.revisionForm, ...(x.revisionForm ?? {}) },
    rulesText: typeof x.rulesText === 'string' ? x.rulesText : DEFAULT_SETTINGS.rulesText,
    qiraat: { ...DEFAULT_SETTINGS.qiraat, ...(x.qiraat ?? {}) },
  };
}
const toStudent = (r: Row, ranges: Range[] = []): Student => ({
  id: r.id, orgId: r.org_id, userId: r.user_id, name: r.name, ageGroup: r.age_group, direction: r.direction, dailyNewAyahs: r.daily_new_ayahs,
  goal: r.goal, guardianName: r.guardian_name, guardianEmail: r.guardian_email, notify: r.notify, startDate: String(r.start_date).slice(0, 10), archivedAt: r.archived_at, memorized: ranges, parentCode: r.parent_code ?? null, oldPages: r.old_pages ?? null, rulesAckAt: r.rules_ack_at ? ts(r.rules_ack_at) : null, revisionStartPage: r.revision_start_page ?? null, newPages: r.new_pages === null || r.new_pages === undefined ? null : Number(r.new_pages), nextFromSurah: r.next_from_surah ?? null, skippedSurahs: pgArr(r.skipped_surahs).map(Number), revisionStartOn: r.revision_start_on ? iso(r.revision_start_on) : null,
});
/** Postgres arrays of enums can arrive as '{a,b}' text */
const pgArr = (v: unknown): any[] => Array.isArray(v) ? v : typeof v === 'string' ? v.replace(/^\{|\}$/g, '').split(',').filter(Boolean) : [];
const ts = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d));
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const toSession = (r: Row, errs: SessionError[] = []): Session => ({
  id: r.id, orgId: r.org_id, studentId: r.student_id, date: iso(r.date), type: r.type, range: { start: r.start_ayah_id, end: r.end_ayah_id },
  errorsMajor: r.errors_major, errorsMinor: r.errors_minor,
  scores: { tajweed: num(r.score_tajweed), fluency: num(r.score_fluency), accuracy: num(r.score_accuracy), tarteel: num(r.score_tarteel), overall: num(r.score_overall) },
  attendance: r.attendance, mode: r.mode, teacherNote: r.teacher_note, studentNote: r.student_note, followUp: r.follow_up, recordedBy: r.recorded_by, errors: errs, createdAt: ts(r.created_at), checkStatus: r.check_status ?? null, checkedAt: r.checked_at ? ts(r.checked_at) : null, checkNote: r.check_note ?? null, selfLogged: !!r.self_logged,
});

export function api(be: Backend) {
  const sel = be.select.bind(be);
  return {
    backend: be,
    async memberships(userId: string): Promise<Membership[]> {
      const rows = await sel<Row>({ table: 'organization_members', where: [{ op: 'eq', col: 'user_id', value: userId }] });
      return rows.map(r => ({ orgId: r.org_id, role: r.role, extraRoles: pgArr(r.extra_roles), displayName: r.display_name }));
    },
    async org(orgId: string, role: Role, roles: Role[] = [role]): Promise<Org> {
      const [r] = await sel<Row>({ table: 'organizations', columns: 'id,name,timezone,join_code,settings', where: [{ op: 'eq', col: 'id', value: orgId }] });
      return { id: r.id, name: r.name, timezone: r.timezone, joinCode: r.join_code, settings: mergeSettings(r.settings), role, roles };
    },
    async leaderboard(orgId: string, days: number): Promise<BoardRow[]> {
      const rows = await be.rpc<Row[]>('class_leaderboard', { org: orgId, p_days: days });
      return (rows ?? []).map(r => ({ studentId: r.student_id, name: r.display_name, days: Number(r.days_active), pages: Number(r.pages_revised), clean: Number(r.clean_pages), points: Number(r.points), isMe: !!r.is_me }));
    },
    async announcements(orgId: string): Promise<Announcement[]> {
      return (await sel<Row>({ table: 'announcements', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['pinned', 'desc'], ['created_at', 'desc']], limit: 100 }))
        .map(r => ({ id: r.id, classId: r.class_id, title: r.title, body: r.body, pinned: r.pinned, createdBy: r.created_by, createdAt: ts(r.created_at) }));
    },
    addAnnouncement: (orgId: string, p: { classId: string | null; title: string; body: string; pinned: boolean }) => be.insert('announcements', { org_id: orgId, class_id: p.classId, title: p.title, body: p.body || null, pinned: p.pinned }),
    removeAnnouncement: (id: string) => be.remove('announcements', [{ op: 'eq', col: 'id', value: id }]),
    async messages(orgId: string, opts: { studentId?: string; since?: string } = {}): Promise<Message[]> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }];
      if (opts.studentId) where.push({ op: 'eq', col: 'student_id', value: opts.studentId });
      if (opts.since) where.push({ op: 'gte', col: 'created_at', value: opts.since });
      return (await sel<Row>({ table: 'messages', where, order: [['created_at', 'asc']], limit: 1000 }))
        .map(r => ({ id: r.id, studentId: r.student_id, sender: r.sender, senderName: r.sender_name, body: r.body, createdAt: ts(r.created_at) }));
    },
    sendMessage: (orgId: string, studentId: string, body: string, senderName: string) => be.insert('messages', { org_id: orgId, student_id: studentId, body, sender_name: senderName }),
    async behaviour(orgId: string, since: string, studentId?: string): Promise<BehaviourPoint[]> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'gte', col: 'date', value: since }];
      if (studentId) where.push({ op: 'eq', col: 'student_id', value: studentId });
      return (await sel<Row>({ table: 'behaviour_points', where, order: [['created_at', 'desc']], limit: 3000 }))
        .map(r => ({ id: r.id, studentId: r.student_id, date: iso(r.date), category: r.category, value: Number(r.value), note: r.note, createdAt: ts(r.created_at) }));
    },
    addBehaviour: (orgId: string, studentId: string, date: string, category: string, value: 1 | -1) => be.insert('behaviour_points', { org_id: orgId, student_id: studentId, date, category, value }),
    removeBehaviour: (id: string) => be.remove('behaviour_points', [{ op: 'eq', col: 'id', value: id }]),
    async events(orgId: string): Promise<CalEvent[]> {
      return (await sel<Row>({ table: 'events', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['starts_on', 'asc']], limit: 1000 }))
        .map(r => ({ id: r.id, classId: r.class_id, startsOn: iso(r.starts_on), endsOn: r.ends_on ? iso(r.ends_on) : null, title: r.title, kind: r.kind, notes: r.notes }));
    },
    addEvent: (orgId: string, p: { classId: string | null; startsOn: string; endsOn: string | null; title: string; kind: string; notes: string }) => be.insert('events', { org_id: orgId, class_id: p.classId, starts_on: p.startsOn, ends_on: p.endsOn, title: p.title, kind: p.kind, notes: p.notes || null }),
    removeEvent: (id: string) => be.remove('events', [{ op: 'eq', col: 'id', value: id }]),
    async exams(orgId: string): Promise<Exam[]> {
      return (await sel<Row>({ table: 'exams', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['scheduled_on', 'asc']], limit: 2000 }))
        .map(r => ({ id: r.id, studentId: r.student_id, title: r.title, juz: r.juz, range: r.start_ayah_id ? { start: r.start_ayah_id, end: r.end_ayah_id } : null, scheduledOn: iso(r.scheduled_on), examiner: r.examiner, status: r.status, score: num(r.score), notes: r.notes }));
    },
    addExam: (orgId: string, p: { studentId: string; title: string; juz: number | null; range: Range | null; scheduledOn: string; examiner: string }) => be.insert('exams', { org_id: orgId, student_id: p.studentId, title: p.title, juz: p.juz, start_ayah_id: p.range?.start ?? null, end_ayah_id: p.range?.end ?? null, scheduled_on: p.scheduledOn, examiner: p.examiner || null }),
    updateExam: (id: string, patch: { status?: string; score?: number | null; notes?: string | null; scheduled_on?: string }) => be.update('exams', patch, [{ op: 'eq', col: 'id', value: id }]),
    removeExam: (id: string) => be.remove('exams', [{ op: 'eq', col: 'id', value: id }]),
    async applications(orgId: string): Promise<Application[]> {
      return (await sel<Row>({ table: 'applications', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['created_at', 'desc']], limit: 500 }))
        .map(r => ({ id: r.id, name: r.name, ageGroup: r.age_group, contact: r.contact, memorised: r.memorised, message: r.message, status: r.status, createdAt: ts(r.created_at) }));
    },
    setApplicationStatus: (id: string, status: string) => be.update('applications', { status }, [{ op: 'eq', col: 'id', value: id }]),
    programPublicName: (orgId: string) => be.rpc<string | null>('program_public_name', { p_org: orgId }),
    submitApplication: (orgId: string, p: { name: string; age_group: string; contact: string; memorised: string; message: string }) => be.rpc<boolean>('submit_application', { p_org: orgId, p }),
    async fees(orgId: string, month: string): Promise<FeeRecord[]> {
      return (await sel<Row>({ table: 'fee_records', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'eq', col: 'month', value: month }] }))
        .map(r => ({ id: r.id, studentId: r.student_id, month: r.month, amount: Number(r.amount), paidOn: r.paid_on ? iso(r.paid_on) : null, method: r.method, note: r.note }));
    },
    saveFee: async (orgId: string, p: { studentId: string; month: string; amount: number; paidOn: string | null; method: string | null }) => {
      const n = await be.update('fee_records', { amount: p.amount, paid_on: p.paidOn, method: p.method }, [{ op: 'eq', col: 'student_id', value: p.studentId }, { op: 'eq', col: 'month', value: p.month }]);
      if (!n) await be.insert('fee_records', { org_id: orgId, student_id: p.studentId, month: p.month, amount: p.amount, paid_on: p.paidOn, method: p.method });
    },
    checkIn: (classId: string, code: string, mode: string) => be.rpc<string>('student_check_in', { p_class: classId, p_code: code, p_mode: mode }),
    checkinCode: (classId: string) => be.rpc<string>('class_checkin_code', { p_class: classId }),
    requestAbsence: (p: { studentId: string; date: string; kind: 'free' | 'excuse'; reason: string }) => be.rpc<string>('request_absence', { p: { student_id: p.studentId, date: p.date, kind: p.kind, reason: p.reason } }),
    async absenceRequests(orgId: string): Promise<AbsenceRequest[]> {
      return (await sel<Row>({ table: 'absence_requests', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['date', 'desc']], limit: 1000 }))
        .map(r => ({ id: r.id, studentId: r.student_id, date: iso(r.date), kind: r.kind, reason: r.reason, status: r.status, createdAt: ts(r.created_at) }));
    },
    decideAbsence: (id: string, status: 'approved' | 'declined') => be.update('absence_requests', { status, decided_at: new Date().toISOString() }, [{ op: 'eq', col: 'id', value: id }]),
    async qiraat(orgId: string): Promise<QiraatData> {
      const w = [{ op: 'eq' as const, col: 'org_id', value: orgId }];
      const [p, t, k, m] = await Promise.all([
        sel<Row>({ table: 'qiraat_profiles', where: w, limit: 2000 }),
        sel<Row>({ table: 'qiraat_tests', where: w, order: [['created_at', 'desc']], limit: 3000 }),
        sel<Row>({ table: 'qiraat_khatmah', where: w, limit: 5000 }),
        sel<Row>({ table: 'qiraat_matn_log', where: w, order: [['date', 'desc']], limit: 3000 }),
      ]);
      const js = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v ?? []) as QiraatMistake[];
      return {
        profiles: p.map(r => ({ studentId: r.student_id, active: r.active, riwayat: pgArr(r.riwayat), mode: r.mode, matn: r.matn, matnDailyLines: r.matn_daily_lines, classGoal: r.class_goal ?? null })),
        tests: t.map(r => ({ id: r.id, studentId: r.student_id, kind: r.kind, surah: r.surah, bab: r.bab, title: r.title, riwayat: pgArr(r.riwayat), scheduledOn: r.scheduled_on ? iso(r.scheduled_on) : null, takenOn: r.taken_on ? iso(r.taken_on) : null, status: r.status, result: r.result, mistakes: js(r.mistakes), note: r.note, createdAt: ts(r.created_at) })),
        khatmah: k.map(r => ({ studentId: r.student_id, track: r.track, surah: r.surah, doneOn: iso(r.done_on) })),
        matn: m.map(r => ({ id: r.id, studentId: r.student_id, matn: r.matn, lineFrom: r.line_from, lineTo: r.line_to, kind: r.kind, date: iso(r.date) })),
      };
    },
    setQiraat: (studentId: string, p: { active: boolean; riwayat: string[]; mode: 'ifrad' | 'jam'; matn: string | null; matnDailyLines: number; classGoal?: string | null }) =>
      be.rpc<null>('set_qiraat_profile', { p_student: studentId, p: { active: p.active, riwayat: p.riwayat, mode: p.mode, matn: p.matn ?? '', matn_daily_lines: p.matnDailyLines, class_goal: p.classGoal ?? '' } }),
    saveQiraatTest: (t: { id?: string; studentId: string; kind: 'farsh' | 'usul'; surah: number | null; bab: string | null; title: string; riwayat: string[]; scheduledOn: string | null; result: string | null; mistakes: QiraatMistake[]; note: string; takenOn?: string | null }) =>
      be.rpc<string>('save_qiraat_test', { p: { id: t.id ?? '', student_id: t.studentId, kind: t.kind, surah: t.surah, bab: t.bab, title: t.title, riwayat: t.riwayat, scheduled_on: t.scheduledOn ?? '', result: t.result ?? '', mistakes: t.mistakes, note: t.note, taken_on: t.takenOn ?? '' } }),
    removeQiraatTest: (id: string) => be.remove('qiraat_tests', [{ op: 'eq', col: 'id', value: id }]),
    setKhatmah: async (orgId: string, studentId: string, track: string, surahs: number[], on: boolean) => {
      for (const surah of surahs) {
        if (on) await be.insert('qiraat_khatmah', { org_id: orgId, student_id: studentId, track, surah }).catch(e => { if (!/duplicate|unique/i.test(String((e as Error).message))) throw e; });
        else await be.remove('qiraat_khatmah', [{ op: 'eq', col: 'student_id', value: studentId }, { op: 'eq', col: 'track', value: track }, { op: 'eq', col: 'surah', value: surah }]);
      }
    },
    addMatn: (orgId: string, p: { studentId: string; matn: string; lineFrom: number; lineTo: number; kind: 'memorised' | 'recited'; date: string }) =>
      be.insert('qiraat_matn_log', { org_id: orgId, student_id: p.studentId, matn: p.matn, line_from: p.lineFrom, line_to: p.lineTo, kind: p.kind, date: p.date }),
    removeMatn: (id: string) => be.remove('qiraat_matn_log', [{ op: 'eq', col: 'id', value: id }]),
    async joinRequests(orgId: string): Promise<JoinRequest[]> {
      return (await sel<Row>({ table: 'class_join_requests', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['created_at', 'desc']], limit: 500 }))
        .map(r => ({ id: r.id, classId: r.class_id, studentId: r.student_id, status: r.status, note: r.note, createdAt: ts(r.created_at), decidedAt: r.decided_at ? ts(r.decided_at) : null }));
    },
    requestClassJoin: (classId: string, studentId?: string | null, note?: string) => be.rpc<string>('request_class_join', { p_class: classId, p_student: studentId ?? null, p_note: note ?? null }),
    cancelClassJoin: (id: string) => be.rpc<null>('cancel_class_join', { p_id: id }),
    decideClassJoin: (id: string, approve: boolean) => be.rpc<null>('decide_class_join', { p_id: id, p_approve: approve }),
    standing: (studentId: string) => be.rpc<Standing>('attendance_standing', { sid: studentId }),
    async revisionCheckins(orgId: string, sinceWeek: string): Promise<RevisionCheckin[]> {
      return (await sel<Row>({ table: 'revision_checkins', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'gte', col: 'week_start', value: sinceWeek }], limit: 5000 }))
        .map(r => ({ id: r.id, studentId: r.student_id, weekStart: iso(r.week_start), slot: r.slot, done: r.done, partner: r.partner, pages: r.pages, recorded: r.recorded, recordingLink: r.recording_link, note: r.note }));
    },
    saveRevisionCheckin: async (orgId: string, p: { studentId: string; weekStart: string; slot: string; done: boolean; partner: string; pages: string; recorded: boolean; recordingLink: string }) => {
      const patch = { done: p.done, partner: p.partner || null, pages: p.pages || null, recorded: p.recorded, recording_link: p.recordingLink || null };
      const n = await be.update('revision_checkins', patch, [{ op: 'eq', col: 'student_id', value: p.studentId }, { op: 'eq', col: 'week_start', value: p.weekStart }, { op: 'eq', col: 'slot', value: p.slot }]);
      if (!n) await be.insert('revision_checkins', { org_id: orgId, student_id: p.studentId, week_start: p.weekStart, slot: p.slot, ...patch });
    },
    classmates: () => be.rpc<Array<{ student_id: string; name: string; class_name: string }>>('classmates', {}),
    setMemorisedSurahs: (studentId: string, p: { surahs?: number[]; partial?: { surah: number; ayahs: number } | null; skipped?: number[]; nextFrom?: number | null; direction?: 'back' | 'forward' }) =>
      be.rpc<null>('set_memorised_surahs', { p_student: studentId, p: { ...(p.surahs ? { surahs: p.surahs } : {}), ...(p.partial ? { partial: p.partial } : {}), ...(p.skipped ? { skipped: p.skipped } : {}), ...(p.nextFrom !== undefined ? { next_from: p.nextFrom ?? '' } : {}), ...(p.direction ? { direction: p.direction } : {}) } }),
    setRevisionStart: (studentId: string, page: number | null) => be.rpc<null>('set_revision_start', { p_student: studentId, p_page: page }),
    signOff: (id: string, p: { status: 'ok' | 'redo'; errorsMajor: number; errorsMinor: number; note: string }) =>
      be.rpc<null>('sign_off_session', { p_id: id, p: { status: p.status, errors_major: p.errorsMajor, errors_minor: p.errorsMinor, note: p.note } }),
    submitLesson: (p: { studentId: string; start: number; end: number; note: string }) =>
      be.rpc<string>('submit_lesson', { p: { student_id: p.studentId, start_ayah_id: p.start, end_ayah_id: p.end, student_note: p.note } }),
    checkSessions: (ids: string[], status: 'ok' | 'redo', note?: string) => be.rpc<number>('check_sessions', { p_ids: ids, p_status: status, p_note: note ?? null }),
    ackRules: (studentId: string) => be.update('students', { rules_ack_at: new Date().toISOString() }, [{ op: 'eq', col: 'id', value: studentId }]),
    setExtraRoles: (orgId: string, userId: string, roles: Role[]) => be.update('organization_members', { extra_roles: roles }, [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'eq', col: 'user_id', value: userId }]),
    savePushSubscription: async (sub: { endpoint: string; p256dh: string; auth: string; userAgent: string }) => {
      // RLS limits this to the signed-in account's own row, so other accounts on the same phone keep theirs
      await be.remove('push_subscriptions', [{ op: 'eq', col: 'endpoint', value: sub.endpoint }]);
      await be.insert('push_subscriptions', { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_agent: sub.userAgent.slice(0, 200) });
    },
    hasPushSubscription: async (endpoint: string) => (await sel<Row>({ table: 'push_subscriptions', where: [{ op: 'eq', col: 'endpoint', value: endpoint }] })).length > 0,
    removePushSubscription: (endpoint: string) => be.remove('push_subscriptions', [{ op: 'eq', col: 'endpoint', value: endpoint }]),
    ownerPrograms: () => be.rpc<Array<{ id: string; name: string; students: number; members: number; created_at: string }>>('owner_programs', {}),
    ownerList: () => be.rpc<Array<{ email: string; added_at: string }>>('owner_list', {}),
    ownerSet: (email: string, add: boolean) => be.rpc<null>('owner_set', { p_email: email, p_add: add }),
    canCreatePrograms: () => be.rpc<boolean>('can_create_programs', {}),
    teacherCode: (orgId: string) => be.rpc<string>('teacher_code', { org: orgId }),
    async students(orgId: string, opts: { includeArchived?: boolean } = {}): Promise<Student[]> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }];
      if (!opts.includeArchived) where.push({ op: 'is', col: 'archived_at', value: null });
      const [rows, ranges] = await Promise.all([
        sel<Row>({ table: 'students', where, order: [['name', 'asc']] }),
        sel<Row>({ table: 'memorized_ranges', columns: 'student_id,start_ayah_id,end_ayah_id', where: [{ op: 'eq', col: 'org_id', value: orgId }] }),
      ]);
      const by = new Map<string, Range[]>();
      ranges.forEach(r => { const l = by.get(r.student_id) ?? []; l.push({ start: r.start_ayah_id, end: r.end_ayah_id }); by.set(r.student_id, l); });
      return rows.map(r => toStudent(r, by.get(r.id) ?? []));
    },
    async sessions(orgId: string, opts: { since?: string; studentId?: string; limit?: number } = {}): Promise<Session[]> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'is', col: 'deleted_at', value: null }];
      if (opts.since) where.push({ op: 'gte', col: 'date', value: opts.since });
      if (opts.studentId) where.push({ op: 'eq', col: 'student_id', value: opts.studentId });
      const rows = await sel<Row>({ table: 'sessions', where, order: [['date', 'desc'], ['created_at', 'desc']], limit: opts.limit ?? 1500 });
      if (!rows.length) return [];
      const errs = await sel<Row>({ table: 'session_errors', where: [{ op: 'in', col: 'session_id', value: rows.map(r => r.id) }] });
      const by = new Map<string, SessionError[]>();
      errs.forEach(e => { const l = by.get(e.session_id) ?? []; l.push({ id: e.id, ayahId: e.ayah_id, category: e.category, severity: e.severity, note: e.note }); by.set(e.session_id, l); });
      return rows.map(r => toSession(r, by.get(r.id) ?? []));
    },
    async revision(orgId: string, studentId?: string): Promise<Map<string, RevisionItem[]>> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }];
      if (studentId) where.push({ op: 'eq', col: 'student_id', value: studentId });
      const rows = await sel<Row>({ table: 'revision_items', where });
      const by = new Map<string, RevisionItem[]>();
      rows.forEach(r => { const l = by.get(r.student_id) ?? []; l.push({ page: r.page, lastReviewedOn: r.last_reviewed_on ? iso(r.last_reviewed_on) : null, intervalDays: r.interval_days, lapses: r.lapses, dueOn: iso(r.due_on) }); by.set(r.student_id, l); });
      return by;
    },
    async assignments(orgId: string, studentId?: string): Promise<Assignment[]> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }];
      if (studentId) where.push({ op: 'eq', col: 'student_id', value: studentId });
      const rows = await sel<Row>({ table: 'assignments', where, order: [['due_on', 'asc']], limit: 1000 });
      return rows.map(r => ({ id: r.id, studentId: r.student_id, type: r.type, range: r.start_ayah_id ? { start: r.start_ayah_id, end: r.end_ayah_id } : null, dueOn: iso(r.due_on), priority: r.priority, instructions: r.instructions, status: r.status, feedback: r.feedback, createdAt: ts(r.created_at) }));
    },
    async attendance(orgId: string, since: string): Promise<Attendance[]> {
      const rows = await sel<Row>({ table: 'attendance', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'gte', col: 'date', value: since }] });
      return rows.map(r => ({ studentId: r.student_id, date: iso(r.date), status: r.status, mode: r.mode, source: r.source, checkedInAt: r.checked_in_at ? ts(r.checked_in_at) : null, note: r.note }));
    },
    async classes(orgId: string): Promise<ClassRow[]> {
      const [rows, links] = await Promise.all([
        sel<Row>({ table: 'classes', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'is', col: 'archived_at', value: null }], order: [['name', 'asc']] }),
        sel<Row>({ table: 'class_students', where: [{ op: 'eq', col: 'org_id', value: orgId }] }),
      ]);
      return rows.map(r => ({ id: r.id, name: r.name, teacherUserId: r.teacher_user_id, schedule: r.schedule, startsOn: r.starts_on ? iso(r.starts_on) : null, endsOn: r.ends_on ? iso(r.ends_on) : null, notes: r.notes, studentIds: links.filter(l => l.class_id === r.id).map(l => l.student_id),
        slots: Array.isArray(r.schedule_slots) ? r.schedule_slots : (typeof r.schedule_slots === 'string' ? JSON.parse(r.schedule_slots) : []), location: r.location ?? 'mosque', checkinOpenMin: r.checkin_open_min ?? 15, lateAfterMin: r.late_after_min ?? 10, requireCode: r.require_code ?? true }));
    },
    async goals(orgId: string, studentId?: string): Promise<Goal[]> {
      const where: Filter[] = [{ op: 'eq', col: 'org_id', value: orgId }];
      if (studentId) where.push({ op: 'eq', col: 'student_id', value: studentId });
      return (await sel<Row>({ table: 'goals', where })).map(r => ({ id: r.id, studentId: r.student_id, period: r.period, metric: r.metric, target: Number(r.target), startsOn: iso(r.starts_on), endsOn: r.ends_on ? iso(r.ends_on) : null }));
    },
    async milestones(orgId: string, studentId: string): Promise<Milestone[]> {
      return (await sel<Row>({ table: 'milestones', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'eq', col: 'student_id', value: studentId }] })).map(r => ({ code: r.code, achievedOn: iso(r.achieved_on) }));
    },
    async members(orgId: string): Promise<Member[]> {
      return (await sel<Row>({ table: 'organization_members', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['created_at', 'asc']] })).map(r => ({ userId: r.user_id, role: r.role, extraRoles: pgArr(r.extra_roles), displayName: r.display_name, createdAt: ts(r.created_at) }));
    },
    async notifications(orgId: string): Promise<Notice[]> {
      return (await sel<Row>({ table: 'notifications', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['created_at', 'desc']], limit: 100 })).map(r => ({ id: r.id, studentId: r.student_id, to: r.to_address, template: r.template, status: r.status, error: r.error, createdAt: ts(r.created_at) }));
    },
    async audit(orgId: string): Promise<AuditRow[]> {
      return (await sel<Row>({ table: 'audit_logs', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['at', 'desc']], limit: 200 })).map(r => ({ id: Number(r.id), actor: r.actor, action: r.action, entity: r.entity, entityId: r.entity_id, at: ts(r.at) }));
    },

    // ---------------------------------------------------------------- writes
    createOrg: (name: string, timezone: string, displayName: string) => be.rpc<string>('create_organization', { p_name: name, p_timezone: timezone, p_display_name: displayName }),
    joinOrg: (code: string, displayName: string) => be.rpc<{ org_id: string; role: Role }>('join_organization', { p_code: code, p_display_name: displayName }),
    regenerateCodes: (orgId: string) => be.rpc<null>('regenerate_codes', { org: orgId }),
    createStudent: (p: { orgId: string; forSelf: boolean; name: string; ageGroup: string; direction: string; dailyNewAyahs: number; goal: string; guardianName: string; guardianEmail: string; notify: boolean; memorized: Range[] }) =>
      be.rpc<string>('create_student', { p: { org_id: p.orgId, for_self: p.forSelf, name: p.name, age_group: p.ageGroup, direction: p.direction, daily_new_ayahs: p.dailyNewAyahs, goal: p.goal, guardian_name: p.guardianName, guardian_email: p.guardianEmail, notify: p.notify, memorized: p.memorized.map(r => [r.start, r.end]) } }),
    updateStudent: (id: string, patch: Partial<{ new_pages: number | null; parent_code: string; old_pages: number | null; name: string; age_group: string; daily_new_ayahs: number; goal: string; guardian_name: string; guardian_email: string | null; notify: boolean; direction: string; archived_at: string | null }>) =>
      be.update('students', patch, [{ op: 'eq', col: 'id', value: id }]),
    recordSession: (p: { studentId: string; date: string; type: string; range: Range; errorsMajor: number; errorsMinor: number; errors: SessionError[]; scores: Record<string, number | null>; attendance: string; mode: string; teacherNote?: string; studentNote?: string; followUp?: boolean }) =>
      be.rpc<string>('record_session', { p: {
        student_id: p.studentId, date: p.date, type: p.type, start_ayah_id: p.range.start, end_ayah_id: p.range.end, errors_major: p.errorsMajor, errors_minor: p.errorsMinor,
        errors: p.errors.map(e => ({ ayah_id: e.ayahId, category: e.category, severity: e.severity, note: e.note ?? null })), scores: p.scores,
        attendance: p.attendance, mode: p.mode, teacher_note: p.teacherNote ?? null, student_note: p.studentNote ?? null, follow_up: p.followUp ?? false,
      } }),
    deleteSession: (id: string) => be.rpc<null>('delete_session', { p_id: id }),
    createAssignment: (orgId: string, p: { studentId: string; type: AssignmentType; range: Range | null; dueOn: string; priority: number; instructions: string }) =>
      be.insert('assignments', { org_id: orgId, student_id: p.studentId, type: p.type, start_ayah_id: p.range?.start ?? null, end_ayah_id: p.range?.end ?? null, due_on: p.dueOn, priority: p.priority, instructions: p.instructions || null }),
    setAssignmentStatus: (id: string, status: AssignmentStatus, feedback?: string) => be.rpc<null>('set_assignment_status', { p_id: id, p_status: status, p_feedback: feedback ?? null }),
    deleteAssignment: (id: string) => be.remove('assignments', [{ op: 'eq', col: 'id', value: id }]),
    saveAttendance: async (orgId: string, studentId: string, date: string, status: string, mode: string) => {
      const n = await be.update('attendance', { status, mode, source: 'teacher' }, [{ op: 'eq', col: 'student_id', value: studentId }, { op: 'eq', col: 'date', value: date }]);
      if (!n) await be.insert('attendance', { org_id: orgId, student_id: studentId, date, status, mode });
    },
    createClass: (orgId: string, p: { name: string; teacherUserId: string | null; schedule: string; startsOn: string | null; notes: string; extra?: Record<string, unknown> }) =>
      be.insert<Row>('classes', { org_id: orgId, name: p.name, teacher_user_id: p.teacherUserId, schedule: p.schedule || null, starts_on: p.startsOn, notes: p.notes || null, ...(p.extra ?? {}) }),
    updateClass: (id: string, patch: Record<string, unknown>) => be.update('classes', patch, [{ op: 'eq', col: 'id', value: id }]),
    setClassStudents: async (orgId: string, classId: string, studentIds: string[], before: string[]) => {
      for (const s of studentIds.filter(x => !before.includes(x))) await be.insert('class_students', { class_id: classId, student_id: s, org_id: orgId });
      for (const s of before.filter(x => !studentIds.includes(x))) await be.remove('class_students', [{ op: 'eq', col: 'class_id', value: classId }, { op: 'eq', col: 'student_id', value: s }]);
    },
    createGoal: (orgId: string, p: { studentId: string; period: string; metric: string; target: number; startsOn: string }) =>
      be.insert('goals', { org_id: orgId, student_id: p.studentId, period: p.period, metric: p.metric, target: p.target, starts_on: p.startsOn }),
    deleteGoal: (id: string) => be.remove('goals', [{ op: 'eq', col: 'id', value: id }]),
    updateOrg: (orgId: string, patch: { name?: string; timezone?: string; settings?: OrgSettings }) => be.update('organizations', patch as Record<string, unknown>, [{ op: 'eq', col: 'id', value: orgId }]),
    setMemberRole: (orgId: string, userId: string, role: Role) => be.update('organization_members', { role }, [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'eq', col: 'user_id', value: userId }]),
    removeMember: (orgId: string, userId: string) => be.remove('organization_members', [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'eq', col: 'user_id', value: userId }]),
    notify: (body: Record<string, unknown>) => (be.invoke ? be.invoke('notify', body) : Promise.resolve(null)),
  };
}
export type Api = ReturnType<typeof api>;
