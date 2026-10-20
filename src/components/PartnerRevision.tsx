// Revision partners: confirm a classmate's revision and mark mistakes on exact ayahs. Weak ayahs come from those marks.
import { outbox, isNetworkError } from '../app/outbox';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Check, AlertTriangle, Eye } from 'lucide-react';
import { useOrg } from '../app/context';
import type { Session } from '../lib/types';
import { fromAyahId, surahNameEn, formatRange } from '../quran';
import { addDays, niceDate } from '../lib/dates';
import { friendly } from '../api/backend';
import { useRefresh } from './PullToRefresh';
import { Button, Card, CardHead, Field, Modal, Pill, inputCls, useToast, cx } from './ui';
import { InfoTip } from './InfoTip';
import { useAyahStarts } from '../lib/ayahText';
import { AyahPlayer } from './AyahPlayer';

export type AyahMark = { ayahId: number; severity: 'major' | 'minor' };

/** Tap an ayah once for a small mistake, twice for a big one, three times to clear. */
export function AyahMistakePicker({ start, end, value, onChange }: { start: number; end: number; value: AyahMark[]; onChange: (v: AyahMark[]) => void }) {
  const ids = useMemo(() => Array.from({ length: Math.min(end - start + 1, 300) }, (_, i) => start + i), [start, end]);
  const words = useAyahStarts();
  const at = (id: number) => value.find(v => v.ayahId === id)?.severity;
  const tap = (id: number) => { const cur = at(id); const rest = value.filter(v => v.ayahId !== id); onChange(cur === undefined ? [...rest, { ayahId: id, severity: 'minor' }] : cur === 'minor' ? [...rest, { ayahId: id, severity: 'major' }] : rest); };
  let lastSurah = 0;
  return <div>
    <p className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-ink-soft">Tap the ayah where a mistake happened <span className="font-normal text-ink-faint">(once = small, twice = big)</span><InfoTip k="smallMistake" /></p>
    <div className={cx('max-h-[300px] overflow-y-auto overscroll-contain rounded-xl bg-paper p-2 ring-1 ring-line', words ? 'flex flex-col gap-1' : 'flex flex-wrap gap-1.5')} data-no-pull>{ids.map(id => {
      const { surah, ayah } = fromAyahId(id); const head = surah !== lastSurah; lastSurah = surah; const sev = at(id);
      const tone = sev === 'major' ? 'bg-bad text-white ring-bad' : sev === 'minor' ? 'bg-amber-100 text-warn ring-warn/40' : 'bg-white text-ink-soft ring-line';
      return <span key={id} className="contents">{head && <span className="w-full px-1 pt-1 text-xs font-bold text-ink-faint">{surahNameEn(surah)}</span>}
        {words ? <button type="button" onClick={() => tap(id)} aria-pressed={!!sev} aria-label={`${surahNameEn(surah)} ayah ${ayah}${sev ? `, ${sev === 'major' ? 'big' : 'small'} mistake` : ''}`}
            className={cx('flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left ring-1 ring-inset', tone)}>
            <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums">{ayah}</span>
            <span lang="ar" dir="rtl" className="min-w-0 flex-1 truncate px-1 text-right font-quran text-lg leading-loose">{words[id - 1]}</span>
            {sev && <span className="shrink-0 text-[11px] font-bold uppercase">{sev === 'major' ? 'Big' : 'Small'}</span>}
          </button>
          : <button type="button" onClick={() => tap(id)} aria-pressed={!!sev} aria-label={`${surahNameEn(surah)} ayah ${ayah}${sev ? `, ${sev === 'major' ? 'big' : 'small'} mistake` : ''}`}
            className={cx('grid h-9 min-w-[36px] place-items-center rounded-lg px-1.5 text-sm font-bold tabular-nums ring-1 ring-inset', tone)}>{ayah}</button>}</span>;
    })}</div>
    {value.length > 0 && <p className="mt-1 text-xs text-ink-faint">{value.filter(v => v.severity === 'major').length} big · {value.filter(v => v.severity === 'minor').length} small</p>}
  </div>;
}

type Req = { session_id: string; student_name: string; type: string; start_ayah_id: number; end_ayah_id: number; date: string | Date; student_note: string | null };
const TYPE: Record<string, string> = { old: 'Old revision', recent: 'Recent revision', juz_revision: 'Full juz revision', review: 'Review' };

