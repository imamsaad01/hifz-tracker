// Full history for one student (all dates), plus milestones. RLS decides whether the caller may see it.
import { useCallback, useEffect, useState } from 'react';
import { useRefresh } from '../components/PullToRefresh';
import { useOrg } from './context';
import type { Milestone, Session } from '../lib/types';
import { friendly } from '../api/backend';
const cache = new Map<string, { sessions: Session[]; milestones: Milestone[] }>();
export function useStudentData(studentId: string | null) {
  const { api, org, backend, user } = useOrg();
  const ck = `${user?.id ?? ''}:${studentId ?? ''}`;
  const [sessions, setSessions] = useState<Session[] | null>(() => (studentId ? cache.get(ck)?.sessions ?? null : null));
  const [milestones, setMilestones] = useState<Milestone[]>(() => (studentId ? cache.get(ck)?.milestones ?? [] : []));
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!studentId) return;
    try { setError(null); const [s, m] = await Promise.all([api.sessions(org.id, { studentId, limit: 5000 }), api.milestones(org.id, studentId)]); cache.set(ck, { sessions: s, milestones: m }); setSessions(s); setMilestones(m); }
    catch (e) { if (!cache.has(ck)) setError(friendly(e)); }
  }, [api, org.id, studentId, ck]);
  // switching to another student: show their cached data (or nothing) at once, never the previous student's
  useEffect(() => { const c = cache.get(ck); setSessions(c?.sessions ?? null); setMilestones(c?.milestones ?? []); }, [ck]);
  useEffect(() => { reload(); }, [reload]);
  useRefresh(reload);
  useEffect(() => backend.subscribe?.(['sessions', 'milestones'], reload), [backend, reload]);
  return { sessions, milestones, error, reload };
}
