// Live class: the halaqah's queue for today. One tap opens the record sheet; when saved, the next student is up.
import { useMemo, useState } from 'react';
import { Play, CheckCircle2, UserX, ChevronRight, ClipboardCheck } from 'lucide-react';
import { RevisionReadOnly, weakAyahs } from '../../components/PartnerRevision';
import { SignOffModal } from '../../components/RevisionSelf';
import { weekSummary } from '../../lib/weekly';
import { useOrg } from '../../app/context';
import type { OrgData } from '../../app/useOrgData';
import { insight } from '../../lib/insights';
import { formatRange, fromAyahId, surahNameEn } from '../../quran';
import { Button, Card, Field, Select, Pill, Empty, useToast } from '../../components/ui';
import { RecordSheet } from '../../components/RecordSheet';
import { AdabTaps } from '../../components/Adab';
import { friendly } from '../../api/backend';
import { CheckinCode } from './AttendancePage';
import { nowIn } from '../../lib/schedule';
import type { Session, SessionType } from '../../lib/types';

export function LiveClass({ data, reload }: { data: OrgData; reload: () => void }) {
  const { org, today, api, user } = useOrg(); const toast = useToast();
  const mine = data.classes.find(c => c.teacherUserId === user?.id);
  const [cls, setCls] = useState(mine?.id ?? data.classes[0]?.id ?? 'all');
  const [rec, setRec] = useState<string | null>(null);
  const firstType = (_sid: string): SessionType => 'new'; // revision is confirmed by partners; the teacher hears the new lesson
  const students = data.students.filter(s => cls === 'all' || data.classes.find(c => c.id === cls)?.studentIds.includes(s.id));
  const ins = useMemo(() => students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)), [students, data, org.settings, today]);
  const finished = (i: typeof ins[number]) => data.sessions.some(x => x.studentId === i.student.id && x.date === today && x.type === 'new' && (x.recordedBy === 'teacher' || x.checkStatus === 'ok')) || (!i.nextNew && data.sessions.some(x => x.studentId === i.student.id && x.date === today));
  const pendingNew = (sid: string) => data.sessions.find(x => x.studentId === sid && x.type === 'new' && x.selfLogged && !x.checkStatus) ?? null;
  const [signOff, setSignOff] = useState<Session | null>(null);
  const nameOf = (id: string | null | undefined) => (data.students.find(x => x.id === id)?.name ?? 'partner').split(' ')[0];
  const days = org.settings.revision.days?.length ? org.settings.revision.days : [0, 1, 2, 3, 4, 5, 6];
  const away = (i: typeof ins[number]) => i.attendanceToday === 'absent' || i.attendanceToday === 'excused';
  const waiting = ins.filter(i => !finished(i) && !away(i));
  const done = ins.filter(i => finished(i));
  const absent = ins.filter(i => !finished(i) && away(i));
  const current = waiting[0];
  const recIns = ins.find(i => i.student.id === rec);
  const absentNow = async (sid: string) => { try { await api.saveAttendance(org.id, sid, today, 'absent', 'in_person'); reload(); } catch (e) { toast(friendly(e), 'err'); } };
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Halaqah" className="min-w-[220px]">{id => <Select id={id} value={cls} onChange={setCls} options={[['all', 'All students'], ...data.classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>
      {data.classes.find(c => c.id === cls)?.slots.some(sl => sl.day === nowIn(org.timezone).dow) && data.classes.find(c => c.id === cls)?.requireCode && <CheckinCode classId={cls} />}
      <p className="text-sm text-ink-soft"><b>{done.length}</b> done · <b>{waiting.length}</b> waiting · <b>{absent.length}</b> absent</p>
    </div>
    {current ? <Card className="border-2 border-pine-600 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-pine-700">Up now</p>
      <h2 className="mt-1 text-2xl font-bold">{current.student.name}</h2>
      <div className="mt-3 flex flex-col gap-3">
        <div><p className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-bold text-pine-800">1. Their revision this week <span className="font-normal text-ink-faint">(confirmed by partners)</span>{(() => { const w = weekSummary(data.sessions.filter(x => x.studentId === current.student.id), today, days, current.revision.perDay, false); return w.target ? <Pill tone={w.percent >= 1 ? 'green' : w.missedDays ? 'amber' : 'slate'}>{w.oldPages}/{w.target} Old pages</Pill> : null; })()}</p>
          <RevisionReadOnly sessions={data.sessions} studentId={current.student.id} names={nameOf} />
          {(() => { const wa = weakAyahs(data.sessions, current.student.id, today).slice(0, 8); return wa.length ? <p className="mt-1.5 text-sm text-warn"><b>Weak ayahs:</b> {wa.map(w => { const a = fromAyahId(w.ayahId); return `${surahNameEn(a.surah)} ${a.ayah}`; }).join(' · ')}</p> : null; })()}</div>
        <div><p className="mb-1 text-sm font-bold text-pine-800">2. New lesson</p>
          {pendingNew(current.student.id) ? <p className="text-[15px]">Submitted: <b>{formatRange(pendingNew(current.student.id)!.range)}</b>{pendingNew(current.student.id)!.studentNote ? <span className="text-ink-faint"> · “{pendingNew(current.student.id)!.studentNote}”</span> : null}</p>
            : <p className="text-[15px]"><b>{current.nextNew ? formatRange(current.nextNew) : 'all memorised'}</b></p>}</div>
      </div>
      {current.reasons.length > 0 && <p className="mt-1 text-sm text-warn">{current.reasons.map(r => r.text).join(' · ')}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{pendingNew(current.student.id) ? <Button onClick={() => setSignOff(pendingNew(current.student.id))}><ClipboardCheck size={16} />Sign off new lesson</Button> : <Button onClick={() => setRec(current.student.id)}><Play size={16} />Record new lesson</Button>}<Button kind="secondary" onClick={() => absentNow(current.student.id)}><UserX size={16} />Absent</Button></div>
      <div className="mt-3 -mx-1"><AdabTaps studentId={current.student.id} points={data.behaviour} onChanged={reload} compact /></div>
    </Card> : <Card><Empty icon={<CheckCircle2 size={30} />} title={ins.length ? 'Everyone is done for today' : 'No students in this halaqah'}>{ins.length ? 'Mā shāʾ Allāh. Check Today for anything that needs attention.' : 'Add students to the halaqah under Classes.'}</Empty></Card>}
    {waiting.length > 1 && <Card><h3 className="px-5 pt-4 font-bold">Next</h3><ol className="mt-2 divide-y divide-line">{waiting.slice(1).map((i, k) => <li key={i.student.id} className="flex items-center gap-3 px-5 py-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-black/[.05] text-xs font-bold">{k + 2}</span><span className="min-w-0 flex-1"><b>{i.student.name}</b><span className="block text-sm text-ink-faint">{i.nextNew ? formatRange(i.nextNew) : ''}</span></span>
      <Button kind="quiet" className="min-h-[36px] px-2 text-sm" onClick={() => setRec(i.student.id)}>Record<ChevronRight size={14} /></Button></li>)}</ol></Card>}
    {(done.length > 0 || absent.length > 0) && <div className="flex flex-wrap gap-1.5">{done.map(i => <Pill key={i.student.id} tone="green"><CheckCircle2 size={12} />{i.student.name}</Pill>)}{absent.map(i => <Pill key={i.student.id} tone="amber">{i.student.name} · absent</Pill>)}</div>}
    {signOff && <SignOffModal s={signOff} who={data.students.find(x => x.id === signOff.studentId)?.name ?? ''} onClose={() => setSignOff(null)} onSaved={reload} />}
    {recIns && <RecordSheet key={recIns.student.id + firstType(recIns.student.id)} open onClose={() => setRec(null)} student={recIns.student} insight={recIns} sessions={data.sessions} initialType={firstType(recIns.student.id)} onSaved={reload} />}
  </div>;
}
