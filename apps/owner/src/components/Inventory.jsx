/** Pieces of the inventory screen: stock age bar, shelf life cell, shipment label, shipment lot detail. */
import { Anchor, Archive, Train } from '@untitledui/icons';
import { useNavigate } from 'react-router';
import { formatDate, formatDateTime, formatNumber, formatQty, round, SHELF_STATUS_LABELS, STOCK_AGE_BUCKETS, STOCK_GRADE_LABELS, stockAgeBucket } from '@feather/shared';
import { Alert, cx, DataTable, DetailList, Loading, Meter, Modal, StatusBadge, Tag } from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

export const SHELF_TONE = { fresh: 'good', soon: 'warn', expired: 'bad', none: 'neutral' };
const AGE_COLOR = { a0_30: 'bg-utility-green-500', a31_60: 'bg-utility-yellow-500', a61_90: 'bg-utility-orange-500', a90_plus: 'bg-utility-red-500' };
const MODE_ICON = { rail_rake: Train, river_barge: Anchor, coastal_ship: Anchor };

/** "12,400 bags · 85.200 MT" from { bag: 12400, MT: 85.2 }. */
export function qtyLine(totals, empty = '0') {
  const parts = Object.entries(totals)
    .filter(([, v]) => v)
    .sort(([a], [b]) => (a === 'bag' ? -1 : b === 'bag' ? 1 : 0))
    .map(([unit, v]) => formatQty(v, unit));
  return parts.length ? parts.join(' · ') : empty;
}

/** Adds qty into totals keyed by unit. */
export function addQty(totals, unit, qty) {
  totals[unit] = round((totals[unit] ?? 0) + qty);
  return totals;
}

/** Good stock per age bucket: { a0_30: qty, … }. */
export function ageSplit(lots) {
  const out = Object.fromEntries(STOCK_AGE_BUCKETS.map((b) => [b.key, 0]));
  for (const l of lots) {
    if (!(l.qty.prime > 0) || l.shelf.ageDays == null) continue;
    out[stockAgeBucket(l.shelf.ageDays).key] += l.qty.prime;
  }
  return out;
}

/** Stacked bar of stock by age. split = ageSplit(…). */
export function AgeBar({ split, className, size = 'md' }) {
  const total = Object.values(split).reduce((a, b) => a + b, 0);
  return (
    <div className={cx('flex w-full overflow-hidden rounded-full bg-quaternary', size === 'sm' ? 'h-2' : 'h-3', className)} role="img" aria-label="Stock by age">
      {total > 0 &&
        STOCK_AGE_BUCKETS.map((b) =>
          split[b.key] > 0 ? <div key={b.key} className={cx('h-full', AGE_COLOR[b.key])} style={{ width: `${(split[b.key] / total) * 100}%` }} title={`${b.label}: ${formatNumber(split[b.key], 0)}`} /> : null,
        )}
    </div>
  );
}

export function AgeLegend({ split, unit }) {
  const total = Object.values(split).reduce((a, b) => a + b, 0);
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {STOCK_AGE_BUCKETS.map((b) => (
        <li key={b.key} className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-tertiary">
            <span className={cx('size-2 shrink-0 rounded-full', AGE_COLOR[b.key])} aria-hidden />
            {b.label}
          </p>
          <p className="mt-0.5 text-md font-semibold text-primary tabular-nums">{formatQty(split[b.key], unit)}</p>
          <p className="text-xs text-tertiary tabular-nums">{total ? `${Math.round((split[b.key] / total) * 100)}%` : '—'}</p>
        </li>
      ))}
    </ul>
  );
}

/** Shipment paper number with its type, or "Older stock" for stock with no shipment. */
export function ShipmentLabel({ lot, showSeller = true }) {
  const s = lot.shipment;
  if (!s) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
          <Archive className="size-4" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-primary">Older stock</p>
          <p className="text-xs text-tertiary">No shipment paper</p>
        </div>
      </div>
    );
  }
  const Icon = MODE_ICON[s.mode] ?? Train;
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-primary">{s.referenceNo}</p>
        <p className="truncate text-xs text-tertiary">
          {s.referenceType}
          {showSeller && s.seller ? ` · ${s.seller}` : ''}
        </p>
      </div>
    </div>
  );
}

export function shelfText(shelf) {
  if (shelf.status === 'none') return shelf.ageDays != null ? `${shelf.ageDays} days old` : '—';
  if (shelf.status === 'expired') return `Expired ${-shelf.daysLeft} day${shelf.daysLeft === -1 ? '' : 's'} ago`;
  if (shelf.daysLeft === 0) return 'Last day';
  return `${shelf.daysLeft} day${shelf.daysLeft === 1 ? '' : 's'} left`;
}

/** Days of shelf life left with a meter. */
export function ShelfCell({ shelf, shelfLifeDays }) {
  if (shelf.status === 'none') return <span className="text-tertiary">{shelfText(shelf)}</span>;
  const tone = SHELF_TONE[shelf.status];
  return (
    <div className="w-36">
      <p className={cx('text-sm font-medium', tone === 'bad' ? 'text-error-primary' : tone === 'warn' ? 'text-warning-primary' : 'text-primary')}>{shelfText(shelf)}</p>
      <Meter className="mt-1.5" value={Math.max(0, shelf.daysLeft)} max={shelfLifeDays} tone={tone} />
    </div>
  );
}

/** FIFO position: "Next out" for the first lot of good stock in its warehouse + product. */
export function FifoTag({ rank }) {
  if (!rank) return <span className="text-quaternary">—</span>;
  if (rank === 1) return <Tag tone="brand">Next out</Tag>;
  return <span className="font-medium text-tertiary tabular-nums">#{rank}</span>;
}

