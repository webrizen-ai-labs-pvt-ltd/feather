import { AlertTriangle, Archive, Building07, CheckCircle, Clock, Download01, Hourglass03 } from '@untitledui/icons';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDate, formatDateTime, formatNumber, formatPct, formatQty, round, SHELF_STATUS_LABELS, STOCK_GRADE_LABELS } from '@feather/shared';
import { Alert, Button, Card, CardHeader, ConfirmDialog, cx, DataTable, EmptyState, Loading, MetricCard, PageHeader, Segmented, SelectField, StatusBadge, Tabs, useApi } from '@feather/ui';
import { addQty, AgeBar, AgeLegend, ageSplit, FifoTag, LotModal, otherGrades, qtyLine, ShelfCell, shelfText, ShipmentLabel } from '@/components/Inventory.jsx';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';

const GRADE_TONE = { prime: 'good', seconds: 'warn', rejected: 'bad' };
/** Headline figure: bags when there are any (cement), else MT; restQty = the other unit for the line below. */
const mainQty = (totals) => (totals.bag ? formatQty(totals.bag, 'bag') : totals.MT ? formatQty(totals.MT, 'MT') : '0');
const restQty = (totals) => (totals.bag && totals.MT ? `+ ${formatQty(totals.MT, 'MT')}` : null);
const SHELF_FILTERS = [
  { value: 'all', label: 'All stock' },
  { value: 'soon', label: SHELF_STATUS_LABELS.soon },
  { value: 'expired', label: SHELF_STATUS_LABELS.expired },
];

