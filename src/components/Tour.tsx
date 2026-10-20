// First-login guided tour: spotlights each part of the screen with a short explanation. Skip any time; replay from the menu.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { useApp } from '../app/context';
import type { Role } from '../lib/types';
import { cx } from './ui';

export interface TourStep { target?: string; title: string; body: string; optional?: boolean; route?: string }

const STUDENT: TourStep[] = [
  { title: 'Assalamu alaikum! Welcome to Hifz Tracker', body: 'A one-minute tour of your app. You can skip it now and replay it any time from “My plan”.' },
  { target: 'halaqah', title: 'Your halaqah', body: 'This shows your class and teacher. If you are not in one yet, choose a class time and tap “Request to join”. Your teacher approves it.', optional: true },
  { target: 'announcements', title: 'Announcements', body: 'New announcements from your teacher always appear here at the top, marked New.', optional: true },
  { target: 'partner', title: 'Your revision partner', body: 'When a classmate revises to you, they ask you to confirm it here. Tap the ayahs where they made a mistake (once = small, twice = big), then Confirm. When you log your own revision, choose who listened.', optional: true },
  { target: 'week', title: 'This week’s revision', body: 'How many Old pages you revised this week against your target, day by day. If you haven’t logged today’s revision, the buttons here remind you. Tap the (i) buttons anywhere for what a word means.', optional: true },
  { target: 'qiraat', title: 'Your qirāʾāt', body: 'Your riwāyāt, upcoming farsh and uṣūl tests, today’s matn lines, the words to revise, a reciter in your riwāyah and your khatmah progress.', optional: true },
  { target: 'checkin', title: 'Check in at class', body: 'When class starts, tap Check in and type the 4-digit code your teacher shows. Can’t come? Tap “I can’t come” before class.', optional: true },
  { target: 'today-plan', title: 'Today', body: 'Your day as three steps: New lesson, Recent revision, Old revision. The next one is open with its buttons. Tick them off as you go.', optional: true },
  { target: 'revision-log', title: 'Your lessons & revision', body: 'Everything you submitted this week, your teacher’s sign-off, mistakes and notes. Tap “Choose where to start” to pick the surah your Old revision starts from. It continues automatically after that.', optional: true },
  { target: 'notify', title: 'Phone reminders', body: 'Turn on notifications for class check-in, revision days, partner revision nights, tests and messages.', optional: true },
  { target: 'nav-progress', title: 'Progress', body: 'See how much you have memorised, your streak, badges and certificates.' },
  { target: 'nav-messages', title: 'Messages', body: 'Message your teacher privately.' },
  { target: 'nav-me', title: 'My plan', body: 'Change your plan, your qirāʾāt, your halaqah, and replay this tour.' },
  { title: 'You’re all set', body: 'May Allah make it easy for you and put barakah in your hifz. Pull down from the top of any screen to refresh.' },
];
const TEACHER: TourStep[] = [
  { title: 'Welcome, teacher', body: 'A quick tour of the teacher side. Skip any time and replay it from More.', route: 'today' },
  { target: 'today-actions', title: 'Start here', body: 'Live class shows the check-in code and the next student to hear. Record saves a lesson in a few taps. Assign sets work.', route: 'today' },
  { target: 'requests', title: 'Halaqah requests', body: 'Students ask to join a halaqah here. Approve or decline with one tap.', optional: true, route: 'today' },
  { target: 'revision-check', title: 'New lessons to sign off', body: 'Students submit the new lesson they memorised. Hear it, tap Sign off and mark mistakes on the ayahs, or send it back. Revision is confirmed by their partners; you see it on each student and in Live class.', optional: true, route: 'today' },
  { target: 'qiraat-due', title: 'Qirāʾāt tests', body: 'Farsh and uṣūl tests due this week. Tap a name to mark it.', optional: true, route: 'today' },
  { target: 'today-students', title: 'Today’s students', body: 'Who still needs to be heard, and who needs attention (overdue revision, missed days, weak pages).', optional: true, route: 'today' },
  { target: 'nav-students', title: 'Students', body: 'Open any student for their plan, revision start point, qirāʾāt (tests, khatmah, matn), history, messages and reports.' },
  { target: 'nav-classes', title: 'Class', body: 'Live class, attendance with the check-in code, halaqahs and their times, and the calendar.' },
  { target: 'nav-assignments', title: 'Work', body: 'Assignments, juz tests and the weekly partner revision forms.' },
  { target: 'nav-more', title: 'More', body: 'Settings (revision days, reminders, attendance, class expectations), people and roles, join codes and reports.' },
  { target: 'inbox', title: 'What’s new', body: 'New messages and announcements. Turn on phone notifications too, so absence requests and messages reach you.' },
  { title: 'Bismillah', body: 'That’s it. Replay this tour any time from More.' },
];
const PARENT: TourStep[] = [
  { title: 'Welcome', body: 'A short tour of your child’s page. Skip any time.' },
  { target: 'announcements', title: 'Announcements', body: 'New messages from the teacher appear at the top.', optional: true },
  { target: 'absence', title: 'Report an absence', body: 'Tell the teacher before class if your child cannot come.', optional: true },
  { target: 'revision-log', title: 'Revision', body: 'The revision your child logged this week and whether the teacher has checked it.', optional: true },
  { target: 'qiraat', title: 'Qirāʾāt', body: 'Tests, matn progress and the words to revise.', optional: true },
  { target: 'notify', title: 'Notifications', body: 'Turn on phone notifications for results, absences and announcements.', optional: true },
  { title: 'Done', body: 'Everything here is read-only. Pull down to refresh.' },
];
const STEPS: Record<Role, TourStep[]> = { student: STUDENT, admin: TEACHER, teacher: TEACHER, parent: PARENT };

