// "My stars": every star plants something in the student's garden. 25 fill a garden; then the next garden opens.
import { cx } from './ui';
import { garden, nextStreakGoal, STARS_PER_LEVEL } from '../lib/stars';

export function GardenCard({ stars, level }: { stars: number; level: { level: number; into: number; need: number } }) {
  const g = garden(level.level); const next = garden(level.level + 1);
  return <section className="rounded-[28px] bg-[#FFF4D6] p-5 text-[#1B2433] ring-2 ring-[#E8A317]/40" aria-label={`Level ${level.level}, ${g.name} garden: ${level.into} of ${level.need} planted`}>
    <div className="flex items-center gap-3">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-4xl shadow-sm" aria-hidden>{g.plant}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase tracking-wide text-[#9A5B00]">Level {level.level}</span>
        <span className="block text-2xl font-bold leading-tight">{g.name} garden</span></span>
      <span className="text-right"><span className="block text-3xl font-bold tabular-nums">⭐ {stars}</span></span>
    </div>
    <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden>
      {Array.from({ length: STARS_PER_LEVEL }, (_, k) => <span key={k} className={cx('grid aspect-square place-items-center rounded-xl text-2xl', k < level.into ? 'bg-white shadow-sm' : 'border-2 border-dashed border-[#E8A317]/40')}>{k < level.into ? g.plant : ''}</span>)}
    </div>
    <p className="mt-3 text-center font-bold">{level.need - level.into} more star{level.need - level.into === 1 ? '' : 's'} to open the {next.name} garden {next.plant}</p>
  </section>;
}

export function StreakCard({ days, best }: { days: number; best: number }) {
  const goal = nextStreakGoal(days);
  return <section className="flex items-center gap-4 rounded-[28px] bg-white p-5 ring-1 ring-line dark:bg-paper" aria-label={`${days} days in a row. Next goal ${goal} days.`}>
    <span className="text-5xl" aria-hidden>🔥</span>
    <span className="min-w-0 flex-1">
      <span className="block text-2xl font-bold">{days} day{days === 1 ? '' : 's'} in a row</span>
      <span className="block text-ink-soft">{goal - days} more to reach {goal} 🏅 · best {Math.max(best, days)}</span>
      <span className="mt-2 block h-3 overflow-hidden rounded-full bg-black/[.08] dark:bg-white/10"><span className="block h-full rounded-full bg-[#E8A317]" style={{ width: `${Math.min(100, (days / goal) * 100)}%` }} /></span>
    </span>
  </section>;
}
