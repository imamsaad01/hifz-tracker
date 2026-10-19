// "What's new" bell: new messages and announcements since this person last looked (remembered on this device).
import { useCallback, useEffect, useState } from 'react';
import { useRefresh } from './PullToRefresh';
import { Bell, MessageCircle, Megaphone } from 'lucide-react';
import { useApp } from '../app/context';
import type { Announcement, Message } from '../api/data';
import { Modal, cx } from './ui';
import { go } from '../app/router';

const KEY = 'hifz-inbox-seen';
const seenAt = () => { try { return localStorage.getItem(KEY) ?? '1970-01-01'; } catch { return '1970-01-01'; } };
const listeners = new Set<() => void>();
export function markSeen() { try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* blocked */ } listeners.forEach(l => l()); }

export function InboxBell() {
  const { api, org, user, backend } = useApp();
  const [items, setItems] = useState<Array<{ kind: 'msg' | 'ann'; at: string; title: string; body: string; studentId?: string }>>([]);
  const [seen, setSeen] = useState(seenAt()); const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    if (!org || !user) return;
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    try {
      const [msgs, anns] = await Promise.all([api.messages(org.id, { since }), api.announcements(org.id)]);
      const m = msgs.filter((x: Message) => x.sender !== user.id).map(x => ({ kind: 'msg' as const, at: x.createdAt, title: x.senderName ?? 'New message', body: x.body, studentId: x.studentId }));
      const a = anns.filter((x: Announcement) => x.createdBy !== user.id && x.createdAt >= since).map(x => ({ kind: 'ann' as const, at: x.createdAt, title: x.title, body: x.body ?? '' }));
      setItems([...m, ...a].sort((p, q) => q.at.localeCompare(p.at)).slice(0, 40));
    } catch { /* offline: keep what we have */ }
  }, [api, org, user]);
  useEffect(() => { load(); }, [load]);
  useRefresh(load);
  useEffect(() => backend.subscribe?.(['messages', 'announcements'], load), [backend, load]);
  useEffect(() => { const l = () => setSeen(seenAt()); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  if (!org) return null;
  const unread = items.filter(i => i.at > seen).length;
  const staff = org.role === 'admin' || org.role === 'teacher';
  return <>
    <button type="button" onClick={() => setOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-black/5" aria-label={unread ? `${unread} new` : 'What’s new'}>
      <Bell size={19} />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10px] font-bold leading-[18px] text-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    <Modal open={open} onClose={() => { setOpen(false); markSeen(); }} title="What’s new">
      {items.length ? <ul className="flex flex-col gap-2">{items.map((i, k) => <li key={k}><button type="button" className={cx('flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-pine-50', i.at > seen && 'bg-brass-100/50')}
        onClick={() => { setOpen(false); markSeen(); if (i.kind === 'msg') go(staff ? 'students' : org.role === 'student' ? 'messages' : 'child', ...(staff && i.studentId ? [i.studentId, 'messages'] : [])); else go(staff ? 'today' : org.role === 'student' ? 'home' : 'child'); }}>
        {i.kind === 'msg' ? <MessageCircle size={18} className="mt-0.5 shrink-0 text-pine-700" /> : <Megaphone size={18} className="mt-0.5 shrink-0 text-brass-500" />}
        <span className="min-w-0"><b className="block">{i.title}</b><span className="line-clamp-2 text-sm text-ink-soft">{i.body}</span><span className="text-xs text-ink-faint">{new Date(i.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span>
      </button></li>)}</ul> : <p className="py-6 text-center text-sm text-ink-faint">Nothing new in the last 30 days.</p>}
    </Modal>
  </>;
}
