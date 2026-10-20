// Summary tiles and tap-to-open rows, shared by the profile and progress screens.
import { CountUp } from './Motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cx } from './ui';

const TONE = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const;
export function Tile({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: keyof typeof TONE }) {
  return <div className="rounded-xl bg-paper px-3 py-3 ring-1 ring-line">
    <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</p>
    <p className={cx('mt-0.5 text-2xl font-bold tabular-nums', tone ? TONE[tone] : 'text-ink')}><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold text-ink-faint">{unit}</span>}</p>
    {sub && <p className="text-xs text-ink-faint">{sub}</p>}
  </div>;
}
/** One line with a value on the right; tap to open the details underneath (like a phone's settings list). */
export function Row({ title, value, tone, children }: { title: string; value: string; tone?: keyof typeof TONE; children: React.ReactNode }) {
  return <details className="group">
    <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-5 hover:bg-pine-50/50 [&::-webkit-details-marker]:hidden">
      <span className="flex-1 font-bold">{title}</span>{value && <span className={cx('text-sm font-bold', tone ? TONE[tone] : 'text-ink-soft')}>{value}</span>}
      <ChevronDown size={18} className="text-ink-faint transition group-open:rotate-180" />
    </summary>
    <div className="flex flex-col gap-4 border-t border-line bg-paper/60 p-4">{children}</div>
  </details>;
}

/** A row that opens something (a form, a page): title on the left, current value and an arrow on the right. */
export function LinkRow({ title, value, onClick, icon: I }: { title: string; value?: string; onClick: () => void; icon?: import('lucide-react').LucideIcon }) {
  return <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 px-5 text-left hover:bg-pine-50/50">
    {I && <I size={18} className="shrink-0 text-pine-700" />}<span className="flex-1 font-bold">{title}</span>
    {value && <span className="max-w-[55%] truncate text-sm text-ink-soft">{value}</span>}<ChevronRight size={18} className="shrink-0 text-ink-faint" />
  </button>;
}
/** A titled group of rows, like a phone's settings screen. */
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-faint">{title}</h2><div className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">{children}</div></section>;
}
