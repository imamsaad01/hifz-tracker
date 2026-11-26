// In class: the teacher hears New, Recent and Old with one tap each.
// "No mistakes" saves it straight away (the student's seed becomes a golden star); "Mistakes…" opens the full sheet.
import { useState } from 'react';
import { Check } from 'lucide-react';
import { useOrg } from '../app/context';
import { friendly } from '../api/backend';
import { defaultRange } from './RecordSheet';
import { formatRange } from '../quran';
import { partsByDay, type Part } from '../lib/stars';
import { useToast, cx } from './ui';
import type { Session, SessionType, Student } from '../lib/types';
import type { StudentInsight } from '../lib/insights';

// Revision first, then the new lesson ("Revision will be tested before new memorization").
const COLS: Array<[Part, string, string]> = [['old', 'Old', 'bg-[#0369A1]'], ['recent', 'Recent', 'bg-[#9A6B1F]'], ['new', 'New', 'bg-[#047857]']];

export function QuickHear({ student, insight, sessions, pend, onSignOff, onMistakes, onSaved }: {
  student: Student; insight: StudentInsight; sessions: Session[]; pend: Session | null;
  onSignOff: (s: Session) => void; onMistakes: (t: SessionType) => void; onSaved: () => void;
}) {
  const { api, today } = useOrg(); const toast = useToast();
  const [busy, setBusy] = useState<Part | null>(null);
  const day = partsByDay(sessions, student.id).get(today);
  const heard = (p: Part) => { const g = day?.get(p); return g === 'gold' || g === 'star' ? g : null; };
  const rangeFor = (p: Part) => p === 'new' ? (pend?.range ?? insight.nextNew) : defaultRange(p, student, insight, sessions, today);
  const clean = async (p: Part) => {
    const range = rangeFor(p); if (!range) { toast('Nothing to hear for this part yet.', 'err'); return; }
    setBusy(p);
    try {
      await api.recordSession({ studentId: student.id, date: today, type: p, range, errorsMajor: 0, errorsMinor: 0, errors: [], scores: {}, attendance: 'present', mode: 'in_person' });
      toast(`${student.name.split(' ')[0]}: ${formatRange(range)} heard. Golden star 🌟`); onSaved();
    } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(null); }
  };
  return <div className="mt-4">
    <p className="mb-2 text-sm font-bold text-ink-soft">Heard it? One tap.</p>
    <div className="grid grid-cols-3 gap-2">{COLS.map(([p, label, bg]) => { const h = heard(p); const r = rangeFor(p);
      return <div key={p} className="flex flex-col gap-1.5 rounded-2xl bg-black/[.03] p-2 dark:bg-white/5">
        <span className="flex items-center gap-1.5 text-sm font-bold"><i className={cx('h-2.5 w-2.5 rounded-full', bg)} />{label}</span>
        <span className="min-h-[2.5em] text-xs leading-tight text-ink-faint">{r ? formatRange(r) : '—'}</span>
        {h ? <span className={cx('flex min-h-[48px] items-center justify-center gap-1 rounded-xl text-sm font-bold text-white', bg)}><Check size={16} strokeWidth={3} />{h === 'gold' ? 'Heard 🌟' : 'Heard'}</span>
          : p === 'new' && pend ? <button type="button" onClick={() => onSignOff(pend)} className="min-h-[48px] rounded-xl bg-[#047857] px-1 text-sm font-bold text-white">Sign off</button>
          : <>
            <button type="button" disabled={!r || busy !== null} onClick={() => clean(p)} className={cx('min-h-[48px] rounded-xl px-1 text-sm font-bold text-white disabled:opacity-40', bg)}>{busy === p ? 'Saving…' : '✓ No mistakes'}</button>
            <button type="button" disabled={!r} onClick={() => onMistakes(p)} className="min-h-[40px] rounded-xl text-sm font-bold text-ink-soft ring-1 ring-line disabled:opacity-40">Mistakes…</button>
          </>}
      </div>; })}</div>
  </div>;
}
