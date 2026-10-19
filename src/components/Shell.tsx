// Page frame: sidebar on desktop, bottom navigation on phones, sync status always visible.
import React, { useEffect, useState } from 'react';
import { LogOut, CloudOff, RefreshCw, type LucideIcon } from 'lucide-react';
import { useApp } from '../app/context';
import { outbox, useOutboxCount } from '../app/outbox';
import { Brand } from './Brand';
import { InstallApp } from './InstallApp';
import { InboxBell } from './Inbox';
import { PullToRefresh, AutoRefresh } from './PullToRefresh';
import { Tour } from './Tour';
import { cx, Select, useToast } from './ui';

const ROLE_NAME = { admin: 'Admin', teacher: 'Teacher', student: 'Student', parent: 'Parent' } as const;
export interface NavItem { key: string; label: string; icon: LucideIcon; href: string }
export function Shell({ nav, active, children }: { nav: NavItem[]; active: string; children: React.ReactNode }) {
  const { org, memberships, switchOrg, backend, user, api, switchRole } = useApp();
  const pending = useOutboxCount();
  const toast = useToast();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const flush = async () => { const n = await outbox.flush(p => api.recordSession(p as never)); if (n) toast(`${n} saved session${n > 1 ? 's' : ''} sent.`); };
  useEffect(() => { const on = () => { setOnline(true); flush(); }; const off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); if (pending) flush(); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="flex min-h-full flex-col lg:flex-row">
    <PullToRefresh />
    <AutoRefresh />
    <Tour />
    <aside className="no-print hidden w-64 shrink-0 flex-col gap-6 border-r border-line bg-white p-5 lg:flex">
      <Brand small />
      <nav aria-label="Main" className="flex flex-col gap-1">{nav.map(n => <a key={n.key} href={n.href} data-tour={`nav-${n.key}`} aria-current={active === n.key ? 'page' : undefined} className={cx('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-bold', active === n.key ? 'bg-pine-50 text-pine-800' : 'text-ink-soft hover:bg-paper')}><n.icon size={18} />{n.label}</a>)}</nav>
      <div className="mt-auto flex flex-col gap-2 text-sm">
        {memberships.length > 1 && <Select aria-label="Program" value={org?.id ?? ''} onChange={switchOrg} options={memberships.map(m => [m.orgId, m.orgId === org?.id ? org.name : `Program (${m.role})`])} />}
        {org && org.roles.length > 1 && <Select aria-label="View as" value={org.role} onChange={switchRole} options={org.roles.map(r => [r, `View as ${ROLE_NAME[r]}`] as [typeof r, string])} />}
        <p className="truncate text-ink-faint">{user?.name ?? user?.email}{backend.kind === 'preview' ? ' · preview' : ''}</p>
        <button type="button" onClick={() => backend.signOut()} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-2 font-bold text-ink-soft hover:bg-paper"><LogOut size={16} />Sign out</button>
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur lg:px-8">
        <div className="lg:hidden"><Brand small /></div>
        <p className="hidden min-w-0 truncate text-sm font-bold text-ink-soft lg:block">{org?.name}</p>
        <div className="ml-auto flex items-center gap-2">
          {org && org.roles.length > 1 && <Select aria-label="View as" className="!w-auto !min-h-[36px] text-sm lg:hidden" value={org.role} onChange={switchRole} options={org.roles.map(r => [r, ROLE_NAME[r]] as [typeof r, string])} />}
          <InstallApp compact />
          <InboxBell />
          {(!online || pending > 0) && <button type="button" onClick={flush} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-amber-50 px-3 text-xs font-bold text-warn ring-1 ring-warn/30">{online ? <RefreshCw size={14} /> : <CloudOff size={14} />}{online ? `${pending} waiting · send now` : `Offline${pending ? ` · ${pending} waiting` : ''}`}</button>}
          <button type="button" onClick={() => backend.signOut()} className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-black/5 lg:hidden" aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">{children}</main>
    </div>
    <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
      {nav.map(n => <a key={n.key} href={n.href} data-tour={`nav-${n.key}`} aria-current={active === n.key ? 'page' : undefined} className={cx('flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold', active === n.key ? 'text-pine-800' : 'text-ink-faint')}><n.icon size={20} />{n.label}</a>)}
    </nav>
  </div>;
}
export function PageTitle({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><h1 className="text-2xl font-bold text-ink">{title}</h1>{sub && <p className="text-sm text-ink-faint">{sub}</p>}</div>{action}</div>;
}
