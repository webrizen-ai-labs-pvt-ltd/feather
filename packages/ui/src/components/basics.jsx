import clsx from 'clsx';
import logoUrl from '@feather/assets/brand/logo.svg';
import { APP_NAME } from '@feather/shared';

export function Logo({ className = 'h-8', withName = true, nameClassName = 'text-lg' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src={logoUrl} alt={withName ? '' : APP_NAME} className={clsx('w-auto', className)} />
      {withName && <span className={clsx('font-bold tracking-tight', nameClassName)}>{APP_NAME}</span>}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-600/50',
  secondary: 'bg-white text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50 disabled:text-ink-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:bg-red-600/50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 disabled:bg-emerald-600/50',
  ghost: 'text-ink-700 hover:bg-ink-100 disabled:text-ink-400',
};
const BUTTON_SIZES = {
  sm: 'px-2.5 py-1.5 text-sm gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-4 py-3 text-base gap-2',
  xl: 'px-5 py-4 text-lg gap-2.5 w-full', // field phones: big thumb target
};

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-semibold shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : Icon && <Icon className="size-5 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'size-5' }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx('rounded-xl bg-white shadow-xs ring-1 ring-ink-200', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  good: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-300',
  bad: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

const STAT_ACCENT = { neutral: 'text-ink-900', good: 'text-emerald-700', warn: 'text-amber-700', bad: 'text-red-700', brand: 'text-brand-700' };

export function Stat({ label, value, sub, tone = 'neutral', icon: Icon, className }) {
  return (
    <Card className={clsx('p-4', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink-500">
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
      </div>
      <div className={clsx('tabular mt-1 text-2xl font-bold tracking-tight', STAT_ACCENT[tone])}>{value}</div>
      {sub && <div className="mt-1 text-sm text-ink-500">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <Icon className="size-10 text-ink-300" aria-hidden />}
      <p className="mt-3 font-semibold text-ink-800">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, className }) {
  if (!error) return null;
  return (
    <div role="alert" className={clsx('rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 ring-1 ring-red-200', className)}>
      {typeof error === 'string' ? error : error.message}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-ink-500">
      <Spinner /> {label}
    </div>
  );
}

/** Two-column label / value list for detail pages. */
export function DetailList({ items, className }) {
  return (
    <dl className={clsx('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
          <dd className="tabular mt-0.5 break-words text-sm text-ink-900">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