export default function StockPage() {
  const [params, setParams] = useSearchParams();
  const warehouse = params.get('warehouse') ?? 'all';
  const product = params.get('product') ?? 'all';
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const location = warehouse === 'all' ? undefined : warehouse;
  const material = product === 'all' ? undefined : product;

  const { data: lotData, isLoading } = useGet('/stock/lots', { location, material });
  const { data: recon } = useGet('/stock/reconciliation', { location });
  const { data: counts } = useGet('/stock/counts', { location });
  const { data: yards } = useGet('/masters/locations', { type: 'stockyard', active: 'all' });
  const { data: materials } = useGet('/masters/materials', { active: 'all' });
  const api = useApi();

  const [shelfFilter, setShelfFilter] = useState('all');
  const [openLot, setOpenLot] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const adjust = useAction((a, { id, reason }) => a.post(`/stock/counts/${id}/adjust`, { reason }), {
    success: 'Count accepted. System stock updated.',
    invalidate: ['/stock', '/admin'],
    onSuccess: () => setAdjusting(null),
  });

  const lots = lotData?.items ?? [];
  const shelfLifeDays = lotData?.shelfLifeDays ?? 90;
  const warnDays = lotData?.shelfLifeWarnDays ?? 15;
  const allWarehouses = !location;
  const selectedYard = yards?.items.find((y) => y._id === warehouse);
  // Warehouses that are switched off are listed only while they still hold stock.
  const stockedYards = new Set(lots.map((l) => l.location._id));
  const warehouseOptions = [
    { value: 'all', label: 'All warehouses', icon: Building07 },
    ...(yards?.items ?? []).filter((y) => y.active || stockedYards.has(y._id) || y._id === warehouse).map((y) => ({ value: y._id, label: y.name })),
  ];

  const summary = useMemo(() => {
    const good = {};
    const soon = {};
    const expired = {};
    let soonLots = 0;
    let expiredLots = 0;
    for (const l of lots) {
      if (!(l.qty.prime > 0)) continue;
      addQty(good, l.unit, l.qty.prime);
      if (l.shelf.status === 'soon') (addQty(soon, l.unit, l.qty.prime), soonLots++);
      if (l.shelf.status === 'expired') (addQty(expired, l.unit, l.qty.prime), expiredLots++);
    }
    const withGood = lots.filter((l) => l.qty.prime > 0);
    return { good, soon, expired, soonLots, expiredLots, shipments: new Set(withGood.filter((l) => l.lot).map((l) => l.lot)).size };
  }, [lots]);

  // Age split is shown for bagged cement (the stock with a shelf life).
  const bagLots = lots.filter((l) => l.unit === 'bag');
  const split = ageSplit(bagLots);

  // One row per warehouse (all warehouses) or per product (one warehouse).
  const breakdown = useMemo(() => {
    const groups = new Map();
    for (const l of lots) {
      if (!(l.qty.prime > 0)) continue;
      const g = allWarehouses ? l.location : l.material;
      if (!groups.has(g._id)) groups.set(g._id, { id: g._id, name: g.name, lots: [], good: {}, oldest: null, flagged: 0 });
      const row = groups.get(g._id);
      row.lots.push(l);
      addQty(row.good, l.unit, l.qty.prime);
      if (l.shelf.ageDays != null && (row.oldest == null || l.shelf.ageDays > row.oldest)) row.oldest = l.shelf.ageDays;
      if (l.shelf.status === 'soon' || l.shelf.status === 'expired') row.flagged++;
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [lots, allWarehouses]);

  // Head of each first-in-first-out queue: what the yard should load next.
  const nextOut = lots.filter((l) => l.fifoRank === 1).sort((a, b) => (b.shelf.ageDays ?? 0) - (a.shelf.ageDays ?? 0));

  // Cement shipments in stock saved without a date of manufacturing: their shelf life is counted from arrival.
  const noMfgDate = [...new Map(lots.filter((l) => l.lot && l.shelfFrom === 'arrived' && l.shelf.status !== 'none').map((l) => [l.lot, l.shipment])).values()];
  const shownLots = shelfFilter === 'all' ? lots : lots.filter((l) => l.shelf.status === shelfFilter && l.qty.prime > 0);
  const countItems = counts?.items ?? [];
  const pending = countItems.filter((c) => !c.adjustedAt && !c.supersededBy).length;
  const mismatchPct = recon?.mismatchPct ?? 1;
  const reconItems = (recon?.items ?? []).filter((r) => !material || r.material._id === material);
  const mismatches = reconItems.filter((r) => r.lastCount && Math.abs(r.lastCount.diffPct ?? 0) > mismatchPct).length;

  return (
    <>
      <PageHeader
        help="owner-stock"
        title="Inventory"
        subtitle="Stock in your warehouses, by the shipment it came in. Shelf life runs from the date of manufacturing; the oldest goes out first."
        actions={
          <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/stock.xlsx', location ? { location } : undefined)}>
            Excel
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* One tap per warehouse when there are a few; a list on phones or when there are many. */}
        {warehouseOptions.length <= 6 && <Segmented size="md" className="hidden sm:flex" options={warehouseOptions} value={warehouse} onChange={(v) => setFilter('warehouse', v)} />}
        <SelectField
          size="sm"
          className={cx('w-full sm:w-64', warehouseOptions.length <= 6 && 'sm:hidden')}
          value={warehouse}
          onChange={(v) => setFilter('warehouse', v)}
          options={warehouseOptions.map(({ value, label }) => ({ value, label }))}
        />
        <SelectField size="sm" className="w-full sm:w-56" value={product} onChange={(v) => setFilter('product', v)} options={[{ value: 'all', label: 'All products' }, ...toOptions(materials?.items)]} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-6">
        <MetricCard
          icon={Archive}
          label={allWarehouses ? 'Good stock' : `Good stock · ${selectedYard?.name ?? ''}`}
          value={mainQty(summary.good)}
          sub={[restQty(summary.good), `${summary.shipments} shipment${summary.shipments === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
        />
        <MetricCard
          icon={Hourglass03}
          tone={summary.soonLots ? 'warn' : 'good'}
          label="Use first"
          value={mainQty(summary.soon)}
          sub={summary.soonLots ? `${summary.soonLots} lot${summary.soonLots === 1 ? '' : 's'} with ${warnDays} days or less left` : `Nothing within ${warnDays} days of shelf life`}
        />
        <MetricCard
          icon={AlertTriangle}
          tone={summary.expiredLots ? 'bad' : 'good'}
          label="Past shelf life"
          value={mainQty(summary.expired)}
          sub={summary.expiredLots ? `Over ${shelfLifeDays} days old — check before selling` : `Nothing over ${shelfLifeDays} days old`}
        />
        <MetricCard
          icon={CheckCircle}
          tone={pending ? 'warn' : 'good'}
          label="Counts waiting for you"
          value={pending}
          sub={mismatches ? `${mismatches} product line${mismatches === 1 ? '' : 's'} more than ${formatPct(mismatchPct, 1)} off` : 'All counts match'}
        />
      </div>

      {noMfgDate.length > 0 && (
        <Alert tone="warning" className="mb-6" title={`${noMfgDate.length} shipment${noMfgDate.length === 1 ? ' has' : 's have'} no date of manufacturing`}>
          Shelf life for {noMfgDate.length === 1 ? 'it' : 'them'} is counted from the day {noMfgDate.length === 1 ? 'it' : 'they'} arrived, so the cement may be older than shown:{' '}
          {noMfgDate.map((s, i) => (
            <span key={s._id}>
              {i > 0 && ', '}
              <a href={`/shipments/${s._id}`} className="font-medium text-primary underline">
                {s.referenceNo}
              </a>
            </span>
          ))}
          . Add the date from the seller&apos;s bill or the bag print.
        </Alert>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
            <Card className="lg:col-span-3">
              <CardHeader
                icon={Clock}
                title="Stock age"
                subtitle={bagLots.length ? `Good cement bags by days since manufacturing. Shelf life is ${shelfLifeDays} days.` : 'Shows once cement is received at a warehouse.'}
              />
              <div className="flex flex-col gap-6 px-4 py-5 md:px-6">
                <AgeBar split={split} />
                <AgeLegend split={split} unit="bag" />
              </div>
              {breakdown.length > 0 && (
                <ul className="divide-y divide-secondary border-t border-secondary">
                  {breakdown.map((g) => {
                    const gSplit = ageSplit(g.lots.filter((l) => l.unit === 'bag'));
                    const hasBags = Object.values(gSplit).some(Boolean);
                    const body = (
                      <>
                        <div className="min-w-0 sm:w-48">
                          <p className="flex items-center gap-2 truncate font-medium text-primary">
                            {allWarehouses && <Building07 className="size-4 shrink-0 text-fg-quaternary" aria-hidden />}
                            {g.name}
                          </p>
                          <p className="text-xs text-tertiary">
                            {g.oldest != null ? `Oldest ${g.oldest} days` : '—'}
                            {g.flagged ? ` · ${g.flagged} to clear` : ''}
                          </p>
                        </div>
                        <div className="flex-1">{hasBags ? <AgeBar split={gSplit} size="sm" /> : <p className="text-xs text-tertiary">Loose material, no shelf life</p>}</div>
                        <p className="text-sm font-semibold text-primary tabular-nums sm:w-40 sm:text-right">{qtyLine(g.good)}</p>
                      </>
                    );
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setFilter(allWarehouses ? 'warehouse' : 'product', g.id)}
                          className="flex w-full flex-col gap-2 px-4 py-3 text-left outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2 sm:flex-row sm:items-center sm:gap-4 md:px-6"
                        >
                          {body}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader icon={Archive} title="Send next" subtitle="Oldest shipment of each product in each warehouse. Tell the yard to load from these stacks." />
              {nextOut.length ? (
                <ul className="divide-y divide-secondary">
                  {nextOut.slice(0, 8).map((l) => (
                    <li key={l.key}>
                      <button type="button" onClick={() => setOpenLot(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2 md:px-6">
                        <div className="min-w-0 flex-1">
                          <ShipmentLabel lot={l} showSeller={false} />
                          <p className="mt-1 truncate pl-12 text-xs text-tertiary">
                            {l.stockId ? `${l.stockId} · ` : ''}
                            {l.material.name}
                            {allWarehouses ? ` · ${l.location.name}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-primary tabular-nums">{formatQty(l.qty.prime, l.unit)}</p>
                          <p className={cx('text-xs', l.shelf.status === 'expired' ? 'text-error-primary' : l.shelf.status === 'soon' ? 'text-warning-primary' : 'text-tertiary')}>{shelfText(l.shelf)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No good stock" icon={Archive}>
                  Stock shows here when trucks are received at a warehouse.
                </EmptyState>
              )}
            </Card>
          </div>

          <Tabs
            tabs={[
              {
                label: 'Stock by shipment',
                count: lots.length || undefined,
                content: (
                  <DataTable
                    title="Stock by shipment"
                    subtitle="Oldest manufactured first within each warehouse and product. Tap a shipment to see every truck in and out."
                    actions={<Segmented options={SHELF_FILTERS} value={shelfFilter} onChange={setShelfFilter} />}
                    rows={shownLots}
                    rowKey={(l) => l.stockId ?? l.key}
                    onRowClick={setOpenLot}
                    empty={shelfFilter === 'all' ? 'No stock yet. Stock appears when trucks are received at a warehouse.' : 'No stock in this group.'}
                    emptyIcon={Archive}
                    columns={[
                      {
                        key: 'stockId',
                        header: 'Stock ID',
                        sortable: true,
                        sortValue: (l) => l.stockId ?? '',
                        render: (l) => (l.stockId ? <span className="font-semibold text-primary tabular-nums">{l.stockId}</span> : <span className="text-quaternary">—</span>),
                      },
                      { key: 'fifo', header: 'Goes out', render: (l) => <FifoTag rank={l.fifoRank} /> },
                      { key: 'ref', header: 'Shipment paper no.', sortable: true, sortValue: (l) => l.shipment?.referenceNo ?? '', render: (l) => <ShipmentLabel lot={l} /> },
                      {
                        key: 'invoice',
                        header: 'Invoice no.',
                        sortable: true,
                        sortValue: (l) => l.shipment?.invoiceNo ?? '',
                        render: (l) => (l.shipment?.invoiceNo ? <span className="text-primary">{l.shipment.invoiceNo}</span> : <span className="text-quaternary">—</span>),
                      },
                      {
                        key: 'made',
                        header: 'Date of manufacturing',
                        sortable: true,
                        sortValue: (l) => l.startedOn ?? '',
                        render: (l) =>
                          l.manufacturedAt ? (
                            <div>
                              <p className="text-primary">{formatDate(l.manufacturedAt)}</p>
                              <p className="text-xs text-tertiary">Arrived {formatDate(l.arrivedAt)}</p>
                            </div>
                          ) : l.shelf.status === 'none' ? (
                            // No shelf life (sand, aggregate): the date is only for reference.
                            <div>
                              <p className="text-tertiary">—</p>
                              <p className="text-xs text-tertiary">Arrived {formatDate(l.arrivedAt)}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium text-warning-primary">Not entered</p>
                              <p className="text-xs text-tertiary">Counting from arrival, {formatDate(l.arrivedAt)}</p>
                            </div>
                          ),
                      },
                      ...(allWarehouses ? [{ key: 'loc', header: 'Warehouse', sortable: true, sortValue: (l) => l.location.name, render: (l) => l.location.name }] : []),
                      { key: 'mat', header: 'Product', sortable: true, sortValue: (l) => l.material.name, render: (l) => l.material.name },
                      {
                        key: 'left',
                        header: 'Left (good)',
                        align: 'right',
                        sortable: true,
                        sortValue: (l) => l.qty.prime,
                        render: (l) => (
                          <div>
                            <p className={cx('font-semibold', l.qty.prime < 0 ? 'text-error-primary' : 'text-primary')}>{formatQty(l.qty.prime, l.unit)}</p>
                            {otherGrades(l.qty) && <p className="text-xs text-tertiary">{otherGrades(l.qty)}</p>}
                          </div>
                        ),
                      },
                      { key: 'shelf', header: 'Shelf life', sortable: true, sortValue: (l) => l.shelf.daysLeft ?? Infinity, render: (l) => <ShelfCell shelf={l.shelf} shelfLifeDays={shelfLifeDays} /> },
                      { key: 'in', header: 'Received here', align: 'right', render: (l) => formatNumber(l.receivedQty, l.unit === 'bag' ? 0 : 3) },
                      { key: 'out', header: 'Sent out', align: 'right', render: (l) => formatNumber(l.sentQty, l.unit === 'bag' ? 0 : 3) },
                    ]}
                  />
                ),
              },
              {
                label: 'System vs counted',
                count: mismatches || undefined,
                content: (
                  <DataTable
                    title="System vs counted"
                    subtitle={`Totals per product and grade. Red when the last count was more than ${formatPct(mismatchPct, 1)} off.`}
                    rows={reconItems}
                    rowKey={(r) => `${r.location._id}${r.material._id}${r.grade}`}
                    empty="No stock yet."
                    emptyIcon={Archive}
                    columns={[
                      ...(allWarehouses ? [{ key: 'loc', header: 'Warehouse', sortable: true, sortValue: (r) => r.location.name, render: (r) => <span className="font-medium text-primary">{r.location.name}</span> }] : []),
                      { key: 'mat', header: 'Product', sortable: true, sortValue: (r) => r.material.name, render: (r) => r.material.name },
                      { key: 'grade', header: 'Grade', render: (r) => <StatusBadge tone={GRADE_TONE[r.grade]}>{STOCK_GRADE_LABELS[r.grade]}</StatusBadge> },
                      { key: 'book', header: 'System now', align: 'right', sortable: true, sortValue: (r) => r.qty, render: (r) => formatQty(r.qty, r.unit) },
                      { key: 'phys', header: 'Last count', align: 'right', render: (r) => (r.lastCount ? formatQty(r.lastCount.physicalQty, r.unit) : '—') },
                      {
                        key: 'diff',
                        header: 'Difference at count',
                        align: 'right',
                        render: (r) =>
                          r.lastCount ? (
                            <span className={cx('font-medium', Math.abs(r.lastCount.diffPct ?? 0) > mismatchPct ? 'text-error-primary' : 'text-secondary')}>
                              {formatNumber(round(r.lastCount.diffQty), 3)} ({r.lastCount.diffPct != null ? formatPct(r.lastCount.diffPct) : '—'})
                            </span>
                          ) : (
                            '—'
                          ),
                      },
                      { key: 'at', header: 'Counted', render: (r) => formatDateTime(r.lastCount?.at) },
                    ]}
                  />
                ),
              },
              {
                label: 'Stock counts',
                count: pending || undefined,
                content: (
                  <DataTable
                    title="Stock counts"
                    subtitle="Accepting a count posts the difference found on the day of counting. Shortages come out of the oldest shipment."
                    dense
                    rows={countItems}
                    empty="No counts yet. Receiving staff enter them from the Operations app."
                    columns={[
                      { key: 'at', header: 'When', render: (c) => formatDateTime(c.createdAt) },
                      { key: 'by', header: 'Counted by', render: (c) => c.countedBy?.name },
                      ...(allWarehouses ? [{ key: 'loc', header: 'Warehouse', render: (c) => c.location?.name }] : []),
                      { key: 'mat', header: 'Product', render: (c) => c.material?.name },
                      { key: 'grade', header: 'Grade', render: (c) => STOCK_GRADE_LABELS[c.grade] },
                      { key: 'phys', header: 'Counted', align: 'right', render: (c) => formatNumber(c.physicalQty, 3) },
                      { key: 'book', header: 'System then', align: 'right', render: (c) => formatNumber(c.bookQty, 3) },
                      {
                        key: 'diff',
                        header: 'Difference',
                        align: 'right',
                        render: (c) => (
                          <span className={cx(Math.abs(c.diffPct ?? 0) > mismatchPct && 'font-medium text-error-primary')}>
                            {formatNumber(c.diffQty, 3)} ({c.diffPct != null ? formatPct(c.diffPct) : '—'})
                          </span>
                        ),
                      },
                      {
                        key: 'act',
                        header: '',
                        align: 'right',
                        render: (c) =>
                          c.adjustedAt ? (
                            <StatusBadge tone="good">Accepted</StatusBadge>
                          ) : c.supersededBy ? (
                            <StatusBadge>Newer count exists</StatusBadge>
                          ) : (
                            <Button size="sm" color="secondary" iconLeading={CheckCircle} onPress={() => setAdjusting(c)}>
                              Accept count
                            </Button>
                          ),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </>
      )}

      <LotModal lot={openLot} shelfLifeDays={shelfLifeDays} onClose={() => setOpenLot(null)} />
      <ConfirmDialog
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        needReason
        loading={adjust.isPending}
        title="Accept this stock count?"
        message={
          adjusting
            ? `System stock will change by ${formatNumber(adjusting.diffQty, 3)} ${adjusting.material?.unit === 'bag' ? 'bags' : adjusting.material?.unit ?? ''} — the difference found on ${formatDate(adjusting.createdAt)}. Trucks in or out since then are kept. The change is saved with your reason.`
            : ''
        }
        confirmLabel="Accept count"
        onConfirm={(reason) => adjust.mutate({ id: adjusting._id, reason })}
      />
    </>
  );
}