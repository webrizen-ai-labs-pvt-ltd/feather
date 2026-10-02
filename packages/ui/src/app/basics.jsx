/**
 * Feather page building blocks, styled with Untitled UI tokens.
 * Prefer these in app pages; reach into `@uui/...` only for something not covered here.
 */
import { AlertCircle, ArrowLeft, SearchLg } from '@untitledui/icons';
import { useEffect } from 'react';
import { Link as AriaLink } from 'react-aria-components';
import logoUrl from '@feather/assets/brand/logo.svg';
import { APP_NAME } from '@feather/shared';
import { EmptyState as UuiEmptyState } from '@uui/components/application/empty-state/empty-state';
import { LoadingIndicator } from '@uui/components/application/loading-indicator/loading-indicator';
import { FeaturedIcon } from '@uui/components/foundations/featured-icon/featured-icon';
import { cx } from '@uui/utils/cx';
import { HelpLink } from '../help/HelpLink.jsx';
import { useShell } from './shell-context.jsx';

export function Logo({ className = 'h-8', withName = true, nameClassName = 'text-lg', subtitle }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src={logoUrl} alt={withName ? '' : APP_NAME} className={cx('w-auto shrink-0', className)} />
      {withName && (
        <span className="flex flex-col leading-tight">
          <span className={cx('font-semibold tracking-tight text-primary', nameClassName)}>{APP_NAME}</span>
          {subtitle && <span className="text-xs font-medium text-tertiary">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-xl bg-primary shadow-xs ring-1 ring-secondary', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, badge, actions, icon: Icon, className }) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-secondary px-4 py-4 md:px-6 md:py-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <FeaturedIcon icon={Icon} color="gray" theme="modern" size="md" className="shrink-0" />}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-md font-semibold text-primary">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 text-sm text-tertiary">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Page title row. Registers breadcrumbs with the app shell's top bar.
 * breadcrumbs = [{ label, href? }] — the current page is added automatically from `title`.
 */
export function PageHeader({ title, subtitle, actions, breadcrumbs, help, crumbLabel }) {
  const shell = useShell();
  const crumbKey = JSON.stringify([breadcrumbs ?? [], crumbLabel ?? title]);
  useEffect(() => {
    shell?.setCrumbs([...(breadcrumbs ?? []), { label: crumbLabel ?? (typeof title === 'string' ? title : '') }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crumbKey]);
  const parent = breadcrumbs?.at(-1);

  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {parent?.href && (
          <AriaLink href={parent.href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-tertiary outline-focus-ring hover:text-secondary lg:hidden">
            <ArrowLeft className="size-4" aria-hidden /> {parent.label}
          </AriaLink>
        )}
        <h1 className="flex items-center gap-2 text-display-xs font-semibold text-primary">
          <span className="truncate">{title}</span>
          {help && <HelpLink topic={help} />}
        </h1>
        {subtitle && <p className="mt-1 text-md text-tertiary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

const TONE_TEXT = { neutral: 'text-primary', good: 'text-success-primary', warn: 'text-warning-primary', bad: 'text-error-primary', brand: 'text-brand-secondary' };
const TONE_ICON = { neutral: 'gray', good: 'success', warn: 'warning', bad: 'error', brand: 'brand' };

/** A KPI tile: label, big value, a line underneath, optional icon and link. */
export function MetricCard({ label, value, sub, tone = 'neutral', icon, href, className, footer }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-tertiary">{label}</p>
        {icon && <FeaturedIcon icon={icon} size="md" theme="light" color={TONE_ICON[tone]} />}
      </div>
      <p className={cx('mt-2 text-display-xs font-semibold tabular-nums', TONE_TEXT[tone])}>{value}</p>
      {sub && <p className="mt-1 text-sm text-tertiary">{sub}</p>}
      {footer}
    </>
  );
  const cls = cx('block rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary', href && 'outline-focus-ring transition hover:ring-primary focus-visible:outline-2', className);
  return href ? (
    <AriaLink href={href} className={cls}>
      {body}
    </AriaLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Label / value pairs for detail pages. items = [[label, value], …] (falsy entries skipped). */
export function DetailList({ items, columns = 2, className }) {
  return (
    <dl className={cx('grid grid-cols-1 gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-tertiary">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-primary tabular-nums">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <LoadingIndicator type="line-spinner" size="md" label={label} />
    </div>
  );
}

/** Inline alert. tone: error | warning | success | brand | gray */
export function Alert({ tone = 'error', title, children, icon = AlertCircle, actions, className }) {
  const styles = {
    error: 'bg-error-primary ring-error_subtle',
    warning: 'bg-warning-primary ring-[var(--color-utility-orange-200)]',
    success: 'bg-success-primary ring-[var(--color-utility-green-200)]',
    brand: 'bg-brand-primary ring-brand_alt',
    gray: 'bg-secondary ring-secondary',
  }[tone];
  const color = { error: 'error', warning: 'warning', success: 'success', brand: 'brand', gray: 'gray' }[tone];
  return (
    <div role="alert" className={cx('flex gap-3 rounded-xl p-4 ring-1 ring-inset', styles, className)}>
      <FeaturedIcon icon={icon} size="sm" theme="outline" color={color} className="shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold text-primary">{title}</p>}
        {children && <div className={cx('text-secondary', title && 'mt-1')}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function ErrorNote({ error, className }) {
  if (!error) return null;
  return <Alert tone="error" className={className} title={typeof error === 'string' ? error : error.message} />;
}

/** Empty state built on Untitled UI's EmptyState. */
export function EmptyState({ icon = SearchLg, title, children, action, size = 'sm', className }) {
  return (
    <div className={cx('flex justify-center px-4 py-10', className)}>
      <UuiEmptyState size={size}>
        <UuiEmptyState.Header pattern="circle" patternSize="sm">
          <UuiEmptyState.FeaturedIcon icon={icon} color="gray" theme="modern" />
        </UuiEmptyState.Header>
        <UuiEmptyState.Content>
          <UuiEmptyState.Title>{title}</UuiEmptyState.Title>
          {children && <UuiEmptyState.Description>{children}</UuiEmptyState.Description>}
        </UuiEmptyState.Content>
        {action && <UuiEmptyState.Footer>{action}</UuiEmptyState.Footer>}
      </UuiEmptyState>
    </div>
  );
}

/** Small titled group of content inside a page. */
export function Section({ title, description, actions, children, className }) {
  return (
    <section className={cx('mb-8', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-primary">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-tertiary">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
