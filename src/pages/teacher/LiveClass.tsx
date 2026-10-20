// Live class: the halaqah's queue for today. One tap opens the record sheet; when saved, the next student is up.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecallResult } from '../../api/data';
import { useRefresh } from '../../components/PullToRefresh';
import { Play, CheckCircle2, UserX, ChevronRight, ChevronDown, ClipboardCheck, GripVertical, Clock3 } from 'lucide-react';
import { RevisionReadOnly, weakAyahs } from '../../components/PartnerRevision';
import { SignOffModal } from '../../components/RevisionSelf';
import { weekSummary } from '../../lib/weekly';
import { addDays } from '../../lib/dates';
import { useOrg } from '../../app/context';
import type { OrgData } from '../../app/useOrgData';
import { insight } from '../../lib/insights';
import { formatRange, fromAyahId, surahNameEn } from '../../quran';
import { Button, Card, Field, Select, Pill, Empty, useToast, cx } from '../../components/ui';
import { RecordSheet } from '../../components/RecordSheet';
import { AdabTaps } from '../../components/Adab';
import { friendly } from '../../api/backend';
import { CheckinCode } from './AttendancePage';
import { nowIn } from '../../lib/schedule';
import type { Session, SessionType } from '../../lib/types';

const niceAgo = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export function LiveClass({ data, reload }: { data: OrgData; reload: () => void }) {
  const { org, today, api, user } = useOrg(); const toast = useToast();
  const mine = data.classes.find(c => c.teacherUserId === user?.id);
  const [cls, setCls] = useState(mine?.id ?? data.classes[0]?.id ?? 'all');
  const [rec, setRec] = useState<string | null>(null);
  const [more, setMore] = useState<'rev' | 'weak' | 'test' | null>(null);
  const [tests, setTests] = useState<RecallResult[]>([]);
  const loadTests = useCallback(() => api.recallTests(org.id, new Date(Date.now() - 7 * 864e5).toISOString()).then(setTests).catch(e => console.error('recall tests', e)), [api, org.id]);
  useEffect(() => { loadTests(); }, [loadTests]); useRefresh(loadTests);
  const lastTest = (sid: string) => tests.find(t => t.studentId === sid);
  const firstType = (_sid: string): SessionType => 'new'; // revision is confirmed by partners; the teacher hears the new lesson
  const students = data.students.filter(s => cls === 'all' || data.classes.find(c => c.id === cls)?.studentIds.includes(s.id));
  const ins = useMemo(() => students.map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)), [students, data, org.settings, today]);
  const finished = (i: typeof ins[number]) => data.sessions.some(x => x.studentId === i.student.id && x.date === today && x.type === 'new' && (x.recordedBy === 'teacher' || x.checkStatus === 'ok')) || (!i.nextNew && data.sessions.some(x => x.studentId === i.student.id && x.date === today));
  const pendingNew = (sid: string) => data.sessions.find(x => x.studentId === sid && x.type === 'new' && x.selfLogged && !x.checkStatus) ?? null;
  const [signOff, setSignOff] = useState<Session | null>(null);
  const nameOf = (id: string | null | undefined) => (data.students.find(x => x.id === id)?.name ?? 'partner').split(' ')[0];
  const days = org.settings.revision.days?.length ? org.settings.revision.days : [0, 1, 2, 3, 4, 5, 6];
  const away = (i: typeof ins[number]) => i.attendanceToday === 'absent' || i.attendanceToday === 'excused';
  // The teacher's own order for today (swipe to skip, drag to reorder), kept on this device for the day.
  const okey = `hifz-live-order:${cls}:${today}`;
  const [order, setOrderState] = useState<string[]>([]);
  useEffect(() => { try { setOrderState(JSON.parse(localStorage.getItem(okey) ?? '[]')); } catch { setOrderState([]); } }, [okey]);
  const setOrder = (o: string[]) => { setOrderState(o); try { localStorage.setItem(okey, JSON.stringify(o)); } catch { /* private mode */ } };
  const rank = (id: string) => { const k = order.indexOf(id); return k < 0 ? 1e6 : k; };
  const waiting = ins.filter(i => !finished(i) && !away(i)).map((i, k) => ({ i, k })).sort((a, b) => (rank(a.i.student.id) - rank(b.i.student.id)) || a.k - b.k).map(x => x.i);
  const ids = waiting.map(i => i.student.id);
  const skip = (sid: string) => { setMore(null); setOrder([...ids.filter(x => x !== sid), sid]); toast('Moved to the end of the queue.'); };
  const move = (from: number, to: number) => { if (from === to) return; const o = [...ids]; const [x] = o.splice(from, 1); o.splice(to, 0, x); setOrder(o); };
  // swipe the Up-now card left to skip
  const sw = useRef<{ x: number; y: number; id: number } | null>(null); const [dx, setDx] = useState(0);
  // drag a row in Next by its handle
  const listRef = useRef<HTMLOListElement>(null); const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const rowAt = (y: number) => { const rows = [...(listRef.current?.children ?? [])] as HTMLElement[]; let t = rows.length - 1; for (let k = 0; k < rows.length; k++) { const b = rows[k].getBoundingClientRect(); if (y < b.top + b.height / 2) { t = k; break; } } return t; };
  const done = ins.filter(i => finished(i));
  const absent = ins.filter(i => !finished(i) && away(i));
  const current = waiting[0];
  useEffect(() => { setMore(null); }, [current?.student.id]);
  const recIns = ins.find(i => i.student.id === rec);
  const absentNow = async (sid: string) => { try { await api.saveAttendance(org.id, sid, today, 'absent', 'in_person'); reload(); } catch (e) { toast(friendly(e), 'err'); } };
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Halaqah" className="min-w-[220px]">{id => <Select id={id} value={cls} onChange={setCls} options={[['all', 'All students'], ...data.classes.map(c => [c.id, c.name] as [string, string])]} />}</Field>
      {data.classes.find(c => c.id === cls)?.slots.some(sl => sl.day === nowIn(org.timezone).dow) && data.classes.find(c => c.id === cls)?.requireCode && <CheckinCode classId={cls} />}
      <p className="text-sm text-ink-soft"><b>{done.length}</b> done · <b>{waiting.length}</b> waiting · <b>{absent.length}</b> absent</p>
    </div>
    {current ? <div className="relative">
      {dx < -10 && <div aria-hidden className="absolute inset-0 flex items-center justify-end rounded-2xl bg-brass-100 pr-6 font-bold text-brass-500"><Clock3 size={20} className="mr-2" />Later</div>}
      <div style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: sw.current ? 'none' : 'transform .2s' }}
        onPointerDown={e => { if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button,a,input,select,textarea')) return; sw.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; }}
        onPointerMove={e => { const st = sw.current; if (!st || st.id !== e.pointerId) return; const mx = e.clientX - st.x; if (Math.abs(e.clientY - st.y) > 30 && Math.abs(mx) < 30) { sw.current = null; setDx(0); return; } setDx(Math.min(0, mx)); }}
        onPointerUp={() => { const go = dx < -100; sw.current = null; setDx(0); if (go) skip(current.student.id); }}
        onPointerCancel={() => { sw.current = null; setDx(0); }}
        className="touch-pan-y">
    <Card className="border-2 border-pine-600 p-5">
      <p className="flex items-center text-xs font-bold uppercase tracking-wider text-pine-700"><span className="flex-1">Up now</span>{waiting.length > 1 && <span className="font-normal normal-case tracking-normal text-ink-faint lg:hidden">Swipe left to skip</span>}</p>
      <h2 className="mt-1 text-2xl font-bold">{current.student.name}</h2>
      {(() => {
        const sid = current.student.id; const pend = pendingNew(sid); const t = lastTest(sid);
        const w = weekSummary(data.sessions.filter(x => x.studentId === sid), today, days, current.revision.perDay, false);
        const waitingPartner = data.sessions.filter(x => x.studentId === sid && x.type !== 'new' && x.partnerStatus === 'pending' && x.date >= addDays(today, -6)).length;
        const weak = weakAyahs(data.sessions, sid, today);
        const pct = t ? Math.round(((t.total - t.peeked.length) / t.total) * 100) : null;
        const chip = (k: 'rev' | 'weak' | 'test', tone: 'green' | 'amber' | 'red' | 'slate', label: string) => <button type="button" onClick={() => setMore(more === k ? null : k)} aria-expanded={more === k}
          className={cx('inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-bold ring-1 ring-inset', { green: 'bg-emerald-50 text-good ring-good/25', amber: 'bg-amber-50 text-warn ring-warn/25', red: 'bg-red-50 text-bad ring-bad/25', slate: 'bg-black/[.04] text-ink-soft ring-line' }[tone])}>{label}<ChevronDown size={14} className={cx('transition', more === k && 'rotate-180')} /></button>;
        return <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {w.target > 0 && chip('rev', w.percent >= 1 ? 'green' : w.missedDays ? 'amber' : 'slate', `Revision ${w.oldPages}/${w.target} pages${waitingPartner ? ` · ${waitingPartner} waiting` : ''}`)}
            {pct !== null && chip('test', pct >= 90 ? 'green' : pct >= 70 ? 'amber' : 'red', `Self-test ${pct}%`)}
            {weak.length > 0 && chip('weak', weak.some(x => x.big) ? 'red' : 'amber', `${weak.length} weak ayah${weak.length > 1 ? 's' : ''}`)}
          </div>
          {more === 'rev' && <div className="mt-2"><p className="mb-1.5 text-xs text-ink-faint">Last 7 days, confirmed by partners. You only read this.</p><RevisionReadOnly sessions={data.sessions} studentId={sid} names={nameOf} /></div>}
          {more === 'test' && t && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-line">{formatRange({ start: t.start, end: t.end })} · {niceAgo(t.createdAt)}{t.peeked.length ? <><br /><b className="text-warn">Peeked at:</b> {t.peeked.map(a => { const x = fromAyahId(a); return `${surahNameEn(x.surah)} ${x.ayah}`; }).join(' · ')}</> : ' · no peeks'}</p>}
          {more === 'weak' && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-line">{weak.slice(0, 12).map(x => { const a = fromAyahId(x.ayahId); return `${surahNameEn(a.surah)} ${a.ayah}${x.n > 1 ? ` ×${x.n}` : ''}`; }).join(' · ')}</p>}
          <div className="mt-4 rounded-xl bg-pine-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-pine-700">Hear now · new lesson</p>
            <p className="mt-0.5 text-lg font-bold text-pine-800">{pend ? formatRange(pend.range) : current.nextNew ? formatRange(current.nextNew) : 'All memorised'}</p>
            {pend ? <p className="text-sm text-pine-700">Submitted by the student{pend.studentNote ? <> · “{pend.studentNote}”</> : ''}</p> : <p className="text-sm text-pine-700">Not submitted yet: record it as you hear it.</p>}
          </div>
          {current.reasons.length > 0 && <p className="mt-2 text-sm text-warn">{current.reasons.map(r => r.text).join(' · ')}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">{pend ? <Button className="col-span-2 min-h-[52px] text-[17px]" onClick={() => setSignOff(pend)}><ClipboardCheck size={18} />Sign off new lesson</Button> : <Button className="col-span-2 min-h-[52px] text-[17px]" onClick={() => setRec(sid)}><Play size={18} />Record new lesson</Button>}
            {waiting.length > 1 ? <Button kind="secondary" onClick={() => skip(sid)}><Clock3 size={16} />Later</Button> : <span />}<Button kind="secondary" onClick={() => absentNow(sid)}><UserX size={16} />Absent</Button></div>
        </>;
      })()}
      <details className="group mt-3"><summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm font-bold text-ink-soft">Note manners (adab)<ChevronDown size={15} className="transition group-open:rotate-180" /></summary>
        <div className="-mx-1 pt-1"><AdabTaps studentId={current.student.id} points={data.behaviour} onChanged={reload} compact /></div></details>
    </Card></div></div> : <Card><Empty icon={<CheckCircle2 size={30} />} title={ins.length ? 'Everyone is done for today' : 'No students in this halaqah'}>{ins.length ? 'Mā shāʾ Allāh. Check Today for anything that needs attention.' : 'Add students to the halaqah under Classes.'}</Empty></Card>}
    {waiting.length > 1 && <Card><h3 className="flex items-baseline gap-2 px-5 pt-4 font-bold">Next <span className="text-xs font-normal text-ink-faint">Drag ⋮⋮ to change the order</span></h3><ol ref={listRef} className="mt-2 divide-y divide-line">{waiting.slice(1).map((i, k) => <li key={i.student.id} className={cx('flex items-center gap-3 py-2.5 pl-2 pr-5 transition-colors', drag?.from === k && 'bg-pine-50', drag && drag.to === k && drag.from !== k && 'bg-brass-100/60')}>
      <span role="button" tabIndex={0} aria-label={`Move ${i.student.name}. Use arrow keys.`} className="grid h-10 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-faint hover:bg-black/5 active:cursor-grabbing"
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag({ from: k, to: k }); }}
        onPointerMove={e => { if (drag) setDrag({ ...drag, to: rowAt(e.clientY) }); }}
        onPointerUp={() => { if (drag) move(drag.from + 1, drag.to + 1); setDrag(null); }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); move(k + 1, Math.max(0, k)); } if (e.key === 'ArrowDown') { e.preventDefault(); move(k + 1, Math.min(ids.length - 1, k + 2)); } }}><GripVertical size={18} /></span>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/[.05] text-xs font-bold">{k + 2}</span><span className="min-w-0 flex-1"><b>{i.student.name}</b><span className="block text-sm text-ink-faint">{i.nextNew ? formatRange(i.nextNew) : ''}{(() => { const t = lastTest(i.student.id); return t ? ` · self-test ${Math.round(((t.total - t.peeked.length) / t.total) * 100)}%` : ''; })()}</span></span>
      <Button kind="quiet" className="min-h-[44px] px-2 text-sm" onClick={() => setRec(i.student.id)}>Record<ChevronRight size={14} /></Button></li>)}</ol></Card>}
    {(done.length > 0 || absent.length > 0) && <div className="flex flex-wrap gap-1.5">{done.map(i => { const t = lastTest(i.student.id); return <Pill key={i.student.id} tone="green"><CheckCircle2 size={12} />{i.student.name}{t ? ` · self-test ${Math.round(((t.total - t.peeked.length) / t.total) * 100)}%` : ''}</Pill>; })}{absent.map(i => <Pill key={i.student.id} tone="amber">{i.student.name} · absent</Pill>)}</div>}
    {signOff && <SignOffModal s={signOff} who={data.students.find(x => x.id === signOff.studentId)?.name ?? ''} onClose={() => setSignOff(null)} onSaved={reload} />}
    {recIns && <RecordSheet key={recIns.student.id + firstType(recIns.student.id)} open onClose={() => setRec(null)} student={recIns.student} insight={recIns} sessions={data.sessions} initialType={firstType(recIns.student.id)} onSaved={reload} />}
  </div>;
}
