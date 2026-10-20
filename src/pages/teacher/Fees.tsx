// Monthly fees: a simple record of who has paid. No online payments.
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useOrg } from '../../app/context';
import { useOrgData } from '../../app/useOrgData';
import type { FeeRecord } from '../../api/data';
import { Button, Card, Field, Select, Spinner, ErrorBox, Stat, inputCls, cx, useToast } from '../../components/ui';
import { friendly } from '../../api/backend';
import { downloadCsv } from '../../lib/csv';

export function Fees() {
  const { org, api, today } = useOrg(); const toast = useToast();
  const { data, error, reload } = useOrgData();
  const months = useMemo(() => { const out: string[] = []; const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`); for (let i = -1; i < 12; i++) { const x = new Date(d); x.setUTCMonth(d.getUTCMonth() - i); out.push(x.toISOString().slice(0, 7)); } return out; }, [today]);
  const [month, setMonth] = useState(today.slice(0, 7)); const [rows, setRows] = useState<FeeRecord[] | null>(null);
  const load = () => api.fees(org.id, month).then(setRows).catch(e => toast(friendly(e), 'err'));
  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !rows) return <Spinner />;
  const def = org.settings.fees.monthly ?? 0; const cur = org.settings.fees.currency;
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n);
  const rec = (sid: string) => rows.find(r => r.studentId === sid);
  const paid = data.students.filter(s => rec(s.id)?.paidOn);
  const total = paid.reduce((n, s) => n + (rec(s.id)?.amount ?? 0), 0);
  const save = async (sid: string, p: { amount?: number; paidOn?: string | null; method?: string | null }) => {
    const r = rec(sid);
    try { await api.saveFee(org.id, { studentId: sid, month, amount: p.amount ?? r?.amount ?? def, paidOn: p.paidOn !== undefined ? p.paidOn : r?.paidOn ?? null, method: p.method !== undefined ? p.method : r?.method ?? null }); load(); }
    catch (e) { toast(friendly(e), 'err'); }
  };
  const label = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Month" className="min-w-[200px]">{id => <Select id={id} value={month} onChange={setMonth} options={months.map(m => [m, label(m)] as [string, string])} />}</Field>
      <Button kind="secondary" onClick={() => downloadCsv(`fees ${month}.csv`, data.students.map(s => ({ student: s.name, month, amount: rec(s.id)?.amount ?? def, paid_on: rec(s.id)?.paidOn ?? '', method: rec(s.id)?.method ?? '' })))}><Download size={15} />CSV</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><Stat label="Paid" value={`${paid.length}/${data.students.length}`} /><Stat label="Collected" value={fmt(total)} /><Stat label="Not yet paid" value={data.students.length - paid.length} tone={data.students.length - paid.length ? 'warn' : undefined} /></div>
    {!org.settings.fees.monthly && <p className="text-sm text-ink-faint">Tip: set the usual monthly fee in More → Settings so new rows fill in automatically.</p>}
    <Card><ul className="divide-y divide-line">{data.students.map(s => { const r = rec(s.id); return <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
      <b className="min-w-0 flex-1 basis-40">{s.name}</b>
      <input aria-label={`Amount for ${s.name}`} type="number" min={0} step="1" className={cx(inputCls, '!w-28')} defaultValue={r?.amount ?? def} onBlur={e => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== (r?.amount ?? def)) save(s.id, { amount: v }); }} />
      <Select aria-label={`Method for ${s.name}`} className="!w-32" value={r?.method ?? ''} onChange={v => save(s.id, { method: v || null })} options={[['', 'Method'], ['Cash', 'Cash'], ['Card', 'Card'], ['Bank', 'Bank'], ['Zelle', 'Zelle'], ['Other', 'Other']]} />
      <button type="button" aria-pressed={!!r?.paidOn} onClick={() => save(s.id, { paidOn: r?.paidOn ? null : today })} className={cx('min-h-[44px] rounded-xl px-4 text-sm font-bold ring-1 ring-inset', r?.paidOn ? 'bg-good text-white ring-good' : 'bg-white text-ink-soft ring-line')}>{r?.paidOn ? `Paid ${r.paidOn.slice(5)}` : 'Mark paid'}</button>
    </li>; })}</ul></Card>
  </div>;
}