/** What is left in the other grades, e.g. "+12 discount · 3 rejected". */
export function otherGrades(qty) {
  const parts = [];
  if (qty.seconds) parts.push(`${formatNumber(qty.seconds, 3)} ${STOCK_GRADE_LABELS.seconds.toLowerCase()}`);
  if (qty.rejected) parts.push(`${formatNumber(qty.rejected, 3)} ${STOCK_GRADE_LABELS.rejected.toLowerCase()}`);
  return parts.length ? `+ ${parts.join(' · ')}` : null;
}

const REASON_TEXT = {
  receipt: () => 'Received from truck',
  dispatch: (m) => `Sent to ${m.customer ?? m.destination ?? 'customer'}`,
  cancel: () => 'Trip cancelled, put back',
  correction: () => 'Owner weight correction',
  adjustment: () => 'Stock count accepted',
};

/** Everything about one shipment lot in one warehouse, with every in / out. */
export function LotModal({ lot, shelfLifeDays, onClose }) {
  const navigate = useNavigate();
  const { data, isLoading } = useGet(lot ? '/stock/lots/ledger' : null, lot ? { location: lot.location._id, material: lot.material._id, lot: lot.lot ?? 'none' } : undefined);
  if (!lot) return null;
  const unit = lot.unit;
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={[lot.stockId && `Stock ${lot.stockId}`, lot.shipment ? `${lot.shipment.referenceType} ${lot.shipment.referenceNo}` : 'Older stock'].filter(Boolean).join(' · ')}
      description={`${lot.material.name} at ${lot.location.name}`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={SHELF_TONE[lot.shelf.status]}>{lot.shelf.status === 'none' ? shelfText(lot.shelf) : SHELF_STATUS_LABELS[lot.shelf.status]}</StatusBadge>
          {lot.fifoRank && <FifoTag rank={lot.fifoRank} />}
          {lot.fifoRank > 1 && <span className="text-sm text-tertiary">in the queue for this warehouse</span>}
        </div>
        <DetailList
          columns={3}
          items={[
            ['Manufactured', lot.manufacturedAt ? formatDate(lot.manufacturedAt) : <span className="text-warning-primary">Not entered</span>],
            lot.shelf.expiresAt ? ['Shelf life ends', `${formatDate(lot.shelf.expiresAt)} (${shelfText(lot.shelf)})`] : ['Age', shelfText(lot.shelf)],
            ['Arrived', formatDate(lot.arrivedAt)],
            lot.shipment && ['Invoice no.', lot.shipment.invoiceNo ?? '—'],
            lot.shipment?.seller ? ['Seller', lot.shipment.seller] : ['First truck in', formatDateTime(lot.firstInAt)],
            ['Received here', formatQty(lot.receivedQty, unit)],
            ['Sent out', formatQty(lot.sentQty, unit)],
            ['Count / corrections', lot.adjustedQty ? `${lot.adjustedQty > 0 ? '+' : ''}${formatQty(lot.adjustedQty, unit)}` : '—'],
            [`Left — ${STOCK_GRADE_LABELS.prime}`, formatQty(lot.qty.prime, unit)],
            [`Left — ${STOCK_GRADE_LABELS.seconds}`, formatQty(lot.qty.seconds, unit)],
            [`Left — ${STOCK_GRADE_LABELS.rejected}`, formatQty(lot.qty.rejected, unit)],
          ]}
        />
        {lot.shipment && !lot.manufacturedAt && (
          <Alert tone="warning" title="No date of manufacturing on this shipment">
            Shelf life is counted from the day it arrived, so the cement may be older than shown. Add the date on the shipment (from the seller&apos;s bill or the bag print).
          </Alert>
        )}
        {lot.shelf.status !== 'none' && (
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-tertiary">
              <span>{lot.manufacturedAt ? 'Manufactured' : 'Arrived'}</span>
              <span>{shelfLifeDays} days</span>
            </div>
            <Meter value={Math.min(lot.shelf.ageDays, shelfLifeDays)} max={shelfLifeDays} tone={SHELF_TONE[lot.shelf.status]} />
          </div>
        )}
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            dense
            label="In and out"
            rows={data?.items}
            onRowClick={(m) => m.trip?._id && navigate(`/trips/${m.trip._id}`)}
            empty="No entries for this shipment yet."
            columns={[
              { key: 'at', header: 'When', render: (m) => formatDateTime(m.at) },
              {
                key: 'what',
                header: 'What',
                render: (m) => (
                  <div>
                    <p className="text-primary">{(REASON_TEXT[m.reason] ?? (() => m.reason))(m)}</p>
                    <p className="max-w-xs truncate text-xs text-tertiary">{[m.by, m.note].filter(Boolean).join(' · ')}</p>
                  </div>
                ),
              },
              { key: 'trip', header: 'Trip', render: (m) => (m.trip?.tripNo ? <span className="text-secondary">{m.trip.challanNo ?? m.trip.tripNo}</span> : '—') },
              { key: 'grade', header: 'Grade', render: (m) => STOCK_GRADE_LABELS[m.grade] },
              {
                key: 'qty',
                header: 'Quantity',
                align: 'right',
                render: (m) => (
                  <span className={cx('font-medium', m.qty < 0 ? 'text-error-primary' : 'text-success-primary')}>
                    {m.qty > 0 ? '+' : '−'}
                    {formatQty(Math.abs(m.qty), m.unit)}
                  </span>
                ),
              },
            ]}
          />
        )}
        {!lot.shipment && <p className="text-sm text-tertiary">Older stock came in before stock was tracked by shipment. It goes out first.</p>}
      </div>
    </Modal>
  );
}