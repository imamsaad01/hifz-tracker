// Small (i) next to a label: shows the explanation on hover (computer) or tap (phone). Accessible: a real button with a label.
import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { GLOSSARY, type GlossaryKey } from '../lib/glossary';
import { cx } from './ui';

export function InfoTip({ k, text, title, className }: { k?: GlossaryKey; text?: string; title?: string; className?: string }) {
  const g = k ? GLOSSARY[k] : null;
  const body = text ?? g?.text ?? ''; const head = title ?? g?.short ?? '';
  const [open, setOpen] = useState(false); const id = useId(); const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = (v: boolean) => { if (v && ref.current) { const r = ref.current.getBoundingClientRect(); const w = Math.min(280, window.innerWidth * 0.8); setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) }); } setOpen(v); };
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const hide = () => setOpen(false);
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc); window.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', hide, true); };
  }, [open]);
  return <span ref={ref} className={cx('relative inline-flex align-middle', className)} onMouseEnter={() => show(true)} onMouseLeave={() => show(false)}>
    <button type="button" aria-label={`What is “${head}”?`} aria-describedby={open ? id : undefined} aria-expanded={open}
      onClick={e => { e.stopPropagation(); show(!open); }}
      className="grid h-6 w-6 place-items-center rounded-full text-ink-faint hover:bg-black/5 hover:text-pine-700 focus-visible:text-pine-700"><Info size={15} /></button>
    {open && pos && <span role="tooltip" id={id} style={{ top: pos.top, left: pos.left }} className="fixed z-[70] w-[min(280px,80vw)] rounded-xl bg-[#16201E] px-3 py-2.5 text-left text-[13px] ring-1 ring-white/10 font-normal leading-snug text-white shadow-xl">
      {head && <b className="mb-0.5 block text-[13px]">{head}</b>}{body}
    </span>}
  </span>;
}
