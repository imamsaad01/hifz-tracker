// Qira'at: riwayat picker (jamʿ / ifrād), farsh & uṣūl tests, khatmah per track, matn memorisation.
import { useMemo, useState } from 'react';
import { Check, Plus, BookOpenText, Trash2, CalendarClock, AlertTriangle, ScrollText, Pencil, X } from 'lucide-react';
import { useOrg } from '../app/context';
import type { OrgData } from '../app/useOrgData';
import type { QiraatProfile, QiraatTest, QiraatMistake, MatnEntry } from '../api/data';
import type { Student } from '../lib/types';
import { QURRA, USUL, MUTUN, RESULTS, riwayahLabel, riwayatSummary, rawiOf, matnOf, resultLabel, tracksOf, trackLabel, babLabel } from '../lib/qiraat';
import { surahNameEn, surahNameAr } from '../quran';
import { niceDate, addDays } from '../lib/dates';
import { friendly } from '../api/backend';
import { Button, Card, CardHead, Field, Modal, Select, Segmented, Toggle, Pill, inputCls, useToast, cx } from './ui';

export interface QiraatDraft { active: boolean; riwayat: string[]; mode: 'ifrad' | 'jam'; matn: string | null; matnDailyLines: number }
export const emptyQiraat = (): QiraatDraft => ({ active: true, riwayat: [], mode: 'ifrad', matn: null, matnDailyLines: 3 });
const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

/* ------------------------------------------------------------------ picking riwayat */
export function RiwayatPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(value);
  const toggle = (codes: string[], on: boolean) => { const n = new Set(set); codes.forEach(c => (on ? n.add(c) : n.delete(c))); onChange([...n]); };
  return <ul className="flex flex-col divide-y divide-line rounded-xl ring-1 ring-line">{QURRA.map(q => {
    const both = q.ruwat.every(r => set.has(r.code)); const some = q.ruwat.some(r => set.has(r.code));
    return <li key={q.key} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <button type="button" aria-pressed={both} onClick={() => toggle(q.ruwat.map(r => r.code), !both)}
        className={cx('flex min-h-[40px] min-w-[150px] items-center gap-2 rounded-xl px-3 text-left text-sm font-bold ring-1 ring-inset', both ? 'bg-pine-700 text-white ring-pine-700' : some ? 'bg-pine-50 text-pine-800 ring-pine-600/30' : 'bg-white text-ink ring-line')}>
        <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ring-inset', both ? 'bg-white text-pine-700 ring-white' : 'ring-current')}>{both && <Check size={14} />}</span>
        <span className="min-w-0 flex-1">{q.en}</span><span lang="ar" dir="rtl" className="font-quran text-base font-normal">{q.ar}</span>
      </button>
      <span className="flex flex-wrap gap-1.5">{q.ruwat.map(r => { const on = set.has(r.code); return <button key={r.code} type="button" aria-pressed={on} onClick={() => toggle([r.code], !on)}
        className={cx('inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 ring-inset', on ? 'bg-brass-100 text-brass-700 ring-brass-500/50' : 'bg-white text-ink-soft ring-line')}>
        {on && <Check size={14} />}{r.en} <span lang="ar" dir="rtl" className="font-quran font-normal">{r.ar}</span></button>; })}</span>
    </li>;
  })}</ul>;
}

