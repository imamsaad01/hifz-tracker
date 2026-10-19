// Who is signed in, which organization they are in, and their role. Loads once; screens read it.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser, Backend } from '../api/backend';
import { api, type Api, type Membership } from '../api/data';
import type { Org } from '../lib/types';
import { todayIn } from '../lib/dates';

interface Ctx {
  backend: Backend; api: Api; user: AuthUser | null; loading: boolean;
  memberships: Membership[]; org: Org | null; today: string;
  switchOrg: (id: string) => void; refreshSession: () => Promise<void>; switchRole: (r: Org['role']) => void;
}
const AppCtx = createContext<Ctx | null>(null);
const ORG_KEY = 'hifz-active-org';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };

export function AppProvider({ backend, children }: { backend: Backend; children: React.ReactNode }) {
  const a = useMemo(() => api(backend), [backend]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [org, setOrg] = useState<Org | null>(null);

  const current = useRef<string | null | undefined>(undefined);   // undefined = not loaded yet
  const hasOrg = useRef(false);
  /** quiet: refresh in the background without the full-screen loading state (keeps the screen and scroll position) */
  const load = useCallback(async (u: AuthUser | null, quiet = false) => {
    current.current = u?.id ?? null;
    if (!(quiet && hasOrg.current)) setLoading(true);
    try {
      setUser(u);
      if (!u) { hasOrg.current = false; setMemberships([]); setOrg(null); return; }
      const ms = await a.memberships(u.id);
      setMemberships(ms);
      const want = lsGet(ORG_KEY);
      const m = ms.find(x => x.orgId === want) ?? ms[0];
      if (!m) { setOrg(null); return; }
      const roles = [m.role, ...m.extraRoles.filter(r => r !== m.role)];
      const saved = lsGet(`hifz-role-${m.orgId}`) as Org['role'] | null;
      const active = saved && roles.includes(saved) ? saved : roles.includes('admin') ? 'admin' : roles.includes('teacher') ? 'teacher' : m.role;
      const o = await a.org(m.orgId, active, roles); hasOrg.current = true; setOrg(o);
    } catch (e) { if (!(quiet && hasOrg.current)) throw e; } finally { setLoading(false); }
  }, [a]);

  useEffect(() => {
    backend.getUser().then(u => load(u));
    // The auth library re-announces the same user when a session token is renewed (e.g. on returning to the app).
    // Only a real change of user (sign in / sign out / switch) reloads; otherwise nothing happens.
    return backend.onAuthChange(u => { const id = u?.id ?? null; if (current.current !== undefined && id === current.current) { setUser(u); return; } load(u); });
  }, [backend, load]);
  const switchOrg = useCallback((id: string) => { lsSet(ORG_KEY, id); hasOrg.current = false; load(user); }, [load, user]);
  const refreshSession = useCallback(() => load(user, true), [load, user]);
  const switchRole = useCallback((r: Org['role']) => { if (org) { lsSet(`hifz-role-${org.id}`, r); window.location.hash = '#/'; load(user); } }, [org, load, user]);
  const today = todayIn(org?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  return <AppCtx.Provider value={{ backend, api: a, user, loading, memberships, org, today, switchOrg, refreshSession, switchRole }}>{children}</AppCtx.Provider>;
}
export function useApp(): Ctx { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside provider'); return c; }
export function useOrg(): Ctx & { org: Org } { const c = useApp(); if (!c.org) throw new Error('No organization'); return c as Ctx & { org: Org }; }
