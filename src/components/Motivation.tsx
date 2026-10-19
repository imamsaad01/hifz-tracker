// Daily ring, level bar and badge grid.
import { Flame, BookOpen, Star, CheckCircle2, Heart, Medal, Lock, Snowflake } from 'lucide-react';
import type { Badge } from '../lib/motivation';
import { Card, CardHead, cx } from './ui';

/** Three rings: New, Recent, Old. A ring is full when that part is done today; grey when it is not due today. */
export function DailyRing({ parts }: { parts: Array<{ label: string; done: boolean; due: boolean; color: string }> }) {
  const size = 132, stroke = 12;
  const doneCount = parts.filter(p => p.due && p.done).length, dueCount = parts.filter(p => p.due).length;
  return <div className="flex items-center gap-5">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Today: ${doneCount} of ${dueCount} done`} className="shrink-0 -rotate-90">
      {parts.map((p, i) => { const r = size / 2 - stroke / 2 - i * (stroke + 4); const c = 2 * Math.PI * r; return <g key={p.label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-black/[.07]" strokeWidth={stroke} />
        {p.due && p.done && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={0} style={{ transition: 'stroke-dashoffset .6s ease' }} />}
      </g>; })}
    </svg>
    <ul className="flex flex-col gap-1.5 text-[15px]">{parts.map(p => <li key={p.label} className="flex items-center gap-2">
      <i className="inline-block h-3 w-3 rounded-full" style={{ background: p.due ? p.color : '#d6d3cc' }} />
      <b>{p.label}</b><span className={cx('text-sm', p.done ? 'text-good' : 'text-ink-faint')}>{!p.due ? 'not today' : p.done ? 'done' : 'to do'}</span></li>)}
      <li className="mt-1 text-sm font-bold text-pine-800">{dueCount === 0 ? 'Rest day' : doneCount === dueCount ? 'All done today. Mā shāʾ Allāh!' : `${doneCount} of ${dueCount} done`}</li>
    </ul>
  </div>;
}

export function LevelBar({ total, lvl, streak, freezes, frozenDays }: { total: number; lvl: { n: number; name: string; to: number | null; nextName: string | null; progress: number }; streak: number; freezes: number; frozenDays: number }) {
  return <div className="flex flex-col gap-2">
    <div className="flex items-baseline gap-2"><span className="rounded-lg bg-pine-700 px-2 py-0.5 text-sm font-bold text-white">Level {lvl.n}</span><b className="text-lg">{lvl.name}</b><span className="ml-auto text-sm tabular-nums text-ink-faint">{total} points</span></div>
    <div className="h-2.5 overflow-hidden rounded-full bg-black/[.06]" role="progressbar" aria-valuenow={Math.round(lvl.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level"><div className="h-full rounded-full bg-gradient-to-r from-pine-600 to-brass-500" style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
    <p className="text-sm text-ink-faint">{lvl.to ? `${lvl.to - total} points to ${lvl.nextName}` : 'Top level reached'}</p>
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><span className="inline-flex items-center gap-1 font-bold"><Flame size={16} className="text-brass-500" />{streak}-day streak</span>
      {freezes > 0 && <span className="inline-flex items-center gap-1 text-ink-soft"><Snowflake size={15} className="text-sky-600" />{freezes} streak freeze{freezes > 1 ? 's' : ''} a week{frozenDays ? ` · ${frozenDays} used recently` : ''}</span>}</p>
  </div>;
}

const ICON = { flame: Flame, book: BookOpen, star: Star, check: CheckCircle2, heart: Heart, medal: Medal };
export function BadgeGrid({ items }: { items: Badge[] }) {
  const earned = items.filter(b => b.earned).length;
  return <Card><CardHead title="Badges" sub={`${earned} of ${items.length} earned`} />
    <ul className="grid grid-cols-3 gap-3 px-5 py-4 sm:grid-cols-4 lg:grid-cols-6">{items.map(b => { const I = ICON[b.icon]; return <li key={b.id} title={b.how} className={cx('flex flex-col items-center gap-1 rounded-xl p-2 text-center', b.earned ? 'bg-brass-100/60' : 'opacity-60')}>
      <span className={cx('grid h-12 w-12 place-items-center rounded-full', b.earned ? 'bg-brass-500 text-white shadow' : 'bg-black/[.06] text-ink-faint')}>{b.earned ? <I size={22} /> : <Lock size={18} />}</span>
      <b className="text-xs leading-tight">{b.name}</b><span className="text-[11px] leading-tight text-ink-faint">{b.how}</span></li>; })}</ul>
  </Card>;
}
