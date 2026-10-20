import { useState } from 'react';
import { GraduationCap, BookOpen, Users, Building2, ShieldCheck, RotateCcw, Eye, EyeOff, ChevronRight, Check, Repeat, ClipboardCheck } from 'lucide-react';
import { useRef } from 'react';
import { useApp } from '../app/context';
import { Brand } from '../components/Brand';
import { InstallApp } from '../components/InstallApp';
import { Button, Card, ErrorBox, Field, inputCls, Segmented, useToast, cx } from '../components/ui';
import { friendly } from '../api/backend';

const ICON = [GraduationCap, GraduationCap, BookOpen, Users, Building2];
function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}
export function SignIn() {
  const { backend } = useApp();
  const toast = useToast();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seen = () => { try { return localStorage.getItem(INTRO) === '1'; } catch { return true; } };
  const [intro, setIntro] = useState(() => (backend.kind === 'live' && !seen()) || window.location.hash === '#/intro');
  const [startMode, setStartMode] = useState<'in' | 'up'>('in');
  if (intro) return <Intro onDone={m => { try { localStorage.setItem(INTRO, '1'); } catch { /* */ } setStartMode(m); setIntro(false); }} />;
  return <div className="min-h-full bg-pine-900 px-4 py-10">
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex justify-center"><Brand light /></div>
      <Card className="p-6">
        <h1 className="text-2xl font-bold">Assalamu alaikum</h1>
        <p className="mt-1 text-[15px] text-ink-soft">Your new lessons, revision and progress, with your teacher, in one place.</p>
        {err && <div className="mt-4"><ErrorBox message={err} /></div>}
        {backend.kind === 'live' ? <>
          <EmailAuth initial={startMode} />
          {import.meta.env.VITE_GOOGLE_AUTH === 'on' && <Button kind="secondary" className="mt-3 w-full" busy={busy === 'g'} onClick={async () => { setBusy('g'); try { await backend.signInWithGoogle!(); } catch (e) { setErr(friendly(e)); setBusy(null); } }}><GoogleMark />Continue with Google</Button>}
          <InstallApp className="mt-4" />
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-faint"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Your records are private to your program. Nothing is public.</p>
          <button type="button" onClick={() => setIntro(true)} className="mt-2 min-h-[44px] self-start text-sm font-bold text-pine-700 underline">How the app works</button>
        </> : <div className="mt-5 flex flex-col gap-3">
          <p className="rounded-xl bg-brass-100 px-3 py-2 text-sm text-brass-700"><b>Preview.</b> The real database runs inside this browser with sample people, so you can try every role. Choose who to be:</p>
          {backend.personas!.map((p, i) => { const I = ICON[i] ?? Users; return <button key={p.id} type="button" onClick={async () => { setBusy(p.id); await backend.signInAs!(p.id); }}
            className="flex items-start gap-3 rounded-xl border border-line bg-white p-3 text-left hover:border-pine-600 hover:bg-pine-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine-700"><I size={20} /></span>
            <span className="min-w-0"><b className="block">{p.label}</b><span className="text-sm text-ink-faint">{p.description}</span></span>
          </button>; })}
          <button type="button" className="mt-1 inline-flex items-center gap-1.5 self-start text-sm font-bold text-ink-faint underline" onClick={async () => { await backend.resetPreview!(); toast('Sample data restored.'); }}><RotateCcw size={14} />Reset the sample data</button>
        </div>}
      </Card>
    </div>
  </div>;
}

