import { useState } from 'react';
import { GraduationCap, BookOpen, Users, Building2, ShieldCheck, RotateCcw } from 'lucide-react';
import { useApp } from '../app/context';
import { Brand } from '../components/Brand';
import { Button, Card, ErrorBox, useToast } from '../components/ui';
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
  return <div className="min-h-full bg-pine-900 px-4 py-10">
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex justify-center"><Brand light /></div>
      <Card className="p-6">
        <h1 className="text-2xl font-bold">Assalamu alaikum</h1>
        <p className="mt-1 text-[15px] text-ink-soft">Daily hifz records for teachers, students and parents: new lessons, recent and old revision, errors, scores and progress through all 604 pages.</p>
        {err && <div className="mt-4"><ErrorBox message={err} /></div>}
        {backend.kind === 'live' ? <>
          <Button kind="secondary" className="mt-6 w-full" busy={busy === 'g'} onClick={async () => { setBusy('g'); try { await backend.signInWithGoogle!(); } catch (e) { setErr(friendly(e)); setBusy(null); } }}><GoogleMark />Continue with Google</Button>
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-faint"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Student records are private to their program. Nothing is public.</p>
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
