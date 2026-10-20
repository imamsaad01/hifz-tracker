// Small shared building blocks. Accessible by default: real buttons, labelled fields, visible focus.
import { createPortal } from 'react-dom';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Loader2, X, AlertTriangle, Check } from 'lucide-react';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export function Button({ kind = 'primary', busy, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; busy?: boolean }) {
  const k: Record<BtnKind, string> = {
    primary: 'bg-pine-700 text-white hover:bg-pine-800 shadow-card',
    secondary: 'bg-white text-ink border border-line hover:bg-paper shadow-card',
    ghost: 'text-pine-700 hover:bg-pine-50',
    quiet: 'text-ink-soft hover:bg-black/5',
    danger: 'bg-white text-bad border border-red-200 hover:bg-red-50',
  };
  return <button type="button" {...rest} disabled={rest.disabled || busy} className={cx('inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50', k[kind], className)}>
    {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}{children}
  </button>;
}
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return <section {...rest} className={cx('rounded-2xl border border-line bg-white shadow-card', className)}>{children}</section>;
}
export function CardHead({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3 px-5 pt-5"><div className="min-w-0 flex-1"><h2 className="text-[17px] font-bold text-ink">{title}</h2>{sub && <p className="text-sm text-ink-faint">{sub}</p>}</div>{action}</div>;
}
let fieldSeq = 0;
export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string | null; children: (id: string) => React.ReactNode; className?: string }) {
  const [id] = useState(() => `f${++fieldSeq}`);
  return <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
    <label htmlFor={id} className="text-[13px] font-bold text-ink-soft">{label}</label>
    {children(id)}
    {error ? <p className="text-xs font-bold text-bad" role="alert">{error}</p> : hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
  </div>;
}
export const inputCls = 'w-full min-h-[44px] rounded-xl border border-line bg-white px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-pine-600 focus:outline-none focus:ring-2 focus:ring-pine-600/20';
export function Select<T extends string | number>({ value, onChange, options, id, className, ...rest }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; id?: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  return <select id={id} className={cx(inputCls, className)} value={String(value)} onChange={e => { const raw = e.target.value; const opt = options.find(o => String(o[0]) === raw); if (opt) onChange(opt[0]); }} {...rest}>
    {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
  </select>;
}
/** One look for every row of sections in the app: pills, 44px tall, scroll sideways on a phone. */
const pill = (on: boolean) => cx('inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold ring-1 ring-inset transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine-600',
  on ? 'bg-pine-700 text-white ring-pine-700' : 'bg-white text-ink-soft ring-line hover:bg-pine-50');
type SectionItem<T extends string> = { key: T; label: React.ReactNode; icon?: import('lucide-react').LucideIcon };
/** Sections that are their own address (links), e.g. Halaqah → Live class / Attendance */
export function SubNav<T extends string>({ items, active, label, href: link, className }: { items: SectionItem<T>[]; active: T; label: string; href: (k: T) => string; className?: string }) {
  return <nav aria-label={label} className={cx('no-print -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible', className)} data-no-pull>
    {items.map(({ key, label: l, icon: I }) => <a key={key} href={link(key)} aria-current={active === key ? 'page' : undefined} className={pill(active === key)}>{I && <I size={15} />}{l}</a>)}
  </nav>;
}
/** Sections inside one screen (tabs). Arrow keys move between them. */
export function SubTabs<T extends string>({ items, active, onChange, label, className }: { items: SectionItem<T>[]; active: T; onChange: (k: T) => void; label: string; className?: string }) {
  const key = (e: React.KeyboardEvent, i: number) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = items[(i + d + items.length) % items.length]; onChange(n.key); (e.currentTarget.parentElement?.children[(i + d + items.length) % items.length] as HTMLElement | undefined)?.focus(); };
  return <div role="tablist" aria-label={label} className={cx('no-print -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible', className)} data-no-pull>
    {items.map(({ key: k, label: l, icon: I }, i) => <button key={k} type="button" role="tab" aria-selected={active === k} tabIndex={active === k ? 0 : -1} onKeyDown={e => key(e, i)} onClick={() => onChange(k)} className={pill(active === k)}>{I && <I size={15} />}{l}</button>)}
  </div>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; label: string }) {
  return <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-black/[.04] p-1">
    {options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
      className={cx('min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition', value === v ? 'bg-white text-pine-800 shadow-card' : 'text-ink-soft hover:text-ink')}>{l}</button>)}
  </div>;
}
export function Stepper({ value, onChange, label, max = 99 }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  return <div className="flex items-center gap-2" role="group" aria-label={label}>
    <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-xl font-bold text-ink hover:bg-paper">−</button>
    <output aria-live="polite" className="w-10 text-center text-2xl font-bold tabular-nums">{value}</output>
    <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-xl font-bold text-ink hover:bg-paper">+</button>
  </div>;
}
export function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-4 rounded-xl px-1 py-2 text-left">
    <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-ink">{label}</span>{sub && <span className="block text-[13px] text-ink-faint">{sub}</span>}</span>
    <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-pine-700' : 'bg-black/20')}><span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} /></span>
  </button>;
}
export function Pill({ tone = 'slate', children, className }: { tone?: 'green' | 'amber' | 'red' | 'slate' | 'pine' | 'brass'; children: React.ReactNode; className?: string }) {
  const t = { green: 'bg-emerald-50 text-good ring-good/20', amber: 'bg-amber-50 text-warn ring-warn/25', red: 'bg-red-50 text-bad ring-bad/20', slate: 'bg-black/[.04] text-ink-soft ring-black/10', pine: 'bg-pine-50 text-pine-800 ring-pine-600/20', brass: 'bg-brass-100 text-brass-700 ring-brass-500/30' }[tone];
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset', t, className)}>{children}</span>;
}
export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return <div className={cx('h-2 w-full overflow-hidden rounded-full bg-black/[.06]', className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}><div className="bar-fill h-full rounded-full bg-pine-600" style={{ width: `${(v * 100).toFixed(1)}%` }} /></div>;
}
export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'warn' | 'bad' }) {
  return <Card className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{label}</p>
    <p className={cx('mt-1 text-2xl font-bold tabular-nums', tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink')}>{value}</p>{sub && <p className="text-xs text-ink-faint">{sub}</p>}</Card>;
}
export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">{icon && <div className="text-ink-faint">{icon}</div>}<p className="font-bold text-ink">{title}</p>{children && <p className="max-w-sm text-sm text-ink-faint">{children}</p>}{action && <div className="mt-2">{action}</div>}</div>;
}
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="grid min-h-[40vh] place-items-center" role="status"><div className="flex items-center gap-2 text-ink-soft"><Loader2 className="animate-spin" size={20} aria-hidden />{label}…</div></div>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-bad"><AlertTriangle size={18} aria-hidden /><span className="min-w-0 flex-1">{message}</span>{onRetry && <Button kind="danger" className="min-h-[44px] px-3" onClick={onRetry}>Try again</Button>}</div>;
}

