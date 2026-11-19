// "My garden": a seed is planted for every part a student logs; it grows into a plant (a star) only once
// a partner or the teacher heard it. 25 plants fill a garden; then the next garden opens. Rewards are worked for.
import { useEffect, useState } from 'react';
import { cx } from './ui';
import { useOrg } from '../app/context';
import { garden, nextStreakGoal, STARS_PER_LEVEL, PRIZE_BOX, CLASS_TREAT, classTreatTarget } from '../lib/stars';

export function GardenCard({ stars, seeds, level }: { stars: number; seeds: number; level: { level: number; into: number; need: number } }) {
  const g = garden(level.level); const next = garden(level.level + 1);
  const seedSlots = Math.min(seeds, level.need - level.into);
  return <section className="rounded-[28px] bg-[#FFF4D6] p-5 text-[#1B2433] ring-2 ring-[#E8A317]/40" aria-label={`Level ${level.level}, ${g.name} garden: ${level.into} of ${level.need} grown, ${seeds} seeds waiting`}>
    <div className="flex items-center gap-3">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-4xl shadow-sm" aria-hidden>{g.plant}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase tracking-wide text-[#9A5B00]">Level {level.level}</span>
        <span className="block text-2xl font-bold leading-tight">{g.name} garden</span></span>
      <span className="text-right text-3xl font-bold tabular-nums">⭐ {stars}</span>
    </div>
    <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden>
      {Array.from({ length: STARS_PER_LEVEL }, (_, k) => { const grown = k < level.into, seed = !grown && k < level.into + seedSlots;
        return <span key={k} className={cx('grid aspect-square place-items-center rounded-xl text-2xl', grown ? 'bg-white shadow-sm' : seed ? 'bg-white/60' : 'border-2 border-dashed border-[#E8A317]/40')}>{grown ? g.plant : seed ? '🌰' : ''}</span>; })}
    </div>
    <p className="mt-3 text-center font-bold">{level.need - level.into} more star{level.need - level.into === 1 ? '' : 's'} to open the {next.name} garden {next.plant}</p>
    {seeds > 0 && <p className="mt-1 text-center text-sm text-[#5C4A1E]">🌰 {seeds} seed{seeds === 1 ? '' : 's'} waiting. They grow when your partner confirms or your teacher hears you.</p>}
  </section>;
}

export function StreakCard({ days, best }: { days: number; best: number }) {
  const goal = nextStreakGoal(days);
  return <section className="flex items-center gap-4 rounded-[28px] bg-white p-5 ring-1 ring-line dark:bg-paper" aria-label={`${days} days in a row. Next goal ${goal} days.`}>
    <span className="text-5xl" aria-hidden>🔥</span>
    <span className="min-w-0 flex-1">
      <span className="block text-2xl font-bold">{days} day{days === 1 ? '' : 's'} in a row</span>
      <span className="block text-ink-soft">{goal - days} more to reach {goal} 🏅 · best {Math.max(best, days)}</span>
      <Bar value={days / goal} />
    </span>
  </section>;
}

const Bar = ({ value }: { value: number }) => <span className="mt-2 block h-3 overflow-hidden rounded-full bg-black/[.08] dark:bg-white/10"><span className="block h-full rounded-full bg-[#E8A317] transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></span>;

/** The reward ladder: what each step earns, and how far along the student is. */
export function RewardsCard({ stars, juzTests, steady, streak, classId }: { stars: number; juzTests: number; steady: { earned: boolean; weeksOk: number }; streak: number; classId: string | null }) {
  const gardens = Math.floor(stars / STARS_PER_LEVEL);
  const toBox = 3 * STARS_PER_LEVEL - (stars % (3 * STARS_PER_LEVEL));
  const items = [
    { icon: '📜', title: 'Fill a garden', earn: 'Your name is read out in class, and a certificate', done: gardens, progress: (stars % STARS_PER_LEVEL) / STARS_PER_LEVEL, left: `${STARS_PER_LEVEL - (stars % STARS_PER_LEVEL)} stars to go` },
    { icon: '🎁', title: 'Fill 3 gardens', earn: `Pick from the prize box: ${PRIZE_BOX.slice(0, 3).join(', ').toLowerCase()} and more`, done: Math.floor(gardens / 3), progress: 1 - toBox / (3 * STARS_PER_LEVEL), left: `${toBox} stars to go` },
    { icon: '🏅', title: 'Pass a juz test with your teacher', earn: 'A juz certificate, and you lead the class recitation', done: juzTests, progress: 0, left: 'Ask your teacher when you are ready' },
    { icon: '💪', title: 'Steadfast', earn: '30 days in a row, and a friend hears your Old revision twice every week for 4 weeks', done: steady.earned ? 1 : 0, progress: Math.min(streak / 30, steady.weeksOk / 4), left: `${Math.min(streak, 30)}/30 days · ${steady.weeksOk}/4 weeks` },
  ];
  return <section className="rounded-[28px] bg-white p-5 ring-1 ring-line dark:bg-paper">
    <h2 className="mb-1 text-xl font-bold">Rewards</h2>
    <p className="mb-3 text-sm text-ink-soft">Only stars someone heard count. Your teacher gives the rewards in class.</p>
    <ul className="flex flex-col gap-4">{items.map(it => <li key={it.title} className="flex gap-3">
      <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl', it.done ? 'bg-[#FFD23F]' : 'bg-black/[.05] dark:bg-white/10')} aria-hidden>{it.icon}</span>
      <span className="min-w-0 flex-1"><span className="flex items-baseline gap-2"><b className="text-[17px]">{it.title}</b>{it.done > 0 && <span className="rounded-full bg-[#FFD23F] px-2 text-xs font-bold text-[#1B2433]">earned{it.done > 1 ? ` ×${it.done}` : ''}</span>}</span>
        <span className="block text-sm text-ink-soft">{it.earn}</span>
        {it.progress > 0 && <Bar value={it.progress} />}<span className="mt-1 block text-xs font-bold text-ink-faint">{it.left}</span></span>
    </li>)}</ul>
    {classId && <ClassGoal classId={classId} />}
  </section>;
}

export function ClassGoal({ classId, title }: { classId: string; title?: string }) {
  const { api } = useOrg();
  const [v, setV] = useState<{ stars: number; students: number } | null>(null);
  useEffect(() => { let on = true; api.halaqahStars(classId).then(r => { if (on) setV(r); }).catch(() => { if (on) setV(null); }); return () => { on = false; }; }, [api, classId]);
  if (!v || !v.students) return null;
  const target = classTreatTarget(v.students);
  return <div className="mt-5 rounded-2xl bg-[#FFF4D6] p-4 text-[#1B2433]">
    <p className="flex items-center gap-2 font-bold"><span className="text-2xl" aria-hidden>🍕</span>{title ?? 'Class goal this month'}</p>
    <p className="text-sm">{CLASS_TREAT} when the halaqah reaches {target} stars together.</p>
    <Bar value={v.stars / target} />
    <p className="mt-1 text-sm font-bold">{v.stars >= target ? 'Goal reached! 🎉' : `${v.stars} of ${target} stars`}</p>
  </div>;
}
