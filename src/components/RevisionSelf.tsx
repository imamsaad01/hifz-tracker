// Students log their own revision; the teacher checks it. Students choose where their Old revision starts.
import { useMemo, useState } from 'react';
import { Check, RotateCcw, ClipboardCheck, Flag, Undo2 } from 'lucide-react';
import { useOrg } from '../app/context';
import type { OrgData } from '../app/useOrgData';
import type { Session, Student } from '../lib/types';
import { fromAyahId, pageOf, surahFirstId, surahNameEn, surahNameAr, formatRange, ayahCount, ayahId } from '../quran';
import { unionRanges } from '../lib/progress';
import { niceDate, addDays } from '../lib/dates';
import { friendly } from '../api/backend';
import { Button, Card, CardHead, Field, Modal, Pill, Select, Segmented, inputCls, useToast, cx } from './ui';

/** Surahs the student has memorised (any part of), in mushaf order */
function memorisedSurahs(st: Student): number[] {
  const out = new Set<number>();
  for (const r of unionRanges(st.memorized)) { const a = fromAyahId(r.start).surah, b = fromAyahId(r.end).surah; for (let s = a; s <= b; s++) out.add(s); }
  return [...out].sort((x, y) => x - y);
}
export function startLabel(st: Student) {
  if (!st.revisionStartPage) return null;
  const s = memorisedSurahs(st).find(x => pageOf(surahFirstId(x)) === st.revisionStartPage);
  return s ? `${surahNameEn(s)} (page ${st.revisionStartPage})` : `page ${st.revisionStartPage}`;
}