/** Student home: classmates' revision waiting for me to confirm */
export function PartnerRequestsCard() {
  const { api } = useOrg();
  const [rows, setRows] = useState<Req[]>([]); const [open, setOpen] = useState<Req | null>(null);
  const load = useCallback(() => api.partnerRequests().then(setRows).catch(() => setRows([])), [api]);
  useEffect(() => { load(); }, [load]); useRefresh(load);
  if (!rows.length) return null;
  return <Card className="ring-2 ring-brass-500/60">
    <CardHead title={<span className="inline-flex items-center gap-2"><Users size={18} className="text-brass-500" />Confirm your partner’s revision<InfoTip k="partner" /></span>} sub="You listened to them. Note any mistakes, then confirm." />
    <ul className="mt-2 divide-y divide-line">{rows.map(r => <li key={r.session_id} className="flex flex-wrap items-center gap-2 px-5 py-3">
      <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><b>{r.student_name}</b> · {TYPE[r.type] ?? r.type}<span className="block text-sm text-ink-soft">{formatRange({ start: r.start_ayah_id, end: r.end_ayah_id })} · {niceDate(r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10))}</span></span>
      <Button className="min-h-[40px]" onClick={() => setOpen(r)}><Check size={16} />Confirm</Button></li>)}</ul>
    {open && <PartnerConfirmModal r={open} onClose={() => setOpen(null)} onSaved={load} />}
  </Card>;
}
function PartnerConfirmModal({ r, onClose, onSaved }: { r: Req; onClose: () => void; onSaved: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const [marks, setMarks] = useState<AyahMark[]>([]); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const args = { errors: marks, errorsMajor: marks.filter(m => m.severity === 'major').length, errorsMinor: marks.filter(m => m.severity === 'minor').length, note }; try { await api.partnerConfirm(r.session_id, args); toast(`Confirmed. Jazāk Allāhu khayran.`); onSaved(); onClose(); } catch (e) { if (isNetworkError(e)) { outbox.add(`Confirm ${r.student_name}`, { __op: 'partnerConfirm', sessionId: r.session_id, args }); toast('No connection: saved on this phone and will send automatically.'); onClose(); } else toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <Modal open wide onClose={onClose} title={`${r.student_name}’s ${TYPE[r.type] ?? 'revision'}`} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}><Check size={16} />{marks.length ? `Confirm with ${marks.length} mistake${marks.length > 1 ? 's' : ''}` : 'Confirm: no mistakes'}</Button></div>}>
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-pine-50 px-3 py-2 text-[15px] text-pine-800">{formatRange({ start: r.start_ayah_id, end: r.end_ayah_id })}{r.student_note ? <span className="block text-sm text-pine-700">“{r.student_note}”</span> : null}</p>
      <AyahMistakePicker start={r.start_ayah_id} end={r.end_ayah_id} value={marks} onChange={setMarks} />
      <Field label="Note (optional)">{id => <input id={id} className={inputCls} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Mixed up the two similar ayahs" />}</Field>
    </div>
  </Modal>;
}

/** Ayahs with mistakes in the last 60 days, most frequent first */
export function weakAyahs(sessions: Session[], studentId: string, today: string) {
  const since = addDays(today, -60); const m = new Map<number, { n: number; big: number; last: string }>();
  for (const s of sessions) { if (s.studentId !== studentId || s.date < since) continue; for (const e of s.errors) { if (!e.ayahId) continue; const v = m.get(e.ayahId) ?? { n: 0, big: 0, last: s.date }; v.n++; if (e.severity === 'major') v.big++; if (s.date > v.last) v.last = s.date; m.set(e.ayahId, v); } }
  return [...m.entries()].map(([ayahId, v]) => ({ ayahId, ...v })).sort((a, b) => b.big - a.big || b.n - a.n || b.last.localeCompare(a.last));
}
export function WeakAyahsCard({ sessions, studentId, you = true, limit = 12 }: { sessions: Session[]; studentId: string; you?: boolean; limit?: number }) {
  const { today } = useOrg();
  const [pick, setPick] = useState<number | null>(null);
  const list = weakAyahs(sessions, studentId, today);
  if (!list.length) return null;
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><AlertTriangle size={18} className="text-warn" />Weak ayahs<InfoTip text="Ayahs where a mistake was marked in the last 60 days, by your partner or your teacher. Tap one to hear it on repeat." title="Weak ayahs" /></span>} sub={you ? 'Tap one to listen to it 5 times' : 'Mistakes marked in the last 60 days'} />
    <ul className="flex flex-wrap gap-1.5 px-5 pt-3">{list.slice(0, limit).map(w => { const { surah, ayah } = fromAyahId(w.ayahId); return <li key={w.ayahId}>
      <button type="button" aria-pressed={pick === w.ayahId} onClick={() => setPick(pick === w.ayahId ? null : w.ayahId)} className={cx('min-h-[36px] rounded-lg px-2.5 py-1 text-sm ring-1 ring-inset', pick === w.ayahId ? 'bg-pine-700 text-white ring-pine-700' : w.big ? 'bg-red-50 text-bad ring-bad/25' : 'bg-amber-50 text-warn ring-warn/25')}>
      <b>{surahNameEn(surah)} {ayah}</b> <span className="opacity-80">×{w.n}</span></button></li>; })}
      {list.length > limit && <li className="px-1 py-1 text-sm text-ink-faint">+{list.length - limit} more</li>}</ul>
    <div className="px-5 pb-5 pt-3">{pick !== null ? <AyahPlayer key={pick} range={{ start: pick, end: pick }} initialRepeat={5} compact /> : null}</div>
  </Card>;
}

/** Teacher, read-only: a student's revision this week and who confirmed it */
export function RevisionReadOnly({ sessions, studentId, names }: { sessions: Session[]; studentId: string; names: (id: string | null | undefined) => string }) {
  const { today } = useOrg();
  const list = sessions.filter(s => s.studentId === studentId && s.type !== 'new' && s.date >= addDays(today, -6)).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return <p className="text-sm text-ink-faint">No revision logged in the last 7 days.</p>;
  return <ul className="flex flex-col gap-1.5">{list.slice(0, 8).map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-line">
    <Eye size={14} className="text-ink-faint" /><span className="min-w-0 flex-1"><b>{TYPE[s.type] ?? s.type}</b> · {formatRange(s.range)} <span className="text-ink-faint">· {niceDate(s.date)}</span></span>
    {s.partnerStatus === 'confirmed' ? <Pill tone={s.errorsMajor + s.errorsMinor ? 'amber' : 'green'}>{names(s.partnerStudentId)} · {s.errorsMajor + s.errorsMinor} mistake{s.errorsMajor + s.errorsMinor === 1 ? '' : 's'}</Pill>
      : s.partnerStatus === 'pending' ? <Pill tone="slate">Waiting for {names(s.partnerStudentId)}</Pill> : <Pill tone="slate">{s.recordedBy === 'teacher' ? 'Recorded by teacher' : 'On their own'}</Pill>}
  </li>)}</ul>;
}
