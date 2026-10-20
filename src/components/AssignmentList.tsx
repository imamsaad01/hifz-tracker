import { useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import type { Assignment } from '../lib/types';
import { niceDate } from '../lib/dates';
import { formatRange } from '../quran';
import { Pill, Button, Modal, Field, inputCls, Empty, useToast } from './ui';
import { ASSIGNMENT_LABEL } from './AssignmentForm';
import { useOrg } from '../app/context';
import { friendly } from '../api/backend';

const STATUS_TONE = { assigned: 'slate', started: 'brass', completed: 'pine', reviewed: 'green' } as const;
/** role decides the buttons: staff review/delete; a student starts and completes their own */
export function AssignmentList({ items, nameOf, asStudent, onChanged }: { items: Assignment[]; nameOf?: (id: string) => string; asStudent?: boolean; onChanged: () => void }) {
  const { api, today, org } = useOrg();
  const toast = useToast();
  const [review, setReview] = useState<Assignment | null>(null); const [fb, setFb] = useState('');
  const staff = org.role === 'admin' || org.role === 'teacher';
  const act = async (f: () => Promise<unknown>, msg: string) => { try { await f(); toast(msg); onChanged(); } catch (e) { toast(friendly(e), 'err'); } };
  if (!items.length) return <Empty title="No assignments" />;
  return <>
    <ul className="divide-y divide-line">{items.map(a => { const late = (a.status === 'assigned' || a.status === 'started') && a.dueOn < today; return <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
      <span className="min-w-0 flex-1 basis-60">
        <span className="flex flex-wrap items-center gap-2">{nameOf && <b>{nameOf(a.studentId)}</b>}<Pill tone="pine">{ASSIGNMENT_LABEL[a.type]}</Pill>{a.range && <span>{formatRange(a.range)}</span>}{a.priority === 1 && <Pill tone="red">high priority</Pill>}</span>
        <span className="block text-sm text-ink-faint">Due {niceDate(a.dueOn)}{late ? ' · overdue' : ''}{a.instructions ? ` · ${a.instructions}` : ''}</span>
        {a.feedback && <span className="block text-sm text-pine-800"><b>Feedback:</b> {a.feedback}</span>}
      </span>
      <Pill tone={late ? 'red' : STATUS_TONE[a.status]}>{late ? 'overdue' : a.status}</Pill>
      <span className="flex gap-1">
        {asStudent && a.status === 'assigned' && <Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => act(() => api.setAssignmentStatus(a.id, 'started'), 'Started.')}>Start</Button>}
        {asStudent && (a.status === 'assigned' || a.status === 'started') && <Button className="min-h-[44px] px-3 text-sm" onClick={() => act(() => api.setAssignmentStatus(a.id, 'completed'), 'Marked done. Your teacher will review it.')}><CheckCircle2 size={15} />Done</Button>}
        {staff && a.status !== 'reviewed' && <Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => { setReview(a); setFb(a.feedback ?? ''); }}>Review</Button>}
        {staff && <button type="button" aria-label="Delete assignment" className="grid h-[38px] w-[38px] place-items-center rounded-xl text-ink-faint hover:bg-red-50 hover:text-bad" onClick={() => act(() => api.deleteAssignment(a.id), 'Deleted.')}><Trash2 size={16} /></button>}
      </span>
    </li>; })}</ul>
    <Modal open={!!review} onClose={() => setReview(null)} title="Review assignment" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={() => setReview(null)}>Cancel</Button><Button onClick={async () => { const r = review!; setReview(null); await act(() => api.setAssignmentStatus(r.id, 'reviewed', fb.trim() || undefined), 'Reviewed.'); }}>Mark reviewed</Button></div>}>
      <Field label="Feedback for the student (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[90px] py-2`} maxLength={500} value={fb} onChange={e => setFb(e.target.value)} />}</Field>
    </Modal>
  </>;
}
