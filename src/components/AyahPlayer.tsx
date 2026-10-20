// Listen to a reciter for a range of ayahs (audio streamed from everyayah.com; nothing is stored).
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Headphones } from 'lucide-react';
import { fromAyahId, surahNameEn, type Range } from '../quran';
import { Select } from './ui';

const RECITERS: Array<[string, string]> = [['Husary_64kbps', 'Al-Husary'], ['Minshawy_Murattal_128kbps', 'Al-Minshawi'], ['Alafasy_64kbps', 'Mishary Alafasy'], ['Abdul_Basit_Murattal_64kbps', 'Abdul Basit'], ['Maher_AlMuaiqly_64kbps', 'Maher Al-Muaiqly']];
const KEY = 'hifz-reciter';
const pad = (n: number) => String(n).padStart(3, '0');
/** Memorisation loop (as in Tarteel): play each ayah N times, then the whole range M times, at a chosen speed.
 *  onAyah tells the page which ayah is playing, so it can follow along. */
export function AyahPlayer({ range, compact, initialRepeat = 1, onAyah }: { range: Range; compact?: boolean; initialRepeat?: number; onAyah?: (id: number | null) => void }) {
  const [each, setEach] = useState(1); const eachN = useRef(1);
  const [rate, setRate] = useState(() => { try { return Number(localStorage.getItem('hifz-rate')) || 1; } catch { return 1; } });
  const [reciter, setReciter] = useState(() => { try { return localStorage.getItem(KEY) || RECITERS[0][0]; } catch { return RECITERS[0][0]; } });
  const [repeat, setRepeat] = useState(initialRepeat);
  const [cur, setCur] = useState<number | null>(null); const [playing, setPlaying] = useState(false); const [err, setErr] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null); const pass = useRef(1);
  const total = range.end - range.start + 1;
  const src = (id: number) => { const a = fromAyahId(id); return `https://everyayah.com/data/${reciter}/${pad(a.surah)}${pad(a.ayah)}.mp3`; };
  const play = (id: number) => { setErr(false); if (!audio.current) audio.current = new Audio(); const el = audio.current; el.src = src(id); el.playbackRate = rate; el.play().then(() => { setPlaying(true); setCur(id); }).catch(() => { setErr(true); setPlaying(false); }); };
  useEffect(() => { const el = audio.current; if (!el) return; const onEnd = () => setCur(c => { if (c === null) return c; if (eachN.current < each) { eachN.current++; play(c); return c; } eachN.current = 1; if (c < range.end) { play(c + 1); return c + 1; } if (pass.current < repeat) { pass.current++; play(range.start); return range.start; } setPlaying(false); return null; }); el.addEventListener('ended', onEnd); return () => el.removeEventListener('ended', onEnd); });
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = () => { const el = audio.current; if (playing && el) { el.pause(); setPlaying(false); } else if (cur && el) { el.play().then(() => setPlaying(true)).catch(() => setErr(true)); } else { pass.current = 1; eachN.current = 1; play(range.start); } };
  const stop = () => { audio.current?.pause(); setPlaying(false); setCur(null); eachN.current = 1; };
  useEffect(() => { onAyah?.(cur); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; try { localStorage.setItem('hifz-rate', String(rate)); } catch { /* */ } }, [rate]);
  const now = cur ? fromAyahId(cur) : null;
  return <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-2 rounded-xl bg-paper p-3 ring-1 ring-line'}>
    {!compact && <p className="flex items-center gap-2 text-sm font-bold text-pine-800"><Headphones size={16} />Listen and repeat</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={toggle} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-pine-700 px-3 text-sm font-bold text-white" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause' : cur ? 'Resume' : 'Play'}</button>
      {cur && <button type="button" onClick={stop} className="grid h-11 w-11 place-items-center rounded-xl ring-1 ring-line" aria-label="Stop"><Square size={14} /></button>}
      <Select aria-label="Reciter" className="!min-h-[44px] !w-auto text-sm" value={reciter} onChange={v => { setReciter(v); try { localStorage.setItem(KEY, v); } catch { /* */ } stop(); }} options={RECITERS} />
      <Select aria-label="Repeat" className="!min-h-[44px] !w-auto text-sm" value={repeat} onChange={v => setRepeat(Number(v))} options={[[1, 'Range once'], [3, 'Range ×3'], [5, 'Range ×5'], [10, 'Range ×10']]} />
      <Select aria-label="Repeat each ayah" className="!min-h-[44px] !w-auto text-sm" value={each} onChange={v => { setEach(Number(v)); eachN.current = 1; }} options={[[1, 'Each ayah once'], [3, 'Each ayah ×3'], [5, 'Each ayah ×5'], [7, 'Each ayah ×7'], [10, 'Each ayah ×10']]} />
      <Select aria-label="Speed" className="!min-h-[44px] !w-auto text-sm" value={rate} onChange={v => setRate(Number(v))} options={[[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×']]} />
    </div>
    {now && <p className="text-xs text-ink-faint">Playing {surahNameEn(now.surah)} {now.surah}:{now.ayah} · {cur! - range.start + 1} of {total}{each > 1 ? ` · time ${eachN.current} of ${each}` : ''}{repeat > 1 ? ` · round ${pass.current} of ${repeat}` : ''}</p>}
    {err && <p className="text-xs text-bad">Could not play the audio. Check the connection and try again.</p>}
  </div>;
}
