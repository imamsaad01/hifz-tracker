// The student's whole day as three big buttons: New, Recent, Old.
// Tap → see what to read → "I did it!" → a star. Simple enough for a young child.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOrg } from '../app/context';
import { friendly } from '../api/backend';
import { outbox, isNetworkError } from '../app/outbox';
import { formatRange, type Range } from '../quran';
import { weekStart } from '../lib/schedule';
import { useToast, cx } from './ui';
import { MushafLink, rangeMarks } from './Mushaf';
import { AyahPlayer } from './AyahPlayer';
import type { RevisionCheckin } from '../api/data';
import type { Student } from '../lib/types';
import { garden, cheer, STARS_PER_LEVEL } from '../lib/stars';

export type PartState = 'todo' | 'done' | 'waiting' | 'rest';
export interface PartCard { key: 'new' | 'recent' | 'old'; what: string; range: Range | null; state: PartState; restText?: string; doneText?: string }

const LOOK = {
  new: { icon: '🌱', name: 'New', bg: 'bg-[#047857]', how: 'Listen, then say it 5 times without looking.' },
  recent: { icon: '🔁', name: 'Recent', bg: 'bg-[#9A6B1F]', how: 'Read it once, out loud.' },
  old: { icon: '🏔️', name: 'Old', bg: 'bg-[#0369A1]', how: 'Read it to a friend if you can.' },
} as const;
const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function SimpleToday({ student, name, cards, stars, streak, level, week, today, revisionForms, onSaved }: {
  student: Student; name: string; cards: PartCard[]; stars: number; streak: number; level: { level: number; into: number; need: number };
  week: Array<{ date: string; count: number }>; today: string; revisionForms: RevisionCheckin[]; onSaved: () => void;
}) {
  const [open, setOpen] = useState<PartCard | null>(null);
  const due = cards.filter(c => c.state !== 'rest');
  const done = due.filter(c => c.state === 'done' || c.state === 'waiting').length;
  const cheer = !due.length ? 'Rest day today. 😴' : done === 0 ? 'Tap a button to start!' : done < due.length ? `${done} of ${due.length} done. Keep going!` : 'All done today. Mā shāʾ Allāh! 🎉';
  return <div className="mx-auto flex max-w-md flex-col gap-4">
    <div className="flex items-center gap-3">
      <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">Salaam, {name}!</h1>
      <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-lg font-bold tabular-nums ring-2 ring-line dark:bg-paper" title="Days in a row" aria-label={`${streak} days in a row`}>🔥 {streak}</span>
      <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-lg font-bold tabular-nums ring-2 ring-line dark:bg-paper" title="Stars" aria-label={`${stars} stars`}>⭐ {stars}</span>
    </div>

    <ol className="flex justify-between" aria-label="This week">
      {week.map((d, i) => { const isToday = d.date === today; const got = d.count > 0;
        return <li key={d.date} className="flex flex-col items-center gap-1 text-xs font-bold text-ink-faint">
          <span className={cx('grid h-10 w-10 place-items-center rounded-full text-xl font-bold leading-none', got ? 'bg-[#FFD23F] text-[#9A5B00] ring-2 ring-[#E8A317]' : 'border-2 border-dashed border-line', isToday && 'outline outline-2 outline-offset-2 outline-ink')} aria-label={`${DAY[i]}: ${got ? `${d.count} done` : 'nothing yet'}`}>{got ? '★' : ''}</span>{DAY[i]}
        </li>; })}
    </ol>

    {cards.map(c => { const L = LOOK[c.key]; const finished = c.state === 'done' || c.state === 'waiting'; const rest = c.state === 'rest';
      return <button key={c.key} type="button" disabled={rest || finished} onClick={() => setOpen(c)}
        className={cx('flex min-h-[104px] w-full items-center gap-4 rounded-[28px] px-5 py-4 text-left shadow-[inset_0_-8px_0_rgba(0,0,0,.18)] transition active:scale-[.97] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFD23F] disabled:active:scale-100',
          finished ? 'bg-[#FFD23F] text-[#1B2433]' : rest ? 'bg-black/[.06] text-ink-faint shadow-none dark:bg-white/10' : `${L.bg} text-white`)}>
        <span className="w-14 shrink-0 text-center text-5xl leading-none" aria-hidden>{L.icon}</span>
        <span className="min-w-0 flex-1"><span className="block text-[28px] font-bold leading-none">{L.name}</span>
          <span className="mt-1.5 block truncate text-base opacity-90">{finished ? (c.doneText ?? 'Done!') : rest ? (c.restText ?? 'Nothing today') : c.what}</span></span>
        {finished && <span className="shrink-0 text-4xl" aria-hidden>{c.state === 'waiting' ? '⏳' : '✅'}</span>}
      </button>; })}

    <p role="status" className="text-center text-lg font-bold">{cheer}</p>
    <div className="mx-auto w-full max-w-xs" aria-label={`Level ${level.level}: ${level.into} of ${level.need} stars`}>
      <a href="#/progress" className="mb-1 block text-center text-sm font-bold text-ink-soft underline-offset-2 hover:underline">{garden(level.level).plant} {garden(level.level).name} garden · {level.need - level.into} stars to the next one</a>
      <div className="h-3 overflow-hidden rounded-full bg-black/[.08] dark:bg-white/10"><div className="h-full rounded-full bg-[#E8A317] transition-all duration-700" style={{ width: `${(level.into / level.need) * 100}%` }} /></div>
    </div>

    {open && <PartSheet card={open} stars={stars} student={student} today={today} revisionForms={revisionForms} onClose={() => setOpen(null)} onSaved={onSaved} />}
  </div>;
}

