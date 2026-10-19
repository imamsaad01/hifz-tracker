import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, inputCls, Pill } from './ui';
import type { StudentInsight } from '../lib/insights';
export function StudentPicker({ open, onClose, insights, onPick, title = 'Choose a student' }: { open: boolean; onClose: () => void; insights: StudentInsight[]; onPick: (id: string) => void; title?: string }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => insights.filter(i => i.student.name.toLowerCase().includes(q.toLowerCase())), [insights, q]);
  return <Modal open={open} onClose={onClose} title={title}>
    <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3.5 text-ink-faint" aria-hidden /><input className={`${inputCls} pl-9`} placeholder="Search students" value={q} onChange={e => setQ(e.target.value)} aria-label="Search students" /></div>
    <ul className="flex flex-col gap-1">{list.map(i => <li key={i.student.id}><button type="button" onClick={() => { onPick(i.student.id); setQ(''); }} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-pine-50">
      <span className="min-w-0 flex-1 font-bold">{i.student.name}</span>{i.recordedToday ? <Pill tone="green">Recorded today</Pill> : i.attendanceToday === 'absent' ? <Pill tone="amber">Absent</Pill> : null}</button></li>)}
      {!list.length && <li className="py-6 text-center text-sm text-ink-faint">No student matches “{q}”.</li>}</ul>
  </Modal>;
}
