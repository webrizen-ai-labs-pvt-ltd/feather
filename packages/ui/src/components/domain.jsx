import { CameraIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
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
import { compressImage, getPosition } from '../lib/media.js';
import { Badge, Card, Spinner } from './basics.jsx';
import { Meter } from './data.jsx';

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
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-ink-800">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </p>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handle} tabIndex={-1} />
      {value ? (
        <div className="relative overflow-hidden rounded-xl ring-1 ring-ink-200">
          <img src={value.previewUrl} alt="Captured" className="max-h-72 w-full bg-ink-100 object-contain" />
          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-xs text-ink-600">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-4" />
              {value.geo ? `Location saved (±${value.geo.accuracy} m)` : 'Location not available'}
            </span>
            <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-brand-700">
              Retake
            </button>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove photo" className="absolute right-2 top-2 rounded-full bg-ink-900/70 p-1 text-white">
            <XMarkIcon className="size-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-ink-600 active:bg-ink-100',
            error ? 'border-red-400 bg-red-50' : 'border-ink-300 bg-white',
          )}
        >
          {busy ? <Spinner className="size-8" /> : <CameraIcon className="size-10" />}
          <span className="text-base font-semibold">{busy ? 'Preparing photo…' : 'Tap to open camera'}</span>
        </button>
      )}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function TripStatusBadge({ status }) {
  const tone = { in_transit: 'info', received: 'good', cancelled: 'neutral' }[status];
  return <Badge tone={tone}>{TRIP_STATUS_LABELS[status] ?? status}</Badge>;
}

export function FreightBadge({ status }) {
  if (!status) return null;
  const tone = { on_hold: 'neutral', locked: 'bad', ready: 'good', paid: 'brand' }[status];
  return <Badge tone={tone}>{FREIGHT_STATUS_LABELS[status]}</Badge>;
}

export function ConsignmentStatusBadge({ status }) {
  const tone = { expected: 'neutral', placed: 'warn', released: 'info', closed: 'good' }[status];
  return <Badge tone={tone}>{CONSIGNMENT_STATUS_LABELS[status]}</Badge>;
}

const SERIOUS_FLAGS = new Set(['transit_loss', 'weight_gain', 'bag_shortage', 'bag_excess', 'tare_mismatch', 'tare_history']);

export function FlagList({ flags = [], compact }) {
  if (!flags.length) return compact ? null : <span className="text-sm text-ink-500">No issues</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} tone={SERIOUS_FLAGS.has(f) ? 'bad' : 'warn'}>
          {TRIP_FLAG_LABELS[f] ?? f}
        </Badge>
      ))}
    </div>
  );
}

const CLOCK_TONE = { ok: 'good', at_risk: 'warn', overdue: 'bad', penalty: 'bad', done: 'good', not_placed: 'neutral' };
const CLOCK_LABEL = {
  ok: 'On track',
  at_risk: 'Demurrage risk',
  overdue: 'Free time over',
  penalty: 'Penalty charged',
  done: 'Released in time',
  not_placed: 'Not placed yet',
};

/**
 * Free-time clock for a rake / ship. Ticks every 30 s on screen.
 * `showMoney` hides the penalty figure for field staff.
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
  const liftedPct = c.declaredQty ? (c.liftedQty / c.declaredQty) * 100 : 0;
  const tone = CLOCK_TONE[clock.status] ?? 'neutral';
  return (
    <Card className={clsx('@container p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">
            {c.referenceType} {c.referenceNo}
          </p>
          <p className="truncate text-sm text-ink-500">
            {c.material?.name} · {c.location?.name}
          </p>
        </div>
        <Badge tone={tone}>{CLOCK_LABEL[clock.status] ?? '—'}</Badge>
      </div>
      {clock.status === 'not_placed' ? (
        <p className="mt-3 text-sm text-ink-500">Clock starts when the rake is placed or the first truck is loaded.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 @lg:grid-cols-4">
            <ClockFigure label="Free time left" value={formatHours(clock.remainingFreeHours)} bad={clock.remainingFreeHours < 0} />
            <ClockFigure label="Still to lift" value={formatQty(clock.remainingQty, unit)} />
            <ClockFigure label="Speed now / hr" value={formatQty(clock.liftRatePerHour, unit)} />
            <ClockFigure label="Speed needed / hr" value={clock.requiredRatePerHour === null ? '—' : formatQty(clock.requiredRatePerHour, unit)} bad={clock.requiredRatePerHour > clock.liftRatePerHour} />
          </div>
          <Meter className="mt-3" value={c.liftedQty} max={c.declaredQty} tone={tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'good'} />
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-ink-500">
            <span>
              Lifted {formatQty(c.liftedQty, unit)} of {formatQty(c.declaredQty, unit)} ({Math.round(liftedPct)}%)
            </span>
            <span>Free time ends {formatDateTime(clock.freeEndsAt)}</span>
          </div>
          {showMoney && clock.projectedPenalty > 0 && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {clock.isFinal ? 'Penalty' : 'Expected penalty at this speed'}: {formatINR(clock.projectedPenalty)} ({formatHours(clock.projectedOverHours)} over)
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function ClockFigure({ label, value, bad }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className={clsx('tabular text-base font-bold', bad ? 'text-red-700' : 'text-ink-900')}>{value}</p>
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
