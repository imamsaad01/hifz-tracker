// Class leaderboard: consistency, not speed. Points come from the database function class_leaderboard.
import { useEffect, useState } from 'react';
import { Trophy, Info } from 'lucide-react';
import { useOrg } from '../app/context';
import type { BoardRow } from '../api/data';
import { Card, CardHead, Segmented, cx } from './ui';

const MEDAL = ['bg-brass-500 text-white', 'bg-[#9AA5A3] text-white', 'bg-[#B5835A] text-white'];
export function Leaderboard({ limit, compact }: { limit?: number; compact?: boolean }) {
  const { api, org, backend } = useOrg();
  const [days, setDays] = useState<'7' | '30'>('7');
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [off, setOff] = useState(false);
  const [why, setWhy] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => api.leaderboard(org.id, Number(days)).then(r => { if (live) { setRows(r); setOff(false); } }).catch(() => { if (live) setOff(true); });
    load();
    const unsub = backend.subscribe?.(['sessions'], load);
    return () => { live = false; unsub?.(); };
  }, [api, org.id, days, backend]);
  if (off) return null;
  const staff = org.role === 'admin' || org.role === 'teacher';
  const me = rows?.find(r => r.isMe);
  const myRank = me && rows ? rows.indexOf(me) + 1 : null;
  const shown = rows ? (limit ? rows.slice(0, limit) : rows) : [];
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><Trophy size={18} className="text-brass-500" />Most consistent</span>}
      sub={staff && !org.settings.leaderboard.enabled ? 'Only teachers can see this. Turn it on for students in More → Settings.' : myRank ? `You are #${myRank} of ${rows!.length}` : 'Rewards showing up and revising, not speed'}
      action={<button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why} aria-label="How points work" className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-black/5"><Info size={16} /></button>} />
    {why && <p className="mx-5 mt-2 rounded-xl bg-pine-50 px-3 py-2 text-sm text-pine-800">10 points for each day with a session, 2 for each page of revision and 1 more for each page with no mistakes. Revision counts up to 20 pages a day. New lessons give no points, so going faster never wins.</p>}
    {!compact && <div className="px-5 pt-3"><Segmented label="Period" value={days} onChange={setDays} options={[['7', 'This week'], ['30', 'Last 30 days']]} /></div>}
    {rows === null ? <p className="px-5 py-4 text-sm text-ink-faint">Loading…</p> : <ol className="mt-2 divide-y divide-line">{shown.map((r, i) => <li key={r.studentId} className={cx('flex items-center gap-3 px-5 py-2.5', r.isMe && 'bg-brass-100/60')}>
      <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold', MEDAL[i] ?? 'bg-black/[.05] text-ink-soft')}>{i + 1}</span>
      <span className="min-w-0 flex-1"><b className="block truncate">{r.name}{r.isMe ? ' (you)' : ''}</b><span className="text-xs text-ink-faint">{r.days} day{r.days === 1 ? '' : 's'} · {r.pages} page{r.pages === 1 ? '' : 's'} revised · {r.clean} clean</span></span>
      <span className="text-right font-bold tabular-nums text-pine-800">{r.points}<span className="block text-[10px] font-normal uppercase text-ink-faint">points</span></span>
    </li>)}
      {me && limit && myRank && myRank > limit && <li className="flex items-center gap-3 bg-brass-100/60 px-5 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-black/[.05] text-xs font-bold">{myRank}</span><b className="flex-1">{me.name} (you)</b><b className="tabular-nums text-pine-800">{me.points}</b></li>}
    </ol>}
  </Card>;
}
