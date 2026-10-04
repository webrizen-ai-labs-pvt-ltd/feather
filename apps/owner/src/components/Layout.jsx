import {
  Archive,
  BellRinging01,
  BookOpen01,
  Building07,
  ClockRewind,
  Grid01,
  Home02,
  LifeBuoy01,
  Route,
  Settings01,
  ShoppingBag01,
  Train,
  Truck01,
  Users01,
  Wallet02,
} from '@untitledui/icons';
import { Outlet } from 'react-router';
import { ROLE_LABELS } from '@feather/shared';
import { AppShell, useAuth, useGet } from '@feather/ui';

export default function Layout() {
  const { user, logout } = useAuth();
  const { data } = useGet('/admin/alerts', { unread: 'true', limit: 1 }, { refetchInterval: 60_000 });
  const unread = data?.total ?? 0;

  // Top links, then groups that open / close (see AppShell). Order follows the material:
  // it arrives (shipments) → moves (truck trips) → is stored (inventory); then who you deal with, then setup.
  const sections = [
    {
      items: [
        { label: 'Home', href: '/', icon: Home02, end: true, keywords: 'dashboard overview' },
        { label: 'Alerts', href: '/alerts', icon: BellRinging01, badge: unread || undefined, keywords: 'notifications problems' },
      ],
    },
    {
      label: 'Material flow',
      icon: Route,
      items: [
        { label: 'Shipments', href: '/shipments', icon: Train, keywords: 'train barge ship rake' },
        { label: 'Truck trips', href: '/trips', icon: Truck01, keywords: 'trucks tracking payments freight approval' },
        { label: 'Inventory', href: '/inventory', icon: Archive, keywords: 'stock warehouse count' },
      ],
    },
    {
      label: 'Money',
      icon: Wallet02,
      items: [
        { label: 'Customers', href: '/customers', icon: Wallet02, keywords: 'credit dues payments bills sell' },
        { label: 'Sellers', href: '/sellers', icon: ShoppingBag01, keywords: 'suppliers vendors buy purchase' },
        { label: 'Truck companies', href: '/truck-companies', icon: Building07, keywords: 'transporters scorecard' },
      ],
    },
    {
      label: 'Setup',
      icon: Settings01,
      items: [
        { label: 'Business setup', href: '/setup', icon: Grid01, keywords: 'products places materials warehouses sites stations distance labour' },
        { label: 'Staff', href: '/staff', icon: Users01, keywords: 'users pin login' },
        { label: 'Settings', href: '/settings', icon: Settings01, keywords: 'rules limits' },
      ],
    },
    {
      label: 'Records & help',
      icon: BookOpen01,
      items: [
        { label: 'History', href: '/history', icon: ClockRewind, keywords: 'audit log changes' },
        { label: 'Help & guide', href: '/help', icon: LifeBuoy01, keywords: 'manual how to' },
      ],
    },
  ];

  return (
    <AppShell
      sections={sections}
      appLabel="Owner"
      user={user}
      roleLabel={ROLE_LABELS[user?.role]}
      onLogout={logout}
      notifications={{ href: '/alerts', count: unread }}
      helpHref="/help"
    >
      <Outlet />
    </AppShell>
  );
}
