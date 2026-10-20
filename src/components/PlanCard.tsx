import { BookOpen, Repeat, RotateCcw, Flag, Users } from 'lucide-react';
import type { StudentPlan } from '../lib/studentPlan';
import { Card } from './ui';
import { InfoTip } from './InfoTip';

const monthYear = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
export function ClassBadge({ title, teacher }: { title: string; teacher: string | null }) {
  return <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-pine-50 px-3 py-1 text-sm text-pine-800 ring-1 ring-pine-600/20">
    <Users size={14} aria-hidden /><b>{title}</b>{teacher && <span>· Teacher: {teacher}</span>}
  </p>;
}
export function PlanCard({ plan, you = true }: { plan: StudentPlan; you?: boolean }) {
  const days = plan.classDays.length === 7 ? 'every day' : plan.classDays.join(', ');
  const rows = [
    { icon: <BookOpen size={18} />, title: 'New lesson', tip: 'new' as const, text: `${plan.newText} each lesson`, sub: `Lesson days: ${days}` },
    { icon: <Repeat size={18} />, title: 'Recent revision', tip: 'recent' as const, text: `Everything learned in the last ${plan.recentDays} days`, sub: 'Read it every day so new lessons settle' },
    { icon: <RotateCcw size={18} />, title: 'Old revision', tip: 'old' as const, text: plan.oldPerDay ? `${plan.oldPerDay} page${plan.oldPerDay > 1 ? 's' : ''}, ${plan.revWhen}` : 'Starts once a full page is memorised', sub: plan.cycleWeeks ? `${you ? 'You go' : 'Goes'} through everything memorised about every ${plan.cycleWeeks} week${plan.cycleWeeks > 1 ? 's' : ''}` : 'Weak pages come back sooner' },
  ];
  return <Card className="p-5">
    <h2 className="text-lg font-bold">{you ? 'Your plan' : 'Plan'}</h2>
    <ul className="mt-3 grid gap-3 sm:grid-cols-3">{rows.map(r => <li key={r.title} className="rounded-xl bg-paper p-3 ring-1 ring-line">
      <p className="flex items-center gap-2 font-bold text-pine-800">{r.icon}{r.title}<InfoTip k={r.tip} /></p>
      <p className="mt-1 text-[15px] font-bold">{r.text}</p><p className="text-sm text-ink-faint">{r.sub}</p></li>)}</ul>
    {plan.goal && <p className="mt-3 flex items-start gap-2 text-[15px]"><Flag size={18} className="mt-0.5 shrink-0 text-brass-500" />
      {plan.goal.done ? <span><b>Goal reached:</b> {plan.goal.label}. Mā shāʾ Allāh. Time to set the next goal.</span>
        : <span><b>Goal: {plan.goal.label}.</b> {plan.goal.remaining} ayahs to go{plan.goal.eta ? <>, about {plan.goal.weeks} weeks at this pace (around <b>{monthYear(plan.goal.eta)}</b>)</> : ''}.</span>}</p>}
  </Card>;
}
