// Shown once after someone opens a "reset password" email link: they are signed in and choose a new password.
import { useState } from 'react';
import { useApp } from '../app/context';
import { Modal, Button, Field, inputCls, ErrorBox, useToast } from './ui';
import { friendly } from '../api/backend';
const KEY = 'hifz-recovery';
const flagged = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
export function NewPassword() {
  const { backend, user } = useApp(); const toast = useToast();
  const [open, setOpen] = useState(flagged()); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  if (!user || !open || !backend.updatePassword) return null;
  const close = () => { try { sessionStorage.removeItem(KEY); } catch { /* blocked */ } setOpen(false); };
  return <Modal open onClose={close} title="Choose a new password" footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={close}>Later</Button><Button busy={busy} disabled={pw.length < 8} onClick={async () => { setBusy(true); setErr(null); try { await backend.updatePassword!(pw); toast('Password changed.'); close(); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); } }}>Save password</Button></div>}>
    {err && <div className="mb-3"><ErrorBox message={err} /></div>}
    <Field label="New password" hint="At least 8 characters.">{id => <input id={id} type="password" autoComplete="new-password" className={inputCls} value={pw} onChange={e => setPw(e.target.value)} />}</Field>
  </Modal>;
}
