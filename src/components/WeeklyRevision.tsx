// "This week's revision": pages revised vs target, a day strip, and a nudge to log today's revision.
import { CalendarCheck, Plus, AlertTriangle, Check } from 'lucide-react';
import type { WeekSummary } from '../lib/weekly';
import { DAY_NAMES } from '../lib/revision';
import { Button, Card, CardHead, cx } from './ui';
import { InfoTip } from './InfoTip';

export function WeeklyRevisionCard({ w, you = true, onLog }: { w: WeekSummary; you?: boolean; onLog?: (t: 'old' | 'recent', date?: string) => void }) {
  const pct = Math.round(w.percent * 100);
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><CalendarCheck size={18} className="text-pine-700" />This week’s revision<InfoTip k="weekRevision" /></span>}
      sub={w.target ? `Target: ${w.target} Old pages (${w.perDay} a revision day)` : 'Old revision starts once a full page is memorised'} />
    <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
      {w.target > 0 && <div>
        <div className="flex items-baseline justify-between"><span className="text-2xl font-bold tabular-nums">{w.oldPages}<span className="text-base font-normal text-ink-faint"> / {w.target} pages</span></span><span className={cx('text-sm font-bold', pct >= 100 ? 'text-good' : pct >= 50 ? 'text-pine-700' : 'text-warn')}>{pct}%</span></div>
        <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-black/[.06]"><span className={cx('block h-full rounded-full transition-all', pct >= 100 ? 'bg-good' : 'bg-pine-700')} style={{ width: `${pct}%` }} /></span>
      </div>}
      <ol className="grid grid-cols-7 gap-1" aria-label="Days this week">{w.days.map(d => <li key={d.date} className={cx('flex flex-col items-center gap-1 rounded-lg py-1.5 text-xs', d.isToday && 'bg-pine-50 ring-1 ring-pine-600/30')}>
        <span className={cx('font-bold', d.revisionDay ? 'text-ink' : 'text-ink-faint')}>{DAY_NAMES[d.dow]}</span>
        <span aria-label={d.old ? 'Old revision done' : d.missed ? 'Old revision missed' : d.revisionDay ? (d.future ? 'revision day' : 'to do') : 'rest day'}
          className={cx('grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold', d.old ? 'bg-pine-700 text-white' : d.missed ? 'bg-red-50 text-bad ring-1 ring-bad/30' : d.revisionDay ? 'ring-1 ring-pine-600/40 text-pine-700' : 'text-ink-faint')}>
          {d.old ? <Check size={14} /> : d.missed ? '!' : d.revisionDay ? 'O' : '·'}</span>
        <span className={cx('h-1.5 w-1.5 rounded-full', d.recent ? 'bg-brass-500' : 'bg-transparent')} title={d.recent ? 'Recent revision done' : undefined} />
      </li>)}</ol>
      <p className="text-xs text-ink-faint"><b className="text-pine-700">O</b> = Old revision day · <span className="inline-block h-1.5 w-1.5 rounded-full bg-brass-500 align-middle" /> = Recent revision done · Recent: {w.recentDays} day{w.recentDays === 1 ? '' : 's'} · New lessons: {w.newLessons}</p>
      {w.missedDays > 0 && <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-bad"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{w.missedDays} revision day{w.missedDays > 1 ? 's' : ''} with no Old revision {you ? 'logged. If you did it, log it now' : 'logged'}.</p>}
      {onLog && (w.todayNeedsOld || w.todayNeedsRecent || w.missedDays > 0) && <div className="flex flex-wrap gap-2">
        {w.todayNeedsOld && <Button onClick={() => onLog('old')}><Plus size={16} />Log today’s Old revision</Button>}
        {w.todayNeedsRecent && <Button kind="secondary" onClick={() => onLog('recent')}><Plus size={16} />Log today’s Recent revision</Button>}
        {w.missedDays > 0 && <Button kind="secondary" onClick={() => onLog('old', w.days.find(d => d.missed)!.date)}>Log a missed day</Button>}
      </div>}
    </div>
  </Card>;
}
