// One conversation per student: their teachers, the student and their parents can read and write.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useOrg } from '../app/context';
import type { Message, Member } from '../api/data';
import { Button, Card, Spinner, ErrorBox, inputCls, cx, useToast } from './ui';
import { friendly } from '../api/backend';
import { markSeen } from './Inbox';

export function MessageThread({ studentId, studentName, members }: { studentId: string; studentName: string; members: Member[] }) {
  const { org, api, user, backend } = useOrg(); const toast = useToast();
  const [msgs, setMsgs] = useState<Message[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => api.messages(org.id, { studentId }).then(m => { setMsgs(m); markSeen(); }).catch(e => setErr(friendly(e))), [api, org.id, studentId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => backend.subscribe?.(['messages'], load), [backend, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);
  const me = members.find(m => m.userId === user?.id);
  const myName = me?.displayName ?? user?.name ?? user?.email ?? 'Me';
  const roleOf = (uid: string) => members.find(m => m.userId === uid)?.role;
  const send = async () => { const b = text.trim(); if (!b) return; setBusy(true); try { await api.sendMessage(org.id, studentId, b, myName); setText(''); await load(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  if (err) return <ErrorBox message={err} onRetry={load} />;
  if (!msgs) return <Spinner />;
  return <Card className="flex flex-col">
    <p className="border-b border-line px-5 py-3 text-sm text-ink-faint">Messages about <b className="text-ink">{studentName}</b>. Teachers, {studentName.split(' ')[0]} and linked parents can see this conversation.</p>
    <div className="flex max-h-[55vh] min-h-[200px] flex-col gap-2 overflow-y-auto px-4 py-4">
      {msgs.length ? msgs.map(m => { const mine = m.sender === user?.id; const r = roleOf(m.sender); return <div key={m.id} className={cx('max-w-[85%] rounded-2xl px-3 py-2', mine ? 'self-end bg-pine-700 text-white' : 'self-start bg-white ring-1 ring-line')}>
        {!mine && <p className="text-xs font-bold text-pine-800">{m.senderName ?? 'Someone'}{r ? ` · ${r === 'admin' ? 'teacher' : r}` : ''}</p>}
        <p className="whitespace-pre-line text-[15px]">{m.body}</p>
        <p className={cx('mt-0.5 text-[11px]', mine ? 'text-white/70' : 'text-ink-faint')}>{new Date(m.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
      </div>; }) : <p className="m-auto text-sm text-ink-faint">No messages yet.</p>}
      <div ref={end} />
    </div>
    <form className="flex items-end gap-2 border-t border-line p-3" onSubmit={e => { e.preventDefault(); send(); }}>
      <textarea aria-label="Message" className={`${inputCls} min-h-[44px] flex-1 py-2`} rows={1} maxLength={2000} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Write a message" />
      <Button type="submit" busy={busy} disabled={!text.trim()} aria-label="Send"><Send size={16} /></Button>
    </form>
  </Card>;
}
