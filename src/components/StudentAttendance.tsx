// Student side of attendance and partner revision: check in during class, tell the teacher before an absence,
// see where they stand this semester, fill the weekly revision form, read the class rules.
import { useEffect, useState } from 'react';
import { MapPin, CheckCircle2, CalendarX, ShieldAlert, ShieldCheck, Users, Mic, ScrollText } from 'lucide-react';
import { useOrg } from '../app/context';
import type { AbsenceRequest, Attendance, ClassRow, RevisionCheckin, Standing } from '../api/data';
import type { Student } from '../lib/types';
import { classToday, nextClassDates, fmtTime, weekStart, nowIn, scheduleText } from '../lib/schedule';
import { addDays, niceDate } from '../lib/dates';
import { Button, Card, CardHead, Field, Modal, Select, Segmented, Toggle, inputCls, cx, useToast } from './ui';
import { friendly } from '../api/backend';

const minToText = (m: number) => fmtTime(`${Math.floor(m / 60)}:${m % 60}`);

export function CheckInCard({ student, classes, attendance, absences, onChanged }: { student: Student; classes: ClassRow[]; attendance: Attendance[]; absences: AbsenceRequest[]; onChanged: () => void }) {
  const { org, api } = useOrg(); const toast = useToast();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(t); }, []);
  const [code, setCode] = useState(''); const [mode, setMode] = useState<'in_person' | 'online'>('in_person'); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  const ct = classToday(classes, student.id, org.timezone);
  const date = nowIn(org.timezone).date;
  const att = attendance.find(a => a.studentId === student.id && a.date === date);
  const req = absences.find(a => a.studentId === student.id && a.date === date);
  const mine = classes.filter(c => c.studentIds.includes(student.id));
  if (!mine.length) return null;
  const go = async () => {
    if (!ct) return; setBusy(true);
    try { const s = await api.checkIn(ct.cls.id, code.trim(), mode); toast(s === 'late' ? 'Checked in (late).' : 'Checked in. May Allah bless your class.'); setCode(''); onChanged(); }
    catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return <Card className="p-5">
    <div className="flex flex-wrap items-start gap-3">
      <MapPin size={20} className="mt-0.5 text-pine-700" />
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold">Class check-in</h2>
        {!ct ? <p className="text-sm text-ink-soft">No class today. {scheduleText(mine.flatMap(c => c.slots))}.</p>
          : att && att.status !== 'absent' ? <p className="flex items-center gap-1.5 text-[15px] font-bold text-good"><CheckCircle2 size={18} />{att.status === 'late' ? 'Checked in (late)' : att.status === 'excused' ? 'Excused today' : 'Checked in'}{att.checkedInAt ? ` at ${new Date(att.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</p>
          : req && req.status !== 'declined' ? <p className="text-[15px] text-ink-soft">You told the teacher you will be absent today{req.status === 'pending' ? ' (waiting for approval)' : ''}.</p>
          : ct.phase === 'before' ? <p className="text-[15px] text-ink-soft"><b>{ct.cls.name}</b> today {minToText(ct.startsAt)}–{minToText(ct.endsAt)}. Check-in opens at {minToText(ct.opensAt)}.</p>
          : ct.phase === 'after' ? <p className="text-[15px] text-bad">Class has finished{att?.status === 'absent' ? ' and you were marked absent' : ''}. Speak to your teacher if this is wrong.</p>
          : <div className="mt-2 flex flex-col gap-3">
            <p className="text-[15px]"><b>{ct.cls.name}</b> is on now ({minToText(ct.startsAt)}–{minToText(ct.endsAt)}). Arriving after {minToText(ct.startsAt + ct.cls.lateAfterMin)} counts as late.</p>
            {ct.cls.location === 'both' && <Segmented label="Where are you" value={mode} onChange={setMode} options={[['in_person', 'At the mosque'], ['online', 'Online']]} />}
            <div className="flex flex-wrap items-end gap-2">
              {ct.cls.requireCode && <Field label="Today’s code from your teacher" className="w-48">{id => <input id={id} inputMode="numeric" autoComplete="off" maxLength={4} className={cx(inputCls, 'text-center font-mono text-xl tracking-[.4em]')} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />}</Field>}
              <Button busy={busy} disabled={ct.cls.requireCode && code.length !== 4} onClick={go}><CheckCircle2 size={18} />I’m here</Button>
            </div>
          </div>}
      </div>
      <Button kind="secondary" className="min-h-[44px] px-3 text-sm" onClick={() => setAsk(true)}><CalendarX size={16} />I can’t come</Button>
    </div>
    {ask && <AbsenceForm student={student} classes={classes} absences={absences} onClose={() => setAsk(false)} onSaved={onChanged} />}
  </Card>;
}

export function AbsenceForm({ student, classes, absences, onClose, onSaved }: { student: Student; classes: ClassRow[]; absences: AbsenceRequest[]; onClose: () => void; onSaved: () => void }) {
  const { org, api } = useOrg(); const toast = useToast();
  const dates = nextClassDates(classes, student.id, org.timezone, 10);
  const [date, setDate] = useState(dates[0]?.date ?? '');
  const [st, setSt] = useState<Standing | null>(null);
  useEffect(() => { api.standing(student.id).then(setSt).catch(() => setSt(null)); }, [api, student.id]);
  const freeLeft = st ? Math.max(0, st.free - Math.min(st.absences, st.free)) : 0;
  const [kind, setKind] = useState<'free' | 'excuse'>('excuse'); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (freeLeft > 0) setKind('free'); }, [freeLeft]);
  const existing = absences.find(a => a.studentId === student.id && a.date === date);
  return <Modal open onClose={onClose} title="Tell the teacher you can’t come" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!date || (kind === 'excuse' && !reason.trim())} onClick={async () => { setBusy(true); try { await api.requestAbsence({ studentId: student.id, date, kind, reason: reason.trim() }); toast(kind === 'free' ? 'Free absence used. The teacher has been told.' : 'Sent. The teacher will approve or decline.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } }}>Send</Button></div>}>
    {!dates.length ? <p className="text-[15px] text-ink-soft">There is no upcoming class to be absent from. Ask your teacher to set the class times.</p> : <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-brass-100/60 px-3 py-2 text-sm text-brass-700">Absences must be sent <b>before class</b>. Absences that are not communicated may lead to removal from the class.</p>
      <Field label="Which class">{id => <Select id={id} value={date} onChange={setDate} options={dates.map(d => [d.date, `${niceDate(d.date)} · ${d.cls.name} ${fmtTime(d.slot.start)}`] as [string, string])} />}</Field>
      {existing && <p className="text-sm text-ink-soft">Already sent for this day ({existing.status}). Sending again replaces it.</p>}
      <Field label="Type">{id => <Select id={id} value={kind} onChange={v => setKind(v as 'free' | 'excuse')} options={[['free', `Free absence (${freeLeft} left this semester, no reason needed)`], ['excuse', `Excused absence (needs a reason; up to ${st?.extra ?? 2} a semester)`]]} />}</Field>
      {kind === 'free' && freeLeft === 0 && <p className="text-sm text-bad">You have used your free absence this semester. Choose excused and give a reason.</p>}
      {kind === 'excuse' && <Field label="Reason">{id => <textarea id={id} className={`${inputCls} min-h-[80px] py-2`} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Family travel, illness, school exam" />}</Field>}
    </div>}
  </Modal>;
}

export function StandingCard({ studentId, revisionMissed, you = true }: { studentId: string; revisionMissed?: number; you?: boolean }) {
  const { org, api } = useOrg();
  const [st, setSt] = useState<Standing | null>(null);
  useEffect(() => { api.standing(studentId).then(setSt).catch(() => setSt(null)); }, [api, studentId]);
  if (!st) return null;
  const risk = st.over > 0 || st.unnotified > 0;
  const atLimit = !risk && st.absences >= st.free + st.extra;
  const revRisk = (revisionMissed ?? 0) > org.settings.revisionForm.allowedMisses;
  const sem = org.settings.attendance;
  return <Card className={cx('p-5', (risk || revRisk) && 'ring-2 ring-bad/40')}>
    <div className="flex items-start gap-3">{risk || revRisk ? <ShieldAlert size={22} className="text-bad" /> : <ShieldCheck size={22} className="text-good" />}
      <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{you ? 'My standing' : 'Standing'}{sem.semesterStart && sem.semesterEnd ? <span className="text-sm font-normal text-ink-faint"> · semester {niceDate(sem.semesterStart)} – {niceDate(sem.semesterEnd)}</span> : null}</h2>
        <ul className="mt-2 grid gap-2 text-[15px] sm:grid-cols-3">
          <li className="rounded-xl bg-paper p-3 ring-1 ring-line"><b className="block text-2xl tabular-nums">{st.absences}</b>absence{st.absences === 1 ? '' : 's'} · {st.free} free{st.extra ? ` + ${st.extra} excused allowed` : ''}</li>
          <li className={cx('rounded-xl p-3 ring-1', st.unnotified ? 'bg-red-50 ring-bad/30' : 'bg-paper ring-line')}><b className="block text-2xl tabular-nums">{st.unnotified}</b>not communicated before class</li>
          {revisionMissed !== undefined && <li className={cx('rounded-xl p-3 ring-1', revRisk ? 'bg-red-50 ring-bad/30' : 'bg-paper ring-line')}><b className="block text-2xl tabular-nums">{revisionMissed}</b>partner revision{revisionMissed === 1 ? '' : 's'} missed last week ({org.settings.revisionForm.allowedMisses} excused)</li>}
        </ul>
        <p className={cx('mt-2 text-sm', risk || revRisk ? 'text-bad' : atLimit ? 'text-warn' : 'text-ink-soft')}>
          {st.over > 0 ? `Over the absence limit by ${st.over}. Students over the limit may be removed from the class.`
            : st.unnotified > 0 ? 'An absence was not communicated before class. This may lead to removal from the class.'
            : atLimit ? 'No absences left this semester.'
            : `${Math.max(0, st.free - st.absences)} free absence${Math.max(0, st.free - st.absences) === 1 ? '' : 's'} left · ${Math.max(0, st.extra - st.excused)} excused absence${st.extra - st.excused === 1 ? '' : 's'} left (need a reason).`}
          {revRisk ? ' Missing 2 or more revision sessions in a week is followed up by the Sheikh.' : ''}</p>
      </div></div>
  </Card>;
}

export function RevisionFormCard({ student, forms, readOnly, onChanged }: { student: Student; forms: RevisionCheckin[]; readOnly?: boolean; onChanged: () => void }) {
  const { org, today } = useOrg();
  const wk = weekStart(today);
  const slots = org.settings.revisionForm.slots;
  const mine = forms.filter(f => f.studentId === student.id && f.weekStart === wk);
  const [open, setOpen] = useState<string | null>(null);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const passed = (d: number | null) => d !== null && ((dow + 6) % 7) > ((d + 6) % 7);
  const missed = slots.filter(s => passed(s.day) && !mine.some(m => m.slot === s.key && m.done)).length;
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><Users size={18} className="text-pine-700" />Partner revision this week</span>} sub={`${mine.filter(m => m.done).length} of ${slots.length} done · week of ${niceDate(wk)}${missed ? ` · ${missed} missed so far` : ''}`} />
    <ul className="grid gap-2 px-5 py-4 sm:grid-cols-3">{slots.map(s => { const r = mine.find(m => m.slot === s.key && m.done); const late = !r && passed(s.day); return <li key={s.key}>
      <button type="button" disabled={readOnly} onClick={() => setOpen(s.key)} className={cx('flex h-full w-full flex-col items-start gap-1 rounded-xl p-3 text-left ring-1', r ? 'bg-emerald-50 ring-good/30' : late ? 'bg-red-50 ring-bad/30' : 'bg-white ring-line hover:bg-pine-50')}>
        <b className="flex items-center gap-1.5">{r ? <CheckCircle2 size={16} className="text-good" /> : null}{s.label}</b>
        <span className="text-sm text-ink-soft">{r ? [r.partner && `with ${r.partner}`, r.pages, r.recorded && 'recorded'].filter(Boolean).join(' · ') || 'Done' : late ? 'Missed' : readOnly ? 'Not yet' : 'Tap when done'}</span>
      </button></li>; })}</ul>
    {open && <RevisionEntry student={student} slot={slots.find(s => s.key === open)!} existing={mine.find(m => m.slot === open)} weekStart={wk} onClose={() => setOpen(null)} onSaved={onChanged} />}
  </Card>;
}
function RevisionEntry({ student, slot, existing, weekStart: wk, onClose, onSaved }: { student: Student; slot: { key: string; label: string }; existing?: RevisionCheckin; weekStart: string; onClose: () => void; onSaved: () => void }) {
  const { org, api } = useOrg(); const toast = useToast();
  const [mates, setMates] = useState<string[]>([]);
  useEffect(() => { api.classmates().then(r => setMates([...new Set(r.map(x => x.name))])).catch(() => setMates([])); }, [api]);
  const [partner, setPartner] = useState(existing?.partner ?? ''); const [pages, setPages] = useState(existing?.pages ?? ''); const [recorded, setRecorded] = useState(existing?.recorded ?? false); const [link, setLink] = useState(existing?.recordingLink ?? ''); const [busy, setBusy] = useState(false);
  const save = async (done: boolean) => { setBusy(true); try { await api.saveRevisionCheckin(org.id, { studentId: student.id, weekStart: wk, slot: slot.key, done, partner, pages, recorded, recordingLink: link.trim() }); toast(done ? 'Saved. JazakAllahu khayran!' : 'Cleared.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <Modal open onClose={onClose} title={slot.label} footer={<div className="flex justify-end gap-2">{existing?.done && <Button kind="quiet" onClick={() => save(false)}>Not done</Button>}<Button busy={busy} disabled={!partner.trim()} onClick={() => save(true)}><CheckCircle2 size={16} />Done</Button></div>}>
    <div className="flex flex-col gap-4">
      <Field label="Revision partner">{id => mates.length ? <Select id={id} value={partner} onChange={setPartner} options={[['', 'Choose a classmate'], ...mates.map(m => [m, m] as [string, string]), ...(partner && !mates.includes(partner) ? [[partner, partner] as [string, string]] : []), ['Family member', 'A family member']]} /> : <input id={id} className={inputCls} maxLength={80} value={partner} onChange={e => setPartner(e.target.value)} placeholder="Partner’s name" />}</Field>
      <Field label="What you revised (optional)">{id => <input id={id} className={inputCls} maxLength={120} value={pages} onChange={e => setPages(e.target.value)} placeholder="e.g. Juz 30 pages 582–586" />}</Field>
      <Toggle on={recorded} onChange={setRecorded} label="I recorded my recitation" sub="Please record when you can" />
      {recorded && <Field label="Link to the recording (optional)" hint="e.g. a WhatsApp, Google Drive or Voice Memo share link">{id => <div className="relative"><Mic size={16} className="absolute left-3 top-3.5 text-ink-faint" /><input id={id} className={`${inputCls} pl-9`} maxLength={500} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" /></div>}</Field>}
    </div>
  </Modal>;
}
export function missedLastWeek(studentId: string, forms: RevisionCheckin[], slots: Array<{ key: string }>, today: string): number {
  const last = addDays(weekStart(today), -7);
  return slots.filter(s => !forms.some(f => f.studentId === studentId && f.weekStart === last && f.slot === s.key && f.done)).length;
}

/** Class rules; a student confirms once */
/** compact: one line with a Read button; the full text opens in place (keeps the home screen short) */
export function RulesCard({ text, ackAt, onAck, compact }: { text: string; ackAt: string | null; onAck?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  if (!text.trim()) return null;
  if (!open) return <Card className={cx('flex flex-wrap items-center gap-3 p-4', onAck && !ackAt && 'ring-2 ring-brass-500/60')}>
    <ScrollText size={20} className="shrink-0 text-pine-700" />
    <span className="min-w-0 flex-1"><b className="block">Class expectations</b><span className="text-sm text-ink-soft">{onAck && !ackAt ? 'Please read them and tap “I have read and agree”.' : ackAt ? `You agreed on ${niceDate(ackAt.slice(0, 10))}.` : 'Attendance, revision and class rules.'}</span></span>
    <Button kind={onAck && !ackAt ? 'primary' : 'secondary'} className="min-h-[44px]" onClick={() => setOpen(true)}>{onAck && !ackAt ? 'Read & agree' : 'Read'}</Button>
  </Card>;
  return <Card className="p-5">
    <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><ScrollText size={18} className="text-pine-700" /><span className="flex-1">Class expectations</span>{compact && <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold text-ink-faint hover:text-ink">Hide</button>}</h2>
    <RulesText text={text} />
    {onAck && (ackAt ? <p className="mt-3 text-sm text-good">You agreed to these on {niceDate(ackAt.slice(0, 10))}.</p> : <Button className="mt-4" onClick={onAck}><CheckCircle2 size={16} />I have read and agree</Button>)}
  </Card>;
}
export function RulesText({ text }: { text: string }) {
  const blocks: Array<{ h?: string; items: string[]; p: string[] }> = [];
  let cur: { h?: string; items: string[]; p: string[] } = { items: [], p: [] };
  for (const raw of text.split('\n')) {
    const l = raw.trim(); if (!l) continue;
    if (/^([-•*]|\d+\.)\s+/.test(l)) cur.items.push(l.replace(/^([-•*]|\d+\.)\s+/, ''));
    else if (!cur.h && !cur.items.length && !cur.p.length) cur.h = l;
    else { blocks.push(cur); cur = { h: l, items: [], p: [] }; }
  }
  blocks.push(cur);
  return <div className="flex flex-col gap-3">{blocks.filter(b => b.h || b.items.length).map((b, i) => <section key={i}>
    {b.h && <h3 className="font-bold text-pine-800">{b.h}</h3>}
    {b.items.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">{b.items.map((x, k) => <li key={k}>{x}</li>)}</ul>}
  </section>)}</div>;
}
export { DEFAULT_RULES } from '../lib/rules';
