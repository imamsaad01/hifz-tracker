// Halaqah join requests: students (or parents) see each halaqah with its times and ask to join; teachers approve.
import { useState } from 'react';
import { Users, Check, X, Clock, MapPin, UserPlus } from 'lucide-react';
import { useOrg } from '../app/context';
import type { OrgData } from '../app/useOrgData';
import type { Student } from '../lib/types';
import { scheduleText } from '../lib/schedule';
import { friendly } from '../api/backend';
import { Button, Card, CardHead, useToast, cx } from './ui';

const PLACE = { mosque: 'At the mosque', online: 'Online', both: 'Mosque or online' } as const;

/** For a student or parent: every halaqah, its times and teacher, and a button to ask to join. */
export function HalaqahChooser({ student, data, onChanged, forChild }: { student: Student; data: OrgData; onChanged: () => void; forChild?: boolean }) {
  const { api } = useOrg(); const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const classes = data.classes;
  const inAny = classes.some(c => c.studentIds.includes(student.id));
  const teacher = (uid: string | null) => data.members.find(m => m.userId === uid)?.displayName ?? null;
  const pendingFor = (classId: string) => data.joinRequests.find(r => r.classId === classId && r.studentId === student.id && r.status === 'pending');
  const declined = (classId: string) => data.joinRequests.find(r => r.classId === classId && r.studentId === student.id)?.status === 'declined';
  if (!classes.length) return null;
  const act = async (key: string, f: () => Promise<unknown>, msg: string) => { setBusy(key); try { await f(); toast(msg); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(null); } };
  const who = forChild ? student.name.split(' ')[0] : 'you';
  return <Card className={cx(!inAny && 'ring-2 ring-brass-500/60')}>
    <CardHead title={<span className="inline-flex items-center gap-2"><Users size={18} className="text-pine-700" />{inAny ? 'Halaqahs' : forChild ? `Choose ${who}’s halaqah` : 'Choose your halaqah'}</span>}
      sub={inAny ? 'You can ask to join another one too.' : `Pick the class time that suits ${who}. Your teacher approves the request.`} />
    <ul className="mt-2 divide-y divide-line">{classes.map(c => {
      const mine = c.studentIds.includes(student.id); const p = pendingFor(c.id); const t = teacher(c.teacherUserId);
      return <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="font-bold">{c.name}{t && <span className="font-normal text-ink-soft"> · {t}</span>}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-soft"><span className="inline-flex items-center gap-1"><Clock size={14} className="shrink-0" />{scheduleText(c.slots)}</span>{c.location && <span className="inline-flex items-center gap-1"><MapPin size={14} className="shrink-0" />{PLACE[c.location]}</span>}</p>
          {declined(c.id) && !p && !mine && <p className="text-xs text-warn">Your last request was declined. Speak to your teacher before asking again.</p>}
        </div>
        {mine ? <span className="inline-flex items-center gap-1 rounded-full bg-pine-50 px-3 py-1.5 text-sm font-bold text-pine-800"><Check size={15} />{forChild ? 'Joined' : 'You’re in'}</span>
          : p ? <span className="flex items-center gap-2"><span className="rounded-full bg-brass-100 px-3 py-1.5 text-sm font-bold text-brass-700">Waiting for approval</span>
              <Button kind="quiet" className="min-h-[38px] px-2 text-sm" busy={busy === p.id} onClick={() => act(p.id, () => api.cancelClassJoin(p.id), 'Request cancelled.')}>Cancel</Button></span>
          : <Button className="min-h-[40px]" busy={busy === c.id} onClick={() => act(c.id, () => api.requestClassJoin(c.id, student.id), 'Request sent. Your teacher will approve it.')}><UserPlus size={16} />Request to join</Button>}
      </li>;
    })}</ul>
  </Card>;
}

/** For teachers: pending requests to join a halaqah, approve or decline in one tap. */
export function JoinRequestsCard({ data, onChanged }: { data: OrgData; onChanged: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const pending = data.joinRequests.filter(r => r.status === 'pending');
  if (!pending.length) return null;
  const name = (id: string) => data.students.find(s => s.id === id)?.name ?? 'A student';
  const cls = (id: string) => data.classes.find(c => c.id === id)?.name ?? 'a halaqah';
  const decide = async (id: string, ok: boolean) => { setBusy(id + ok); try { await api.decideClassJoin(id, ok); toast(ok ? 'Added to the halaqah.' : 'Request declined.'); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(null); } };
  return <Card className="ring-2 ring-brass-500/60">
    <CardHead title={<span className="inline-flex items-center gap-2"><UserPlus size={18} className="text-brass-500" />Halaqah requests <span className="rounded-full bg-brass-100 px-2 text-sm text-brass-700">{pending.length}</span></span>} sub="Students asking to join a class" />
    <ul className="mt-2 divide-y divide-line">{pending.map(r => <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
      <p className="min-w-0 basis-full sm:basis-0 sm:flex-1"><b>{name(r.studentId)}</b> <span className="text-ink-soft">→ {cls(r.classId)}</span>{r.note && <span className="block text-sm text-ink-faint">“{r.note}”</span>}</p>
      <Button className="min-h-[40px]" busy={busy === r.id + true} onClick={() => decide(r.id, true)}><Check size={16} />Approve</Button>
      <Button kind="secondary" className="min-h-[40px]" busy={busy === r.id + false} onClick={() => decide(r.id, false)}><X size={16} />Decline</Button>
    </li>)}</ul>
  </Card>;
}
