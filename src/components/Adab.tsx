// Adab & effort points: one tap per behaviour. Positive points also count toward the student's level.
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useOrg } from '../app/context';
import type { BehaviourPoint } from '../api/data';
import { Card, CardHead, cx, useToast } from './ui';
import { friendly } from '../api/backend';

export function AdabTaps({ studentId, points, onChanged, compact }: { studentId: string; points: BehaviourPoint[]; onChanged: () => void; compact?: boolean }) {
  const { org, api, today } = useOrg(); const toast = useToast();
  const todays = points.filter(p => p.studentId === studentId && p.date === today);
  const tap = async (category: string, value: 1 | -1) => {
    const existing = todays.find(p => p.category === category);
    try { if (existing) await api.removeBehaviour(existing.id); else { await api.addBehaviour(org.id, studentId, today, category, value); toast(`${value > 0 ? '+1' : '−1'} ${category}`); } onChanged(); }
    catch (e) { toast(friendly(e), 'err'); }
  };
  const chip = (c: string, v: 1 | -1) => { const on = todays.some(p => p.category === c); return <button key={c} type="button" aria-pressed={on} onClick={() => tap(c, v)}
    className={cx('inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-sm font-bold ring-1 ring-inset transition', on ? (v > 0 ? 'bg-good text-white ring-good' : 'bg-bad text-white ring-bad') : (v > 0 ? 'bg-white text-good ring-good/30' : 'bg-white text-bad ring-bad/30'))}>
    {v > 0 ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}{c}</button>; };
  return <div className={cx('flex flex-wrap gap-1.5', compact ? '' : 'px-5 py-3')}>{org.settings.adab.positive.map(c => chip(c, 1))}{org.settings.adab.negative.map(c => chip(c, -1))}</div>;
}
export function AdabSummary({ points, title = 'Adab & effort, last 30 days' }: { points: BehaviourPoint[]; title?: string }) {
  const by = new Map<string, number>(); points.forEach(p => by.set(p.category, (by.get(p.category) ?? 0) + p.value));
  const pos = points.filter(p => p.value > 0).length, neg = points.filter(p => p.value < 0).length;
  return <Card><CardHead title={title} sub={points.length ? `${pos} positive · ${neg} to work on` : 'No adab points yet'} />
    {points.length > 0 && <ul className="flex flex-wrap gap-2 px-5 py-4">{[...by.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => <li key={c} className={cx('rounded-full px-3 py-1 text-sm font-bold', n >= 0 ? 'bg-emerald-50 text-good' : 'bg-red-50 text-bad')}>{c} {n > 0 ? `+${n}` : n}</li>)}</ul>}
  </Card>;
}
