// Teacher: who still needs setting up — halaqah, notifications, class expectations, parent linked — with one-tap fixes
// and ready-to-paste messages for WhatsApp.
import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Copy, Check, ChevronDown, X } from 'lucide-react';
import { useOrg } from '../app/context';
import type { OrgData } from '../app/useOrgData';
import { friendly } from '../api/backend';
import { useRefresh } from './PullToRefresh';
import { Button, Card, CardHead, Select, useToast, cx } from './ui';

const APP = 'https://hifz-tracker-amber.vercel.app';
const HIDE = 'hifz-setup-hidden';
export function SetupCard({ data, onChanged }: { data: OrgData; onChanged: () => void }) {
  const { api, org } = useOrg(); const toast = useToast();
  const [status, setStatus] = useState<Map<string, { notifications: boolean; parents: number }> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE) === new Date().toISOString().slice(0, 10); } catch { return false; } });
  const load = useCallback(() => api.setupStatus(org.id).then(r => setStatus(new Map(r.map(x => [x.student_id, { notifications: x.notifications, parents: Number(x.parents) }])))).catch(() => setStatus(new Map())), [api, org.id]);
  useEffect(() => { load(); }, [load]); useRefresh(load);
  if (!status || hidden) return null;
  const students = data.students.filter(s => s.userId);
  const noClass = data.students.filter(s => !data.classes.some(c => c.studentIds.includes(s.id)));
  const noNotif = students.filter(s => status.get(s.id) && !status.get(s.id)!.notifications);
  const noRules = students.filter(s => !s.rulesAckAt);
  const noParent = data.students.filter(s => status.get(s.id) && status.get(s.id)!.parents === 0);
  const rows = [
    { key: 'class', n: noClass.length, title: 'Not in a halaqah', who: noClass, hint: 'Add them here, or they can tap “Request to join” on their home screen.' },
    { key: 'notif', n: noNotif.length, title: 'Notifications off', who: noNotif, hint: 'They miss check-in, revision and partner reminders.',
      msg: `Assalamu alaikum! Please turn on notifications in the Hifz app so you get class and revision reminders:\n1. Open ${APP}\n2. iPhone: tap Share → Add to Home Screen, then open it from your home screen\n3. Tap “Turn on notifications” on the Today screen and allow.` },
    { key: 'rules', n: noRules.length, title: 'Haven’t agreed to the class expectations', who: noRules, hint: 'They see the expectations at the top of their home screen.',
      msg: `Assalamu alaikum! Please open the Hifz app (${APP}), read the Hifdh Class Expectations at the top of your Today screen and tap “I have read and agree”. Jazakum Allahu khayran.` },
    { key: 'parent', n: noParent.length, title: 'No parent linked', who: noParent, hint: 'Parents create an account and enter the 10-letter code to follow progress.',
      msg: `Assalamu alaikum! To follow your child's hifz: open ${APP}, create an account, choose "Join with a code" and enter your child's code:\n` + noParent.map(s => `• ${s.name}: ${s.parentCode ?? ''}`).join('\n') },
  ].filter(r => r.n > 0);
  if (!rows.length) return null;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Copied. Paste it in your WhatsApp group.'); } catch { toast('Could not copy on this device.', 'err'); } };
  const addTo = async (sid: string, cid: string) => { const c = data.classes.find(x => x.id === cid); if (!c) return; try { await api.setClassStudents(org.id, c.id, [...c.studentIds, sid], c.studentIds); toast('Added.'); onChanged(); } catch (e) { toast(friendly(e), 'err'); } };
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><ClipboardList size={18} className="text-pine-700" />Getting everyone set up</span>} sub={`${students.length} students with accounts`}
      action={<button type="button" aria-label="Hide for today" onClick={() => { setHidden(true); try { localStorage.setItem(HIDE, new Date().toISOString().slice(0, 10)); } catch { /* */ } }} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-black/5"><X size={16} /></button>} />
    <ul className="mt-2 divide-y divide-line">{rows.map(r => <li key={r.key} className="px-5 py-3">
      <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key} className="flex w-full items-center gap-3 text-left">
        <span className={cx('grid h-8 min-w-[32px] place-items-center rounded-full px-2 text-sm font-bold', r.key === 'class' || r.key === 'notif' ? 'bg-amber-50 text-warn' : 'bg-black/[.05] text-ink-soft')}>{r.n}</span>
        <span className="min-w-0 flex-1"><b>{r.title}</b><span className="block truncate text-sm text-ink-faint">{r.who.slice(0, 4).map(s => s.name.split(' ')[0]).join(', ')}{r.n > 4 ? ` +${r.n - 4}` : ''}</span></span>
        <ChevronDown size={18} className={cx('text-ink-faint transition', open === r.key && 'rotate-180')} />
      </button>
      {open === r.key && <div className="mt-3 flex flex-col gap-2">
        <p className="text-sm text-ink-soft">{r.hint}</p>
        {r.key === 'class' ? <ul className="flex flex-col gap-1.5">{r.who.map(s => <li key={s.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{s.name}</span>
          <Select aria-label={`Halaqah for ${s.name}`} className="!min-h-[38px] !w-auto text-sm" value="" onChange={v => v && addTo(s.id, v)} options={[['', 'Add to…'], ...data.classes.map(c => [c.id, c.name] as [string, string])]} /></li>)}</ul>
          : <p className="text-sm">{r.who.map(s => s.name).join(', ')}</p>}
        {'msg' in r && r.msg && <div className="flex flex-wrap gap-2"><Button kind="secondary" className="min-h-[38px] px-3 text-sm" onClick={() => copy(r.msg!)}><Copy size={15} />Copy message for WhatsApp</Button></div>}
      </div>}
    </li>)}</ul>
    {rows.every(r => r.key !== 'class') && <p className="flex items-center gap-1.5 px-5 pb-4 text-sm text-good"><Check size={15} />Everyone is in a halaqah.</p>}
  </Card>;
}
