/**
 * Enterprise app shell shared by both apps:
 *  - left sidebar with grouped navigation (drawer on phones)
 *  - top bar with breadcrumbs, quick search (Ctrl/⌘+K), notifications, theme switch, account menu
 *  - optional bottom tab bar for phones (Operations app)
 * Built on Untitled UI nav items + React Aria.
 */
import {
  ChevronRight,
  ChevronSelectorVertical,
  HelpCircle,
  Home02,
  LogOut01,
  Menu02,
  Moon01,
  SearchLg,
  Sun,
  XClose,
  BellRinging01,
} from '@untitledui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button as AriaButton,
  Dialog as AriaDialog,
  Link as AriaLink,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
} from 'react-aria-components';
import { useLocation, useNavigate } from 'react-router';
import { Dialog, Modal, ModalOverlay } from '@uui/components/application/modals/modal';
import { NavItemBase } from '@uui/components/application/app-navigation/base-components/nav-item';
import { Avatar } from '@uui/components/base/avatar/avatar';
import { Badge } from '@uui/components/base/badges/badges';
import { ButtonUtility } from '@uui/components/base/buttons/button-utility';
import { Dropdown } from '@uui/components/base/dropdown/dropdown';
import { useTheme } from '@uui/providers/theme-provider';
import { cx } from '@uui/utils/cx';
import { Logo } from './basics.jsx';
import { ShellContext } from './shell-context.jsx';

const SIDEBAR_WIDTH = 280;

const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

