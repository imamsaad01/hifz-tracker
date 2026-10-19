import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { AppProvider } from './app/context';
import { ToastProvider } from './components/ui';
import type { Backend } from './api/backend';

// Live when Supabase keys are configured; otherwise the in-browser preview (real database, sample people).
async function pickBackend(): Promise<Backend> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) return (await import('./api/supabaseBackend')).supabaseBackend(url, key);
  return (await import('./api/pgliteBackend')).pgliteBackend();
}
const root = createRoot(document.getElementById('root')!);
root.render(<div className="grid min-h-full place-items-center text-ink-soft" role="status">Loading…</div>);
pickBackend().then(b => root.render(<React.StrictMode><ToastProvider><AppProvider backend={b}><App /></AppProvider></ToastProvider></React.StrictMode>))
  .catch(e => root.render(<div role="alert" className="p-6 text-bad">Could not start: {String(e?.message ?? e)}</div>));

// Installable app: register the service worker on the real site only (not in dev or inside embedded previews).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.self === window.top) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* app still works without it */ }); });
}
