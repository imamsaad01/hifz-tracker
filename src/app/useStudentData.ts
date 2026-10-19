// Full history for one student (all dates), plus milestones. RLS decides whether the caller may see it.
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from './context';
import type { Milestone, Session } from '../lib/types';
import { friendly } from '../api/backend';
export function useStudentData(studentId: string | null) {
  const { api, org, backend } = useOrg();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!studentId) return;
    try { setError(null); const [s, m] = await Promise.all([api.sessions(org.id, { studentId, limit: 5000 }), api.milestones(org.id, studentId)]); setSessions(s); setMilestones(m); }
    catch (e) { setError(friendly(e)); }
  }, [api, org.id, studentId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => backend.subscribe?.(['sessions', 'milestones'], reload), [backend, reload]);
  return { sessions, milestones, error, reload };
}
