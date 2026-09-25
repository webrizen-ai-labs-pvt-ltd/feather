import { Dialog, DialogBackdrop, DialogPanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  Bars3Icon,
  BellAlertIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  QueueListIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  TruckIcon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { COMPANY_NAME } from '@feather/shared';
import { Logo, useApi, useAuth } from '@feather/ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, end: true },
  { to: '/consignments', label: 'Rakes & ships', icon: QueueListIcon },
  { to: '/trips', label: 'Trips & freight', icon: TruckIcon },
  { to: '/customers', label: 'Customer credit', icon: BuildingOffice2Icon },
  { to: '/transporters', label: 'Transporters', icon: ClipboardDocumentListIcon },
  { to: '/stock', label: 'Stock', icon: ArchiveBoxIcon },
  { to: '/alerts', label: 'Alerts', icon: BellAlertIcon, badge: 'alerts' },
  { section: 'Setup' },
  { to: '/masters', label: 'Materials & places', icon: Squares2X2Icon },
  { to: '/users', label: 'Users', icon: UsersIcon },
  { to: '/audit', label: 'Audit log', icon: ShieldCheckIcon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

function NavItems({ unread, onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map((item) =>
        item.section ? (
          <p key={item.section} className="mt-5 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">
            {item.section}
          </p>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                isActive ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-800/60 hover:text-white',
              )
            }
          >
            <item.icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge === 'alerts' && unread > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{unread > 99 ? '99+' : unread}</span>
            )}
          </NavLink>
        ),
      )}
    </nav>
  );
}

function Sidebar({ unread, onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-4 bg-ink-900 pb-4">
      <div className="flex h-16 items-center px-6">
        <span className="rounded-lg bg-white px-2 py-1">
          <Logo className="h-7" nameClassName="text-base text-ink-900" />
        </span>
      </div>
      <NavItems unread={unread} onNavigate={onNavigate} />
      <p className="px-6 text-xs text-ink-500">{COMPANY_NAME}</p>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const api = useApi();
  const { data } = useQuery({
    queryKey: ['alerts', 'unread-count'],
    queryFn: () => api.get('/admin/alerts', { unread: 'true', limit: 1 }),
    refetchInterval: 60_000,
  });
  const unread = data?.total ?? 0;

  return (
    <div className="min-h-dvh">
      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-ink-950/60 transition-opacity data-closed:opacity-0" />
        <div className="fixed inset-0 flex">
          <DialogPanel transition className="relative flex w-full max-w-72 flex-1 transition data-closed:-translate-x-full">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 rounded-md p-1 text-ink-300" aria-label="Close menu">
              <XMarkIcon className="size-6" />
            </button>
            <div className="w-full">
              <Sidebar unread={unread} onNavigate={() => setOpen(false)} />
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <Sidebar unread={unread} />
      </div>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="-m-2 p-2 text-ink-600 lg:hidden" aria-label="Open menu">
            <Bars3Icon className="size-6" />
          </button>
          <span className="lg:hidden">
            <Logo className="h-6" nameClassName="text-base" />
          </span>
          <div className="flex-1" />
          <NavLink to="/alerts" className="relative rounded-full p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Alerts">
            <BellAlertIcon className="size-6" />
            {unread > 0 && <span className="absolute right-1 top-1 size-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
          </NavLink>
          <Menu as="div" className="relative">
            <MenuButton className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">
                {user?.name?.[0]?.toUpperCase() ?? <UserGroupIcon className="size-4" />}
              </span>
              <span className="hidden sm:block">{user?.name}</span>
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              transition
              className="z-50 w-52 rounded-xl bg-white py-1 shadow-lg ring-1 ring-ink-200 [--anchor-gap:6px] focus:outline-none data-closed:opacity-0"
            >
              <div className="border-b border-ink-100 px-4 py-2 text-xs text-ink-500">{user?.email}</div>
              <MenuItem>
                <button type="button" onClick={logout} className="block w-full px-4 py-2 text-left text-sm data-focus:bg-ink-50">
                  Log out
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
