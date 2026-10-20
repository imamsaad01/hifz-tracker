// Admin: "Set up your program" — a short checklist that ticks itself off as the program gets set up, then disappears.
import { useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, Copy, X, Rocket } from 'lucide-react';
import { useOrg } from '../app/context';
import type { OrgData } from '../app/useOrgData';
import { href } from '../app/router';
import { Card, useToast, cx } from './ui';

const APP = 'https://hifz-tracker-amber.vercel.app';
const HIDE = 'hifz-setup-checklist-hidden';
export function SetupChecklist({ data }: { data: OrgData }) {
  const { org } = useOrg(); const toast = useToast();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE) === org.id; } catch { return false; } });
  if (org.role !== 'admin' || hidden) return null;
  const s = org.settings;
  const steps: Array<{ key: string; title: string; hint: string; done: boolean; to?: string; action?: React.ReactNode }> = [
    { key: 'halaqah', title: 'Add your halaqahs and class times', hint: 'Each halaqah’s day sets when new lessons are due.', done: data.classes.length > 0 && data.classes.every(c => c.slots.length > 0), to: href('classes', 'halaqahs') },
    { key: 'teacher', title: 'Give each halaqah a teacher', hint: 'They get the sign-off and attendance reminders.', done: data.classes.length > 0 && data.classes.every(c => !!c.teacherUserId), to: href('classes', 'halaqahs') },
    { key: 'rules', title: 'Write the class expectations', hint: 'Students read and agree to them when they join.', done: !!s.rulesText?.trim(), to: href('more', 'settings') },
    { key: 'revision', title: 'Choose how revision works', hint: s.revision.perWeek ? `Now: ${s.revision.perWeek} times a week, at their own time.` : 'Their own time a few times a week, or fixed days.', done: !!s.revision.perWeek || (s.revision.days?.length ?? 7) < 7, to: href('more', 'settings') },
    { key: 'term', title: 'Set the term dates', hint: 'Used for attendance standing and term reports.', done: !!s.attendance.semesterStart && !!s.attendance.semesterEnd, to: href('more', 'settings') },
    { key: 'invite', title: 'Invite your students', hint: 'Send the link and join code in your WhatsApp group.', done: data.students.some(x => x.userId),
      action: <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`Assalamu alaikum! Join our hifz class on the Hifz app:\n1. Open ${APP}\n2. Tap “Create my account”\n3. Enter the join code: ${org.joinCode ?? '(ask the teacher)'}\nThen add it to your home screen and turn on notifications.`); toast('Invite copied. Paste it in your WhatsApp group.'); } catch { toast('Could not copy on this device.', 'err'); } }}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-pine-700 ring-1 ring-inset ring-pine-600/30 hover:bg-pine-50"><Copy size={15} />Copy invite</button> },
    { key: 'placed', title: 'Put every student in a halaqah', hint: 'Approve join requests on Today, or add them yourself.', done: data.students.length > 0 && data.students.every(x => data.classes.some(c => c.studentIds.includes(x.id))), to: href('classes', 'halaqahs') },
  ];
  const done = steps.filter(x => x.done).length;
  if (done === steps.length) return null;
  const todo = steps.filter(x => !x.done); const finished = steps.filter(x => x.done);
  return <Card className="overflow-hidden">
    <div className="flex items-start gap-3 px-5 pb-2 pt-4">
      <Rocket size={20} className="mt-0.5 shrink-0 text-brass-500" />
      <div className="min-w-0 flex-1"><h2 className="font-bold">Set up your program</h2><p className="text-sm text-ink-faint">{done} of {steps.length} done. It ticks itself off as you go.</p></div>
      <button type="button" aria-label="Hide the checklist" onClick={() => { setHidden(true); try { localStorage.setItem(HIDE, org.id); } catch { /* */ } }} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-black/5"><X size={16} /></button>
    </div>
    <div className="mx-5 mb-2 h-2 overflow-hidden rounded-full bg-black/[.06]"><div className="h-full rounded-full bg-brass-500 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
    <ul className="divide-y divide-line">
      {todo.map((x, i) => <li key={x.key} className={cx('flex items-center gap-3 px-5 py-3', i === 0 && 'bg-brass-100/30')}>
        <Circle size={20} className="shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1"><b className="block">{x.title}</b><span className="block text-sm text-ink-faint">{x.hint}</span></span>
        {x.action ?? (x.to && <a href={x.to} aria-label={x.title} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-pine-700 hover:bg-pine-50"><ChevronRight size={20} /></a>)}
      </li>)}
      {finished.length > 0 && <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm text-ink-soft">{finished.map(x => <span key={x.key} className="inline-flex items-center gap-1.5"><CheckCircle2 size={15} className="text-good" />{x.title}</span>)}</li>}
    </ul>
  </Card>;
}
