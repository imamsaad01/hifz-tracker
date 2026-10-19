import { useState } from 'react';
import { Modal, Button, Field, Select, inputCls, ErrorBox, Toggle, useToast } from './ui';
import { RangePicker } from './quran';
import type { AssignmentType } from '../lib/types';
import type { StudentInsight } from '../lib/insights';
import { addDays, niceDate } from '../lib/dates';
import { pageRange, surahRange, type Range } from '../quran';
import { useOrg } from '../app/context';
import { friendly } from '../api/backend';

export const ASSIGNMENT_LABEL: Record<AssignmentType, string> = { new: 'Learn new', revision: 'Revise', listening: 'Listen', tajweed: 'Tajweed practice', other: 'Other' };
const firstPage = (i: StudentInsight) => i.revision.today[0]?.page ?? i.revision.overdue[0]?.page ?? null;
function suggested(type: AssignmentType, i: StudentInsight | undefined): Range {
  if (!i) return surahRange(114);
  if (type === 'new' && i.nextNew) return i.nextNew;
  const p = firstPage(i);
  if (p) return pageRange(p);
  return i.nextNew ?? surahRange(114);
}
export function AssignmentForm({ open, onClose, insights, fixedStudent, onSaved }: { open: boolean; onClose: () => void; insights: StudentInsight[]; fixedStudent?: string; onSaved: () => void }) {
  const { api, org, today } = useOrg();
  const toast = useToast();
  const [sid, setSid] = useState(fixedStudent ?? insights[0]?.student.id ?? '');
  const ins = insights.find(i => i.student.id === sid);
  const [type, setType] = useState<AssignmentType>('new');
  const [range, setRange] = useState<Range>(() => suggested('new', ins));
  const [hasRange, setHasRange] = useState(true);
  const [due, setDue] = useState('1'); const [custom, setCustom] = useState(addDays(today, 7));
  const [priority, setPriority] = useState(2); const [text, setText] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const dueOn = due === 'custom' ? custom : addDays(today, Number(due));
  const pickStudent = (id: string) => { setSid(id); setRange(suggested(type, insights.find(i => i.student.id === id))); };
  const pickType = (t: AssignmentType) => { setType(t); setRange(suggested(t, ins)); setHasRange(t !== 'other'); };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.createAssignment(org.id, { studentId: sid, type, range: hasRange ? range : null, dueOn, priority, instructions: text.trim() }); toast('Assignment set.'); onSaved(); onClose(); }
    catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };
  return <Modal open={open} onClose={onClose} title="New assignment" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!sid || dueOn < today} onClick={save}>Assign</Button></div>}>
    <div className="flex flex-col gap-4">
      {err && <ErrorBox message={err} />}
      {!fixedStudent && <Field label="Student">{id => <Select id={id} value={sid} onChange={pickStudent} options={insights.map(i => [i.student.id, i.student.name])} />}</Field>}
      <Field label="What">{id => <Select id={id} value={type} onChange={v => pickType(v as AssignmentType)} options={Object.entries(ASSIGNMENT_LABEL) as Array<[AssignmentType, string]>} />}</Field>
      <Toggle on={hasRange} onChange={setHasRange} label="Part of the Qurʾān" sub="Suggested from the student’s next lesson or due pages" />
      {hasRange && <RangePicker value={range} onChange={setRange} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due">{id => <Select id={id} value={due} onChange={setDue} options={[['0', 'Today'], ['1', 'Tomorrow'], ['3', 'In 3 days'], ['7', 'In a week'], ['custom', 'Pick a date']]} />}</Field>
        <Field label="Priority">{id => <Select id={id} value={priority} onChange={v => setPriority(Number(v))} options={[[1, 'High'], [2, 'Normal'], [3, 'Low']]} />}</Field>
      </div>
      {due === 'custom' && <Field label="Due date">{id => <input id={id} type="date" className={inputCls} min={today} value={custom} onChange={e => setCustom(e.target.value)} />}</Field>}
      <p className="text-sm text-ink-faint">Due {niceDate(dueOn)}.</p>
      <Field label="Instructions (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[80px] py-2`} maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Listen 5 times before class, then read to a parent." />}</Field>
    </div>
  </Modal>;
}
