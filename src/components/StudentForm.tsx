// Student setup: four short steps of dropdowns. Used by a student on first sign-in, and by a teacher adding a child.
import { useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { Button, Card, Field, Select, Toggle, inputCls, ErrorBox, cx } from './ui';
import { RangeLabel } from './quran';
import { ayahCount, ayahId, surahNameEn, surahRange, type Range } from '../quran';

export interface StudentDraft { name: string; ageGroup: string; direction: 'back' | 'forward'; dailyNewAyahs: number; goal: string; guardianName: string; guardianEmail: string; notify: boolean; memorized: Range[] }
const AGES = ['Under 7', '7–9', '10–12', '13–15', '16–18', 'Adult'];
const GOALS = ['Juz ʿAmma (Juz 30)', 'Juz 29 and 30', 'Juz 26–30', '5 juz', '10 juz', 'Half the Qurʾān', 'The whole Qurʾān'];
const DAILY = [1, 2, 3, 4, 5, 7, 10, 15, 20];

export function StudentForm({ byTeacher, defaultName = '', onSubmit, onCancel }: { byTeacher?: boolean; defaultName?: string; onSubmit: (d: StudentDraft) => Promise<void>; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(defaultName); const [age, setAge] = useState('10–12');
  const [direction, setDirection] = useState<'back' | 'forward'>('back');
  const [upTo, setUpTo] = useState<number>(0);                 // 0 = nothing yet; else the last whole surah
  const [partSurah, setPartSurah] = useState<number>(114); const [partAyah, setPartAyah] = useState<number>(0);
  const [daily, setDaily] = useState(3); const [goal, setGoal] = useState(GOALS[0]);
  const [gName, setGName] = useState(''); const [gEmail, setGEmail] = useState(''); const [notify, setNotify] = useState(true);

  const whole: Range[] = upTo === 0 ? [] : direction === 'back'
    ? Array.from({ length: 114 - upTo + 1 }, (_, i) => surahRange(114 - i))
    : Array.from({ length: upTo }, (_, i) => surahRange(i + 1));
  const nextSurah = upTo === 0 ? (direction === 'back' ? 114 : 1) : direction === 'back' ? upTo - 1 : upTo + 1;
  const memorized = [...whole, ...(partAyah > 0 ? [{ start: ayahId(partSurah, 1), end: ayahId(partSurah, partAyah) }] : [])];
  const emailOk = !gEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(gEmail);
  const ok = [name.trim().length >= 2, true, true, emailOk][step];
  const steps = ['About', 'Memorised so far', 'Plan', 'Parent'];
  const you = byTeacher ? 'the student' : 'you';

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await onSubmit({ name: name.trim(), ageGroup: age, direction, dailyNewAyahs: daily, goal, guardianName: gName.trim(), guardianEmail: gEmail.trim(), notify: notify && !!gEmail.trim(), memorized }); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-4">
    <ol className="grid grid-cols-4 gap-2" aria-label="Steps">{steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-1.5"><span className={cx('h-1.5 rounded-full', i <= step ? 'bg-pine-700' : 'bg-black/10')} /><span className={cx('text-xs font-bold', i === step ? 'text-pine-800' : 'text-ink-faint')}>{i + 1}. {s}</span></li>)}</ol>
    <Card className="p-5">
      {err && <div className="mb-4"><ErrorBox message={err} /></div>}
      {step === 0 && <div className="flex flex-col gap-4">
        <Field label={byTeacher ? 'Student’s full name' : 'Your full name'}>{id => <input id={id} className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" />}</Field>
        <Field label="Age group" hint="Only the group is kept, never a birthday.">{id => <Select id={id} value={age} onChange={setAge} options={AGES.map(a => [a, a])} />}</Field>
      </div>}
      {step === 1 && <div className="flex flex-col gap-4">
        <Field label="Which way is the memorisation going?">{id => <Select id={id} value={direction} onChange={v => { setDirection(v); setUpTo(0); setPartAyah(0); }} options={[['back', 'From An-Nās backwards (Juz ʿAmma first)'], ['forward', 'From Al-Fātiḥah forwards']]} />}</Field>
        <Field label={direction === 'back' ? `Whole surahs memorised, from An-Nās back to…` : 'Whole surahs memorised, from Al-Fātiḥah up to…'}>{id =>
          <Select id={id} value={upTo} onChange={v => { setUpTo(v); const n = v === 0 ? (direction === 'back' ? 114 : 1) : direction === 'back' ? v - 1 : v + 1; if (n >= 1 && n <= 114) setPartSurah(n); setPartAyah(0); }}
            options={[[0, 'Nothing yet'] as [number, string], ...(direction === 'back' ? Array.from({ length: 114 }, (_, i) => 114 - i) : Array.from({ length: 114 }, (_, i) => i + 1)).map(s => [s, `${s}. ${surahNameEn(s)}`] as [number, string])]} />}</Field>
        {nextSurah >= 1 && nextSurah <= 114 && <Field label={`Part of ${surahNameEn(partSurah)} already memorised?`}>{id =>
          <Select id={id} value={partAyah} onChange={setPartAyah} options={[[0, 'None of it yet'] as [number, string], ...Array.from({ length: ayahCount(partSurah) - 1 }, (_, i) => [i + 1, `Ayahs 1–${i + 1}`] as [number, string])]} />}</Field>}
        {memorized.length > 0 ? <div className="flex flex-col gap-1">{whole.length > 0 && <RangeLabel compact range={{ start: Math.min(...whole.map(r => r.start)), end: Math.max(...whole.map(r => r.end)) }} />}{partAyah > 0 && <RangeLabel compact range={memorized[memorized.length - 1]} />}</div>
          : <p className="text-sm text-ink-faint">Starting fresh. {byTeacher ? 'Their' : 'Your'} first lesson will be {surahNameEn(direction === 'back' ? 114 : 1)}.</p>}
      </div>}
      {step === 2 && <div className="flex flex-col gap-4">
        <Field label="New ayahs each day" hint="Small and steady is best. The teacher can change it.">{id => <Select id={id} value={daily} onChange={setDaily} options={DAILY.map(n => [n, `${n} ayah${n > 1 ? 's' : ''}`])} />}</Field>
        <Field label="Goal">{id => <Select id={id} value={goal} onChange={setGoal} options={GOALS.map(g => [g, g])} />}</Field>
      </div>}
      {step === 3 && <div className="flex flex-col gap-4">
        <Field label="Parent or guardian name (optional)">{id => <input id={id} className={inputCls} value={gName} onChange={e => setGName(e.target.value)} maxLength={80} />}</Field>
        <Field label="Parent’s email (optional)" error={emailOk ? null : 'That email does not look right.'} hint="Used only for progress emails.">{id => <input id={id} type="email" className={inputCls} value={gEmail} onChange={e => setGEmail(e.target.value)} maxLength={120} autoComplete="email" />}</Field>
        <Toggle on={notify} onChange={setNotify} label="Email progress updates" sub="A short summary after each session the teacher records" />
      </div>}
      <div className="mt-6 flex justify-between gap-3">
        {step === 0 ? (onCancel ? <Button kind="secondary" onClick={onCancel}>Cancel</Button> : <span />) : <Button kind="secondary" onClick={() => setStep(s => s - 1)}>Back</Button>}
        {step < 3 ? <Button disabled={!ok} onClick={() => setStep(s => s + 1)}>Next <ChevronRight size={18} /></Button>
          : <Button disabled={!ok} busy={busy} onClick={submit}><Check size={18} />{byTeacher ? 'Add student' : 'Start tracking'}</Button>}
      </div>
    </Card>
    <p className="text-center text-xs text-ink-faint">Everything except the name is a dropdown, and {you} can change it later.</p>
  </div>;
}
