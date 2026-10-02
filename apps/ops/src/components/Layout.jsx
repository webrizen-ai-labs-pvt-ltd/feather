import {
  Archive,
  ClipboardCheck,
  Home02,
  Inbox01,
  LifeBuoy01,
  PlusCircle,
  Train,
  Truck01,
  PackageCheck,
  Upload01,
  WifiOff,
} from '@untitledui/icons';
import { Link as AriaLink } from 'react-aria-components';
import { Outlet } from 'react-router';
import { canAccess, ROLE_LABELS } from '@feather/shared';
import { AppShell, cx, useAuth, useOnline } from '@feather/ui';
import { useOutbox } from '@/lib/outbox.jsx';

/** Every screen of the Operations app, grouped by job. Each person sees only their own groups. */
const SECTIONS = [
  {
    label: 'Loading',
    group: 'loading',
    items: [
      { label: 'Shipments', href: '/loading', icon: Train, end: true, keywords: 'train timer free hours' },
      { label: 'Load a truck', href: '/loading/new', icon: Upload01, keywords: 'loading weighbridge slip' },
    ],
  },
  {
    label: 'Receiving',
    group: 'gate',
    items: [{ label: 'Incoming trucks', href: '/gate', icon: PackageCheck, end: true, keywords: 'arrivals receive' }],
  },
  { label: 'Receiving', group: 'stockCount', items: [{ label: 'Count stock', href: '/gate/count', icon: Archive, keywords: 'stock count warehouse' }] },
  {
    label: 'Dispatch',
    group: 'dispatch',
    items: [
      { label: 'Today', href: '/dispatch', icon: Home02, end: true, keywords: 'board late breakdown' },
      { label: 'Orders', href: '/dispatch/orders', icon: ClipboardCheck, keywords: 'customer orders' },
      { label: 'Send a truck', href: '/dispatch/new', icon: PlusCircle, keywords: 'dispatch warehouse delivery note' },
    ],
  },
];

const BOTTOM = {
  siding_supervisor: [
    { label: 'Shipments', href: '/loading', icon: Train, end: true },
    { label: 'Load truck', href: '/loading/new', icon: Upload01 },
  ],
  gate_inspector: [
    { label: 'Incoming', href: '/gate', icon: PackageCheck, end: true },
    { label: 'Count stock', href: '/gate/count', icon: Archive },
  ],
  dispatch_operator: [
    { label: 'Today', href: '/dispatch', icon: Home02, end: true },
    { label: 'Orders', href: '/dispatch/orders', icon: ClipboardCheck },
    { label: 'Send truck', href: '/dispatch/new', icon: Truck01 },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const { items } = useOutbox();
  const pending = items.length;
  const failed = items.filter((i) => i.status === 'failed').length;

  // Merge groups that share a label (Receiving), keep only what this role may open.
  const merged = [];
  for (const s of SECTIONS.filter((s) => canAccess(s.group, user.role))) {
    const same = merged.find((m) => m.label === s.label);
    if (same) same.items.push(...s.items);
    else merged.push({ label: s.label, items: [...s.items] });
  }
  merged.push({
    label: 'Phone',
    items: [
      { label: 'Saved on this phone', href: '/outbox', icon: Inbox01, badge: pending || undefined, keywords: 'offline outbox' },
      { label: 'Help & guide', href: '/help', icon: LifeBuoy01, keywords: 'manual how to' },
    ],
  });

  const extras = (
    <>
      <span
        className={cx(
          'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex',
          online ? 'bg-success-primary text-success-primary ring-[var(--color-utility-green-200)]' : 'bg-error-primary text-error-primary ring-error_subtle',
        )}
      >
        <span className={cx('size-2 rounded-full', online ? 'bg-fg-success-secondary' : 'bg-fg-error-secondary')} />
        {online ? 'Online' : 'Offline'}
      </span>
      {pending > 0 && (
        <AriaLink
          href="/outbox"
          className={cx(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold outline-focus-ring',
            failed ? 'bg-error-solid text-white' : 'bg-warning-solid text-white',
          )}
        >
          <Inbox01 className="size-4" aria-hidden /> {pending}
        </AriaLink>
      )}
    </>
  );

  const banner = !online && (
    <p className="flex items-center justify-center gap-2 bg-error-solid px-4 py-2 text-center text-sm font-medium text-white">
      <WifiOff className="size-4 shrink-0" aria-hidden /> No network. Keep working — entries are saved on this phone.
    </p>
  );

  return (
    <AppShell
      sections={merged}
      bottomNav={BOTTOM[user.role]}
      appLabel="Operations"
      user={user}
      roleLabel={ROLE_LABELS[user.role]}
      onLogout={logout}
      helpHref="/help"
      topbarExtras={extras}
      banner={banner}
    >
      <Outlet />
    </AppShell>
  );
}
