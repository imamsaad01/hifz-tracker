// Class board: staff post, everyone in the program reads. A post can go to one halaqah or to everyone.
import { useEffect, useState } from 'react';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { useOrg } from '../app/context';
import type { Announcement, ClassRow } from '../api/data';
import { Button, Card, CardHead, Field, Modal, Select, Toggle, inputCls, useToast, cx } from './ui';
import { friendly } from '../api/backend';
import { niceDate } from '../lib/dates';

const seenKey = (orgId: string) => `hifz-ann-seen-${orgId}`;
/** `fresh`: posts this person has not seen yet go first (newest on top) with a "New" tag; then pinned; then the rest, newest first. */
export function AnnouncementBoard({ items, classes, studentClassIds, onChanged, limit, fresh }: { items: Announcement[]; classes: ClassRow[]; studentClassIds?: string[]; onChanged: () => void; limit?: number; fresh?: boolean }) {
  const { org, api, user } = useOrg(); const toast = useToast();
  const staff = org.role === 'admin' || org.role === 'teacher';
  const [open, setOpen] = useState(false);
  // what was already seen when this screen opened (kept for the visit so "New" tags don't vanish while reading)
  const [seen] = useState(() => { try { return localStorage.getItem(seenKey(org.id)) ?? ''; } catch { return ''; } });
  const mine = items.filter(a => staff || !a.classId || (studentClassIds ?? []).includes(a.classId));
  const isNew = (a: Announcement) => !!fresh && a.createdBy !== user?.id && a.createdAt > seen && a.createdAt >= new Date(Date.now() - 30 * 864e5).toISOString();
  const rank = (a: Announcement) => (isNew(a) ? 0 : a.pinned ? 1 : 2);
  const sorted = fresh ? [...mine].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)) : mine;
  const newCount = sorted.filter(isNew).length;
  const visible = sorted.slice(0, Math.max(limit ?? 50, newCount));
  useEffect(() => { if (!fresh || !mine.length) return; const t = setTimeout(() => { try { localStorage.setItem(seenKey(org.id), new Date().toISOString()); } catch { /* blocked */ } }, 2500); return () => clearTimeout(t); }, [fresh, mine.length, org.id]);
  const cls = (id: string | null) => classes.find(c => c.id === id)?.name;
  if (!staff && !visible.length) return null;
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><Megaphone size={18} className="text-pine-700" />Announcements{newCount > 0 && <span className="rounded-full bg-brass-500 px-2 text-sm text-white">{newCount} new</span>}</span>} action={staff ? <Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => setOpen(true)}><Plus size={15} />Post</Button> : undefined} />
    {visible.length ? <ul className="mt-2 divide-y divide-line">{visible.map(a => <li key={a.id} className={cx('px-5 py-3', isNew(a) && 'bg-brass-100/60')}>
      <p className="flex items-start gap-2"><b className="min-w-0 flex-1">{isNew(a) && <span className="mr-2 inline-block rounded-full bg-brass-500 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-white">New</span>}{a.pinned && <Pin size={14} className="mr-1 inline text-brass-500" aria-label="Pinned" />}{a.title}</b>
        {staff && <button type="button" aria-label="Remove announcement" className="text-ink-faint hover:text-bad" onClick={async () => { try { await api.removeAnnouncement(a.id); onChanged(); } catch (e) { toast(friendly(e), 'err'); } }}><Trash2 size={15} /></button>}</p>
      {a.body && <p className="mt-0.5 whitespace-pre-line text-[15px] text-ink-soft">{a.body}</p>}
      <p className="mt-1 text-xs text-ink-faint">{niceDate(a.createdAt.slice(0, 10))}{a.classId ? ` · ${cls(a.classId) ?? 'one halaqah'}` : ' · everyone'}</p>
    </li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-faint">Nothing posted yet. Post a holiday, homework or reminder for everyone to see.</p>}
    {open && <Composer classes={classes} onClose={() => setOpen(false)} onSaved={onChanged} />}
  </Card>;
}
export function Composer({ classes, onClose, onSaved }: { classes: ClassRow[]; onClose: () => void; onSaved: () => void }) {
  const { org, api } = useOrg(); const toast = useToast();
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [to, setTo] = useState(''); const [pinned, setPinned] = useState(false); const [busy, setBusy] = useState(false);
  return <Modal open onClose={onClose} title="Post an announcement" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!title.trim()} onClick={async () => { setBusy(true); try { await api.addAnnouncement(org.id, { classId: to || null, title: title.trim(), body: body.trim(), pinned }); toast('Posted.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Post</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Title">{id => <input id={id} className={inputCls} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. No class this Friday" />}</Field>
      <Field label="Details (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[100px] py-2`} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} />}</Field>
      <Field label="Who sees it">{id => <Select id={id} value={to} onChange={setTo} options={[['', 'Everyone in the program'], ...classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>
      <Toggle on={pinned} onChange={setPinned} label="Pin to the top" />
    </div>
  </Modal>;
}
