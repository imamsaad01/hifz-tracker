// Hide-and-recall: go through a passage one ayah at a time with the words hidden. Recite from memory;
// tap to peek at the opening words only when stuck. At the end, see which ayahs needed a peek and hear them again.
import { useMemo, useState } from 'react';
import { EyeOff, Check, RotateCcw, Brain } from 'lucide-react';
import { fromAyahId, surahNameEn, formatRange, type Range } from '../quran';
import { useAyahStarts } from '../lib/ayahText';
import { AyahPlayer } from './AyahPlayer';
import { Button, Modal, cx } from './ui';
import { useOrg } from '../app/context';
import { outbox, isNetworkError } from '../app/outbox';

const KEY = 'hifz-recall-last';
export function RecallTestButton({ range, studentId, label = 'Test yourself', kind = 'secondary' }: { range: Range; studentId?: string; label?: string; kind?: 'primary' | 'secondary' | 'quiet' }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button kind={kind} onClick={() => setOpen(true)}><Brain size={16} />{label}</Button>
    {open && <RecallTest range={range} studentId={studentId} onClose={() => setOpen(false)} />}
  </>;
}

export function RecallTest({ range, studentId, onClose }: { range: Range; studentId?: string; onClose: () => void }) {
  const { api } = useOrg();
  const all = useMemo(() => Array.from({ length: Math.min(range.end - range.start + 1, 300) }, (_, i) => range.start + i), [range]);
  const words = useAyahStarts();
  const [list, setList] = useState(all);       // the ayahs in this round (all, or only the ones peeked at last time)
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [peeked, setPeeked] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [listen, setListen] = useState(false);
  const id = list[i]; const { surah, ayah } = fromAyahId(id);
  const showSurah = i === 0 || fromAyahId(list[i - 1]).surah !== surah || list !== all;
  const peek = () => { setShown(true); setPeeked(p => (p.includes(id) ? p : [...p, id])); };
  const next = () => {
    if (i + 1 < list.length) { setI(i + 1); setShown(false); return; }
    setDone(true);
    try { localStorage.setItem(KEY, JSON.stringify({ range, peeked: peeked.length, total: list.length, at: new Date().toISOString() })); } catch { /* private mode */ }
    // the first full round goes to the teacher (retries are just practice)
    if (studentId && list === all) {
      const args = { studentId, start: all[0], end: all[all.length - 1], total: all.length, peeked };
      api.saveRecall(args).catch(e => { if (isNetworkError(e)) outbox.add('Test yourself result', { __op: 'saveRecall', args }); else console.error('save test', e); });
    }
  };
  const retry = () => { setList([...peeked].sort((a, b) => a - b)); setI(0); setShown(false); setPeeked([]); setDone(false); setListen(false); };
  const sorted = [...peeked].sort((a, b) => a - b);
  const score = Math.round(((list.length - peeked.length) / Math.max(1, list.length)) * 100);

  return <Modal open onClose={onClose} title="Test yourself" footer={done
    ? <div className="flex flex-wrap justify-end gap-2">
        {peeked.length > 0 && <Button kind="secondary" onClick={retry}><RotateCcw size={16} />Retry the {peeked.length} I peeked at</Button>}
        <Button onClick={onClose}><Check size={16} />Done</Button></div>
    : <div className="flex items-center gap-2">
        <span className="text-sm text-ink-faint">{i + 1} of {list.length}{peeked.length ? ` · ${peeked.length} peek${peeked.length > 1 ? 's' : ''}` : ''}</span>
        <Button className="ml-auto" onClick={next}>{shown ? 'Next ayah' : 'I knew it'}</Button></div>}>
    {!done ? <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">{list === all ? formatRange(range) : 'Retry'}: recite each ayah from memory. Only peek if you are stuck; peeks are counted.{studentId && list === all ? ' Your teacher sees the result.' : ''}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[.06]"><div className="h-full rounded-full bg-pine-600 transition-all" style={{ width: `${(i / list.length) * 100}%` }} /></div>
      <div className="rounded-2xl bg-paper p-5 text-center ring-1 ring-line">
        {showSurah && <p className="text-sm font-bold text-ink-faint">{surahNameEn(surah)}</p>}
        <p className="text-4xl font-bold tabular-nums text-pine-800">{ayah}</p>
        <p className="mb-3 text-xs uppercase tracking-wider text-ink-faint">Ayah</p>
        <button type="button" onClick={peek} disabled={shown} aria-label={shown ? 'Opening words shown' : 'Peek at the opening words'}
          className={cx('flex min-h-[72px] w-full items-center justify-center rounded-xl px-3 transition', shown ? 'bg-amber-50 ring-1 ring-warn/30' : 'bg-white ring-1 ring-line hover:bg-pine-50')}>
          {shown ? <span lang="ar" dir="rtl" className="px-1 font-quran text-2xl leading-loose">{words?.[id - 1] ?? `${surahNameEn(surah)} ${ayah}`}</span>
            : <span className="inline-flex items-center gap-2 font-bold text-ink-soft"><EyeOff size={18} />Hidden · tap to peek</span>}
        </button>
      </div>
    </div> : <div className="flex flex-col gap-4 text-center">
      <p className={cx('text-5xl font-bold', score >= 90 ? 'text-good' : score >= 70 ? 'text-warn' : 'text-bad')}>{score}%</p>
      <p className="text-[15px]">{peeked.length === 0 ? 'Mā shāʾ Allāh: every ayah from memory, no peeks.' : `${list.length - peeked.length} of ${list.length} ayahs from memory. You peeked at:`}</p>
      {peeked.length > 0 && <>
        <ul className="flex flex-wrap justify-center gap-1.5">{sorted.map(p => { const x = fromAyahId(p); return <li key={p} className="rounded-lg bg-amber-50 px-2.5 py-1 text-sm font-bold text-warn ring-1 ring-inset ring-warn/25">{surahNameEn(x.surah)} {x.ayah}</li>; })}</ul>
        {!listen ? <Button kind="secondary" className="mx-auto" onClick={() => setListen(true)}>Listen from {surahNameEn(fromAyahId(sorted[0]).surah)} {fromAyahId(sorted[0]).ayah}</Button>
          : <div className="text-left"><AyahPlayer range={{ start: sorted[0], end: sorted[sorted.length - 1] }} initialRepeat={3} compact /></div>}
      </>}
    </div>}
  </Modal>;
}
