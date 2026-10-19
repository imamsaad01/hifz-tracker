// Printable certificate for a completed juz or milestone. Opens on its own page; print or save as PDF.
import { useEffect, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useOrg } from '../app/context';
import type { Milestone, Student } from '../lib/types';
import type { Member } from '../api/data';
import { juzProgress } from '../lib/progress';
import { niceDate } from '../lib/dates';
import { Button, Spinner, ErrorBox } from '../components/ui';
import { MILESTONE_LABEL } from '../components/StudentReport';
import { friendly } from '../api/backend';

export function certificatesFor(st: Student, milestones: Milestone[]): Array<{ code: string; title: string; date: string | null }> {
  const juz = juzProgress(st.memorized).map((v, i) => [v, i + 1] as const).filter(([v]) => v >= 1).map(([, j]) => ({ code: `juz-${j}`, title: `Juz ${j}`, date: null }));
  const ms = milestones.filter(m => ['juz_5', 'juz_10', 'juz_15', 'juz_20', 'juz_25', 'quran_complete'].includes(m.code)).map(m => ({ code: m.code, title: MILESTONE_LABEL[m.code], date: m.achievedOn }));
  return [...juz, ...ms];
}
export function Certificate({ studentId, code }: { studentId: string; code: string }) {
  const { api, org, today } = useOrg();
  const [st, setSt] = useState<Student | null>(null); const [ms, setMs] = useState<Milestone[]>([]); const [members, setMembers] = useState<Member[]>([]); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { Promise.all([api.students(org.id), api.milestones(org.id, studentId), api.members(org.id)]).then(([s, m, mem]) => { setSt(s.find(x => x.id === studentId) ?? null); setMs(m); setMembers(mem); if (!s.find(x => x.id === studentId)) setErr('Student not found.'); }).catch(e => setErr(friendly(e))); }, [api, org.id, studentId]);
  if (err) return <div className="p-6"><ErrorBox message={err} /></div>;
  if (!st) return <Spinner />;
  const item = certificatesFor(st, ms).find(c => c.code === code);
  if (!item) return <div className="p-6"><ErrorBox message="This certificate is not earned yet." /></div>;
  const teacher = members.find(m => m.role === 'admin')?.displayName ?? org.name;
  const what = code === 'quran_complete' ? 'the memorisation of the whole Qurʾān' : code.startsWith('juz-') ? `the memorisation of ${item.title}` : `the memorisation of ${item.title.toLowerCase()}`;
  return <div className="min-h-full bg-paper px-4 py-6 print:p-0">
    <div className="no-print mx-auto mb-4 flex max-w-4xl gap-2"><Button kind="quiet" onClick={() => history.back()}><ArrowLeft size={16} />Back</Button><Button className="ml-auto" onClick={() => window.print()}><Printer size={16} />Print or save as PDF</Button></div>
    <article className="mx-auto aspect-[1.414] w-full max-w-4xl bg-white p-[3%] shadow-xl print:shadow-none" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div className="flex h-full flex-col items-center justify-center rounded-sm border-[6px] border-double border-pine-700 p-[5%] text-center outline outline-2 outline-offset-4 outline-brass-500">
        <p className="font-quran text-3xl text-pine-800 sm:text-5xl" lang="ar" dir="rtl">شهادة إتمام</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-brass-700 sm:text-sm">Certificate of completion</p>
        <p className="mt-6 text-sm text-ink-soft sm:text-base">This certifies that</p>
        <p className="mt-2 border-b-2 border-brass-500 px-6 pb-1 text-2xl font-bold text-ink sm:text-4xl">{st.name}</p>
        <p className="mt-4 max-w-xl text-sm text-ink-soft sm:text-lg">has completed {what}, by the grace of Allah, at <b className="text-ink">{org.name}</b>.</p>
        <p className="mt-3 font-quran text-lg text-pine-800 sm:text-2xl" lang="ar" dir="rtl">بارك الله فيك</p>
        <div className="mt-auto grid w-full grid-cols-2 gap-6 pt-6 text-xs sm:text-sm">
          <div><p className="border-t border-ink/40 pt-1 font-bold">{teacher}</p><p className="text-ink-faint">Teacher</p></div>
          <div><p className="border-t border-ink/40 pt-1 font-bold">{niceDate(item.date ?? today)}</p><p className="text-ink-faint">Date</p></div>
        </div>
      </div>
    </article>
  </div>;
}
