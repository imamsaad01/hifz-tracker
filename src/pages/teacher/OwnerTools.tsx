// Site owner: every program on this site, and who else may start programs.
import { useEffect, useState } from 'react';
import { Crown, Trash2, UserPlus } from 'lucide-react';
import { useOrg } from '../../app/context';
import { Button, Card, CardHead, ErrorBox, Field, Spinner, inputCls, useToast } from '../../components/ui';
import { friendly } from '../../api/backend';
import { niceDate } from '../../lib/dates';

export function OwnerTools() {
  const { api } = useOrg(); const toast = useToast();
  const [owner, setOwner] = useState<boolean | null>(null);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string; students: number; members: number; created_at: string }>>([]);
  const [owners, setOwners] = useState<Array<{ email: string; added_at: string }>>([]);
  const [email, setEmail] = useState(''); const [err, setErr] = useState<string | null>(null);
  const load = async () => { try { const ok = await api.canCreatePrograms(); setOwner(!!ok); if (ok) { const [p, o] = await Promise.all([api.ownerPrograms(), api.ownerList()]); setPrograms(p); setOwners(o); } } catch (e) { setErr(friendly(e)); } };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <ErrorBox message={err} />;
  if (owner === null) return <Spinner />;
  if (!owner) return <Card className="p-5 text-[15px] text-ink-soft">Only site owners can see this section.</Card>;
  const set = async (e: string, add: boolean) => { try { await api.ownerSet(e, add); toast(add ? 'Added as a site owner.' : 'Removed.'); setEmail(''); load(); } catch (x) { toast(friendly(x), 'err'); } };
  return <div className="flex max-w-3xl flex-col gap-5">
    <Card><CardHead title={<span className="inline-flex items-center gap-2"><Crown size={18} className="text-brass-500" />Programs on this site</span>} sub="Only site owners can start a program" />
      <ul className="mt-2 divide-y divide-line">{programs.map(p => <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><b className="min-w-0 flex-1">{p.name}</b><span className="text-sm text-ink-soft">{p.students} students · {p.members} people · since {niceDate(String(p.created_at).slice(0, 10))}</span></li>)}</ul></Card>
    <Card><CardHead title="Site owners" sub="They can start programs and see this page" />
      <ul className="mt-2 divide-y divide-line">{owners.map(o => <li key={o.email} className="flex items-center gap-3 px-5 py-3"><span className="min-w-0 flex-1 truncate">{o.email}</span><button type="button" aria-label={`Remove ${o.email}`} className="text-ink-faint hover:text-bad" onClick={() => set(o.email, false)}><Trash2 size={16} /></button></li>)}</ul>
      <form className="flex flex-wrap items-end gap-2 border-t border-line px-5 py-4" onSubmit={e => { e.preventDefault(); if (email.trim()) set(email.trim(), true); }}>
        <Field label="Add by email (they must have an account)" className="min-w-[240px] flex-1">{id => <input id={id} type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />}</Field>
        <Button type="submit" disabled={!email.trim()}><UserPlus size={16} />Add</Button>
      </form></Card>
  </div>;
}