function isActive(item, pathname) {
  if (!item.href) return false;
  const path = item.href.split('?')[0];
  return item.end ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

function NavSections({ sections, pathname, onNavigate }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-4">
      {sections.map((section, i) => (
        <div key={section.label ?? i}>
          {section.label && <p className="px-2 pb-1.5 text-xs font-semibold tracking-wide text-quaternary uppercase">{section.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <NavItemBase
                  type="link"
                  href={item.href}
                  icon={item.icon}
                  current={isActive(item, pathname)}
                  onClick={onNavigate}
                  badge={
                    item.badge ? (
                      <Badge size="sm" type="pill-color" color={item.badgeColor ?? 'error'} className="ml-3">
                        {item.badge}
                      </Badge>
                    ) : undefined
                  }
                >
                  {item.label}
                </NavItemBase>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const dark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <Dropdown.Item icon={dark ? Sun : Moon01} onAction={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? 'Light mode' : 'Dark mode'}
    </Dropdown.Item>
  );
}

function AccountMenu({ user, roleLabel, onLogout, helpHref, compact }) {
  return (
    <Dropdown.Root>
      <AriaButton
        aria-label="Account menu"
        className={({ isFocusVisible }) =>
          cx(
            'flex cursor-pointer items-center gap-3 rounded-xl text-left outline-focus-ring transition',
            compact ? 'p-0.5' : 'w-full p-3 ring-1 ring-secondary hover:bg-primary_hover',
            isFocusVisible && 'outline-2 outline-offset-2',
          )
        }
      >
        <Avatar size={compact ? 'sm' : 'md'} initials={initialsOf(user?.name)} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-primary">{user?.name}</span>
              <span className="block truncate text-sm text-tertiary">{roleLabel}</span>
            </span>
            <ChevronSelectorVertical className="size-4 shrink-0 text-fg-quaternary" aria-hidden />
          </>
        )}
      </AriaButton>
      <Dropdown.Popover placement={compact ? 'bottom end' : 'top start'} className="w-64">
        <div className="flex items-center gap-3 border-b border-secondary px-4 py-3">
          <Avatar size="md" initials={initialsOf(user?.name)} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{user?.name}</p>
            <p className="truncate text-sm text-tertiary">{user?.email ?? (user?.phone ? `+91 ${user.phone}` : roleLabel)}</p>
          </div>
        </div>
        <Dropdown.Menu>
          <ThemeMenuItems />
          {helpHref && (
            <Dropdown.Item icon={HelpCircle} href={helpHref}>
              Help & guide
            </Dropdown.Item>
          )}
          <Dropdown.Separator />
          <Dropdown.Item icon={LogOut01} onAction={onLogout}>
            Log out
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/** Ctrl/⌘+K jump-to-page search over the navigation. */
function QuickSearch({ sections, isOpen, onOpenChange }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const items = useMemo(() => sections.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label }))), [sections]);
  const needle = q.trim().toLowerCase();
  const results = needle ? items.filter((i) => `${i.label} ${i.keywords ?? ''} ${i.group ?? ''}`.toLowerCase().includes(needle)) : items;
  const go = (href) => {
    onOpenChange(false);
    setQ('');
    navigate(href);
  };
  return (
    <ModalOverlay isDismissable isOpen={isOpen} onOpenChange={onOpenChange} className="sm:items-start sm:pt-[12vh]">
      <Modal className="max-w-lg">
        <Dialog aria-label="Search pages" className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-secondary px-4">
            <SearchLg className="size-5 text-fg-quaternary" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0].href)}
              placeholder="Jump to a page…"
              className="h-14 w-full bg-transparent text-md text-primary outline-none placeholder:text-placeholder"
            />
            <kbd className="hidden rounded-md px-1.5 py-0.5 text-xs font-medium text-quaternary ring-1 ring-secondary sm:block">Esc</kbd>
          </div>
          <ul className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-tertiary">No page matches “{q}”.</li>}
            {results.map((i) => (
              <li key={i.href}>
                <button type="button" onClick={() => go(i.href)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
                  {i.icon && <i.icon className="size-5 text-fg-quaternary" aria-hidden />}
                  <span className="flex-1 text-sm font-medium text-primary">{i.label}</span>
                  {i.group && <span className="text-xs text-quaternary">{i.group}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function Crumbs({ crumbs }) {
  if (!crumbs.length) return null;
  return (
    <Breadcrumbs className="flex min-w-0 items-center gap-1 text-sm">
      <Breadcrumb id="__home" className="flex items-center">
        <AriaLink href="/" aria-label="Home" className="rounded-md p-1 text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2">
          <Home02 className="size-5" />
        </AriaLink>
      </Breadcrumb>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Breadcrumb key={`${i}-${c.label}`} id={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-4 shrink-0 text-fg-quaternary" aria-hidden />
            {last || !c.href ? (
              <span aria-current={last ? 'page' : undefined} className={cx('truncate rounded-md px-2 py-1 font-semibold', last ? 'bg-primary_hover text-secondary' : 'text-quaternary')}>
                {c.label}
              </span>
            ) : (
              <AriaLink href={c.href} className="truncate rounded-md px-2 py-1 font-semibold text-quaternary outline-focus-ring hover:bg-primary_hover hover:text-tertiary focus-visible:outline-2">
                {c.label}
              </AriaLink>
            )}
          </Breadcrumb>
        );
      })}
    </Breadcrumbs>
  );
}

/**
 * @param {{
 *   sections: {label?: string, items: {label:string, href:string, icon?:any, end?:boolean, badge?:any, keywords?:string}[]}[],
 *   bottomNav?: {label:string, href:string, icon:any, end?:boolean}[],
 *   appLabel: string, user: any, roleLabel: string, onLogout: () => void,
 *   notifications?: {href:string, count:number}, helpHref?: string, topbarExtras?: any, banner?: any, children: any
 * }} props
 */
export function AppShell({ sections, bottomNav, appLabel, user, roleLabel, onLogout, notifications, helpHref, topbarExtras, banner, children }) {
  const { pathname } = useLocation();
  const [crumbs, setCrumbs] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const ctx = useMemo(() => ({ setCrumbs }), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const sidebar = (
    <aside className="flex h-full w-full flex-col bg-primary pt-5">
      <div className="px-6 pb-5">
        <Logo className="h-8" nameClassName="text-md" subtitle={appLabel} />
      </div>
      <div className="px-4 pb-5">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-left text-md text-placeholder shadow-xs ring-1 ring-primary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2"
        >
          <SearchLg className="size-5 text-fg-quaternary" aria-hidden />
          <span className="flex-1">Search</span>
          <kbd className="rounded px-1 text-xs font-medium text-quaternary ring-1 ring-secondary">⌘K</kbd>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        <NavSections sections={sections} pathname={pathname} onNavigate={closeDrawer} />
      </div>
      <div className="border-t border-secondary p-4">
        <AccountMenu user={user} roleLabel={roleLabel} onLogout={onLogout} helpHref={helpHref} />
      </div>
    </aside>
  );

  return (
    <ShellContext.Provider value={ctx}>
      <div className="min-h-dvh bg-secondary">
        {/* Desktop sidebar */}
        <div className="fixed inset-y-0 left-0 z-30 hidden border-r border-secondary lg:block" style={{ width: SIDEBAR_WIDTH }}>
          {sidebar}
        </div>

        {/* Phone drawer */}
        <AriaModalOverlay
            isOpen={drawerOpen}
            onOpenChange={setDrawerOpen}
            isDismissable
            className={({ isEntering, isExiting }) =>
              cx('fixed inset-0 z-50 bg-overlay/70 backdrop-blur-md lg:hidden', isEntering && 'duration-300 animate-in fade-in', isExiting && 'duration-200 animate-out fade-out')
            }
          >
            <AriaModal className={({ isEntering, isExiting }) => cx('h-dvh w-full max-w-[300px]', isEntering && 'duration-300 animate-in slide-in-from-left', isExiting && 'duration-200 animate-out slide-out-to-left')}>
              <AriaDialog aria-label="Navigation" className="relative h-full outline-hidden">
                <button type="button" onClick={closeDrawer} aria-label="Close menu" className="absolute top-4 right-3 z-10 rounded-lg p-2 text-fg-quaternary hover:bg-primary_hover">
                  <XClose className="size-5" />
                </button>
                {sidebar}
              </AriaDialog>
            </AriaModal>
          </AriaModalOverlay>

        <div className="lg:pl-[280px]">
          <header className="sticky top-0 z-20 border-b border-secondary bg-primary/90 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 md:px-8">
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="-ml-1 rounded-lg p-2 text-fg-secondary hover:bg-primary_hover lg:hidden">
                <Menu02 className="size-6" />
              </button>
              <span className="lg:hidden">
                <Logo className="h-7" withName={false} />
              </span>
              <div className="hidden min-w-0 flex-1 md:block">
                <Crumbs crumbs={crumbs} />
              </div>
              <div className="flex-1 md:hidden" />
              <div className="flex items-center gap-1.5">
                {topbarExtras}
                <ButtonUtility size="sm" color="tertiary" tooltip="Search (Ctrl+K)" icon={SearchLg} onPress={() => setSearchOpen(true)} className="lg:hidden" />
                {helpHref && <ButtonUtility size="sm" color="tertiary" tooltip="Help & guide" icon={HelpCircle} href={helpHref} />}
                {notifications && (
                  <span className="relative">
                    <ButtonUtility size="sm" color="tertiary" tooltip="Alerts" icon={BellRinging01} href={notifications.href} />
                    {notifications.count > 0 && (
                      <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-error-solid px-1 text-[10px] font-bold text-white">
                        {notifications.count > 99 ? '99+' : notifications.count}
                      </span>
                    )}
                  </span>
                )}
                <span className="lg:hidden">
                  <AccountMenu compact user={user} roleLabel={roleLabel} onLogout={onLogout} helpHref={helpHref} />
                </span>
              </div>
            </div>
            {banner}
          </header>

          <main className={cx('mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8 md:py-8', bottomNav && 'pb-28 lg:pb-8')}>{children}</main>
        </div>

        {bottomNav && (
          <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 border-t border-secondary bg-primary pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}>
              {bottomNav.map((n) => {
                const active = isActive(n, pathname);
                return (
                  <AriaLink key={n.href} href={n.href} className={cx('flex flex-col items-center gap-1 py-2.5 text-xs font-semibold outline-focus-ring', active ? 'text-brand-secondary' : 'text-quaternary')}>
                    <span className={cx('rounded-full px-4 py-1 transition', active && 'bg-brand-primary')}>
                      <n.icon className="size-6" aria-hidden />
                    </span>
                    {n.label}
                  </AriaLink>
                );
              })}
            </div>
          </nav>
        )}

        <QuickSearch sections={sections} isOpen={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </ShellContext.Provider>
  );
}
