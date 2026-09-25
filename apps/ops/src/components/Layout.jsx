import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  ArrowDownOnSquareIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentListIcon,
  InboxStackIcon,
  PlusCircleIcon,
  Squares2X2Icon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { NavLink, Outlet } from 'react-router';
import { canAccess, ROLE_LABELS } from '@feather/shared';
import { Logo, useAuth, useOnline } from '@feather/ui';
import { useOutbox } from '@/lib/outbox.jsx';

const NAV = [
  { to: '/loading', label: 'Rakes', icon: TruckIcon, group: 'loading', end: true },
  { to: '/loading/new', label: 'Load truck', icon: ArrowUpTrayIcon, group: 'loading' },
  { to: '/gate', label: 'Arrivals', icon: ArrowDownOnSquareIcon, group: 'gate', end: true },
  { to: '/gate/count', label: 'Stock count', icon: ArchiveBoxIcon, group: 'stockCount' },
  { to: '/dispatch', label: 'Board', icon: Squares2X2Icon, group: 'dispatch', end: true },
  { to: '/dispatch/orders', label: 'Orders', icon: ClipboardDocumentListIcon, group: 'dispatch' },
  { to: '/dispatch/new', label: 'Dispatch', icon: PlusCircleIcon, group: 'dispatch' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const { items } = useOutbox();
  const pending = items.length;
  const failed = items.filter((i) => i.status === 'failed').length;
  // Owner can use every screen; keep the bar short by showing only the dispatch set for them.
  const nav = NAV.filter((n) => canAccess(n.group, user.role) && (user.role !== 'owner' || n.group === 'dispatch'));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 bg-ink-900 text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <span className="rounded-md bg-white px-1.5 py-1">
            <Logo className="h-6" nameClassName="text-sm text-ink-900" />
          </span>
          <div className="flex-1" />
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', online ? 'bg-emerald-600/20 text-emerald-300' : 'bg-red-600 text-white')}>
            <span className={clsx('size-2 rounded-full', online ? 'bg-emerald-400' : 'bg-white')} />
            {online ? 'Online' : 'Offline'}
          </span>
          {pending > 0 && (
            <NavLink to="/outbox" className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', failed ? 'bg-red-600' : 'bg-brand-500 text-ink-950')}>
              <InboxStackIcon className="size-4" /> {pending}
            </NavLink>
          )}
          <Menu as="div" className="relative">
            <MenuButton className="flex size-9 items-center justify-center rounded-full bg-ink-700 font-bold" aria-label="Account">
              {user.name?.[0]?.toUpperCase()}
            </MenuButton>
            <MenuItems anchor="bottom end" className="z-50 w-60 rounded-xl bg-white py-1 text-ink-900 shadow-lg ring-1 ring-ink-200 [--anchor-gap:6px] focus:outline-none">
              <div className="border-b border-ink-100 px-4 py-2.5">
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
              </div>
              <MenuItem>
                <NavLink to="/outbox" className="block px-4 py-2.5 text-sm data-focus:bg-ink-50">Saved entries ({pending})</NavLink>
              </MenuItem>
              <MenuItem>
                <button type="button" onClick={logout} className="block w-full px-4 py-2.5 text-left text-sm data-focus:bg-ink-50">Log out</button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
        {!online && <p className="bg-red-700 px-4 py-1.5 text-center text-sm">No network. You can keep working — entries are saved on this phone.</p>}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold', isActive ? 'text-brand-700' : 'text-ink-500')}
            >
              <n.icon className="size-6" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