export function RevisionStartModal({ student, onClose, onSaved }: { student: Student; onClose: () => void; onSaved: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const surahs = useMemo(() => memorisedSurahs(student), [student]);
  const pages = useMemo(() => [...new Set(surahs.map(s => pageOf(surahFirstId(s))))], [surahs]);
  const [by, setBy] = useState<'surah' | 'page'>('surah');
  const [surah, setSurah] = useState(surahs.find(s => pageOf(surahFirstId(s)) === student.revisionStartPage) ?? surahs[0] ?? 1);
  const [page, setPage] = useState<number>(student.revisionStartPage ?? pages[0] ?? 1);
  const [busy, setBusy] = useState(false);
  const chosen = by === 'surah' ? pageOf(surahFirstId(surah)) : page;
  const save = async (p: number | null) => { setBusy(true); try { await api.setRevisionStart(student.id, p); toast(p ? 'Saved. Your Old revision continues from there automatically.' : 'Back to the default order.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <Modal open onClose={onClose} title="Where should Old revision start?" footer={<div className="flex flex-wrap justify-end gap-2">
    {student.revisionStartPage && <Button kind="quiet" onClick={() => save(null)}><Undo2 size={15} />Default order</Button>}
    <Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={() => save(chosen)}>Start here</Button></div>}>
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-ink-soft">Choose where you are now. Each revision day gives the next pages in order from here, then goes round again. Weak pages your teacher marked still come first.</p>
      <Segmented label="Choose by" value={by} onChange={setBy} options={[['surah', 'By surah'], ['page', 'By page']]} />
      {by === 'surah' ? <Field label="Start from the beginning of">{id => <Select id={id} value={surah} onChange={setSurah} options={surahs.map(s => [s, `${s}. ${surahNameEn(s)} · ${surahNameAr(s)} (page ${pageOf(surahFirstId(s))})`] as [number, string])} />}</Field>
        : <Field label="Page (Madani muṣḥaf)">{id => <input id={id} type="number" inputMode="numeric" min={1} max={604} className={inputCls} value={page} onChange={e => setPage(Math.max(1, Math.min(604, Number(e.target.value) || 1)))} />}</Field>}
    </div>
  </Modal>;
}

const LOGGED: Array<Session['type']> = ['new', 'old', 'recent', 'juz_revision'];
const TYPE_NAME: Partial<Record<Session['type'], string>> = { new: 'New lesson', old: 'Old', recent: 'Recent', juz_revision: 'Juz' };
const mistakes = (s: Session) => s.errorsMajor + s.errorsMinor;
const statusPill = (s: Session) => s.checkStatus === 'ok' ? <Pill tone="green"><Check size={12} />Signed off{mistakes(s) ? ` · ${mistakes(s)} mistake${mistakes(s) > 1 ? 's' : ''}` : ''}</Pill>
  : s.checkStatus === 'redo' ? <Pill tone="red">Redo</Pill> : <Pill tone="slate">Waiting for sign-off</Pill>;
const isSelf = (s: Session) => !!s.selfLogged || s.recordedBy === 'student';

/** Student / parent: what they submitted this week and the teacher's sign-off */
export function MyRevisionLog({ studentId, sessions, onStart, start }: { studentId: string; sessions: Session[]; onStart?: () => void; start?: string | null }) {
  const { today } = useOrg();
  const mine = sessions.filter(s => s.studentId === studentId && isSelf(s) && LOGGED.includes(s.type) && s.date >= addDays(today, -7));
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><RotateCcw size={18} className="text-pine-700" />My lessons & revision this week</span>} sub="Submit what you read. Your teacher signs it off and notes any mistakes." />
    {(onStart || start) && <p className="flex flex-wrap items-center gap-2 px-5 pt-3 text-sm"><Flag size={14} className="text-brass-500" />Old revision {start ? <>started from <b>{start}</b></> : 'follows the default order'}{onStart && <button type="button" className="font-bold text-pine-700 underline-offset-2 hover:underline" onClick={onStart}>{start ? 'Change' : 'Choose where to start'}</button>}</p>}
    {mine.length ? <ul className="mt-2 divide-y divide-line">{mine.map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <span className="min-w-0 flex-1"><b>{TYPE_NAME[s.type]}</b> · {formatRange(s.range)}<span className="block text-sm text-ink-faint">{niceDate(s.date)}{s.checkNote ? <> · <span className="text-ink-soft">Teacher: “{s.checkNote}”</span></> : ''}</span></span>{statusPill(s)}</li>)}</ul>
      : <p className="px-5 py-4 text-sm text-ink-faint">Nothing submitted in the last 7 days.</p>}
  </Card>;
}

/** Teacher: lessons and revision students submitted, to sign off with mistakes and a note */
export function RevisionCheckCard({ data, onChanged, studentId }: { data: OrgData; onChanged: () => void; studentId?: string }) {
  const { api, today } = useOrg(); const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Session | null>(null);
  const todo = data.sessions.filter(s => isSelf(s) && LOGGED.includes(s.type) && !s.checkStatus && s.date >= addDays(today, -14) && (!studentId || s.studentId === studentId))
    .sort((a, b) => (a.type === 'new' ? 0 : 1) - (b.type === 'new' ? 0 : 1) || a.date.localeCompare(b.date));
  if (!todo.length) return null;
  const name = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  const quick = async (ids: string[]) => { setBusy(ids.join()); try { await api.checkSessions(ids, 'ok'); toast(`${ids.length} signed off.`); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(null); } };
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><ClipboardCheck size={18} className="text-pine-700" />To sign off <span className="rounded-full bg-pine-50 px-2 text-sm text-pine-800">{todo.length}</span></span>}
      sub="What students say they read. Sign off, add mistakes, or send back." action={todo.length > 1 ? <Button kind="secondary" className="min-h-[38px] px-3 text-sm" busy={busy === todo.map(t => t.id).join()} onClick={() => quick(todo.map(t => t.id))}><Check size={15} />Sign off all (no mistakes)</Button> : undefined} />
    <ul className="mt-2 divide-y divide-line">{todo.slice(0, 40).map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">{!studentId && <b>{name(s.studentId)} · </b>}<span className={s.type === 'new' ? 'font-bold text-pine-800' : ''}>{TYPE_NAME[s.type]}</span>: {formatRange(s.range)}
        <span className="block text-sm text-ink-faint">{niceDate(s.date)}{mistakes(s) ? ` · student noted ${mistakes(s)} mistake(s)` : ''}{s.studentNote ? ` · “${s.studentNote}”` : ''}</span></span>
      <Button className="min-h-[38px] px-3 text-sm" onClick={() => setOpen(s)}><ClipboardCheck size={15} />Sign off</Button>
      <Button kind="quiet" aria-label="Sign off with no mistakes" className="min-h-[38px] px-2 text-sm" busy={busy === s.id} onClick={() => quick([s.id])}><Check size={16} /></Button>
    </li>)}</ul>
    {open && <SignOffModal s={open} who={name(open.studentId)} onClose={() => setOpen(null)} onSaved={onChanged} />}
  </Card>;
}

