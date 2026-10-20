// Progress at a glance: three rings (goal, this week, today) and a streak calendar of the last weeks.
import { addDays } from '../lib/dates';
import { cx } from './ui';

export type RingPart = { label: string; value: number; detail: string; color: string };
/** Three rings inside each other; each fills from 0 to 1. Colours come from the theme so dark mode works. */
export function Rings({ parts }: { parts: RingPart[] }) {
  const size = 132, stroke = 13, gap = 3;
  return <div className="flex items-center gap-4">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map(p => `${p.label}: ${p.detail}`).join('; ')} className="shrink-0 -rotate-90">
      {parts.map((p, i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + gap); const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(1, p.value));
        return <g key={p.label}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeOpacity={0.16} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`} className="transition-[stroke-dasharray] duration-700" />
        </g>;
      })}
    </svg>
    <ul className="flex min-w-[130px] flex-1 flex-col gap-3">{parts.map(p => <li key={p.label}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-faint"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</p>
      <p className="text-lg font-bold leading-tight">{p.detail}</p>
    </li>)}</ul>
  </div>;
}

/** The last N weeks, Monday to Sunday, one square per day: filled when something was read, blue when a streak freeze covered it. */
export function StreakCalendar({ dates, frozen, today, weeks = 12 }: { dates: string[]; frozen: string[]; today: string; weeks?: number }) {
  const did = new Set(dates); const ice = new Set(frozen);
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const start = addDays(today, -wd - (weeks - 1) * 7);
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const count = dates.filter(d => d >= start && d <= today).length;
  return <div>
    <div role="img" aria-label={`${count} days with reading in the last ${weeks} weeks`} className="grid max-w-[340px] grid-flow-col gap-[3px]" style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))', gridTemplateColumns: `14px repeat(${weeks}, minmax(0, 1fr))` }}>
      {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => <span key={`l${i}`} aria-hidden className="self-center text-[10px] font-bold leading-none text-ink-faint">{l}</span>)}
      {cols.flat().map(d => <span key={d} title={d}
        className={cx('aspect-square rounded-[3px]', d > today ? 'bg-transparent' : did.has(d) ? 'bg-pine-600' : ice.has(d) ? 'bg-sky-400/70' : 'bg-black/[.07]', d === today && 'ring-2 ring-brass-500')} />)}
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-pine-600" />Read</span>
      {frozen.length > 0 && <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-sky-400/70" />Streak freeze</span>}
      <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-black/[.07]" />Missed</span>
    </div>
  </div>;
}
