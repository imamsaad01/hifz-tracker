// First sign-in: start a program (becomes its admin) or join one with a code.
import { useState } from 'react';
import { Building2, KeyRound, LogOut } from 'lucide-react';
import { useApp } from '../app/context';
import { Brand } from '../components/Brand';
import { Button, Card, Field, inputCls, ErrorBox, Select } from '../components/ui';
import { friendly } from '../api/backend';

const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Africa/Cairo', 'Africa/Lagos', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Australia/Sydney'];
export function Welcome() {
  const { api, user, backend, switchOrg } = useApp();
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState(''); const [name, setName] = useState(user?.name ?? '');
  const [org, setOrg] = useState(''); const [tz, setTz] = useState(ZONES.includes(local) ? local : 'America/New_York');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const run = async (f: () => Promise<string>) => { setBusy(true); setErr(null); try { switchOrg(await f()); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); } };
  return <div className="min-h-full px-4 py-10">
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="flex items-center justify-between"><Brand small /><Button kind="quiet" onClick={() => backend.signOut()}><LogOut size={16} />Sign out</Button></div>
      <div><h1 className="text-2xl font-bold">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1><p className="text-ink-soft">Join your class with the code your teacher gave you, or start a new program as a teacher.</p></div>
      {err && <ErrorBox message={err} />}
      <Card className="p-5">
        <div className="mb-4 grid grid-cols-2 gap-2">
          {([['join', 'Join with a code', KeyRound], ['create', 'Start a program', Building2]] as const).map(([k, l, I]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-sm font-bold ${mode === k ? 'border-pine-700 bg-pine-50 text-pine-800' : 'border-line bg-white text-ink-soft'}`}><I size={16} />{l}</button>)}
        </div>
        {mode === 'join' ? <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); run(async () => (await api.joinOrg(code, name)).org_id); }}>
          <Field label="Your name">{id => <input id={id} className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} required />}</Field>
          <Field label="Class code" hint="Students: 6 characters. Teachers: 8. Parents: the 10-character code for your child. Ask the teacher.">{id => <input id={id} className={`${inputCls} font-mono uppercase tracking-widest`} value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={10} required autoCapitalize="characters" />}</Field>
          <Button type="submit" busy={busy} disabled={code.length < 6 || name.trim().length < 2}>Join</Button>
        </form> : <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); run(() => api.createOrg(org, tz, name)); }}>
          <Field label="Your name">{id => <input id={id} className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} required />}</Field>
          <Field label="Program name" hint="For example: Masjid Al-Noor Hifz Class">{id => <input id={id} className={inputCls} value={org} onChange={e => setOrg(e.target.value)} maxLength={80} required />}</Field>
          <Field label="Time zone" hint="“Today” and streaks follow this time zone.">{id => <Select id={id} value={tz} onChange={setTz} options={[...new Set([local, ...ZONES])].map(z => [z, z.replace('_', ' ')])} />}</Field>
          <Button type="submit" busy={busy} disabled={org.trim().length < 2 || name.trim().length < 2}>Create program</Button>
          <p className="text-xs text-ink-faint">You become its admin. You will get a code for students and one for other teachers.</p>
        </form>}
      </Card>
    </div>
  </div>;
}
