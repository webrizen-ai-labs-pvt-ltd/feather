/** Feather-specific components: photos, status badges, problem badges, the free-hours timer. */
import { Camera01, Clock, MarkerPin01, RefreshCw01, Train, XClose } from '@untitledui/icons';
import { useEffect, useRef, useState } from 'react';
import {
  CONSIGNMENT_STATUS_LABELS,
  FREIGHT_STATUS_LABELS,
  formatDateTime,
  formatHours,
  formatINR,
  formatQty,
  TRIP_FLAG_LABELS,
  TRIP_STATUS_LABELS,
} from '@feather/shared';
import { LoadingIndicator } from '@uui/components/application/loading-indicator/loading-indicator';
import { Badge, BadgeWithDot } from '@uui/components/base/badges/badges';
import { FeaturedIcon } from '@uui/components/foundations/featured-icon/featured-icon';
import { cx } from '@uui/utils/cx';
import { compressImage, getPosition } from '../lib/media.js';
import { Meter } from './data.jsx';

/** Badge with a coloured dot. tone: good | warn | bad | brand | neutral | info */
export function StatusBadge({ tone = 'neutral', children, size = 'sm' }) {
  const color = { good: 'success', warn: 'warning', bad: 'error', brand: 'brand', neutral: 'gray', info: 'blue' }[tone] ?? 'gray';
  return (
    <BadgeWithDot type="pill-color" color={color} size={size}>
      {children}
    </BadgeWithDot>
  );
}

/** Plain coloured badge (no dot) — for counts and short tags. */
export function Tag({ tone = 'neutral', children }) {
  const color = { good: 'success', warn: 'warning', bad: 'error', brand: 'brand', neutral: 'gray', info: 'blue' }[tone] ?? 'gray';
  return (
    <Badge type="color" color={color} size="sm">
      {children}
    </Badge>
  );
}

export const TripStatusBadge = ({ status }) => (
  <StatusBadge tone={{ in_transit: 'info', received: 'good', cancelled: 'neutral' }[status]}>{TRIP_STATUS_LABELS[status] ?? status}</StatusBadge>
);

export const FreightBadge = ({ status }) =>
  status ? <StatusBadge tone={{ on_hold: 'neutral', locked: 'bad', ready: 'good', paid: 'brand' }[status]}>{FREIGHT_STATUS_LABELS[status]}</StatusBadge> : null;

export const ConsignmentStatusBadge = ({ status }) => (
  <StatusBadge tone={{ expected: 'neutral', placed: 'warn', released: 'info', closed: 'good' }[status]}>{CONSIGNMENT_STATUS_LABELS[status]}</StatusBadge>
);

const SERIOUS_FLAGS = new Set(['transit_loss', 'weight_gain', 'bag_shortage', 'bag_excess', 'tare_mismatch', 'tare_history']);

export function FlagList({ flags = [], compact }) {
  if (!flags.length) return compact ? null : <span className="text-sm text-tertiary">No problems</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <Tag key={f} tone={SERIOUS_FLAGS.has(f) ? 'bad' : 'warn'}>
          {TRIP_FLAG_LABELS[f] ?? f}
        </Tag>
      ))}
    </div>
  );
}

/**
 * Camera-only photo input. On Android, `capture` opens the camera directly —
 * no gallery, so an old slip photo cannot be re-used. GPS is attached when allowed.
 * onChange({ blob, previewUrl, geo }) or null.
 */
export function PhotoCapture({ label = 'Photo of weighbridge slip', value, onChange, error, required = true }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => value?.previewUrl && URL.revokeObjectURL(value.previewUrl), [value]);

  async function handle(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const [blob, geo] = await Promise.all([compressImage(file), getPosition()]);
    setBusy(false);
    onChange({ blob, previewUrl: URL.createObjectURL(blob), geo, takenAt: new Date().toISOString() });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-secondary">
        {label}
        {required && <span className="text-brand-tertiary"> *</span>}
      </p>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handle} tabIndex={-1} />
      {value ? (
        <div className="relative overflow-hidden rounded-xl ring-1 ring-secondary">
          <img src={value.previewUrl} alt="Captured slip" className="max-h-72 w-full bg-secondary object-contain" />
          <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-sm text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <MarkerPin01 className="size-4" aria-hidden />
              {value.geo ? `Location saved (±${value.geo.accuracy} m)` : 'Location not available'}
            </span>
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 font-semibold text-brand-secondary">
              <RefreshCw01 className="size-4" aria-hidden /> Retake
            </button>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove photo" className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white">
            <XClose className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cx(
            'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition outline-focus-ring focus-visible:outline-2',
            error ? 'border-error bg-error-primary' : 'border-primary bg-primary hover:bg-primary_hover',
          )}
        >
          {busy ? <LoadingIndicator type="line-spinner" size="sm" /> : <FeaturedIcon icon={Camera01} color="gray" theme="modern" size="lg" />}
          <span>
            <span className="block text-sm font-semibold text-brand-secondary">{busy ? 'Preparing photo…' : 'Tap to open camera'}</span>
            <span className="mt-0.5 block text-xs text-tertiary">Gallery photos are not allowed</span>
          </span>
        </button>
      )}
      {error && <p className="text-sm text-error-primary">{error}</p>}
    </div>
  );
}