function EmailAuth({ initial = 'in' }: { initial?: 'in' | 'up' }) {
  const { backend } = useApp();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>(initial);
  const [show, setShow] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [note, setNote] = useState<string | null>(null);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ok = emailOk && (mode === 'reset' || pw.length >= 8) && (mode !== 'up' || name.trim().length >= 2);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      if (mode === 'in') await backend.signInWithEmail!(email.trim(), pw);
      else if (mode === 'up') { const confirm = await backend.signUpWithEmail!(email.trim(), pw, name.trim()); if (confirm) setNote(`We sent a link to ${email.trim()}. Open it to finish creating your account, then sign in.`); }
      else { await backend.resetPassword!(email.trim()); setNote(`If ${email.trim()} has an account, a link to set a new password is on its way.`); }
    } catch (x) { setErr(friendly(x)); } finally { setBusy(false); }
  };
  return <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
    {mode !== 'reset' && <Segmented label="Account" value={mode} onChange={m => { setMode(m); setErr(null); setNote(null); }} options={[['in', 'Sign in'], ['up', 'Create account']]} />}
    {err && <ErrorBox message={err} />}
    {note && <p role="status" className="rounded-xl bg-pine-50 px-3 py-2 text-sm text-pine-800">{note}</p>}
    {mode === 'up' && <Field label="Your name">{id => <input id={id} className={inputCls} autoComplete="name" value={name} maxLength={80} onChange={e => setName(e.target.value)} />}</Field>}
    <Field label="Email">{id => <input id={id} type="email" className={inputCls} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />}</Field>
    {mode !== 'reset' && <Field label="Password" hint={mode === 'up' ? 'At least 8 characters.' : undefined}>{id => <div className="relative"><input id={id} type={show ? 'text' : 'password'} className={cx(inputCls, 'pr-12')} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={e => setPw(e.target.value)} /><button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-faint hover:text-ink">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}</Field>}
    <Button type="submit" busy={busy} disabled={!ok}>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</Button>
    {mode === 'in' && <button type="button" className="self-start text-sm font-bold text-ink-faint underline" onClick={() => { setMode('reset'); setErr(null); setNote(null); }}>Forgot password?</button>}
    {mode === 'reset' && <button type="button" className="self-start text-sm font-bold text-ink-faint underline" onClick={() => { setMode('in'); setErr(null); setNote(null); }}>Back to sign in</button>}
  </form>;
}

const INTRO = 'hifz-intro-seen';
const SLIDES = [
  { icon: BookOpen, title: 'One clear path each day', body: 'Open the app and see exactly what to read today: your new lesson, recent revision and old revision. Tick them off as you go.',
    art: [['New lesson', 'Al-Mulk 1–5', true], ['Recent revision', 'Al-Qalam 1–20', true], ['Old revision', 'Pages 582–584', false]] as Array<[string, string, boolean]> },
  { icon: Repeat, title: 'Revise with a partner', body: 'Read your revision to a classmate. They confirm it and tap any ayah you slipped on, so your weak ayahs come back until they are strong.',
    art: [['Partner', 'Yusuf confirmed', true], ['Mistakes', 'Al-Mulk 7, 13', false], ['Weak ayahs', 'Listen on repeat', false]] as Array<[string, string, boolean]> },
  { icon: ClipboardCheck, title: 'Your teacher signs it off', body: 'Submit what you memorised. Your teacher hears it in class, signs it off with notes, and sees your progress at a glance.',
    art: [['Submitted', 'Al-Mulk 1–5', true], ['Signed off', 'Ustadh Bilal', true], ['Goal', 'Juz 29 · 34%', false]] as Array<[string, string, boolean]> },
];
/** Three short screens before the first sign-in: what the app does, in plain words. Swipe or tap Next. */
function Intro({ onDone }: { onDone: (mode: 'in' | 'up') => void }) {
  const [i, setI] = useState(0); const x0 = useRef<number | null>(null);
  const last = i === SLIDES.length - 1; const sl = SLIDES[i]; const I = sl.icon;
  const go = (d: number) => setI(v => Math.max(0, Math.min(SLIDES.length - 1, v + d)));
  return <div className="flex min-h-[100dvh] flex-col bg-pine-900 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] text-white"
    onPointerDown={e => { x0.current = e.clientX; }} onPointerUp={e => { if (x0.current === null) return; const dx = e.clientX - x0.current; x0.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}
    onKeyDown={e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}>
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <div className="flex items-center justify-between"><Brand light small /><button type="button" onClick={() => onDone('in')} className="min-h-[44px] px-2 text-sm font-bold text-white/70 hover:text-white">Skip</button></div>
      <div key={i} className="flex flex-1 flex-col justify-center py-4 [animation:intro-in_.35s_ease-out]" aria-live="polite">
        <div className="mx-auto w-full max-w-[300px] rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/10">
          {sl.art.map(([a, b, done]) => <div key={a} className="flex items-center gap-3 py-1.5">
            <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full ring-2', done ? 'bg-emerald-400/90 text-pine-900 ring-emerald-400/90' : 'ring-white/30')}>{done && <Check size={16} />}</span>
            <span><span className="block text-[11px] font-bold uppercase tracking-wider text-white/60">{a}</span><span className="block font-bold">{b}</span></span></div>)}
        </div>
        <h1 className="mt-6 flex items-center justify-center gap-2 text-center text-[26px] font-bold leading-tight"><I size={24} className="shrink-0 text-brass-100" />{sl.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-[16px] leading-relaxed text-white/80">{sl.body}</p>
      </div>
      <div className="flex justify-center gap-2 pb-3" role="tablist" aria-label="Intro screens">{SLIDES.map((_, k) => <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Screen ${k + 1}`} onClick={() => setI(k)}
        className="grid h-11 w-8 place-items-center"><i className={cx('block h-2 rounded-full transition-all', k === i ? 'w-6 bg-white' : 'w-2 bg-white/35')} /></button>)}</div>
      {last ? <div className="flex flex-col gap-2">
          <button type="button" onClick={() => onDone('up')} className="min-h-[54px] rounded-2xl bg-white text-[17px] font-bold text-pine-800">Create my account</button>
          <button type="button" onClick={() => onDone('in')} className="min-h-[50px] rounded-2xl text-[16px] font-bold text-white ring-1 ring-white/30">I already have an account</button></div>
        : <button type="button" onClick={() => go(1)} className="inline-flex min-h-[54px] items-center justify-center gap-1 rounded-2xl bg-white text-[17px] font-bold text-pine-800">Next<ChevronRight size={18} /></button>}
    </div>
  </div>;
}
