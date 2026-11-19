// "My lessons" on the student home: the next lesson, and every lesson already done, as colourful tiles.
// Tap any tile and a card pops up with what it was, when, whether it was heard, and buttons to open or listen.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Session } from '../lib/types';
import { growth, type Grow } from '../lib/stars';
import { niceDate } from '../lib/dates';
import { formatRange, type Range } from '../quran';
import { MushafLink, rangeMarks } from './Mushaf';
import { AyahPlayer } from './AyahPlayer';
import { cx } from './ui';

const LOOK: Record<Grow, { bg: string; icon: string; say: string }> = {
  gold: { bg: 'bg-[#FFD23F] text-[#1B2433]', icon: '🌟', say: 'Your teacher heard it with no mistakes. Golden star!' },
  star: { bg: 'bg-[#047857] text-white', icon: '⭐', say: 'Heard by your teacher or a friend. It grew into a star.' },
  seed: { bg: 'bg-[#E9DFF7] text-[#3B1D5C]', icon: '🌰', say: 'Waiting for your teacher to hear it. Then it grows into a star.' },
  wilted: { bg: 'bg-[#F6D9E4] text-[#6B1F3D]', icon: '🔁', say: 'Your teacher asked you to read this one again.' },
};

type Pop = { kind: 'next'; range: Range } | { kind: 'done'; s: Session };

export function MyLessons({ sessions, studentId, next }: { sessions: Session[]; studentId: string; next: Range | null }) {
  const [pop, setPop] = useState<Pop | null>(null); const [all, setAll] = useState(false);
  const done = sessions.filter(s => s.studentId === studentId && s.type === 'new').sort((a, b) => b.date.localeCompare(a.date) || b.range.start - a.range.start);
  const shown = all ? done : done.slice(0, 6);
  return <section className="mt-2" aria-label="My lessons">
    <h2 className="mb-3 text-xl font-bold">My lessons</h2>
    {next && <button type="button" onClick={() => setPop({ kind: 'next', range: next })}
      className="mb-3 flex w-full items-center gap-3 rounded-[22px] bg-gradient-to-r from-[#5A2380] to-[#A7305C] px-4 py-4 text-left text-white shadow-[inset_0_-6px_0_rgba(0,0,0,.18)] active:scale-[.98]">
      <span className="text-4xl" aria-hidden>✨</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase tracking-wide opacity-90">Next lesson</span><span className="block truncate text-xl font-bold">{formatRange(next)}</span></span>
      <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">Tap</span>
    </button>}
    {done.length ? <>
      <p className="mb-2 text-sm font-bold text-ink-soft">Done so far · {done.length} lesson{done.length === 1 ? '' : 's'}</p>
      <ul className="grid grid-cols-2 gap-2">{shown.map(s => { const L = LOOK[growth(s)];
        return <li key={s.id}><button type="button" onClick={() => setPop({ kind: 'done', s })} className={cx('flex h-full min-h-[76px] w-full flex-col justify-between rounded-2xl px-3 py-2.5 text-left active:scale-[.97]', L.bg)}>
          <span className="flex items-start justify-between gap-1"><b className="line-clamp-2 text-[15px] leading-tight">{formatRange(s.range)}</b><span className="text-xl leading-none" aria-hidden>{L.icon}</span></span>
          <span className="text-xs font-bold opacity-80">{niceDate(s.date)}</span>
        </button></li>; })}</ul>
      {done.length > 6 && <button type="button" onClick={() => setAll(a => !a)} className="mt-2 min-h-[48px] w-full rounded-2xl bg-black/[.05] font-bold text-ink-soft dark:bg-white/10">{all ? 'Show fewer' : `Show all ${done.length}`}</button>}
    </> : <p className="rounded-2xl bg-black/[.04] px-4 py-3 text-ink-soft dark:bg-white/5">Your first lesson will show up here. 🌱</p>}
    {pop && <LessonPop pop={pop} onClose={() => setPop(null)} />}
  </section>;
}

function LessonPop({ pop, onClose }: { pop: Pop; onClose: () => void }) {
  const range = pop.kind === 'next' ? pop.range : pop.s.range;
  const g = pop.kind === 'done' ? growth(pop.s) : null; const L = g ? LOOK[g] : null;
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={formatRange(range)} className="done-pop w-full max-w-md rounded-t-[28px] bg-paper p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
      <div className="flex items-start gap-3">
        <span className={cx('grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl', L ? L.bg : 'bg-gradient-to-br from-[#5A2380] to-[#A7305C]')} aria-hidden>{L ? L.icon : '✨'}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold uppercase tracking-wide text-ink-faint">{pop.kind === 'next' ? 'Next lesson' : `Lesson · ${niceDate(pop.s.date)}`}</span>
          <span className="block text-2xl font-bold leading-tight">{formatRange(range)}</span></span>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl hover:bg-black/5"><X size={24} /></button>
      </div>
      <p className="mt-3 text-lg">{L ? L.say : 'Listen to it a few times, then say it without looking. When you know it, tap New on your home screen.'}</p>
      {pop.kind === 'done' && pop.s.teacherNote && <p className="mt-2 rounded-2xl bg-[#FFF4D6] px-4 py-3 text-[#1B2433]"><b>Your teacher:</b> {pop.s.teacherNote}</p>}
      {pop.kind === 'done' && pop.s.checkNote && <p className="mt-2 rounded-2xl bg-[#FFF4D6] px-4 py-3 text-[#1B2433]"><b>Your teacher:</b> {pop.s.checkNote}</p>}
      <div className="mt-4 flex flex-col gap-3">
        <MushafLink range={range} title={formatRange(range)} marks={rangeMarks(range, 'lesson')} label="📖 Open in the muṣḥaf" className="min-h-[56px] justify-center text-base" />
        <AyahPlayer range={range} compact />
      </div>
    </div>
  </div>, document.body);
}
