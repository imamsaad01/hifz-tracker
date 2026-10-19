// New-student applications from the public form, and the link to share.
import { useEffect, useState } from 'react';
import { Copy, Inbox } from 'lucide-react';
import { useOrg } from '../../app/context';
import type { Application } from '../../api/data';
import { Button, Card, CardHead, Empty, ErrorBox, Select, Spinner, useToast } from '../../components/ui';
import { friendly } from '../../api/backend';
import { niceDate } from '../../lib/dates';

export function Applications() {
  const { org, api } = useOrg(); const toast = useToast();
  const [rows, setRows] = useState<Application[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = () => api.applications(org.id).then(setRows).catch(e => setErr(friendly(e)));
  useEffect(() => { load(); }, [org.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const link = `${window.location.origin}${window.location.pathname}#/apply/${org.id}`;
  if (err) return <ErrorBox message={err} onRetry={load} />;
  if (!rows) return <Spinner />;
  return <div className="flex flex-col gap-5">
    <Card className="p-5"><h2 className="font-bold">Your application form</h2><p className="mt-1 text-sm text-ink-soft">Share this link on WhatsApp, your masjid page or a flyer. Families fill in a short form; it lands here. It does not create an account. When you accept someone, send them the student code.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-paper px-3 py-2 text-sm ring-1 ring-line">{link}</code><Button kind="secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); toast('Link copied.'); } catch { toast('Select the link and copy it.', 'err'); } }}><Copy size={15} />Copy</Button></div></Card>
    <Card><CardHead title="Applications" sub={`${rows.filter(r => r.status === 'new').length} new`} />
      {rows.length ? <ul className="mt-2 divide-y divide-line">{rows.map(a => <li key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
        <span className="min-w-0 flex-1 basis-60"><b className="block">{a.name}{a.ageGroup ? <span className="font-normal text-ink-soft"> · {a.ageGroup}</span> : null}</b>
          <span className="block select-all text-sm">{a.contact}</span>
          {a.memorised && <span className="block text-sm text-ink-soft">Memorised: {a.memorised}</span>}
          {a.message && <span className="block text-sm text-ink-soft">“{a.message}”</span>}
          <span className="text-xs text-ink-faint">{niceDate(a.createdAt.slice(0, 10))}</span></span>
        <Select aria-label={`Status for ${a.name}`} className="!w-40" value={a.status} onChange={async v => { try { await api.setApplicationStatus(a.id, v); load(); } catch (e) { toast(friendly(e), 'err'); } }} options={[['new', 'New'], ['contacted', 'Contacted'], ['accepted', 'Accepted'], ['declined', 'Declined']]} />
      </li>)}</ul> : <Empty icon={<Inbox size={28} />} title="No applications yet">Share the link above to receive them.</Empty>}
    </Card>
  </div>;
}
