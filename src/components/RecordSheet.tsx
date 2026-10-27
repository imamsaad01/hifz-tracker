// Quick record: one sheet, everything pre-filled, three taps to save.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button, Segmented, Stepper, Field, Select, Toggle, inputCls, useToast, ErrorBox, cx } from './ui';
import { RangePicker, ScoreInput } from './quran';
import { ERROR_LABEL, SESSION_LABEL, type ErrorCategory, type ErrorSeverity, type Session, type SessionError, type SessionType, type Student } from '../lib/types';
import { fromAyahId, pageRange, surahRange, type Range } from '../quran';
import { groupPages } from '../lib/revision';
import { recentRanges, type StudentInsight } from '../lib/insights';
import { unionRanges } from '../lib/progress';
import { useApp } from '../app/context';
import { friendly } from '../api/backend';
import { outbox, isNetworkError } from '../app/outbox';
import { formatRange } from '../quran';
import type { RevisionCheckin } from '../api/data';
import { weekStart } from '../lib/schedule';

export function defaultRange(type: SessionType, st: Student, ins: StudentInsight, sessions: Session[], today: string): Range {
  if (type === 'new' && ins.nextNew) return ins.nextNew;
  if (type === 'recent') { const r = recentRanges(sessions, st.id, today, 7); if (r.length) return r[r.length - 1]; }
  if ((type === 'old' || type === 'review' || type === 'juz_revision') && ins.revision.today.length) {
    const [a, b] = groupPages(ins.revision.today.map(i => i.page))[0];
    return { start: pageRange(a).start, end: pageRange(b).end };
  }
  const mem = unionRanges(st.memorized);
  if (mem.length) return mem[mem.length - 1];
  return ins.nextNew ?? surahRange(114);
}

const TEACHER_TYPES: Array<[SessionType, string]> = [['new', 'New lesson'], ['recent', 'Recent revision'], ['old', 'Old revision']];
const OTHER_TYPES: Array<[SessionType, string]> = (['juz_revision', 'assessment', 'catch_up', 'review', 'other'] as SessionType[]).map(t => [t, SESSION_LABEL[t]]);
const CATS = Object.entries(ERROR_LABEL) as Array<[ErrorCategory, string]>;

