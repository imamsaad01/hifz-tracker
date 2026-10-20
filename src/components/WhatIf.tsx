// "What if": slide the lesson size and lessons per week to see when the goal would be finished.
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Student } from '../lib/types';
import { goalTarget } from '../lib/studentPlan';
import { pagesInRange, rangeLength } from '../quran';
import { addDays } from '../lib/dates';
import { cx } from './ui';

const SIZES = [0.5, 1, 1.5, 2, 3, 4, 5];
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const label = (p: number) => (p === 0.5 ? '½ page' : `${p} page${p > 1 ? 's' : ''}`);
export function WhatIf({ student, remaining, lessonsPerWeek, today, you = true, baseWeeks }: { student: Student; remaining: number; lessonsPerWeek: number; today: string; you?: boolean; baseWeeks?: number | null }) {
  const t = goalTarget(student.goal, student.direction)?.target;
  const ayahsPerPage = t ? rangeLength(t) / Math.max(1, pagesInRange(t).length) : 10.3;
  const nowPages = student.newPages ?? Math.max(0.5, Math.round((student.dailyNewAyahs / ayahsPerPage) * 2) / 2);
  const [pages, setPages] = useState(SIZES.includes(nowPages) ? nowPages : 1);
  const [perWeek, setPerWeek] = useState(Math.max(1, lessonsPerWeek));
  const weeksFor = (p: number, w: number) => Math.ceil(remaining / Math.max(1, p * ayahsPerPage * w));
  const untouched = pages === (SIZES.includes(nowPages) ? nowPages : 1) && perWeek === Math.max(1, lessonsPerWeek);
  const base = baseWeeks ?? weeksFor(nowPages, Math.max(1, lessonsPerWeek));
  const weeks = untouched ? base : weeksFor(pages, perWeek);
  const finish = addDays(today, weeks * 7);
  if (remaining <= 0) return <p className="text-sm text-good">The goal is reached. Mā shāʾ Allāh.</p>;
  return <div className="flex flex-col gap-4">
    <div>
      <p className="mb-1.5 flex items-baseline justify-between text-sm font-bold"><span>Each lesson</span><span className="text-pine-700">{label(pages)}</span></p>
      <input type="range" min={0} max={SIZES.length - 1} step={1} value={SIZES.indexOf(pages)} onChange={e => setPages(SIZES[Number(e.target.value)])} aria-label="Pages each lesson" aria-valuetext={label(pages)} className="w-full accent-[#215549]" />
      <div className="flex justify-between text-[11px] text-ink-faint">{SIZES.map(s => <span key={s}>{s === 0.5 ? '½' : s}</span>)}</div>
    </div>
    <div>
      <p className="mb-1.5 text-sm font-bold">Lessons a week</p>
      <div className="flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5, 6, 7].map(n => <button key={n} type="button" aria-pressed={perWeek === n} onClick={() => setPerWeek(n)} className={cx('h-11 min-w-[44px] rounded-xl text-sm font-bold ring-1 ring-inset', perWeek === n ? 'bg-pine-700 text-white ring-pine-700' : 'bg-white text-ink-soft ring-line')}>{n}</button>)}</div>
    </div>
    <div className="flex items-center gap-3 rounded-xl bg-pine-50 px-4 py-3 text-pine-900 dark:text-pine-100">
      <CalendarClock size={22} className="shrink-0 text-pine-700" />
      <p className="text-[15px]">{you ? 'You would finish' : 'Finishes'} <b>{student.goal || 'the goal'}</b> around <b>{fmt(finish)}</b><span className="block text-sm opacity-80">{weeks} weeks · {remaining} ayahs to go{weeks !== base ? ` · ${weeks < base ? `${base - weeks} weeks sooner` : `${weeks - base} weeks later`} than now` : ' · same as now'}</span></p>
    </div>
    <p className="text-xs text-ink-faint">An estimate from the ayahs left and about {ayahsPerPage.toFixed(0)} ayahs a page. {you ? 'Talk to your teacher before changing your lesson size.' : 'Change the lesson size under Edit.'}</p>
  </div>;
}
