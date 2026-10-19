// Typed reads and writes. Screens call these; these call the Backend. No screen builds queries itself.
import type { Backend, Filter } from './backend';
import { DEFAULT_SETTINGS, type Assignment, type AssignmentStatus, type AssignmentType, type Milestone, type Org, type OrgSettings, type RevisionItem, type Role, type Session, type SessionError, type Student } from '../lib/types';
import type { Range } from '../quran';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface Membership { orgId: string; role: Role; displayName: string | null }
export interface Member { userId: string; role: Role; displayName: string | null; createdAt: string }
export interface ClassRow { id: string; name: string; teacherUserId: string | null; schedule: string | null; startsOn: string | null; endsOn: string | null; notes: string | null; studentIds: string[] }
export interface Attendance { studentId: string; date: string; status: string; mode: string }
export interface Goal { id: string; studentId: string; period: string; metric: string; target: number; startsOn: string; endsOn: string | null }
export interface Notice { id: string; studentId: string | null; to: string | null; template: string | null; status: string; error: string | null; createdAt: string }
export interface BoardRow { studentId: string; name: string; days: number; pages: number; clean: number; points: number; isMe: boolean }
export interface AuditRow { id: number; actor: string | null; action: string; entity: string; entityId: string | null; at: string }

export function mergeSettings(s: Row | null | undefined): OrgSettings {
  const x = s ?? {};
  return {
    scoreScale: Number(x.scoreScale ?? DEFAULT_SETTINGS.scoreScale),
    revision: { ...DEFAULT_SETTINGS.revision, ...(x.revision ?? {}) },
    accuracy: { ...DEFAULT_SETTINGS.accuracy, ...(x.accuracy ?? {}) },
    email: { ...DEFAULT_SETTINGS.email, ...(x.email ?? {}) },
    leaderboard: { ...DEFAULT_SETTINGS.leaderboard, ...(x.leaderboard ?? {}) },
  };
}
const toStudent = (r: Row, ranges: Range[] = []): Student => ({
  id: r.id, orgId: r.org_id, userId: r.user_id, name: r.name, ageGroup: r.age_group, direction: r.direction, dailyNewAyahs: r.daily_new_ayahs,
  goal: r.goal, guardianName: r.guardian_name, guardianEmail: r.guardian_email, notify: r.notify, startDate: String(r.start_date).slice(0, 10), archivedAt: r.archived_at, memorized: ranges, parentCode: r.parent_code ?? null,
});
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const toSession = (r: Row, errs: SessionError[] = []): Session => ({
  id: r.id, orgId: r.org_id, studentId: r.student_id, date: iso(r.date), type: r.type, range: { start: r.start_ayah_id, end: r.end_ayah_id },
  errorsMajor: r.errors_major, errorsMinor: r.errors_minor,
  scores: { tajweed: num(r.score_tajweed), fluency: num(r.score_fluency), accuracy: num(r.score_accuracy), tarteel: num(r.score_tarteel), overall: num(r.score_overall) },
  attendance: r.attendance, mode: r.mode, teacherNote: r.teacher_note, studentNote: r.student_note, followUp: r.follow_up, recordedBy: r.recorded_by, errors: errs, createdAt: String(r.created_at),
});

