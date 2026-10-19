// Loads what a teacher's screens need for one organization, with live refresh and a reload function.
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from './context';
import type { Assignment, RevisionItem, Session, Student } from '../lib/types';
import type { Attendance, ClassRow, Goal, Member } from '../api/data';
import { addDays } from '../lib/dates';
import { friendly } from '../api/backend';

export interface OrgData { students: Student[]; sessions: Session[]; revision: Map<string, RevisionItem[]>; assignments: Assignment[]; attendance: Attendance[]; classes: ClassRow[]; goals: Goal[]; members: Member[] }
export function useOrgData(opts: { days?: number } = {}) {
  const { api, org, today, backend } = useOrg();
  const [data, setData] = useState<OrgData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const since = addDays(today, -(opts.days ?? 60));
  const reload = useCallback(async () => {
    try {
      setError(null);
      const [students, sessions, revision, assignments, attendance, classes, goals, members] = await Promise.all([
        api.students(org.id), api.sessions(org.id, { since }), api.revision(org.id), api.assignments(org.id), api.attendance(org.id, since), api.classes(org.id), api.goals(org.id), api.members(org.id),
      ]);
      setData({ students, sessions, revision, assignments, attendance, classes, goals, members });
    } catch (e) { setError(friendly(e)); }
  }, [api, org.id, since]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => backend.subscribe?.(['sessions', 'students', 'assignments'], reload), [backend, reload]);
  return { data, error, reload };
}