/* ---------------------------------------------------------------- modal / sheet */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus(), 30);
    return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  // Rendered at the page level: a parent with blur/transform (like the sticky top bar) would otherwise trap and clip it.
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pt-[max(16px,env(safe-area-inset-top))] sm:items-center sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-paper shadow-2xl sm:max-h-[94vh] sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4"><h2 className="min-w-0 flex-1 text-lg font-bold">{title}</h2><button data-close type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5"><X size={20} /></button></div>
      <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4', !footer && 'pb-[max(16px,env(safe-area-inset-bottom))]')}>{children}</div>
      {footer && <div className="border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  </div>, document.body);
}
export function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; body: React.ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return <Modal open={open} onClose={onClose} title={title} footer={<div className="flex justify-end gap-2"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button kind={danger ? 'danger' : 'primary'} busy={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>{confirmLabel}</Button></div>}>
    <div className="text-[15px] text-ink-soft">{body}</div>
  </Modal>;
}

/* ---------------------------------------------------------------- toasts */
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems(x => [...x, { id, text, tone }]);
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), tone === 'err' ? 6000 : 3500);
  }, []);
  return <ToastCtx.Provider value={push}>{children}
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {items.map(t => <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-xl', t.tone === 'err' ? 'bg-bad' : 'bg-pine-900')}>{t.tone === 'err' ? <AlertTriangle size={16} /> : <Check size={16} />}{t.text}</div>)}
    </div>
  </ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);