export function RecordSheet({ open, onClose, student, insight, sessions, asStudent, initialType = 'new', initialDate, revisionForms, onSaved }: {
  open: boolean; onClose: () => void; student: Student; insight: StudentInsight; sessions: Session[]; asStudent?: boolean; initialType?: SessionType; initialDate?: string; revisionForms?: RevisionCheckin[]; onSaved: () => void;
}) {
  const { api, org, today } = useApp();
  const toast = useToast();
  const scale = org?.settings.scoreScale ?? 5;
  const [type, setType] = useState<SessionType>((asStudent ? (['old', 'recent', 'review'].includes(initialType) ? initialType : 'old') : initialType));
  const [range, setRange] = useState<Range>(() => defaultRange((asStudent ? (['old', 'recent', 'review'].includes(initialType) ? initialType : 'old') : initialType), student, insight, sessions, today));
  const [date, setDate] = useState(initialDate ?? today);
  const [major, setMajor] = useState(0); const [minor, setMinor] = useState(0);
  const [tags, setTags] = useState<SessionError[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({ overall: null, tajweed: null, fluency: null, accuracy: null, tarteel: null });
  const [more, setMore] = useState(false);
  const [attendance, setAttendance] = useState('present'); const [mode, setMode] = useState('in_person');
  const [note, setNote] = useState(''); const [followUp, setFollowUp] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [partner, setPartner] = useState(''); const [mates, setMates] = useState<Array<{ student_id: string; name: string }>>([]);
  useEffect(() => { if (open && asStudent) api.revisionPartners().then(setMates).catch(() => setMates([])); }, [open, asStudent, api]);

  useEffect(() => { if (open) { const t = (asStudent ? (['old', 'recent', 'review'].includes(initialType) ? initialType : 'old') : initialType); setType(t); setRange(defaultRange(t, student, insight, sessions, today)); setDate(initialDate ?? today); setMajor(0); setMinor(0); setTags([]); setScores({ overall: null, tajweed: null, fluency: null, accuracy: null, tarteel: null }); setAttendance('present'); setMode('in_person'); setNote(''); setFollowUp(false); setErr(null); } }, [open, student.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickType = (t: SessionType) => { setType(t); setRange(defaultRange(t, student, insight, sessions, today)); };
  const ayahChoices = useMemo<Array<[number, string]>>(() => { const out: Array<[number, string]> = []; for (let id = range.start; id <= Math.min(range.end, range.start + 400); id++) { const { surah, ayah } = fromAyahId(id); out.push([id, `${surah}:${ayah}`]); } return out; }, [range]);
  const absent = attendance === 'absent' || attendance === 'excused';

  const save = async () => {
    setBusy(true); setErr(null);
    const payload = {
      studentId: student.id, date, type, range, errorsMajor: Math.max(major, tags.filter(t => t.severity === 'major').length), errorsMinor: Math.max(minor, tags.filter(t => t.severity === 'minor').length),
      errors: tags, scores: asStudent ? {} : scores, attendance: asStudent ? 'present' : attendance, mode, teacherNote: asStudent ? undefined : note, studentNote: asStudent ? note : undefined, followUp,
    };
    try {
      const sid = await api.recordSession(payload);
      if (asStudent && partner && sid) { try { await api.requestPartner(sid, partner); } catch (e) { toast(friendly(e), 'err'); } }
      // One log fills both records: an Old revision also ticks this week's next partner-revision slot.
      if (asStudent && type === 'old' && org && revisionForms) {
        const wk = weekStart(date); const doneSlots = new Set(revisionForms.filter(f => f.studentId === student.id && f.weekStart === wk && f.done).map(f => f.slot));
        const slot = org.settings.revisionForm.slots.find(x => !doneSlots.has(x.key));
        if (slot) { try { await api.saveRevisionCheckin(org.id, { studentId: student.id, weekStart: wk, slot: slot.key, done: true, partner: mates.find(m => m.student_id === partner)?.name ?? 'On my own', pages: formatRange(range), recorded: false, recordingLink: '' }); } catch { /* the session itself is saved */ } }
      }
      if (!asStudent && org?.settings.email.enabled && org.settings.email.onSession) api.notify({ type: 'session', student_id: student.id, date }).catch(() => {});
      toast(asStudent && partner ? `Saved. ${mates.find(m => m.student_id === partner)?.name.split(' ')[0] ?? 'Your partner'} will be asked to confirm it.` : `Saved: ${student.name}, ${formatRange(range)}`); onSaved(); onClose();
    } catch (e) {
      if (isNetworkError(e)) { outbox.add(`${student.name} · ${formatRange(range)}`, { ...(payload as unknown as Record<string, unknown>), ...(asStudent && partner ? { __partner: partner } : {}) }); toast('No connection: kept on this device and will send automatically.'); onClose(); }
      else setErr(friendly(e));
    } finally { setBusy(false); }
  };

  return <Modal open={open} onClose={onClose} title={asStudent ? (type === 'old' ? 'Log my Old revision' : type === 'recent' ? 'Log my Recent revision' : 'Record my revision') : `Record · ${student.name}`} wide
    footer={<div className="flex items-center gap-2"><span className="hidden text-sm text-ink-faint sm:block">{formatRange(range)} · {major + minor} errors</span><Button kind="secondary" className="ml-auto" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Save session</Button></div>}>
    <div className="flex flex-col gap-5">
      {err && <ErrorBox message={err} />}
      {!(asStudent && ['old', 'recent'].includes(initialType)) && <div className="flex flex-col gap-2">
        <Segmented label="Session type" value={(asStudent ? [['old', ''], ['recent', ''], ['review', '']] : TEACHER_TYPES).some(([t]) => t === type) ? type : ('more' as SessionType)} onChange={v => (v as string) === 'more' ? pickType('juz_revision') : pickType(v)}
          options={asStudent ? [['old', 'Old revision'], ['recent', 'Recent revision'], ['review', 'Other review']] : [...TEACHER_TYPES, ['more' as SessionType, 'More…']]} />
        {!asStudent && !['new', 'recent', 'old'].includes(type) && <Select value={type} onChange={pickType} options={OTHER_TYPES} aria-label="Other session type" />}
      </div>}
      {!absent && <RangePicker value={range} onChange={setRange} />}
      {!absent && <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="mb-1 text-[13px] font-bold text-ink-soft">Major errors</p><Stepper label="major errors" value={major} onChange={setMajor} /></div>
        <div><p className="mb-1 text-[13px] font-bold text-ink-soft">Minor errors</p><Stepper label="minor errors" value={minor} onChange={setMinor} /></div>
      </div>}
      {!absent && <details className="rounded-xl border border-line bg-white px-4 py-2">
        <summary className="cursor-pointer py-1 text-sm font-bold text-pine-700">Tag errors to ayahs (optional){tags.length ? ` · ${tags.length}` : ''}</summary>
        <div className="flex flex-col gap-2 py-2">
          {tags.map((t, i) => <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_auto] items-center gap-2">
            <Select aria-label="Ayah" value={t.ayahId ?? range.start} onChange={v => setTags(x => x.map((y, j) => j === i ? { ...y, ayahId: v } : y))} options={ayahChoices} />
            <Select aria-label="Kind of error" value={t.category} onChange={v => setTags(x => x.map((y, j) => j === i ? { ...y, category: v } : y))} options={CATS} />
            <Select aria-label="Severity" value={t.severity} onChange={v => setTags(x => x.map((y, j) => j === i ? { ...y, severity: v as ErrorSeverity } : y))} options={[['minor', 'Minor'], ['major', 'Major']]} />
            <button type="button" aria-label="Remove" onClick={() => setTags(x => x.filter((_, j) => j !== i))} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-red-50"><Trash2 size={16} className="text-bad" /></button>
          </div>)}
          <Button kind="ghost" className="self-start" onClick={() => setTags(x => [...x, { ayahId: range.start, category: 'similar_ayah', severity: 'minor' }])}><Plus size={16} />Add an error</Button>
        </div>
      </details>}
      {!asStudent && !absent && <div className="flex flex-col gap-1">
        <ScoreInput label="Overall" scale={scale} value={scores.overall} onChange={v => setScores(s => ({ ...s, overall: v }))} />
        <ScoreInput label="Tajweed" scale={scale} value={scores.tajweed} onChange={v => setScores(s => ({ ...s, tajweed: v }))} />
        <ScoreInput label="Fluency" scale={scale} value={scores.fluency} onChange={v => setScores(s => ({ ...s, fluency: v }))} />
        {more ? <><ScoreInput label="Accuracy" scale={scale} value={scores.accuracy} onChange={v => setScores(s => ({ ...s, accuracy: v }))} /><ScoreInput label="Tarteel" scale={scale} value={scores.tarteel} onChange={v => setScores(s => ({ ...s, tarteel: v }))} /></>
          : <button type="button" onClick={() => setMore(true)} className="self-start text-sm font-bold text-pine-700 underline">More scores</button>}
      </div>}
      {!asStudent && <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Attendance">{() => <Segmented label="Attendance" value={attendance} onChange={setAttendance} options={[['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['excused', 'Excused']]} />}</Field>
        <Field label="Where">{() => <Segmented label="Where" value={mode} onChange={setMode} options={[['in_person', 'In person'], ['online', 'Online']]} />}</Field>
      </div>}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        {asStudent && <Field label="Who listened? (revision partner)" hint="They get a notification to confirm it and note any mistakes.">{id => <Select id={id} value={partner} onChange={setPartner} options={[['', 'Nobody / on my own'], ...mates.map(m => [m.student_id, m.name + ((m as { same_class?: boolean }).same_class === false ? ' (other halaqah)' : '')] as [string, string])]} />}</Field>}
        <Field label={asStudent ? 'My note (optional)' : 'Note for the student (optional)'}>{id => <textarea id={id} className={cx(inputCls, 'min-h-[64px] py-2')} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />}</Field>
        <Field label="Date">{id => <input id={id} type="date" className={inputCls} value={date} max={today} onChange={e => setDate(e.target.value || today)} />}</Field>
      </div>
      {!asStudent && <Toggle on={followUp} onChange={setFollowUp} label="Follow up next time" sub="Shows this student under “Needs attention”" />}
    </div>
  </Modal>;
}
