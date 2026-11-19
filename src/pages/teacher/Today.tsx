// The teacher's home: one big "Start class" button, the things that need a yes/no, and the class list
// with three dots per student (New · Recent · Old today) and one Record button each.
import { JoinRequestsCard } from '../../components/HalaqahJoin';
import { RevisionCheckCard } from '../../components/RevisionSelf';
import { useMemo, useState } from 'react';
import { Radio, UserPlus, Users, Check } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import { insight } from '../../lib/insights';
import { niceDate, addDays } from '../../lib/dates';
import { partOf, garden2, garden, steadfast, STARS_PER_LEVEL, PRIZE_BOX, type Part } from '../../lib/stars';
import { formatRange } from '../../quran';
import { Button, Card, Spinner, ErrorBox, Empty, useToast, cx } from '../../components/ui';
import { RecordSheet } from '../../components/RecordSheet';
import { ClassGoal } from '../../components/Garden';
import { SubTabs } from '../../components/ui';
import { href, go } from '../../app/router';
import { friendly } from '../../api/backend';

const PARTS: Array<[Part, string, string]> = [['new', 'New', 'bg-[#047857]'], ['recent', 'Recent', 'bg-[#9A6B1F]'], ['old', 'Old', 'bg-[#0369A1]']];

export function Today() {
  const { org, today, api, user } = useOrg();
  const { data, error, reload } = useOrgData();
  const [cls, setCls] = useState<string | null>(null);
  const toast = useToast();
  const [rec, setRec] = useState<string | null>(null);
  const myClass = data?.classes.find(c => c.teacherUserId === user?.id)?.id ?? 'all';
  const activeCls = cls ?? myClass;
  const inCls = (sid: string) => activeCls === 'all' || !!data?.classes.find(c => c.id === activeCls)?.studentIds.includes(sid);
  const ins = useMemo(() => data ? data.students.filter(s => inCls(s.id)).map(s => insight(s, data.sessions, data.revision.get(s.id) ?? [], data.assignments, data.attendance, org.settings, today)) : [], [data, org.settings, today, activeCls]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  const partsToday = (sid: string) => new Set(data.sessions.filter(s => s.studentId === sid && s.date === today).map(s => partOf(s.type)).filter(Boolean) as Part[]);
  const absentToday = (sid: string) => data.attendance.some(a => a.studentId === sid && a.date === today && (a.status === 'absent' || a.status === 'excused'));
  const rows = ins.map(i => ({ i, parts: partsToday(i.student.id), absent: absentToday(i.student.id) }))
    .sort((a, b) => Number(a.absent) - Number(b.absent) || a.parts.size - b.parts.size || a.i.student.name.localeCompare(b.i.student.name));
  const toHear = rows.filter(r => !r.absent && r.parts.size === 0).length;
  const recIns = ins.find(i => i.student.id === rec);
  const markAbsent = async (sid: string) => { try { await api.saveAttendance(org.id, sid, today, 'absent', 'in_person'); toast('Marked absent.'); reload(); } catch (e) { toast(friendly(e), 'err'); } };
  const first = (user?.name ?? '').split(' ')[0];

  return <div className="mx-auto flex max-w-2xl flex-col gap-5">
    <div>
      <h1 className="text-2xl font-bold">Salaam{first ? `, ${first}` : ''}</h1>
      <p className="text-ink-soft">{niceDate(today)}{data.students.length ? ` · ${toHear ? `${toHear} still to hear` : 'everyone heard today'}` : ''}</p>
    </div>
    <button type="button" onClick={() => go('classes', 'live')} data-tour="today-actions"
      className="flex min-h-[84px] items-center justify-center gap-3 rounded-[26px] bg-[#047857] px-6 text-2xl font-bold text-white shadow-[inset_0_-8px_0_rgba(0,0,0,.18)] transition active:scale-[.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFD23F]">
      <Radio size={28} />Start class
    </button>

    {/* only things waiting for a yes/no */}
    <div className="flex flex-col gap-4 empty:hidden" data-tour="revision-check">
      <RevisionCheckCard data={data} onChanged={reload} />
      <JoinRequestsCard data={data} onChanged={reload} />
      <Celebrate data={data} studentIds={ins.map(i => i.student.id)} streaks={new Map(ins.map(i => [i.student.id, i.streak]))} today={today} />
    </div>

    {!data.students.length ? <Card><Empty icon={<Users size={32} />} title="No students yet" action={<Button onClick={() => go('students', 'new')}><UserPlus size={18} />Add your first student</Button>}>Add students yourself, or share the class code <b className="font-mono">{org.joinCode}</b> so they can join and set themselves up.</Empty></Card> : <section data-tour="today-students">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="flex-1 text-lg font-bold">My students</h2>
        <span className="flex items-center gap-3 text-xs font-bold text-ink-faint" aria-hidden>{PARTS.map(([k, l, c]) => <span key={k} className="flex items-center gap-1"><i className={cx('h-3 w-3 rounded-full', c)} />{l}</span>)}</span>
      </div>
      {data.classes.length > 1 && <SubTabs label="Halaqah" className="mb-3" active={activeCls} onChange={setCls} items={[{ key: 'all', label: 'All' }, ...data.classes.map(c => ({ key: c.id, label: c.name }))]} />}
      <ul className="flex flex-col gap-2">{rows.map(({ i, parts, absent }) => { const worry = i.reasons.find(r => r.severity >= 2 && r.kind !== 'absent');
        return <li key={i.student.id} className={cx('flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line dark:bg-paper', (absent || parts.size === 3) && 'opacity-60')}>
          <a href={href('students', i.student.id)} className="min-w-0 flex-1">
            <b className="block truncate text-[17px] text-ink">{i.student.name}</b>
            <span className={cx('block truncate text-sm', worry ? 'font-bold text-warn' : 'text-ink-faint')}>{absent ? 'Absent today' : worry ? worry.text : i.nextNew ? `Next: ${formatRange(i.nextNew)}` : 'All memorised'}</span>
            <span className="mt-1.5 flex gap-1.5" aria-label={`Today: ${PARTS.filter(([k]) => parts.has(k)).map(([, l]) => l).join(', ') || 'nothing yet'}`}>
              {PARTS.map(([k, l, c]) => <span key={k} title={l} className={cx('grid h-6 w-6 place-items-center rounded-full', parts.has(k) ? `${c} text-white` : 'border-2 border-dashed border-line')}>{parts.has(k) && <Check size={13} strokeWidth={3} />}</span>)}
            </span>
          </a>
          {!absent && <Button className="min-h-[48px] shrink-0 px-4" onClick={() => setRec(i.student.id)}>Record</Button>}
          {!absent && parts.size === 0 && <button type="button" onClick={() => markAbsent(i.student.id)} className="hidden min-h-[48px] shrink-0 rounded-xl px-2 text-sm font-bold text-ink-faint hover:bg-black/5 sm:block">Absent</button>}
        </li>; })}</ul>
    </section>}
    {activeCls !== 'all' && <ClassGoal classId={activeCls} title="Halaqah goal this month" />}
    {recIns && <RecordSheet open={!!rec} onClose={() => setRec(null)} student={recIns.student} insight={recIns} sessions={data.sessions} onSaved={reload} />}
  </div>;
}

/** Rewards earned in the last two weeks, for the teacher to give out in class. */
function Celebrate({ data, studentIds, streaks, today }: { data: import('../../app/useOrgData').OrgData; studentIds: string[]; streaks: Map<string, number>; today: string }) {
  const since = addDays(today, -13);
  const out: Array<{ id: string; name: string; what: string; give: string; cert?: string }> = [];
  for (const sid of studentIds) {
    const name = data.students.find(x => x.id === sid)?.name ?? '';
    const now = Math.floor(garden2(data.sessions, sid).stars / STARS_PER_LEVEL);
    const before = Math.floor(garden2(data.sessions.filter(x => x.date < since), sid).stars / STARS_PER_LEVEL);
    for (let g = before + 1; g <= now; g++) {
      out.push({ id: `${sid}g${g}`, name, what: `filled the ${garden(g).name} garden ${garden(g).plant}`, give: 'Read their name out, give the certificate', cert: href('certificate', sid, `garden-${g}`) });
      if (g % 3 === 0) out.push({ id: `${sid}p${g}`, name, what: `filled ${g} gardens 🎁`, give: `Prize box: ${PRIZE_BOX.slice(0, 4).join(', ').toLowerCase()}…` });
    }
    if (steadfast(data.sessions, sid, today, streaks.get(sid) ?? 0).earned) out.push({ id: `${sid}s`, name, what: 'is Steadfast 💪 (30 days, partner revision every week)', give: 'Praise them in front of the class' });
    for (const x of data.exams.filter(e => e.studentId === sid && e.status === 'passed' && e.scheduledOn >= since)) out.push({ id: x.id, name, what: `passed ${x.title} 🏅`, give: 'Juz certificate, and they lead the class recitation' });
  }
  if (!out.length) return null;
  return <Card className="p-5">
    <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><span aria-hidden>🎉</span>To celebrate in class</h2>
    <p className="mb-3 text-sm text-ink-soft">Earned in the last two weeks. Only heard recitation counts.</p>
    <ul className="flex flex-col gap-3">{out.map(o => <li key={o.id} className="rounded-2xl bg-[#FFF4D6] px-4 py-3 text-[#1B2433]">
      <p><b>{o.name}</b> {o.what}</p><p className="text-sm">{o.give}{o.cert && <> · <a className="font-bold underline" href={o.cert}>Certificate</a></>}</p>
    </li>)}</ul>
  </Card>;
}
