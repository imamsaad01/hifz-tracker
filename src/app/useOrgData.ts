// Loads what a teacher's screens need for one organization, with live refresh and a reload function.
import { useCallback, useEffect, useState } from 'react';
import { useRefresh } from '../components/PullToRefresh';
import { useOrg } from './context';
import type { Assignment, RevisionItem, Session, Student } from '../lib/types';
import type { Attendance, ClassRow, Goal, Member, Announcement, BehaviourPoint, CalEvent, Exam, AbsenceRequest, RevisionCheckin, JoinRequest } from '../api/data';
import { addDays } from '../lib/dates';
import { friendly } from '../api/backend';

export interface OrgData { students: Student[]; sessions: Session[]; revision: Map<string, RevisionItem[]>; assignments: Assignment[]; attendance: Attendance[]; classes: ClassRow[]; goals: Goal[]; members: Member[]; announcements: Announcement[]; behaviour: BehaviourPoint[]; events: CalEvent[]; exams: Exam[]; absences: AbsenceRequest[]; revisionForms: RevisionCheckin[]; joinRequests: JoinRequest[] }
export function useOrgData(opts: { days?: number } = {}) {
  const { api, org, today, backend } = useOrg();
  const [data, setData] = useState<OrgData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const since = addDays(today, -(opts.days ?? 60));
  const reload = useCallback(async () => {
    try {
      setError(null);
      const [students, sessions, revision, assignments, attendance, classes, goals, members, announcements, behaviour, events, exams, absences, revisionForms, joinRequests] = await Promise.all([
        api.students(org.id), api.sessions(org.id, { since }), api.revision(org.id), api.assignments(org.id), api.attendance(org.id, since), api.classes(org.id), api.goals(org.id), api.members(org.id),
        api.announcements(org.id), api.behaviour(org.id, since), api.events(org.id), api.exams(org.id), api.absenceRequests(org.id), api.revisionCheckins(org.id, addDays(today, -63)), api.joinRequests(org.id).catch(() => []),
      ]);
      setData({ students, sessions, revision, assignments, attendance, classes, goals, members, announcements, behaviour, events, exams, absences, revisionForms, joinRequests });
    } catch (e) { setError(friendly(e)); }
  }, [api, org.id, since]);
  useEffect(() => { reload(); }, [reload]);
  useRefresh(reload);
  useEffect(() => backend.subscribe?.(['sessions', 'students', 'assignments', 'announcements', 'attendance', 'absence_requests', 'revision_checkins', 'class_join_requests', 'class_students'], reload), [backend, reload]);
  return { data, error, reload };
}
