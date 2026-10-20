// "Install the app" button. Android/desktop Chrome: real install prompt. iPhone/iPad: short Add to Home Screen steps.
import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { cx } from './ui';

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as PromptEvent; listeners.forEach(l => l()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(l => l()); });
}
const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const embedded = () => typeof window !== 'undefined' && window.self !== window.top;

export function InstallApp({ compact, className }: { compact?: boolean; className?: string }) {
  const [, tick] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { const l = () => tick(n => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  if (standalone() || embedded()) return null;
  const ios = isIOS();
  if (!deferred && !ios) return null;               // browser cannot install, or already installed
  const click = async () => {
    if (deferred) { await deferred.prompt(); await deferred.userChoice.catch(() => null); deferred = null; tick(n => n + 1); }
    else setHelp(h => !h);
  };
  return <div className={cx('flex flex-col gap-2', className)}>
    <button type="button" onClick={click} aria-label={compact ? 'Install the app' : undefined} className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-bold', compact ? 'min-h-[44px] whitespace-nowrap px-3 text-sm text-pine-800 ring-1 ring-pine-600/30 bg-pine-50' : 'min-h-[48px] w-full bg-pine-50 px-4 text-[15px] text-pine-800 ring-1 ring-pine-600/30')}>
      <Download size={compact ? 14 : 18} />{compact ? <span className="hidden min-[400px]:inline">Install</span> : 'Install the app on this phone'}
    </button>
    {help && <div className="relative rounded-xl bg-white p-3 text-sm text-ink shadow-card ring-1 ring-line">
      <button type="button" aria-label="Close" onClick={() => setHelp(false)} className="absolute right-2 top-2 text-ink-faint"><X size={16} /></button>
      <p className="font-bold">On iPhone or iPad (in Safari):</p>
      <ol className="mt-1 flex flex-col gap-1">
        <li className="flex items-center gap-2">1. Tap <Share size={16} className="text-pine-700" aria-label="Share" /> Share at the bottom of the screen</li>
        <li className="flex items-center gap-2">2. Tap <PlusSquare size={16} className="text-pine-700" aria-label="Add" /> <b>Add to Home Screen</b></li>
        <li>3. Tap <b>Add</b>. Open Hifz from your home screen from now on.</li>
      </ol>
      <p className="mt-1 text-xs text-ink-faint">Using Chrome on iPhone? Open this page in Safari first.</p>
    </div>}
  </div>;
}
