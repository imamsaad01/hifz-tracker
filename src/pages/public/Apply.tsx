// Public application form: no account needed. Only the program's name is shown.
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../../app/context';
import { Brand } from '../../components/Brand';
import { Button, Card, ErrorBox, Field, Select, inputCls } from '../../components/ui';
import { friendly } from '../../api/backend';

export function Apply({ orgId }: { orgId: string }) {
  const { api } = useApp();
  const [program, setProgram] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState(''); const [age, setAge] = useState('7–9'); const [contact, setContact] = useState(''); const [mem, setMem] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState(false);
  useEffect(() => { api.programPublicName(orgId).then(setProgram).catch(() => setProgram(null)); }, [api, orgId]);
  const ok = name.trim().length >= 2 && contact.trim().length >= 5;
  return <div className="min-h-full bg-pine-900 px-4 py-10"><div className="mx-auto flex max-w-lg flex-col gap-6">
    <div className="flex justify-center"><Brand light /></div>
    <Card className="p-6">
      {program === null ? <ErrorBox message="This application link is not valid. Ask the teacher for the right link." /> : done ? <div className="flex flex-col items-center gap-2 py-6 text-center"><CheckCircle2 size={40} className="text-good" /><h1 className="text-xl font-bold">Application sent</h1><p className="text-ink-soft">JazakAllahu khayran. {program} will contact you soon.</p></div> : <>
        <h1 className="text-2xl font-bold">Apply to {program ?? '…'}</h1>
        <p className="mt-1 text-[15px] text-ink-soft">Tell us about the student. The teacher will contact you.</p>
        {err && <div className="mt-4"><ErrorBox message={err} /></div>}
        <form className="mt-5 flex flex-col gap-4" onSubmit={async e => { e.preventDefault(); if (!ok) return; setBusy(true); setErr(null); try { await api.submitApplication(orgId, { name: name.trim(), age_group: age, contact: contact.trim(), memorised: mem.trim(), message: msg.trim() }); setDone(true); } catch (x) { setErr(friendly(x)); } finally { setBusy(false); } }}>
          <Field label="Student’s name">{id => <input id={id} className={inputCls} maxLength={80} value={name} onChange={e => setName(e.target.value)} required />}</Field>
          <Field label="Age">{id => <Select id={id} value={age} onChange={setAge} options={['Under 7', '7–9', '10–12', '13–15', '16–18', 'Adult'].map(a => [a, a] as [string, string])} />}</Field>
          <Field label="Parent phone or email" hint="So the teacher can reach you.">{id => <input id={id} className={inputCls} maxLength={120} value={contact} onChange={e => setContact(e.target.value)} required />}</Field>
          <Field label="Already memorised (optional)">{id => <input id={id} className={inputCls} maxLength={200} value={mem} onChange={e => setMem(e.target.value)} placeholder="e.g. Juz 30 up to An-Naba" />}</Field>
          <Field label="Anything else (optional)">{id => <textarea id={id} className={`${inputCls} min-h-[80px] py-2`} maxLength={1000} value={msg} onChange={e => setMsg(e.target.value)} />}</Field>
          <Button type="submit" busy={busy} disabled={!ok}>Send application</Button>
        </form></>}
    </Card>
  </div></div>;
}
