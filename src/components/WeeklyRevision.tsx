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
      sub={!w.target ? 'Old revision starts once a full page is memorised' : w.perWeek ? `Goal: ${w.perWeek} times this week, on any days you choose · ${w.perDay} pages each` : `Target: ${w.target} Old pages (${w.perDay} a revision day)`} />
    <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
      {w.target > 0 && w.perWeek && <div className="flex items-center gap-3">
        <div className="flex gap-1.5" aria-label={`${w.oldDays} of ${w.perWeek} revisions this week`}>{Array.from({ length: w.perWeek }, (_, i) => <span key={i} className={cx('grid h-9 w-9 place-items-center rounded-full text-sm font-bold', i < w.oldDays ? 'bg-pine-700 text-white' : 'border-2 border-dashed border-pine-600/40 text-pine-700')}>{i < w.oldDays ? <Check size={16} /> : i + 1}</span>)}</div>
        <p className="text-sm"><b>{Math.min(w.oldDays, w.perWeek)} of {w.perWeek}</b> revisions done{w.oldDays >= w.perWeek ? '. Mā shāʾ Allāh!' : ''}</p>
      </div>}
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
      <p className="text-xs text-ink-faint">{w.perWeek ? <><Check size={11} className="inline" /> = Old revision done · </> : <><b className="text-pine-700">O</b> = Old revision day · </>}<span className="inline-block h-1.5 w-1.5 rounded-full bg-brass-500 align-middle" /> = Recent revision done · Recent: {w.recentDays} day{w.recentDays === 1 ? '' : 's'} · New lessons: {w.newLessons}</p>
      {w.missedDays > 0 && <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-bad"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{w.perWeek ? `Not enough days left this week for ${w.missedDays} more revision${w.missedDays > 1 ? 's' : ''}. ${you ? 'If you did one and forgot to log it, log it now.' : ''}` : `${w.missedDays} revision day${w.missedDays > 1 ? 's' : ''} with no Old revision ${you ? 'logged. If you did it, log it now' : 'logged'}.`}</p>}
      {onLog && (w.todayNeedsOld || w.todayNeedsRecent || w.missedDays > 0) && <div className="flex flex-wrap gap-2">
        {w.todayNeedsOld && <Button onClick={() => onLog('old')}><Plus size={16} />Log today’s Old revision</Button>}
        {w.todayNeedsRecent && <Button kind="secondary" onClick={() => onLog('recent')}><Plus size={16} />Log today’s Recent revision</Button>}
        {w.missedDays > 0 && w.days.some(d => d.missed) && <Button kind="secondary" onClick={() => onLog('old', w.days.find(d => d.missed)!.date)}>Log a missed day</Button>}
        {w.perWeek && w.missedDays > 0 && <Button kind="secondary" onClick={() => onLog('old', w.days.filter(d => !d.future && !d.isToday && !d.old).pop()?.date)}>Log an earlier day</Button>}
      </div>}
    </div>
  </Card>;
}

/** Parent: the week at a glance (also sent as a notification on Sunday evening) */
export function ParentWeekCard({ name, w, newLessons, present, classes, note }: { name: string; w: WeekSummary; newLessons: number; present: number; classes: number; note: string | null }) {
  const first = name.split(' ')[0];
  const items: Array<[string, string, string?]> = [
    ['Old revision', w.target ? `${w.oldPages} of ${w.target} pages` : `${w.oldPages} pages`, w.target ? `${Math.round(w.percent * 100)}%` : undefined],
    ['Recent revision', `${w.recentDays} day${w.recentDays === 1 ? '' : 's'}`],
    ['New lessons signed off', String(newLessons)],
    ['Class attendance', classes ? `${present} of ${classes}` : String(present)],
  ];
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><CalendarCheck size={18} className="text-pine-700" />{first}’s week</span>} sub="Monday to today. A summary is also sent every Sunday evening." />
    <dl className="grid grid-cols-2 gap-2 px-5 pb-4 pt-3 sm:grid-cols-4">{items.map(([k, v, x]) => <div key={k} className="rounded-xl bg-paper p-3 ring-1 ring-line"><dt className="text-xs font-bold uppercase tracking-wide text-ink-faint">{k}</dt><dd className="mt-0.5 text-lg font-bold">{v}{x && <span className="ml-1 text-sm font-normal text-ink-faint">{x}</span>}</dd></div>)}</dl>
    {w.missedDays > 0 && <p className="mx-5 mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-bad">{w.perWeek ? `${w.oldDays} of ${w.perWeek} revisions done this week.` : `${w.missedDays} revision day${w.missedDays > 1 ? 's' : ''} this week with no Old revision logged.`}</p>}
    {note && <p className="mx-5 mb-5 rounded-xl bg-pine-50 px-3 py-2 text-sm text-pine-800"><b>Teacher’s latest note:</b> “{note}”</p>}
  </Card>;
}
