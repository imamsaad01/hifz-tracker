// Live class: the halaqah's queue for today. One tap opens the record sheet; when saved, the next student is up.
import { useMemo, useState } from 'react';
import { Play, CheckCircle2, UserX, ChevronRight } from 'lucide-react';
import { useOrg } from '../../app/context';
import type { OrgData } from '../../app/useOrgData';
import { insight } from '../../lib/insights';
import { formatRange } from '../../quran';
import { Button, Card, Field, Select, Pill, Empty, useToast } from '../../components/ui';
import { RecordSheet } from '../../components/RecordSheet';
import { AdabTaps } from '../../components/Adab';
import { friendly } from '../../api/backend';

export function LiveClass({ data, reload }: { data: OrgData; reload: () => void }) {
  const { org, today, api, user } = useOrg(); const toast = useToast();
  const mine = data.classes.find(c => c.teacherUserId === user?.id);
  const [cls, setCls] = useState(mine?.id ?? data.classes[0]?.id ?? 'all');
  const [rec, setRec] = useState<string | null>(null);
  const students = data.students.filter(s => cls === 'all' || data.classes.find(c => c.id === cls)?.studentIds.includes(s.id));
  const ins = useMemo(() => students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)), [students, data, org.settings, today]);
  const waiting = ins.filter(i => !i.recordedToday && i.attendanceToday !== 'absent');
  const done = ins.filter(i => i.recordedToday);
  const absent = ins.filter(i => !i.recordedToday && i.attendanceToday === 'absent');
  const current = waiting[0];
  const recIns = ins.find(i => i.student.id === rec);
  const absentNow = async (sid: string) => { try { await api.saveAttendance(org.id, sid, today, 'absent', 'in_person'); reload(); } catch (e) { toast(friendly(e), 'err'); } };
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Halaqah" className="min-w-[220px]">{id => <Select id={id} value={cls} onChange={setCls} options={[['all', 'All students'], ...data.classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>
      <p className="text-sm text-ink-soft"><b>{done.length}</b> done · <b>{waiting.length}</b> waiting · <b>{absent.length}</b> absent</p>
    </div>
    {current ? <Card className="border-2 border-pine-600 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-pine-700">Up now</p>
      <h2 className="mt-1 text-2xl font-bold">{current.student.name}</h2>
      <p className="mt-1 text-[15px] text-ink-soft">New: <b className="text-ink">{current.nextNew ? formatRange(current.nextNew) : 'all memorised'}</b>{current.revision.today.length ? <> · Old: <b className="text-ink">pages {current.revision.today.map(r => r.page).join(', ')}</b></> : null}</p>
      {current.reasons.length > 0 && <p className="mt-1 text-sm text-warn">{current.reasons.map(r => r.text).join(' · ')}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setRec(current.student.id)}><Play size={16} />Record</Button><Button kind="secondary" onClick={() => absentNow(current.student.id)}><UserX size={16} />Absent</Button></div>
      <div className="mt-3 -mx-1"><AdabTaps studentId={current.student.id} points={data.behaviour} onChanged={reload} compact /></div>
    </Card> : <Card><Empty icon={<CheckCircle2 size={30} />} title={ins.length ? 'Everyone is done for today' : 'No students in this halaqah'}>{ins.length ? 'Mā shāʾ Allāh. Check Today for anything that needs attention.' : 'Add students to the halaqah under Classes.'}</Empty></Card>}
    {waiting.length > 1 && <Card><h3 className="px-5 pt-4 font-bold">Next</h3><ol className="mt-2 divide-y divide-line">{waiting.slice(1).map((i, k) => <li key={i.student.id} className="flex items-center gap-3 px-5 py-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-black/[.05] text-xs font-bold">{k + 2}</span><span className="min-w-0 flex-1"><b>{i.student.name}</b><span className="block text-sm text-ink-faint">{i.nextNew ? formatRange(i.nextNew) : ''}</span></span>
      <Button kind="quiet" className="min-h-[36px] px-2 text-sm" onClick={() => setRec(i.student.id)}>Record<ChevronRight size={14} /></Button></li>)}</ol></Card>}
    {(done.length > 0 || absent.length > 0) && <div className="flex flex-wrap gap-1.5">{done.map(i => <Pill key={i.student.id} tone="green"><CheckCircle2 size={12} />{i.student.name}</Pill>)}{absent.map(i => <Pill key={i.student.id} tone="amber">{i.student.name} · absent</Pill>)}</div>}
    {recIns && <RecordSheet open onClose={() => setRec(null)} student={recIns.student} insight={recIns} sessions={data.sessions} onSaved={reload} />}
  </div>;
}
