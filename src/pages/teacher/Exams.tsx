// Juz tests: schedule, record the result, retake if needed.
import { useState } from 'react';
import { Plus, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { useOrg } from '../../app/context';
import type { Exam } from '../../api/data';
import type { Student } from '../../lib/types';
import { addDays, niceDate } from '../../lib/dates';
import { juzRange, formatRange } from '../../quran';
import { Button, Card, Empty, Field, Modal, Pill, Select, inputCls, useToast } from '../../components/ui';
import { friendly } from '../../api/backend';

const TONE = { scheduled: 'brass', passed: 'green', retake: 'amber', missed: 'red' } as const;
export function ExamList({ exams, students, onChanged, fixedStudent }: { exams: Exam[]; students: Student[]; onChanged: () => void; fixedStudent?: string }) {
  const { org, api, today } = useOrg(); const toast = useToast();
  const staff = org.role === 'admin' || org.role === 'teacher';
  const [add, setAdd] = useState(false); const [result, setResult] = useState<Exam | null>(null);
  const list = exams.filter(e => !fixedStudent || e.studentId === fixedStudent).sort((a, b) => (a.status === 'scheduled' ? 0 : 1) - (b.status === 'scheduled' ? 0 : 1) || a.scheduledOn.localeCompare(b.scheduledOn));
  const name = (id: string) => students.find(s => s.id === id)?.name ?? '';
  return <Card>
    {staff && <div className="flex justify-end border-b border-line px-5 py-3"><Button className="min-h-[38px] px-3 text-sm" onClick={() => setAdd(true)} disabled={!students.length}><Plus size={15} />Schedule a test</Button></div>}
    {list.length ? <ul className="divide-y divide-line">{list.map(x => <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
      <span className="min-w-0 flex-1 basis-56"><b className="block">{x.title}{!fixedStudent && <span className="font-normal text-ink-soft"> · {name(x.studentId)}</span>}</b>
        <span className="text-sm text-ink-faint">{niceDate(x.scheduledOn)}{x.examiner ? ` · Examiner: ${x.examiner}` : ''}{x.range ? ` · ${formatRange(x.range)}` : ''}{x.score !== null ? ` · ${x.score}%` : ''}</span>
        {x.notes && <span className="block text-sm text-ink-soft">{x.notes}</span>}</span>
      <Pill tone={x.status === 'scheduled' && x.scheduledOn < today ? 'red' : TONE[x.status]}>{x.status === 'scheduled' && x.scheduledOn < today ? 'needs result' : x.status}</Pill>
      {staff && <span className="flex gap-1">{x.status === 'scheduled' && <Button kind="secondary" className="min-h-[36px] px-3 text-sm" onClick={() => setResult(x)}>Result</Button>}
        <button type="button" aria-label="Remove test" className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:text-bad" onClick={async () => { try { await api.removeExam(x.id); onChanged(); } catch (e) { toast(friendly(e), 'err'); } }}><Trash2 size={15} /></button></span>}
    </li>)}</ul> : <Empty title="No tests scheduled">{staff ? 'Schedule a juz test when a student finishes a juz.' : undefined}</Empty>}
    {add && <ExamForm students={students} fixedStudent={fixedStudent} onClose={() => setAdd(false)} onSaved={onChanged} />}
    {result && <ResultForm exam={result} onClose={() => setResult(null)} onSaved={onChanged} />}
  </Card>;
}
function ExamForm({ students, fixedStudent, onClose, onSaved }: { students: Student[]; fixedStudent?: string; onClose: () => void; onSaved: () => void }) {
  const { org, api, today, user } = useOrg();
  const toast = useToast();
  const [sid, setSid] = useState(fixedStudent ?? students[0]?.id ?? ''); const [juz, setJuz] = useState(30); const [on, setOn] = useState(addDays(today, 7)); const [examiner, setExaminer] = useState(user?.name ?? ''); const [busy, setBusy] = useState(false);
  return <Modal open onClose={onClose} title="Schedule a juz test" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!sid} onClick={async () => { setBusy(true); try { await api.addExam(org.id, { studentId: sid, title: `Juz ${juz} test`, juz, range: juzRange(juz), scheduledOn: on, examiner }); toast('Test scheduled.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Schedule</Button></div>}>
    <div className="flex flex-col gap-4">
      {!fixedStudent && <Field label="Student">{id => <Select id={id} value={sid} onChange={setSid} options={students.map(s => [s.id, s.name])} />}</Field>}
      <Field label="Juz">{id => <Select id={id} value={juz} onChange={v => setJuz(Number(v))} options={Array.from({ length: 30 }, (_, i) => [30 - i, `Juz ${30 - i}`] as [number, string])} />}</Field>
      <Field label="Date">{id => <input id={id} type="date" className={inputCls} value={on} min={today} onChange={e => setOn(e.target.value)} />}</Field>
      <Field label="Examiner">{id => <input id={id} className={inputCls} maxLength={80} value={examiner} onChange={e => setExaminer(e.target.value)} />}</Field>
    </div>
  </Modal>;
}
function ResultForm({ exam, onClose, onSaved }: { exam: Exam; onClose: () => void; onSaved: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const [score, setScore] = useState(90); const [notes, setNotes] = useState('');
  const save = async (status: 'passed' | 'retake' | 'missed') => { try { await api.updateExam(exam.id, { status, score: status === 'missed' ? null : score, notes: notes.trim() || null }); toast(status === 'passed' ? 'Passed. Mā shāʾ Allāh!' : 'Saved.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } };
  return <Modal open onClose={onClose} title={`Result · ${exam.title}`} footer={<div className="flex flex-wrap justify-end gap-2"><Button kind="quiet" onClick={() => save('missed')}>Missed</Button><Button kind="secondary" onClick={() => save('retake')}><RotateCcw size={15} />Retake</Button><Button onClick={() => save('passed')}><CheckCircle2 size={15} />Passed</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Score">{id => <Select id={id} value={score} onChange={v => setScore(Number(v))} options={[100, 98, 95, 90, 85, 80, 75, 70, 60, 50].map(n => [n, `${n}%`] as [number, string])} />}</Field>
      <Field label="Notes (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[80px] py-2`} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Strong; two hesitations in Al-Mutaffifin" />}</Field>
    </div>
  </Modal>;
}
