// The bell: a history of everything the app told this person (last 60 days) — sign-offs, partner confirmations,
// test results, reminders, messages and announcements — even if they swiped the phone notification away.
import { useCallback, useEffect, useState } from 'react';
import { Bell, MessageCircle, Megaphone, CheckCircle2, CalendarClock, BookOpenText, Users, AlertTriangle, BellRing } from 'lucide-react';
import { useApp } from '../app/context';
import type { Announcement, Message } from '../api/data';
import { Modal, cx } from './ui';
import { useRefresh } from './PullToRefresh';
import { go } from '../app/router';

const KEY = 'hifz-inbox-seen';
const seenAt = () => { try { return localStorage.getItem(KEY) ?? '1970-01-01'; } catch { return '1970-01-01'; } };
const listeners = new Set<() => void>();
export function markSeen() { try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* blocked */ } listeners.forEach(l => l()); }

type Item = { key: string; at: string; title: string; body: string; url?: string | null; kind: 'msg' | 'ann' | 'note'; studentId?: string };
const iconFor = (i: Item) => {
  if (i.kind === 'msg') return <MessageCircle size={18} className="mt-0.5 shrink-0 text-pine-700" />;
  if (i.kind === 'ann' || /^Announcement/.test(i.title)) return <Megaphone size={18} className="mt-0.5 shrink-0 text-brass-500" />;
  if (/Signed off|confirmed|Welcome to|Lesson saved/i.test(i.title)) return <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" />;
  if (/redo|Missed|weak|declined|follow-up/i.test(i.title)) return <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />;
  if (/Test|Juzʾ|matn|Qir/i.test(i.title)) return <BookOpenText size={18} className="mt-0.5 shrink-0 text-brass-500" />;
  if (/partner|Halaqah/i.test(i.title)) return <Users size={18} className="mt-0.5 shrink-0 text-pine-700" />;
  if (/starts at|Absence|revision|Revision/i.test(i.title)) return <CalendarClock size={18} className="mt-0.5 shrink-0 text-pine-700" />;
  return <BellRing size={18} className="mt-0.5 shrink-0 text-ink-faint" />;
};

export function InboxBell() {
  const { api, org, user, backend } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [seen, setSeen] = useState(seenAt()); const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    if (!org || !user) return;
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    try {
      const [notes, msgs, anns] = await Promise.all([api.myNotifications().catch(() => []), api.messages(org.id, { since }).catch(() => [] as Message[]), api.announcements(org.id).catch(() => [] as Announcement[])]);
      const n: Item[] = notes.map(x => ({ key: `n${x.id}`, at: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at as unknown as Date).toISOString(), title: x.title, body: x.body ?? '', url: x.url, kind: 'note' }));
      const titles = new Set(n.map(x => x.title)); const bodies = new Set(n.map(x => x.body));
      const m: Item[] = msgs.filter(x => x.sender !== user.id && !bodies.has(x.body)).map(x => ({ key: `m${x.id}`, at: x.createdAt, title: x.senderName ?? 'New message', body: x.body, kind: 'msg', studentId: x.studentId }));
      const a: Item[] = anns.filter(x => x.createdBy !== user.id && x.createdAt >= since && !titles.has(`Announcement: ${x.title}`)).map(x => ({ key: `a${x.id}`, at: x.createdAt, title: x.title, body: x.body ?? '', kind: 'ann' }));
      setItems([...n, ...m, ...a].sort((p, q) => q.at.localeCompare(p.at)).slice(0, 80));
    } catch { /* offline: keep what we have */ }
  }, [api, org, user]);
  useEffect(() => { load(); }, [load]); useRefresh(load);
  useEffect(() => backend.subscribe?.(['messages', 'announcements', 'sessions', 'qiraat_tests', 'class_join_requests'], load), [backend, load]);
  useEffect(() => { const l = () => setSeen(seenAt()); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  if (!org) return null;
  const unread = items.filter(i => i.at > seen).length;
  const staff = org.role === 'admin' || org.role === 'teacher';
  const openItem = (i: Item) => {
    setOpen(false); markSeen();
    if (i.url && i.url.startsWith('#/') && i.url !== '#/') { window.location.hash = i.url; return; }
    if (i.kind === 'msg') go(staff ? 'students' : org.role === 'student' ? 'messages' : 'child', ...(staff && i.studentId ? [i.studentId, 'messages'] : []));
    else go(staff ? 'today' : org.role === 'student' ? 'home' : 'child');
  };
  const day = (iso: string) => { const d = new Date(iso); const t = new Date(); const y = new Date(Date.now() - 864e5); return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  let lastDay = '';
  return <>
    <button type="button" data-tour="inbox" onClick={() => setOpen(true)} className="relative grid h-11 w-10 sm:w-11 place-items-center rounded-xl text-ink-soft hover:bg-black/5" aria-label={unread ? `${unread} new` : 'What’s new'}>
      <Bell size={19} />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10px] font-bold leading-[18px] text-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    <Modal open={open} onClose={() => { setOpen(false); markSeen(); }} title="Notifications">
      {items.length ? <ul className="flex flex-col gap-1">{items.map(i => { const d = day(i.at); const head = d !== lastDay; lastDay = d; return <li key={i.key}>
        {head && <p className="px-1 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-ink-faint first:pt-0">{d}</p>}
        <button type="button" className={cx('flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-pine-50', i.at > seen && 'bg-brass-100/50')} onClick={() => openItem(i)}>
          {iconFor(i)}
          <span className="min-w-0 flex-1"><b className="block">{i.title}</b>{i.body && <span className="line-clamp-2 text-sm text-ink-soft">{i.body}</span>}</span>
          <span className="shrink-0 text-xs text-ink-faint">{new Date(i.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
        </button></li>; })}</ul>
        : <p className="py-6 text-center text-sm text-ink-faint">Nothing yet. Reminders, sign-offs and messages will show here.</p>}
    </Modal>
  </>;
}