/** riwayat + jamʿ/ifrād + matn; used at sign-up, by the teacher, and when a student edits their plan */
export function QiraatSetup({ value, onChange }: { value: QiraatDraft; onChange: (v: QiraatDraft) => void }) {
  const n = value.riwayat.length;
  return <div className="flex flex-col gap-4">
    <div><p className="mb-2 text-[13px] font-bold text-ink-soft">Which riwāyāt are you reading? Tap a qāriʾ for both ruwāt, or tap a single rāwī.</p><RiwayatPicker value={value.riwayat} onChange={r => onChange({ ...value, riwayat: r, mode: r.length > 1 ? value.mode : 'ifrad' })} /></div>
    {n > 1 && <div><p className="mb-2 text-[13px] font-bold text-ink-soft">How are you reading them?</p>
      <Segmented label="Jamʿ or ifrād" value={value.mode} onChange={m => onChange({ ...value, mode: m })} options={[['jam', 'Jamʿ (together)'], ['ifrad', 'Ifrād (one at a time)']]} />
      <p className="mt-1 text-sm text-ink-faint">{value.mode === 'jam' ? 'One khatmah, reading all of them together.' : 'A separate khatmah for each riwāyah.'}</p></div>}
    {n > 0 && <p className="rounded-xl bg-pine-50 px-3 py-2 text-sm text-pine-800"><b>{value.mode === 'jam' && n > 1 ? 'Jamʿ' : 'Ifrād'}:</b> {riwayatSummary(value.riwayat)}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Matn you are memorising">{id => <Select id={id} value={value.matn ?? ''} onChange={v => onChange({ ...value, matn: v || null })} options={[['', 'None for now'], ...MUTUN.map(m => [m.key, `${m.en} (${m.lines} lines)`] as [string, string])]} />}</Field>
      {value.matn && <Field label="New lines each day">{id => <Select id={id} value={value.matnDailyLines} onChange={v => onChange({ ...value, matnDailyLines: v })} options={[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map(x => [x, `${x} line${x > 1 ? 's' : ''}`] as [number, string])} />}</Field>}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ helpers */
export const profileOf = (data: OrgData, studentId: string) => data.qiraat.profiles.find(p => p.studentId === studentId) ?? null;
export function weakAreas(tests: QiraatTest[], today: string) {
  const since = addDays(today, -60);
  const recent = tests.filter(t => t.status === 'done' && (t.takenOn ?? '') >= since && (t.result === 'repeat' || t.mistakes.length > 0))
    .sort((a, b) => (b.takenOn ?? '').localeCompare(a.takenOn ?? ''));
  const byTitle = new Map<string, { title: string; date: string; result: string | null; mistakes: QiraatMistake[] }>();
  for (const t of recent) { const w = byTitle.get(t.title); if (w) w.mistakes.push(...t.mistakes); else byTitle.set(t.title, { title: t.title, date: t.takenOn ?? '', result: t.result, mistakes: [...t.mistakes] }); }
  return [...byTitle.values()];
}
export function matnState(p: QiraatProfile | null, log: MatnEntry[]) {
  const m = matnOf(p?.matn); if (!p || !m) return null;
  const mine = log.filter(l => l.studentId === p.studentId && l.matn === m.key);
  const memorised = Math.max(0, ...mine.filter(l => l.kind === 'memorised').map(l => l.lineTo));
  const recited = Math.max(0, ...mine.filter(l => l.kind === 'recited').map(l => l.lineTo));
  const next = memorised + 1; const to = Math.min(m.lines, memorised + p.matnDailyLines);
  return { matn: m, memorised, recited, next: next <= m.lines ? next : null, to, entries: mine };
}
const Bar = ({ value, max, tone = 'pine' }: { value: number; max: number; tone?: 'pine' | 'brass' }) =>
  <span className="block h-2 overflow-hidden rounded-full bg-black/[.06]"><span className={cx('block h-full rounded-full', tone === 'pine' ? 'bg-pine-700' : 'bg-brass-500')} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} /></span>;
const RiwayahChips = ({ codes }: { codes: string[] }) => <span className="flex flex-wrap gap-1">{codes.map(c => <Pill key={c} tone="brass">{riwayahLabel(c)}</Pill>)}</span>;

/* ------------------------------------------------------------------ student / parent view */
export function QiraatStudentCard({ student, data, onChanged, readOnly }: { student: Student; data: OrgData; onChanged: () => void; readOnly?: boolean }) {
  const { api, org, today } = useOrg(); const toast = useToast();
  const p = profileOf(data, student.id);
  const [busy, setBusy] = useState(false);
  if (!p || !p.active) return null;
  const tests = data.qiraat.tests.filter(t => t.studentId === student.id);
  const upcoming = tests.filter(t => t.status === 'scheduled').sort((a, b) => (a.scheduledOn ?? '9').localeCompare(b.scheduledOn ?? '9'));
  const weak = weakAreas(tests, today);
  const ms = matnState(p, data.qiraat.matn);
  const tracks = tracksOf(p);
  const done = (t: string) => data.qiraat.khatmah.filter(k => k.studentId === student.id && k.track === t).length;
  const todayEntry = ms?.entries.find(e => e.kind === 'memorised' && e.date === today);
  const memorisedToday = !!todayEntry;
  const logLines = async () => { if (!ms?.next) return; setBusy(true); try { await api.addMatn(org.id, { studentId: student.id, matn: ms.matn.key, lineFrom: ms.next, lineTo: ms.to, kind: 'memorised', date: today }); toast('Lines saved. Bārak Allāhu fīk.'); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <Card>
    <CardHead title={<span className="inline-flex items-center gap-2"><BookOpenText size={18} className="text-brass-500" />Qirāʾāt</span>} sub={<>{p.mode === 'jam' && p.riwayat.length > 1 ? 'Jamʿ' : 'Ifrād'} · {riwayatSummary(p.riwayat)}</>} />
    <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
      {upcoming.length > 0 && <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-ink-soft"><CalendarClock size={15} />Coming tests</p>
        <ul className="flex flex-col gap-1.5">{upcoming.slice(0, 4).map(t => <li key={t.id} className={cx('rounded-xl px-3 py-2 ring-1 ring-inset', t.scheduledOn === today ? 'bg-brass-100 ring-brass-500/40' : 'ring-line')}>
          <b>{t.title}</b>{t.kind === 'farsh' && t.surah && <span lang="ar" dir="rtl" className="mx-1.5 font-quran text-pine-800">{surahNameAr(t.surah)}</span>}
          <span className="block text-sm text-ink-soft">{t.scheduledOn ? (t.scheduledOn === today ? 'Today' : niceDate(t.scheduledOn)) : 'Date to be set'}{t.riwayat.length ? ` · ${riwayatSummary(t.riwayat)}` : ''}</span></li>)}</ul></div>}
      {ms && <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-ink-soft"><ScrollText size={15} />{ms.matn.en} <span lang="ar" dir="rtl" className="font-quran font-normal">{ms.matn.ar}</span></p>
        <Bar value={ms.memorised} max={ms.matn.lines} tone="brass" />
        <p className="mt-1 text-sm text-ink-soft">{ms.memorised} of {ms.matn.lines} lines memorised{ms.recited ? ` · ${ms.recited} recited to your teacher` : ''}</p>
        {(ms.next || todayEntry) && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2"><span className="min-w-0 flex-1 text-[15px]"><b>Today:</b> lines {todayEntry ? `${todayEntry.lineFrom}–${todayEntry.lineTo}` : `${ms.next}–${ms.to}`}</span>
          {!readOnly && (memorisedToday ? <Pill tone="green"><Check size={13} />Done today</Pill> : <Button className="min-h-[38px] px-3 text-sm" busy={busy} onClick={logLines}><Check size={15} />I memorised them</Button>)}</div>}
      </div>}
      {weak.length > 0 && <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-warn"><AlertTriangle size={15} />To revise</p>
        <ul className="flex flex-col gap-1.5">{weak.slice(0, 5).map(w => <li key={w.title} className="rounded-xl bg-amber-50 px-3 py-2"><b>{w.title}</b>{w.result === 'repeat' && <Pill tone="amber" className="ml-2">Repeat</Pill>}
          {w.mistakes.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{w.mistakes.slice(0, 8).map((m, i) => <span key={i} className="rounded-lg bg-white px-2 py-0.5 text-sm ring-1 ring-line"><span lang="ar" dir="auto">{m.text}</span>{m.riwayah && <span className="text-ink-faint"> · {rawiOf(m.riwayah)?.en}</span>}</span>)}</span>}</li>)}</ul></div>}
      <div><p className="mb-1.5 text-sm font-bold text-ink-soft">Khatmah</p>
        <ul className="flex flex-col gap-2">{tracks.map(t => <li key={t}><span className="flex justify-between text-sm"><span className="min-w-0 truncate">{trackLabel(t, p)}</span><span className="tabular-nums text-ink-faint">{done(t)}/114</span></span><Bar value={done(t)} max={114} /></li>)}</ul></div>
      {!upcoming.length && !weak.length && <p className="text-sm text-ink-faint">Your teacher schedules farsh and uṣūl tests here. You’ll get a reminder two days before.</p>}
    </div>
  </Card>;
}

/* ------------------------------------------------------------------ teacher: profile, tests, khatmah, matn */
export function QiraatTeacherPanel({ student, data, onChanged }: { student: Student; data: OrgData; onChanged: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const p = profileOf(data, student.id);
  const [edit, setEdit] = useState(false);
  const [test, setTest] = useState<QiraatTest | 'new' | null>(null);
  const [view, setView] = useState<'tests' | 'khatmah' | 'matn'>('tests');
  const on = !!p?.active;
  const flip = async (v: boolean) => {
    if (v && !p?.riwayat.length) { setEdit(true); return; }
    try { await api.setQiraat(student.id, { ...(p ?? emptyQiraat()), active: v }); onChanged(); } catch (e) { toast(friendly(e), 'err'); }
  };
  return <Card>
    <div className="px-5 pt-3"><Toggle on={on} onChange={flip} label="Qirāʾāt student" sub={on && p ? `${p.mode === 'jam' && p.riwayat.length > 1 ? 'Jamʿ' : 'Ifrād'} · ${riwayatSummary(p.riwayat)}` : 'Reads the qirāʾāt to you: riwāyāt, farsh and uṣūl tests, matn'} /></div>
    {on && p && <div className="flex flex-col gap-4 px-5 pb-5 pt-2">
      <div className="flex flex-wrap items-center gap-2"><RiwayahChips codes={p.riwayat} /><Button kind="quiet" className="min-h-[36px] px-2 text-sm" onClick={() => setEdit(true)}><Pencil size={14} />Change</Button></div>
      <Segmented label="Qira'at section" value={view} onChange={setView} options={[['tests', 'Farsh & uṣūl'], ['khatmah', 'Khatmah'], ['matn', 'Matn']]} />
      {view === 'tests' && <TestsList student={student} data={data} onOpen={setTest} onChanged={onChanged} />}
      {view === 'khatmah' && <KhatmahGrid student={student} profile={p} data={data} onChanged={onChanged} />}
      {view === 'matn' && <MatnPanel student={student} profile={p} data={data} onChanged={onChanged} />}
    </div>}
    {edit && <ProfileModal student={student} profile={p} onClose={() => setEdit(false)} onSaved={onChanged} />}
    {test && p && <TestModal student={student} profile={p} test={test === 'new' ? null : test} onClose={() => setTest(null)} onSaved={onChanged} />}
  </Card>;
}

export function ProfileModal({ student, profile, onClose, onSaved }: { student: Student; profile: QiraatProfile | null; onClose: () => void; onSaved: () => void }) {
  const { api } = useOrg(); const toast = useToast();
  const [v, setV] = useState<QiraatDraft>(profile ? { ...profile, active: true } : emptyQiraat()); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.setQiraat(student.id, v); toast('Saved.'); onSaved(); onClose(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  return <Modal open wide onClose={onClose} title={`Qirāʾāt: ${student.name}`} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!v.riwayat.length} onClick={save}>Save</Button></div>}>
    <QiraatSetup value={v} onChange={setV} />
  </Modal>;
}

function TestsList({ student, data, onOpen, onChanged }: { student: Student; data: OrgData; onOpen: (t: QiraatTest | 'new') => void; onChanged: () => void }) {
  const { api, today } = useOrg(); const toast = useToast();
  const tests = data.qiraat.tests.filter(t => t.studentId === student.id);
  const scheduled = tests.filter(t => t.status === 'scheduled').sort((a, b) => (a.scheduledOn ?? '9').localeCompare(b.scheduledOn ?? '9'));
  const done = tests.filter(t => t.status === 'done').sort((a, b) => (b.takenOn ?? '').localeCompare(a.takenOn ?? ''));
  const weak = weakAreas(tests, today);
  const tone = (r: string | null) => (r === 'repeat' ? 'red' : r === 'pass' ? 'amber' : 'green') as 'red' | 'amber' | 'green';
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2"><Button onClick={() => onOpen('new')}><Plus size={16} />Schedule or record a test</Button></div>
    {weak.length > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-warn"><b>Weak areas (60 days):</b> {weak.map(w => w.title).join(' · ')}</p>}
    {scheduled.length > 0 && <ul className="flex flex-col divide-y divide-line rounded-xl ring-1 ring-line">{scheduled.map(t => <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><b>{t.title}</b><span className="block text-sm text-ink-soft">{t.scheduledOn ? niceDate(t.scheduledOn) : 'No date'} · {riwayatSummary(t.riwayat)}</span></span>
      <Button className="min-h-[38px] px-3 text-sm" onClick={() => onOpen(t)}><Check size={15} />Mark</Button>
      <Button kind="quiet" aria-label="Remove test" className="min-h-[38px] px-2" onClick={async () => { try { await api.removeQiraatTest(t.id); onChanged(); } catch (e) { toast(friendly(e), 'err'); } }}><Trash2 size={15} /></Button>
    </li>)}</ul>}
    {done.length > 0 && <ul className="flex flex-col divide-y divide-line rounded-xl ring-1 ring-line">{done.slice(0, 30).map(t => <li key={t.id}><button type="button" onClick={() => onOpen(t)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left hover:bg-paper">
      <span className="min-w-0 flex-1"><b>{t.title}</b><span className="block text-sm text-ink-soft">{t.takenOn ? niceDate(t.takenOn) : ''} · {riwayatSummary(t.riwayat)}{t.mistakes.length ? ` · ${t.mistakes.length} mistake${t.mistakes.length > 1 ? 's' : ''}` : ''}</span></span>
      <Pill tone={tone(t.result)}>{resultLabel(t.result)}</Pill></button></li>)}</ul>}
    {!tests.length && <p className="text-sm text-ink-faint">No tests yet. Schedule one ahead (the student is reminded 2 days before and on the day), or record one you just heard.</p>}
  </div>;
}

function TestModal({ student, profile, test, onClose, onSaved }: { student: Student; profile: QiraatProfile; test: QiraatTest | null; onClose: () => void; onSaved: () => void }) {
  const { api, today } = useOrg(); const toast = useToast();
  const [kind, setKind] = useState<'farsh' | 'usul'>(test?.kind ?? 'farsh');
  const [surah, setSurah] = useState(test?.surah ?? 2); const [bab, setBab] = useState(test?.bab ?? USUL[5].key);
  const [riw, setRiw] = useState<string[]>(test?.riwayat.length ? test.riwayat : profile.riwayat);
  const [when, setWhen] = useState<'later' | 'now'>(test ? 'now' : 'later');
  const [date, setDate] = useState(test?.scheduledOn ?? addDays(today, 7));
  const [result, setResult] = useState<string>(test?.result ?? 'good');
  const [mistakes, setMistakes] = useState<QiraatMistake[]>(test?.mistakes ?? []);
  const [word, setWord] = useState(''); const [wordRiw, setWordRiw] = useState<string>('');
  const [note, setNote] = useState(test?.note ?? ''); const [busy, setBusy] = useState(false);
  const title = kind === 'farsh' ? `Farsh: ${surahNameEn(surah)}` : `Uṣūl: ${babLabel(bab)}`;
  const addWord = () => { if (!word.trim()) return; setMistakes(m => [...m, { text: word.trim().slice(0, 120), riwayah: wordRiw || null }]); setWord(''); };
  const save = async () => {
    setBusy(true);
    try {
      const all = word.trim() ? [...mistakes, { text: word.trim(), riwayah: wordRiw || null }] : mistakes;
      await api.saveQiraatTest({ id: test?.id, studentId: student.id, kind, surah: kind === 'farsh' ? surah : null, bab: kind === 'usul' ? bab : null, title, riwayat: riw,
        scheduledOn: when === 'later' ? date : test?.scheduledOn ?? today, result: when === 'now' ? result : null, mistakes: when === 'now' ? all : [], note, takenOn: when === 'now' ? (test?.takenOn ?? today) : null });
      toast(when === 'now' ? 'Result saved.' : 'Test scheduled. The student will be reminded.'); onSaved(); onClose();
    } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return <Modal open wide onClose={onClose} title={test ? title : 'Farsh or uṣūl test'} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!riw.length} onClick={save}>{when === 'now' ? 'Save result' : 'Schedule'}</Button></div>}>
    <div className="flex flex-col gap-4">
      <Segmented label="Test type" value={kind} onChange={setKind} options={[['farsh', 'Farsh of a surah'], ['usul', 'Uṣūl (a bāb)']]} />
      {kind === 'farsh' ? <Field label="Surah">{id => <Select id={id} value={surah} onChange={setSurah} options={SURAHS.map(s => [s, `${s}. ${surahNameEn(s)} · ${surahNameAr(s)}`] as [number, string])} />}</Field>
        : <Field label="Bāb">{id => <Select id={id} value={bab} onChange={setBab} options={USUL.map(b => [b.key, `${b.en} · ${b.ar}`] as [string, string])} />}</Field>}
      <div><p className="mb-1.5 text-[13px] font-bold text-ink-soft">In which riwāyāt</p>
        <div className="flex flex-wrap gap-1.5">{profile.riwayat.map(c => { const on = riw.includes(c); return <button key={c} type="button" aria-pressed={on} onClick={() => setRiw(on ? riw.filter(x => x !== c) : [...riw, c])}
          className={cx('inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 ring-inset', on ? 'bg-brass-100 text-brass-700 ring-brass-500/50' : 'bg-white text-ink-soft ring-line')}>{on && <Check size={14} />}{riwayahLabel(c)}</button>; })}</div></div>
      <Segmented label="When" value={when} onChange={setWhen} options={[['later', 'Schedule for a date'], ['now', 'Record the result now']]} />
      {when === 'later' ? <Field label="Test date">{id => <input id={id} type="date" className={inputCls} min={today} value={date} onChange={e => setDate(e.target.value)} />}</Field> : <>
        <Field label="Result">{id => <Select id={id} value={result} onChange={setResult} options={RESULTS.map(([k, l]) => [k, l] as [string, string])} />}</Field>
        <div><p className="mb-1.5 text-[13px] font-bold text-ink-soft">Words or rules they got wrong</p>
          {mistakes.length > 0 && <ul className="mb-2 flex flex-wrap gap-1.5">{mistakes.map((m, i) => <li key={i} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 py-1 pl-2.5 pr-1 text-sm ring-1 ring-warn/25"><span lang="ar" dir="auto">{m.text}</span>{m.riwayah && <span className="text-ink-faint">· {rawiOf(m.riwayah)?.en}</span>}
            <button type="button" aria-label="Remove" className="grid h-6 w-6 place-items-center rounded-md hover:bg-black/5" onClick={() => setMistakes(mistakes.filter((_, j) => j !== i))}><X size={13} /></button></li>)}</ul>}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input aria-label="Word or rule" className={inputCls} dir="auto" placeholder="e.g. مالك يوم الدين، or 'ṣilah of mīm al-jamʿ'" value={word} maxLength={120} onChange={e => setWord(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }} />
            {riw.length > 1 ? <Select aria-label="Riwayah" className="sm:!w-auto" value={wordRiw} onChange={setWordRiw} options={[['', 'All / general'], ...riw.map(c => [c, rawiOf(c)?.en ?? c] as [string, string])]} /> : <span className="hidden sm:block" />}
            <Button kind="secondary" onClick={addWord} disabled={!word.trim()}><Plus size={15} />Add</Button>
          </div></div>
        <Field label="Note (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[70px] py-2`} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />}</Field>
      </>}
    </div>
  </Modal>;
}

function KhatmahGrid({ student, profile, data, onChanged }: { student: Student; profile: QiraatProfile; data: OrgData; onChanged: () => void }) {
  const { api, org } = useOrg(); const toast = useToast();
  const tracks = tracksOf(profile);
  const [track, setTrack] = useState(tracks[0]);
  const t = tracks.includes(track) ? track : tracks[0];
  const done = useMemo(() => new Set(data.qiraat.khatmah.filter(k => k.studentId === student.id && k.track === t).map(k => k.surah)), [data.qiraat.khatmah, student.id, t]);
  const [pending, setPending] = useState<number | null>(null);
  const flip = async (s: number) => { setPending(s); try { await api.setKhatmah(org.id, student.id, t, [s], !done.has(s)); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setPending(null); } };
  if (!t) return null;
  return <div className="flex flex-col gap-3">
    {tracks.length > 1 && <Field label="Khatmah">{id => <Select id={id} value={t} onChange={setTrack} options={tracks.map(x => [x, trackLabel(x, profile)] as [string, string])} />}</Field>}
    <p className="text-sm text-ink-soft"><b>{done.size}/114</b> surahs read{tracks.length === 1 ? ` · ${trackLabel(t, profile)}` : ''}. Tap a surah when they finish reading it to you.</p>
    <Bar value={done.size} max={114} />
    <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-12">{SURAHS.map(s => <li key={s}><button type="button" title={surahNameEn(s)} aria-label={`${s}. ${surahNameEn(s)}${done.has(s) ? ', read' : ''}`} aria-pressed={done.has(s)} disabled={pending === s} onClick={() => flip(s)}
      className={cx('h-10 w-full rounded-lg text-sm font-bold tabular-nums ring-1 ring-inset transition', done.has(s) ? 'bg-pine-700 text-white ring-pine-700' : 'bg-white text-ink-soft ring-line hover:bg-pine-50', pending === s && 'opacity-50')}>{s}</button></li>)}</ul>
  </div>;
}

function MatnPanel({ student, profile, data, onChanged }: { student: Student; profile: QiraatProfile; data: OrgData; onChanged: () => void }) {
  const { api, org, today } = useOrg(); const toast = useToast();
  const ms = matnState(profile, data.qiraat.matn);
  const [from, setFrom] = useState(ms ? Math.max(1, ms.recited + 1) : 1); const [to, setTo] = useState(ms ? Math.min(ms.matn.lines, Math.max(ms.recited + 1, ms.memorised)) : 1);
  const [busy, setBusy] = useState(false);
  if (!ms) return <p className="text-sm text-ink-faint">No matn chosen. Tap “Change” above to choose the Shāṭibiyyah, Durrah or Ṭayyibah.</p>;
  const add = async () => { setBusy(true); try { await api.addMatn(org.id, { studentId: student.id, matn: ms.matn.key, lineFrom: Math.min(from, to), lineTo: Math.max(from, to), kind: 'recited', date: today }); toast('Saved.'); onChanged(); } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); } };
  const lines = Array.from({ length: ms.matn.lines }, (_, i) => i + 1);
  return <div className="flex flex-col gap-3">
    <p className="text-[15px]"><b>{ms.matn.en}</b> <span lang="ar" dir="rtl" className="font-quran">{ms.matn.ar}</span> · {profile.matnDailyLines} new line{profile.matnDailyLines > 1 ? 's' : ''} a day</p>
    <div><span className="flex justify-between text-sm"><span>Memorised (student’s log)</span><b className="tabular-nums">{ms.memorised}/{ms.matn.lines}</b></span><Bar value={ms.memorised} max={ms.matn.lines} tone="brass" /></div>
    <div><span className="flex justify-between text-sm"><span>Recited to you</span><b className="tabular-nums">{ms.recited}/{ms.matn.lines}</b></span><Bar value={ms.recited} max={ms.matn.lines} /></div>
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <Field label="Recited from line">{id => <Select id={id} value={from} onChange={setFrom} options={lines.map(l => [l, String(l)] as [number, string])} />}</Field>
      <Field label="to line">{id => <Select id={id} value={to} onChange={setTo} options={lines.map(l => [l, String(l)] as [number, string])} />}</Field>
      <Button busy={busy} onClick={add}><Check size={16} />Save</Button>
    </div>
    {ms.entries.length > 0 && <ul className="divide-y divide-line rounded-xl text-sm ring-1 ring-line">{ms.entries.slice(0, 10).map(e => <li key={e.id} className="flex items-center gap-2 px-3 py-2">
      <span className="flex-1">{niceDate(e.date)} · lines {e.lineFrom}–{e.lineTo}</span><Pill tone={e.kind === 'recited' ? 'pine' : 'brass'}>{e.kind === 'recited' ? 'Recited' : 'Memorised'}</Pill>
      <button type="button" aria-label="Remove entry" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-black/5 hover:text-bad" onClick={async () => { try { await api.removeMatn(e.id); onChanged(); } catch (err) { toast(friendly(err), 'err'); } }}><Trash2 size={14} /></button></li>)}</ul>}
  </div>;
}

/** Teacher's Today: qira'at tests in the next week */
export function QiraatTestsDue({ data, onOpenStudent }: { data: OrgData; onOpenStudent: (id: string) => void }) {
  const { today } = useOrg();
  const week = addDays(today, 7);
  const due = data.qiraat.tests.filter(t => t.status === 'scheduled' && t.scheduledOn && t.scheduledOn <= week).sort((a, b) => (a.scheduledOn ?? '').localeCompare(b.scheduledOn ?? ''));
  if (!due.length) return null;
  const name = (id: string) => data.students.find(s => s.id === id)?.name ?? '';
  return <Card><CardHead title={<span className="inline-flex items-center gap-2"><BookOpenText size={18} className="text-brass-500" />Qirāʾāt tests this week</span>} />
    <ul className="mt-2 divide-y divide-line">{due.map(t => <li key={t.id}><button type="button" onClick={() => onOpenStudent(t.studentId)} className="flex w-full flex-wrap items-center gap-x-2 px-5 py-2.5 text-left hover:bg-paper">
      <b>{name(t.studentId)}</b><span className="text-ink-soft">{t.title}</span><span className={cx('ml-auto text-sm', (t.scheduledOn ?? '') < today ? 'font-bold text-bad' : t.scheduledOn === today ? 'font-bold text-brass-700' : 'text-ink-faint')}>{(t.scheduledOn ?? '') < today ? 'Overdue' : t.scheduledOn === today ? 'Today' : niceDate(t.scheduledOn!)}</span></button></li>)}</ul>
  </Card>;
}