function Stepper({ label, value, onChange, tone }: { label: string; value: number; onChange: (n: number) => void; tone: 'bad' | 'warn' }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 ring-1 ring-line">
    <span className="text-[15px] font-bold">{label}</span>
    <span className="flex items-center gap-2">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl font-bold ring-1 ring-line">−</button>
      <span className={cx('w-8 text-center text-xl font-bold tabular-nums', value ? (tone === 'bad' ? 'text-bad' : 'text-warn') : 'text-ink-faint')}>{value}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(99, value + 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl font-bold ring-1 ring-line">+</button>
    </span>
  </div>;
}
const NOTE_CHIPS = ['Excellent, keep it up', 'Weak in the middle, read it again', 'Confused similar ayahs', 'Watch the madd and ghunnah', 'Hesitated a lot, revise before next class'];
function SignOffModal({ s, who, onClose, onSaved }: { s: Session; who: string; onClose: () => void; onSaved: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const [maj, setMaj] = useState(s.errorsMajor); const [min, setMin] = useState(s.errorsMinor); const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'ok' | 'redo' | null>(null);
  const go = async (status: 'ok' | 'redo') => { setBusy(status); try { await api.signOff(s.id, { status, errorsMajor: maj, errorsMinor: min, note }); toast(status === 'ok' ? `Signed off for ${who}.` : `Sent back to ${who}.`); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(null); } };
  return <Modal open onClose={onClose} title={`Sign off: ${who}`} footer={<div className="flex flex-wrap justify-end gap-2"><Button kind="secondary" busy={busy === 'redo'} onClick={() => go('redo')}>Send back to redo</Button><Button busy={busy === 'ok'} onClick={() => go('ok')}><Check size={16} />Sign off</Button></div>}>
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-pine-50 px-3 py-2 text-[15px] text-pine-800"><b>{TYPE_NAME[s.type]}</b> · {formatRange(s.range)}<span className="block text-sm text-pine-700">{niceDate(s.date)}{s.studentNote ? ` · “${s.studentNote}”` : ''}</span></p>
      {s.type === 'new' && <p className="text-sm text-ink-soft">Signing off adds this lesson to what {who.split(' ')[0]} has memorised.</p>}
      <Stepper label="Big mistakes" value={maj} onChange={setMaj} tone="bad" />
      <Stepper label="Small mistakes" value={min} onChange={setMin} tone="warn" />
      <Field label="Note for the student (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[80px] py-2`} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Which ayahs, what to fix…" />}</Field>
      <div className="flex flex-wrap gap-1.5">{NOTE_CHIPS.map(c => <button key={c} type="button" onClick={() => setNote(n => (n ? `${n} ${c}.` : `${c}.`))} className="min-h-[34px] rounded-full bg-white px-3 text-xs font-bold text-ink-soft ring-1 ring-line hover:bg-pine-50">{c}</button>)}</div>
    </div>
  </Modal>;
}

/** Student: submit the new lesson they memorised (counts once the teacher signs it off) */
export function SubmitLessonModal({ student, suggested, onClose, onSaved }: { student: Student; suggested: { start: number; end: number }; onClose: () => void; onSaved: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const startA = fromAyahId(suggested.start); const total = ayahCount(startA.surah);
  const [endAyah, setEndAyah] = useState(fromAyahId(suggested.end).ayah); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.submitLesson({ studentId: student.id, start: suggested.start, end: ayahId(startA.surah, endAyah), note }); toast('Submitted. Your teacher will sign it off.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <Modal open onClose={onClose} title="I memorised my new lesson" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}><Check size={16} />Submit for sign-off</Button></div>}>
    <div className="flex flex-col gap-4">
      <p className="text-[15px]"><b>{surahNameEn(startA.surah)}</b> <span lang="ar" dir="rtl" className="font-quran">{surahNameAr(startA.surah)}</span>, from ayah {startA.ayah}</p>
      <Field label="Up to ayah">{id => <Select id={id} value={endAyah} onChange={setEndAyah} options={Array.from({ length: total - startA.ayah + 1 }, (_, i) => startA.ayah + i).map(n => [n, `Ayah ${n}`] as [number, string])} />}</Field>
      <Field label="Anything for your teacher? (optional)">{id => <input id={id} className={inputCls} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Ayah 5 is still a bit weak" />}</Field>
      <p className="text-sm text-ink-faint">It counts as memorised once your teacher signs it off.</p>
    </div>
  </Modal>;
}
