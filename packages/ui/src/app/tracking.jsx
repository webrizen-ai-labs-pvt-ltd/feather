/**
 * Parcel-style tracking (like an online order tracker) for trucks and shipments.
 *  - <TrackingProgress> : horizontal step tracker with dates (vertical on phones)
 *  - <TrackingTimeline> : full history, newest first
 *  - <MiniTracker>      : compact dots for table rows
 *  - truckTracking(trip, { money }) / shipmentTracking(c) : turn records into steps + events
 */
import {
  AlertTriangle,
  BankNote01,
  Check,
  CheckCircle,
  Clock,
  File06,
  Lock01,
  MarkerPin01,
  Package,
  PackageCheck,
  Tool01,
  Train,
  Truck01,
  XClose,
} from '@untitledui/icons';
import { formatDateTime, formatHours, formatQty, TRIP_FLAG_LABELS } from '@feather/shared';
import { cx } from '@uui/utils/cx';

const TONE = {
  brand: { solid: 'bg-brand-solid', ring: 'ring-brand', text: 'text-brand-secondary', soft: 'bg-brand-primary' },
  warning: { solid: 'bg-warning-solid', ring: 'ring-[var(--color-utility-orange-300)]', text: 'text-warning-primary', soft: 'bg-warning-primary' },
  error: { solid: 'bg-error-solid', ring: 'ring-error', text: 'text-error-primary', soft: 'bg-error-primary' },
  success: { solid: 'bg-success-solid', ring: 'ring-[var(--color-utility-green-300)]', text: 'text-success-primary', soft: 'bg-success-primary' },
};

/**
 * steps = [{ key, label, sub?, at? }], current = index of the step in progress
 * (steps before it are done; current === steps.length means everything is done).
 */