const CLOCK_TONE = { ok: 'good', at_risk: 'warn', overdue: 'bad', penalty: 'bad', done: 'good', not_placed: 'neutral' };
const CLOCK_LABEL = {
  ok: 'On track',
  at_risk: 'Running late',
  overdue: 'Late fee started',
  penalty: 'Late fee charged',
  done: 'Emptied in time',
  not_placed: 'Not arrived yet',
};

/**
 * Free-hours timer for a shipment. Ticks every 30 s.
 * `showMoney` shows the late fee in rupees (office only).
 */
export function DemurrageClock({ consignment, showMoney = false, className }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const c = consignment;
  const clock = c.clock ?? {};
  const unit = c.material?.unit ?? c.unit;
  const pct = c.declaredQty ? (c.liftedQty / c.declaredQty) * 100 : 0;
  const tone = CLOCK_TONE[clock.status] ?? 'neutral';
  const meter = tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'good';

  return (
    <div className={cx('@container rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <FeaturedIcon icon={Train} color={tone === 'bad' ? 'error' : tone === 'warn' ? 'warning' : 'gray'} theme="light" size="md" />
          <div className="min-w-0">
            <p className="truncate text-md font-semibold text-primary">{c.referenceNo}</p>
            <p className="truncate text-sm text-tertiary">
              {c.material?.name} · {c.location?.name}
            </p>
          </div>
        </div>
        <StatusBadge tone={tone}>{CLOCK_LABEL[clock.status] ?? '—'}</StatusBadge>
      </div>

      {clock.status === 'not_placed' ? (
        <p className="mt-4 text-sm text-tertiary">The timer starts when the shipment arrives or the first truck is loaded.</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 @lg:grid-cols-4">
            <Figure label="Free hours left" value={formatHours(clock.remainingFreeHours)} bad={clock.remainingFreeHours < 0} icon />
            <Figure label="Still to unload" value={formatQty(clock.remainingQty, unit)} />
            <Figure label="Speed now / hr" value={formatQty(clock.liftRatePerHour, unit)} />
            <Figure label="Speed needed / hr" value={clock.requiredRatePerHour === null ? '—' : formatQty(clock.requiredRatePerHour, unit)} bad={clock.requiredRatePerHour > clock.liftRatePerHour} />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-medium text-secondary">
                {Math.round(pct)}% unloaded <span className="font-normal text-tertiary">· {formatQty(c.liftedQty, unit)} of {formatQty(c.declaredQty, unit)}</span>
              </span>
              <span className="text-tertiary">Free hours end {formatDateTime(clock.freeEndsAt)}</span>
            </div>
            <Meter value={c.liftedQty} max={c.declaredQty} tone={meter} />
          </div>
          {showMoney && clock.projectedPenalty > 0 && (
            <p className="mt-4 rounded-lg bg-error-primary px-4 py-3 text-sm font-semibold text-error-primary">
              {clock.isFinal ? 'Late fee' : 'Expected late fee at this speed'}: {formatINR(clock.projectedPenalty)}{' '}
              <span className="font-normal">({formatHours(clock.projectedOverHours)} over)</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Figure({ label, value, bad, icon }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium text-tertiary">
        {icon && <Clock className="size-3.5" aria-hidden />}
        {label}
      </p>
      <p className={cx('mt-1 text-lg font-semibold tabular-nums', bad ? 'text-error-primary' : 'text-primary')}>{value}</p>
    </div>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