export function api(be: Backend) {
  const sel = be.select.bind(be);
  return {
    backend: be,
    async memberships(userId: string): Promise<Membership[]> {
      const rows = await sel<Row>({ table: 'organization_members', where: [{ op: 'eq', col: 'user_id', value: userId }] });
      return rows.map(r => ({ orgId: r.org_id, role: r.role, displayName: r.display_name }));
    },
    async org(orgId: string, role: Role): Promise<Org> {
      const [r] = await sel<Row>({ table: 'organizations', columns: 'id,name,timezone,join_code,settings', where: [{ op: 'eq', col: 'id', value: orgId }] });
      return { id: r.id, name: r.name, timezone: r.timezone, joinCode: r.join_code, settings: mergeSettings(r.settings), role };
    },
    async leaderboard(orgId: string, days: number): Promise<BoardRow[]> {
      const rows = await be.rpc<Row[]>('class_leaderboard', { org: orgId, p_days: days });
      return (rows ?? []).map(r => ({ studentId: r.student_id, name: r.display_name, days: Number(r.days_active), pages: Number(r.pages_revised), clean: Number(r.clean_pages), points: Number(r.points), isMe: !!r.is_me }));
    },
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
      return rows.map(r => ({ id: r.id, studentId: r.student_id, type: r.type, range: r.start_ayah_id ? { start: r.start_ayah_id, end: r.end_ayah_id } : null, dueOn: iso(r.due_on), priority: r.priority, instructions: r.instructions, status: r.status, feedback: r.feedback, createdAt: String(r.created_at) }));
    },
    async attendance(orgId: string, since: string): Promise<Attendance[]> {
      const rows = await sel<Row>({ table: 'attendance', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'gte', col: 'date', value: since }] });
      return rows.map(r => ({ studentId: r.student_id, date: iso(r.date), status: r.status, mode: r.mode }));
    },
    async classes(orgId: string): Promise<ClassRow[]> {
      const [rows, links] = await Promise.all([
        sel<Row>({ table: 'classes', where: [{ op: 'eq', col: 'org_id', value: orgId }, { op: 'is', col: 'archived_at', value: null }], order: [['name', 'asc']] }),
        sel<Row>({ table: 'class_students', where: [{ op: 'eq', col: 'org_id', value: orgId }] }),
      ]);
      return rows.map(r => ({ id: r.id, name: r.name, teacherUserId: r.teacher_user_id, schedule: r.schedule, startsOn: r.starts_on ? iso(r.starts_on) : null, endsOn: r.ends_on ? iso(r.ends_on) : null, notes: r.notes, studentIds: links.filter(l => l.class_id === r.id).map(l => l.student_id) }));
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
      return (await sel<Row>({ table: 'organization_members', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['created_at', 'asc']] })).map(r => ({ userId: r.user_id, role: r.role, displayName: r.display_name, createdAt: String(r.created_at) }));
    },
    async notifications(orgId: string): Promise<Notice[]> {
      return (await sel<Row>({ table: 'notifications', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['created_at', 'desc']], limit: 100 })).map(r => ({ id: r.id, studentId: r.student_id, to: r.to_address, template: r.template, status: r.status, error: r.error, createdAt: String(r.created_at) }));
    },
    async audit(orgId: string): Promise<AuditRow[]> {
      return (await sel<Row>({ table: 'audit_logs', where: [{ op: 'eq', col: 'org_id', value: orgId }], order: [['at', 'desc']], limit: 200 })).map(r => ({ id: Number(r.id), actor: r.actor, action: r.action, entity: r.entity, entityId: r.entity_id, at: String(r.at) }));
    },

    // ---------------------------------------------------------------- writes
    createOrg: (name: string, timezone: string, displayName: string) => be.rpc<string>('create_organization', { p_name: name, p_timezone: timezone, p_display_name: displayName }),
    joinOrg: (code: string, displayName: string) => be.rpc<{ org_id: string; role: Role }>('join_organization', { p_code: code, p_display_name: displayName }),
    regenerateCodes: (orgId: string) => be.rpc<null>('regenerate_codes', { org: orgId }),
    createStudent: (p: { orgId: string; forSelf: boolean; name: string; ageGroup: string; direction: string; dailyNewAyahs: number; goal: string; guardianName: string; guardianEmail: string; notify: boolean; memorized: Range[] }) =>
      be.rpc<string>('create_student', { p: { org_id: p.orgId, for_self: p.forSelf, name: p.name, age_group: p.ageGroup, direction: p.direction, daily_new_ayahs: p.dailyNewAyahs, goal: p.goal, guardian_name: p.guardianName, guardian_email: p.guardianEmail, notify: p.notify, memorized: p.memorized.map(r => [r.start, r.end]) } }),
    updateStudent: (id: string, patch: Partial<{ parent_code: string; name: string; age_group: string; daily_new_ayahs: number; goal: string; guardian_name: string; guardian_email: string | null; notify: boolean; direction: string; archived_at: string | null }>) =>
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
      const n = await be.update('attendance', { status, mode }, [{ op: 'eq', col: 'student_id', value: studentId }, { op: 'eq', col: 'date', value: date }]);
      if (!n) await be.insert('attendance', { org_id: orgId, student_id: studentId, date, status, mode });
    },
    createClass: (orgId: string, p: { name: string; teacherUserId: string | null; schedule: string; startsOn: string | null; notes: string }) =>
      be.insert<Row>('classes', { org_id: orgId, name: p.name, teacher_user_id: p.teacherUserId, schedule: p.schedule || null, starts_on: p.startsOn, notes: p.notes || null }),
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