const key = (role: string, uid: string) => `hifz-tour-${role === 'admin' ? 'teacher' : role}-${uid}`;
const seen = (k: string) => { try { return localStorage.getItem(k) === 'done'; } catch { return true; } };
const markDone = (k: string) => { try { localStorage.setItem(k, 'done'); } catch { /* blocked */ } };
const listeners = new Set<() => void>();
/** Replay the tour from a button */
export const startTour = () => listeners.forEach(l => l());

/** first element with data-tour=name that is actually on screen (mobile and desktop navs both exist) */
function findTarget(name: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return all.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

export function Tour() {
  const { org, user } = useApp();
  const role = org?.role; const uid = user?.id;
  const steps = role ? STEPS[role] : [];
  const k = role && uid ? key(role, uid) : '';
  const [open, setOpen] = useState(false); const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dir = useDir();

  // auto-start once the home screen has rendered (not during sign-up)
  useEffect(() => {
    if (!k || seen(k)) return;
    const t = setInterval(() => { if (document.querySelector('main [data-tour]')) { clearInterval(t); setI(0); setOpen(true); } }, 1200);
    return () => clearInterval(t);
  }, [k]);
  useEffect(() => { const l = () => { setI(0); setOpen(true); }; listeners.add(l); return () => { listeners.delete(l); }; }, []);

  const close = useCallback(() => { setOpen(false); if (k) markDone(k); }, [k]);
  const step = steps[i];
  // go to the step's page, find its target (skip optional steps whose target isn't on screen)
  useLayoutEffect(() => {
    if (!open || !step) return;
    if (step.route && !location.hash.startsWith(`#/${step.route}`)) location.hash = `#/${step.route}`;
    if (!step.target) { setRect(null); return; }
    let tries = 0; let alive = true;
    const look = () => {
      if (!alive) return;
      const el = findTarget(step.target!);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => alive && setRect(el.getBoundingClientRect()), 350); return; }
      if (++tries < 8) { setTimeout(look, 250); return; }
      if (step.optional) setI(n => Math.min(steps.length - 1, n + (dir.current))); else setRect(null);
    };
    look();
    return () => { alive = false; };
  }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !step?.target) return;
    const upd = () => { const el = findTarget(step.target!); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener('resize', upd); window.addEventListener('scroll', upd, true);
    return () => { window.removeEventListener('resize', upd); window.removeEventListener('scroll', upd, true); };
  }, [open, step]);
  useEffect(() => { if (!open) return; const kd = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') back(); }; document.addEventListener('keydown', kd); return () => document.removeEventListener('keydown', kd); });

  const next = () => { dir.current = 1; if (i >= steps.length - 1) close(); else { setRect(null); setI(i + 1); } };
  const back = () => { dir.current = -1; if (i > 0) { setRect(null); setI(i - 1); } };
  if (!open || !step) return null;

  const pad = 8; const vw = window.innerWidth, vh = window.innerHeight;
  const hole = rect ? { left: Math.max(4, rect.left - pad), top: Math.max(4, rect.top - pad), width: Math.min(vw - 8, rect.width + pad * 2), height: Math.min(vh - 8, rect.height + pad * 2) } : null;
  const below = hole ? hole.top + hole.height + 12 : 0; const cardH = 210;
  const cardTop = hole ? (below + cardH < vh ? below : Math.max(12, hole.top - cardH - 12)) : null;
  return createPortal(<div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`Tour step ${i + 1} of ${steps.length}: ${step.title}`}>
    {hole ? <div aria-hidden className="pointer-events-none absolute rounded-2xl ring-4 ring-brass-500 transition-all duration-300" style={{ ...hole, boxShadow: '0 0 0 9999px rgba(10,20,18,.62)' }} />
      : <div aria-hidden className="absolute inset-0 bg-[rgba(10,20,18,.62)]" />}
    <div className={cx('absolute left-1/2 w-[min(420px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl bg-white p-5 shadow-2xl', !hole && 'top-1/2 -translate-y-1/2')} style={hole ? { top: cardTop ?? 12 } : undefined}>
      <div className="flex items-start gap-3">
        {!hole && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brass-100 text-brass-700"><Sparkles size={20} /></span>}
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{i + 1} of {steps.length}</p><h2 className="text-lg font-bold">{step.title}</h2></div>
        <button type="button" onClick={close} aria-label="Skip the tour" className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-black/5"><X size={18} /></button>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={close} className="min-h-[40px] rounded-xl px-2 text-sm font-bold text-ink-faint hover:text-ink">Skip tour</button>
        <span className="flex-1" />
        {i > 0 && <button type="button" onClick={back} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3 text-sm font-bold text-ink-soft ring-1 ring-line"><ChevronLeft size={16} />Back</button>}
        <button type="button" onClick={next} autoFocus className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-pine-700 px-4 text-sm font-bold text-white">{i >= steps.length - 1 ? 'Finish' : i === 0 ? 'Show me' : 'Next'}{i < steps.length - 1 && <ChevronRight size={16} />}</button>
      </div>
      <div className="mt-3 flex justify-center gap-1" aria-hidden>{steps.map((_, n) => <i key={n} className={cx('h-1.5 rounded-full transition-all', n === i ? 'w-5 bg-pine-700' : 'w-1.5 bg-black/15')} />)}</div>
    </div>
  </div>, document.body);
}
function useDir() { const [r] = useState(() => ({ current: 1 })); return r; }