export function TrackingProgress({ steps, current, tone = 'brand', headline, subline, className }) {
  const t = TONE[tone];
  const done = (i) => i < current;
  const fill = steps.length > 1 ? Math.min(1, Math.max(0, current) / (steps.length - 1)) : 1;
  return (
    <div className={cx('rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary md:p-6', className)}>
      {headline && (
        <div className="mb-6">
          <p className={cx('text-lg font-semibold', t.text)}>{headline}</p>
          {subline && <p className="mt-0.5 text-sm text-tertiary">{subline}</p>}
        </div>
      )}

      {/* Horizontal (tablet and up) */}
      <ol className="relative hidden grid-flow-col sm:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        <span aria-hidden className="absolute top-3.5 h-1 rounded-full bg-quaternary" style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }} />
        <span
          aria-hidden
          className={cx('absolute top-3.5 h-1 rounded-full transition-all duration-500', t.solid)}
          style={{ left: `${50 / steps.length}%`, width: `calc(${fill} * (100% - ${100 / steps.length}%))` }}
        />
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex flex-col items-center px-1 text-center">
            <StepDot state={done(i) ? 'done' : i === current ? 'current' : 'todo'} tone={t} />
            <p className={cx('mt-3 text-sm font-semibold', i <= current ? 'text-primary' : 'text-quaternary')}>{s.label}</p>
            {s.sub && <p className={cx('mt-0.5 text-xs', i === current ? t.text : 'text-tertiary')}>{s.sub}</p>}
            {s.at && <p className="mt-0.5 text-xs text-quaternary tabular-nums">{formatDateTime(s.at)}</p>}
          </li>
        ))}
      </ol>

      {/* Vertical (phones) */}
      <ol className="sm:hidden">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className={cx('absolute top-7 bottom-0 left-3.5 w-0.5', done(i) ? t.solid : 'bg-quaternary')} />}
            <StepDot state={done(i) ? 'done' : i === current ? 'current' : 'todo'} tone={t} />
            <div className="min-w-0 pt-1">
              <p className={cx('text-sm font-semibold', i <= current ? 'text-primary' : 'text-quaternary')}>{s.label}</p>
              {s.sub && <p className={cx('text-xs', i === current ? t.text : 'text-tertiary')}>{s.sub}</p>}
              {s.at && <p className="text-xs text-quaternary tabular-nums">{formatDateTime(s.at)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepDot({ state, tone }) {
  if (state === 'done') {
    return (
      <span className={cx('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-white', tone.solid)}>
        <Check className="size-4 stroke-[3px]" aria-hidden />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className={cx('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary ring-2', tone.ring)}>
        <span className={cx('absolute inline-flex size-full animate-ping rounded-full opacity-20', tone.solid)} />
        <span className={cx('size-3 rounded-full', tone.solid)} />
      </span>
    );
  }
  return <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary ring-2 ring-secondary" />;
}

const EVENT_TONE = {
  gray: 'bg-secondary text-fg-quaternary ring-secondary',
  brand: 'bg-brand-primary text-fg-brand-primary ring-brand_alt',
  success: 'bg-success-primary text-fg-success-primary ring-[var(--color-utility-green-200)]',
  warning: 'bg-warning-primary text-fg-warning-primary ring-[var(--color-utility-orange-200)]',
  error: 'bg-error-primary text-fg-error-primary ring-error_subtle',
};

/** events = [{ key, title, detail?, at?, icon, tone? }] — shown newest first. */
export function TrackingTimeline({ events, title = 'History', className }) {
  const list = [...events].sort((a, b) => new Date(b.at ?? 0) - new Date(a.at ?? 0));
  return (
    <div className={cx('rounded-xl bg-primary shadow-xs ring-1 ring-secondary', className)}>
      <div className="border-b border-secondary px-5 py-4 md:px-6">
        <h2 className="text-md font-semibold text-primary">{title}</h2>
      </div>
      <ol className="px-5 py-5 md:px-6">
        {list.map((e, i) => {
          const Icon = e.icon ?? Clock;
          return (
            <li key={e.key} className="relative flex gap-4 pb-6 last:pb-0">
              {i < list.length - 1 && <span aria-hidden className="absolute top-10 bottom-1 left-[19px] w-px bg-border-secondary" />}
              <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset', EVENT_TONE[e.tone ?? 'gray'])}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-sm font-semibold text-primary">{e.title}</p>
                  {e.at && <p className="text-xs text-quaternary tabular-nums">{formatDateTime(e.at)}</p>}
                </div>
                {e.detail && <div className="mt-0.5 text-sm text-tertiary">{e.detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Compact tracker for table rows: ●━━●━━○ with the current step's label. */
export function MiniTracker({ steps, current, tone = 'brand' }) {
  const t = TONE[tone];
  const label = current >= steps.length ? steps.at(-1)?.label : steps[current]?.label;
  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <div className="flex items-center">
        {steps.map((s, i) => (
          <span key={s.key} className="flex flex-1 items-center last:flex-none">
            <span className={cx('size-2.5 shrink-0 rounded-full', i < current || current >= steps.length ? t.solid : i === current ? cx('ring-2 ring-offset-1', t.ring, t.solid) : 'bg-quaternary')} />
            {i < steps.length - 1 && <span className={cx('h-0.5 flex-1', i < current ? t.solid : 'bg-quaternary')} />}
          </span>
        ))}
      </div>
      <span className={cx('text-xs font-medium', t.text)}>{label}</span>
    </div>
  );
}

const HOUR = 3_600_000;
const LOCKING = new Set(['transit_loss', 'weight_gain', 'bag_damage', 'bag_shortage', 'bag_excess', 'tare_mismatch']);

/**
 * Steps + history for one truck trip.
 * money = show the payment steps (owner / dispatch only).
 */
export function truckTracking(trip, { money = true } = {}) {
  const from = trip.sourceLocation?.name ?? 'loading point';
  const to = trip.destination?.name ?? 'destination';
  const unit = trip.unit;
  const status = trip.status;
  const fr = trip.freight;

  const steps = [
    { key: 'loaded', label: 'Loaded', sub: from, at: trip.loading?.at },
    { key: 'road', label: 'On the way', sub: trip.breakdown?.active ? 'Breakdown' : undefined },
    { key: 'arrived', label: 'Arrived', sub: to, at: trip.receipt?.at },
  ];
  if (money && fr) {
    steps.push({ key: 'checked', label: 'Payment checked', at: fr.reviewedAt ?? (fr.status === 'ready' ? trip.receipt?.at : undefined) });
    steps.push({ key: 'paid', label: 'Truck company paid', at: fr.paidAt });
  }

  let current = 1;
  let tone = 'brand';
  let headline = `On the way to ${to}`;
  let subline;
  if (status === 'in_transit') {
    const hours = (Date.now() - new Date(trip.loading?.at)) / HOUR;
    const late = trip.expectedTransitHours && hours > trip.expectedTransitHours;
    steps[1].sub = trip.breakdown?.active ? 'Breakdown reported' : late ? `Late · ${formatHours(hours)} on road` : `${formatHours(hours)} on road`;
    if (trip.breakdown?.active || late) tone = 'warning';
    headline = trip.breakdown?.active ? 'Breakdown on the way' : late ? `Running late to ${to}` : `On the way to ${to}`;
    subline = trip.expectedTransitHours ? `Normal road time is ${formatHours(trip.expectedTransitHours)}.` : undefined;
  } else if (status === 'received') {
    current = 3;
    headline = `Arrived at ${to}`;
    const problems = (trip.flags ?? []).filter((f) => LOCKING.has(f));
    if (money && fr) {
      if (fr.status === 'locked') {
        tone = 'warning';
        steps[3].sub = 'On hold — needs review';
        headline = 'Arrived — payment on hold';
        subline = problems.map((f) => TRIP_FLAG_LABELS[f]).join(' · ');
      } else if (fr.status === 'ready') {
        current = 4;
        steps[3].sub = fr.waived ? 'Paid in full approved' : fr.deduction > 0 ? 'Cut approved' : 'No problems';
        steps[4].sub = 'Ready to pay';
        tone = 'success';
        headline = 'Arrived — ready to pay';
      } else if (fr.status === 'paid') {
        current = 5;
        tone = 'success';
        headline = 'Delivered and paid';
      }
    } else {
      current = 3;
      tone = 'success';
    }
  } else if (status === 'cancelled') {
    tone = 'error';
    current = 0;
    headline = 'Trip cancelled';
    subline = trip.cancelReason;
  }

  const events = [];
  if (trip.loading?.at) {
    events.push({
      key: 'loaded',
      at: trip.loading.at,
      icon: Truck01,
      tone: 'brand',
      title: `Loaded at ${from}`,
      detail: `${formatQty(trip.loading.qty, unit)} on ${trip.vehicleNo ?? 'truck'}${trip.driverName ? ` · Driver ${trip.driverName}` : ''}`,
    });
  }
  if (trip.challanNo) events.push({ key: 'note', at: trip.loading?.at, icon: File06, title: `Delivery note ${trip.challanNo} made`, detail: trip.customer?.name });
  if (trip.breakdown?.at) {
    events.push({ key: 'breakdown', at: trip.breakdown.at, icon: Tool01, tone: 'warning', title: 'Breakdown reported', detail: trip.breakdown.note });
    if (trip.breakdown.clearedAt) events.push({ key: 'moving', at: trip.breakdown.clearedAt, icon: Truck01, title: 'Moving again' });
  }
  if (trip.receipt?.at) {
    events.push({
      key: 'arrived',
      at: trip.receipt.at,
      icon: MarkerPin01,
      tone: 'success',
      title: `Arrived at ${to}`,
      detail: [trip.receipt.net != null && `${formatQty(trip.receipt.net)} material weight`, trip.receipt.grnNo && `Receipt ${trip.receipt.grnNo}`].filter(Boolean).join(' · '),
    });
    const problems = (trip.flags ?? []).filter((f) => LOCKING.has(f));
    if (problems.length) {
      events.push({ key: 'problems', at: new Date(new Date(trip.receipt.at).getTime() + 1000), icon: AlertTriangle, tone: 'error', title: 'Problems found', detail: problems.map((f) => TRIP_FLAG_LABELS[f]).join(' · ') });
    }
  }
  if (money && fr?.reviewedAt) {
    events.push({ key: 'reviewed', at: fr.reviewedAt, icon: fr.waived ? CheckCircle : Lock01, tone: 'brand', title: fr.waived ? 'Approved: pay in full' : 'Approved: pay with cut', detail: fr.reviewNote });
  }
  if (money && fr?.paidAt) events.push({ key: 'paid', at: fr.paidAt, icon: BankNote01, tone: 'success', title: 'Truck company paid' });
  if (status === 'cancelled') events.push({ key: 'cancel', at: trip.updatedAt, icon: XClose, tone: 'error', title: 'Trip cancelled', detail: trip.cancelReason });

  return { steps, current, tone, headline, subline, events };
}

/** Steps + history for a shipment (train / barge / ship). */
export function shipmentTracking(c) {
  const unit = c.material?.unit ?? c.unit;
  const pct = c.declaredQty ? Math.round((c.liftedQty / c.declaredQty) * 100) : 0;
  const steps = [
    { key: 'way', label: 'On the way', sub: c.supplier, at: c.createdAt },
    { key: 'arrived', label: 'Arrived', sub: c.location?.name, at: c.placedAt },
    { key: 'unloading', label: 'Unloading', sub: c.placedAt ? `${pct}% unloaded` : undefined },
    { key: 'emptied', label: 'Emptied', at: c.releasedAt },
    { key: 'closed', label: 'Closed', at: c.closedAt },
  ];
  const current = { expected: 0, placed: 2, released: 4, closed: 5 }[c.status] ?? 0;
  const clock = c.clock ?? {};
  const tone = clock.status === 'overdue' || clock.status === 'penalty' ? 'error' : clock.status === 'at_risk' ? 'warning' : current >= 4 ? 'success' : 'brand';
  const headline = {
    expected: 'On the way to the unloading point',
    placed: clock.status === 'overdue' ? 'Unloading — late fee running' : clock.status === 'at_risk' ? 'Unloading — running late' : 'Unloading',
    released: 'Emptied — waiting for last trucks',
    closed: 'Closed',
  }[c.status];

  const events = [{ key: 'created', at: c.createdAt, icon: File06, title: 'Shipment added', detail: `${formatQty(c.declaredQty, unit)} from ${c.supplier}` }];
  if (c.placedAt) events.push({ key: 'arrived', at: c.placedAt, icon: Train, tone: 'brand', title: `Arrived at ${c.location?.name ?? 'unloading point'}`, detail: 'Free-hours timer started' });
  if (c.releasedAt) events.push({ key: 'emptied', at: c.releasedAt, icon: Package, tone: c.demurrage?.finalPenalty ? 'warning' : 'success', title: 'Emptied and handed back' });
  if (c.closedAt) events.push({ key: 'closed', at: c.closedAt, icon: PackageCheck, tone: 'success', title: 'Shipment closed' });

  return { steps, current, tone, headline, events, pct };
}