type Step = 'read' | 'friend' | 'yay';
function PartSheet({ card, stars, student, today, revisionForms, onClose, onSaved }: { card: PartCard; stars: number; student: Student; today: string; revisionForms: RevisionCheckin[]; onClose: () => void; onSaved: () => void }) {
  const { api, org } = useOrg(); const toast = useToast();
  const L = LOOK[card.key];
  const [step, setStep] = useState<Step>('read'); const [hard, setHard] = useState(false); const [busy, setBusy] = useState(false);
  const [mates, setMates] = useState<Array<{ student_id: string; name: string; same_class: boolean }>>([]);
  const [gain, setGain] = useState(1);
  useEffect(() => { if (card.key === 'old') api.revisionPartners().then(setMates).catch(() => setMates([])); }, [card.key, api]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  const range = card.range;
  const note = (h: boolean) => (h ? 'This one was hard' : undefined);

  const save = async (h: boolean, partner: { id: string; name: string } | null) => {
    if (!range) return; setBusy(true);
    try {
      if (card.key === 'new') {
        const args = { studentId: student.id, start: range.start, end: range.end, note: note(h) ?? '' };
        try { await api.submitLesson(args); } catch (e) { if (isNetworkError(e)) outbox.add(`New lesson · ${formatRange(range)}`, { __op: 'submitLesson', args }); else throw e; }
      } else {
        const payload = { studentId: student.id, date: today, type: card.key, range, errorsMajor: 0, errorsMinor: 0, errors: [], scores: {}, attendance: 'present', mode: 'in_person', studentNote: note(h), followUp: h };
        let sid: string | null = null;
        try { sid = await api.recordSession(payload); } catch (e) { if (isNetworkError(e)) outbox.add(`${student.name} · ${formatRange(range)}`, { ...(payload as unknown as Record<string, unknown>), ...(partner ? { __partner: partner.id } : {}) }); else throw e; }
        if (partner && sid) { try { await api.requestPartner(sid, partner.id); } catch { /* the revision itself is saved */ } }
        // Old revision also ticks this week's next partner-revision slot, so there is no separate form to fill.
        if (card.key === 'old') {
          const wk = weekStart(today); const doneSlots = new Set(revisionForms.filter(f => f.studentId === student.id && f.weekStart === wk && f.done).map(f => f.slot));
          const slot = org.settings.revisionForm.slots.find(x => !doneSlots.has(x.key));
          if (slot) { try { await api.saveRevisionCheckin(org.id, { studentId: student.id, weekStart: wk, slot: slot.key, done: true, partner: partner?.name ?? 'On my own', pages: formatRange(range), recorded: false, recordingLink: '' }); } catch { /* */ } }
        }
      }
      setGain(partner ? 2 : 1); setStep('yay'); onSaved();
    } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  const did = (h: boolean) => { setHard(h); if (card.key === 'old') setStep('friend'); else void save(h, null); };

  const big = 'w-full min-h-[64px] rounded-[22px] px-4 text-2xl font-bold shadow-[inset_0_-6px_0_rgba(0,0,0,.15)] active:scale-[.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#0369A1]';
  return createPortal(<div role="dialog" aria-modal="true" aria-label={L.name} className="fixed inset-0 z-50 flex flex-col bg-paper pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
    <div className="flex justify-end px-3"><button type="button" onClick={onClose} aria-label="Close" className="grid h-12 w-12 place-items-center rounded-2xl hover:bg-black/5"><X size={26} /></button></div>
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 text-center">
      {step === 'read' && <>
        <span className="text-7xl" aria-hidden>{L.icon}</span>
        <p className="text-3xl font-bold leading-tight">{card.what}</p>
        <p className="text-lg text-ink-soft">{L.how}</p>
        {range && <MushafLink range={range} title={L.name} marks={rangeMarks(range, card.key === 'new' ? 'lesson' : 'revision')} label="Open the muṣḥaf" className="min-h-[52px] px-5 text-base" />}
        {range && card.key === 'new' && <div className="w-full text-left"><AyahPlayer range={range} compact /></div>}
        <button type="button" disabled={busy} onClick={() => did(false)} className={cx(big, 'mt-2 bg-[#FFD23F] text-[#1B2433]')}>I did it!</button>
        <button type="button" disabled={busy} onClick={() => did(true)} className={cx(big, 'bg-black/[.06] text-ink shadow-none dark:bg-white/10')}>It was hard</button>
      </>}
      {step === 'friend' && <>
        <span className="text-7xl" aria-hidden>👂</span>
        <p className="text-3xl font-bold">Did a friend listen?</p>
        <p className="text-lg text-ink-soft">Tap their name for a bonus star.</p>
        <div className="grid w-full grid-cols-2 gap-3">
          {mates.filter(m => m.same_class !== false).slice(0, 12).map(m => <button key={m.student_id} type="button" disabled={busy} onClick={() => save(hard, { id: m.student_id, name: m.name })} className={cx(big, 'min-h-[56px] truncate bg-[#0369A1] text-xl text-white')}>{m.name.split(' ')[0]}</button>)}
        </div>
        <button type="button" disabled={busy} onClick={() => save(hard, null)} className={cx(big, 'bg-black/[.06] text-ink shadow-none dark:bg-white/10')}>No, on my own</button>
      </>}
      {step === 'yay' && <>
        <span className="done-pop text-8xl" aria-hidden>{gain > 1 ? '⭐⭐' : '⭐'}</span>
        <p className="text-4xl font-bold">+{gain} star{gain > 1 ? 's' : ''}!</p>
        <p className="text-lg text-ink-soft">{card.key === 'new' ? 'Your teacher will check it in class.' : hard ? 'Hard is good. Your teacher will help with it.' : cheer(Date.now() >> 10)}</p>
        <p className="text-base font-bold text-[#9A5B00]">{garden(Math.floor(stars / STARS_PER_LEVEL) + 1).plant} A new plant in your garden</p>
        <button type="button" autoFocus onClick={onClose} className={cx(big, 'bg-[#FFD23F] text-[#1B2433]')}>Yay!</button>
      </>}
    </div>
  </div>, document.body);
}
