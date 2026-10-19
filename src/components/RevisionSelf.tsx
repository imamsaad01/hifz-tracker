// Students log their own revision; the teacher checks it. Students choose where their Old revision starts.
import { useMemo, useState } from 'react';
import { Check, RotateCcw, ClipboardCheck, Flag, Undo2 } from 'lucide-react';
import { useOrg } from '../app/context';
import type { OrgData } from '../app/useOrgData';
import type { Session, Student } from '../lib/types';
import { fromAyahId, pageOf, surahFirstId, surahNameEn, surahNameAr, formatRange } from '../quran';
import { unionRanges } from '../lib/progress';
import { niceDate, addDays } from '../lib/dates';
import { friendly } from '../api/backend';
import { Button, Card, CardHead, Field, Modal, Pill, Select, Segmented, inputCls, useToast } from './ui';

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

const LOGGED: Array<Session['type']> = ['old', 'recent', 'juz_revision'];
const TYPE_NAME: Partial<Record<Session['type'], string>> = { old: 'Old', recent: 'Recent', juz_revision: 'Juz' };
const statusPill = (s: Session) => s.checkStatus === 'ok' ? <Pill tone="green"><Check size={12} />Checked</Pill> : s.checkStatus === 'redo' ? <Pill tone="red">Redo</Pill> : <Pill tone="slate">Waiting for check</Pill>;

/** Student / parent: the revision they logged this week and whether the teacher has checked it */
export function MyRevisionLog({ studentId, sessions, onStart, start }: { studentId: string; sessions: Session[]; onStart?: () => void; start?: string | null }) {
  const { today } = useOrg();
  const mine = sessions.filter(s => s.studentId === studentId && s.recordedBy === 'student' && LOGGED.includes(s.type) && s.date >= addDays(today, -7));
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><RotateCcw size={18} className="text-pine-700" />My revision this week</span>} sub="Log your revision with “I revised this”. Your teacher checks it." />
    {(onStart || start) && <p className="flex flex-wrap items-center gap-2 px-5 pt-3 text-sm"><Flag size={14} className="text-brass-500" />Old revision {start ? <>started from <b>{start}</b></> : 'follows the default order'}{onStart && <button type="button" className="font-bold text-pine-700 underline-offset-2 hover:underline" onClick={onStart}>{start ? 'Change' : 'Choose where to start'}</button>}</p>}
    {mine.length ? <ul className="mt-2 divide-y divide-line">{mine.map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <span className="min-w-0 flex-1"><b>{TYPE_NAME[s.type]}</b> · {formatRange(s.range)}<span className="block text-sm text-ink-faint">{niceDate(s.date)}{s.checkNote ? ` · “${s.checkNote}”` : ''}</span></span>{statusPill(s)}</li>)}</ul>
      : <p className="px-5 py-4 text-sm text-ink-faint">Nothing logged in the last 7 days.</p>}
  </Card>;
}

/** Teacher: revision students logged themselves, waiting for a check */
export function RevisionCheckCard({ data, onChanged, studentId }: { data: OrgData; onChanged: () => void; studentId?: string }) {
  const { api, today } = useOrg(); const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [redo, setRedo] = useState<Session | null>(null); const [note, setNote] = useState('');
  const todo = data.sessions.filter(s => s.recordedBy === 'student' && LOGGED.includes(s.type) && !s.checkStatus && s.date >= addDays(today, -14) && (!studentId || s.studentId === studentId))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!todo.length) return null;
  const name = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  const check = async (ids: string[], status: 'ok' | 'redo', n?: string) => { setBusy(ids.join()); try { await api.checkSessions(ids, status, n); toast(status === 'ok' ? `${ids.length} checked.` : 'Sent back to redo.'); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(null); } };
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><ClipboardCheck size={18} className="text-pine-700" />Revision to check <span className="rounded-full bg-pine-50 px-2 text-sm text-pine-800">{todo.length}</span></span>}
      sub="Students logged these themselves" action={todo.length > 1 ? <Button kind="secondary" className="min-h-[38px] px-3 text-sm" busy={busy === todo.map(t => t.id).join()} onClick={() => check(todo.map(t => t.id), 'ok')}><Check size={15} />Check all</Button> : undefined} />
    <ul className="mt-2 divide-y divide-line">{todo.slice(0, 30).map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">{!studentId && <b>{name(s.studentId)} · </b>}{TYPE_NAME[s.type]}: {formatRange(s.range)}
        <span className="block text-sm text-ink-faint">{niceDate(s.date)}{s.errorsMajor + s.errorsMinor ? ` · ${s.errorsMajor + s.errorsMinor} mistake(s) noted` : ''}{s.studentNote ? ` · “${s.studentNote}”` : ''}</span></span>
      <Button className="min-h-[38px] px-3 text-sm" busy={busy === s.id} onClick={() => check([s.id], 'ok')}><Check size={15} />Checked</Button>
      <Button kind="secondary" className="min-h-[38px] px-3 text-sm" onClick={() => { setRedo(s); setNote(''); }}>Redo</Button>
    </li>)}</ul>
    {redo && <Modal open onClose={() => setRedo(null)} title={`Ask ${name(redo.studentId)} to redo`} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={() => setRedo(null)}>Cancel</Button><Button busy={busy === redo.id} onClick={async () => { await check([redo.id], 'redo', note); setRedo(null); }}>Send</Button></div>}>
      <Field label="Note for the student (optional)">{id => <input id={id} className={inputCls} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Read it again with your partner tonight" />}</Field>
    </Modal>}
  </Card>;
}
