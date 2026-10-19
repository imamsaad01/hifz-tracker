// Month calendar: class days, holidays, exams and events. Staff add; everyone in the program sees.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useOrg } from '../../app/context';
import type { CalEvent, ClassRow, Exam } from '../../api/data';
import type { Student } from '../../lib/types';
import { addDays, niceDate } from '../../lib/dates';
import { Button, Card, CardHead, Field, Modal, Select, inputCls, cx, useToast } from '../../components/ui';
import { friendly } from '../../api/backend';

export const KIND: Record<string, [string, string]> = { class: ['Class', 'bg-pine-600'], holiday: ['Holiday', 'bg-bad'], exam: ['Exam', 'bg-brass-500'], event: ['Event', 'bg-sky-600'] };
const monthStart = (iso: string) => iso.slice(0, 8) + '01';
export function CalendarView({ events, exams, students, classes, onChanged }: { events: CalEvent[]; exams: Exam[]; students: Student[]; classes: ClassRow[]; onChanged: () => void }) {
  const { org, today, api } = useOrg(); const toast = useToast();
  const staff = org.role === 'admin' || org.role === 'teacher';
  const [month, setMonth] = useState(monthStart(today)); const [add, setAdd] = useState<string | null>(null);
  const days = useMemo(() => { const first = new Date(`${month}T12:00:00Z`); const lead = (first.getUTCDay() + 6) % 7; const start = addDays(month, -lead); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); }, [month]);
  const shift = (n: number) => { const d = new Date(`${month}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 10)); };
  const on = (d: string) => events.filter(e => e.startsOn <= d && (e.endsOn ?? e.startsOn) >= d);
  const examsOn = (d: string) => exams.filter(x => x.scheduledOn === d && x.status === 'scheduled');
  const name = (id: string) => students.find(s => s.id === id)?.name.split(' ')[0] ?? '';
  const upcoming = [...events.filter(e => (e.endsOn ?? e.startsOn) >= today).map(e => ({ d: e.startsOn, t: e.title, k: e.kind, id: e.id })), ...exams.filter(x => x.scheduledOn >= today && x.status === 'scheduled').map(x => ({ d: x.scheduledOn, t: `${x.title} · ${name(x.studentId)}`, k: 'exam', id: '' }))].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 12);
  const label = new Date(`${month}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2"><Button kind="quiet" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} /></Button><h2 className="flex-1 text-center text-lg font-bold">{label}</h2><Button kind="quiet" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={18} /></Button>{staff && <Button className="min-h-[38px] px-3 text-sm" onClick={() => setAdd(today)}><Plus size={15} />Add</Button>}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-faint">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{days.map(d => { const ev = on(d), ex = examsOn(d); return <button key={d} type="button" disabled={!staff} onClick={() => staff && setAdd(d)}
        className={cx('flex min-h-[64px] flex-col items-stretch gap-0.5 rounded-lg p-1 text-left ring-1 ring-inset', d.slice(0, 7) === month.slice(0, 7) ? 'bg-white ring-line' : 'bg-transparent ring-transparent opacity-50', d === today && 'ring-2 ring-pine-600')}>
        <span className={cx('text-xs font-bold', d === today ? 'text-pine-800' : 'text-ink-soft')}>{Number(d.slice(8))}</span>
        {ev.slice(0, 2).map(e => <span key={e.id} className={cx('truncate rounded px-1 text-[10px] font-bold text-white', KIND[e.kind][1])}>{e.title}</span>)}
        {ex.length > 0 && <span className="truncate rounded bg-brass-500 px-1 text-[10px] font-bold text-white">{ex.length} test{ex.length > 1 ? 's' : ''}</span>}
      </button>; })}</div>
      <p className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">{Object.values(KIND).map(([l, c]) => <span key={l} className="inline-flex items-center gap-1"><i className={cx('h-2.5 w-2.5 rounded-sm', c)} />{l}</span>)}</p>
    </Card>
    <Card><CardHead title="Coming up" />
      {upcoming.length ? <ul className="mt-2 divide-y divide-line">{upcoming.map((u, i) => <li key={i} className="flex items-center gap-3 px-5 py-2.5"><i className={cx('h-2.5 w-2.5 shrink-0 rounded-full', KIND[u.k][1])} /><span className="min-w-0 flex-1"><b className="block truncate">{u.t}</b><span className="text-sm text-ink-faint">{niceDate(u.d)}</span></span>
        {staff && u.id && <button type="button" aria-label="Remove" className="text-ink-faint hover:text-bad" onClick={async () => { try { await api.removeEvent(u.id); onChanged(); } catch (e) { toast(friendly(e), 'err'); } }}><Trash2 size={15} /></button>}</li>)}</ul>
        : <p className="px-5 py-4 text-sm text-ink-faint">Nothing scheduled.</p>}
    </Card>
    {add && <EventForm date={add} classes={classes} onClose={() => setAdd(null)} onSaved={onChanged} />}
  </div>;
}
function EventForm({ date, classes, onClose, onSaved }: { date: string; classes: ClassRow[]; onClose: () => void; onSaved: () => void }) {
  const { org, api } = useOrg(); const toast = useToast();
  const [title, setTitle] = useState(''); const [kind, setKind] = useState('holiday'); const [from, setFrom] = useState(date); const [to, setTo] = useState(date); const [cls, setCls] = useState(''); const [busy, setBusy] = useState(false);
  return <Modal open onClose={onClose} title="Add to calendar" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!title.trim() || to < from} onClick={async () => { setBusy(true); try { await api.addEvent(org.id, { classId: cls || null, startsOn: from, endsOn: to > from ? to : null, title: title.trim(), kind, notes: '' }); toast('Added.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Add</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="What">{id => <Select id={id} value={kind} onChange={v => { setKind(v); if (!title) setTitle(v === 'holiday' ? 'No class' : ''); }} options={Object.entries(KIND).map(([k, [l]]) => [k, l] as [string, string])} />}</Field>
      <Field label="Title">{id => <input id={id} className={inputCls} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Eid holiday" />}</Field>
      <div className="grid grid-cols-2 gap-3"><Field label="From">{id => <input id={id} type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />}</Field><Field label="To">{id => <input id={id} type="date" className={inputCls} value={to} min={from} onChange={e => setTo(e.target.value)} />}</Field></div>
      <Field label="For">{id => <Select id={id} value={cls} onChange={setCls} options={[['', 'Everyone'], ...classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>
    </div>
  </Modal>;
}
