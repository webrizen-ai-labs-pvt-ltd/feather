import { Archive, CheckCircle, Download01 } from '@untitledui/icons';
import { useState } from 'react';
import { formatDateTime, formatNumber, formatPct, round, STOCK_GRADE_LABELS } from '@feather/shared';
import { Button, ConfirmDialog, cx, DataTable, Loading, MetricCard, PageHeader, StatusBadge, Tabs, useApi } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const GRADE_TONE = { prime: 'good', seconds: 'warn', rejected: 'bad' };

export default function StockPage() {
  const { data, isLoading } = useGet('/stock/reconciliation');
  const { data: counts } = useGet('/stock/counts');
  const [adjusting, setAdjusting] = useState(null);
  const api = useApi();
  const adjust = useAction((a, { id, reason }) => a.post(`/stock/counts/${id}/adjust`, { reason }), {
    success: 'System stock now matches the counted stock',
    invalidate: ['/stock', '/admin'],
    onSuccess: () => setAdjusting(null),
  });
  const items = data?.items ?? [];
  const warehouses = new Set(items.map((r) => r.location._id)).size;
  const mismatches = items.filter((r) => r.lastCount && Math.abs(r.lastCount.diffPct ?? 0) > 1).length;
  const pending = (counts?.items ?? []).filter((c) => !c.adjustedAt).length;

  return (
    <>
      <PageHeader
        help="owner-stock"
        title="Inventory"
        subtitle="System stock is worked out from every truck in and out. Warehouse staff count stock without seeing the system figure."
        actions={
          <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/stock.xlsx')}>
            Excel
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
        <MetricCard icon={Archive} label="Warehouses with stock" value={warehouses} sub={`${items.length} product lines`} />
        <MetricCard label="Counts that don't match" tone={mismatches ? 'bad' : 'good'} value={mismatches} sub="More than 1% off at last count" />
        <MetricCard label="Counts waiting for you" tone={pending ? 'warn' : 'good'} value={pending} sub="Accept or ignore each one" />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <Tabs
          tabs={[
            {
              label: 'System vs counted',
              content: (
                <DataTable
                  title="System vs counted"
                  rows={items}
                  rowKey={(r) => `${r.location._id}${r.material._id}${r.grade}`}
                  empty="No stock yet. Stock appears when trucks are received at a warehouse."
                  emptyIcon={Archive}
                  columns={[
                    { key: 'loc', header: 'Warehouse', sortable: true, sortValue: (r) => r.location.name, render: (r) => <span className="font-medium text-primary">{r.location.name}</span> },
                    { key: 'mat', header: 'Product', sortable: true, sortValue: (r) => r.material.name, render: (r) => r.material.name },
                    { key: 'grade', header: 'Grade', render: (r) => <StatusBadge tone={GRADE_TONE[r.grade]}>{STOCK_GRADE_LABELS[r.grade]}</StatusBadge> },
                    { key: 'book', header: 'System now', align: 'right', sortable: true, sortValue: (r) => r.qty, render: (r) => `${formatNumber(r.qty, 3)} ${r.unit}` },
                    { key: 'phys', header: 'Last count', align: 'right', render: (r) => (r.lastCount ? `${formatNumber(r.lastCount.physicalQty, 3)} ${r.unit}` : '—') },
                    {
                      key: 'diff',
                      header: 'Difference at count',
                      align: 'right',
                      render: (r) =>
                        r.lastCount ? (
                          <span className={cx('font-medium', Math.abs(r.lastCount.diffPct ?? 0) > 1 ? 'text-error-primary' : 'text-secondary')}>
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
                  subtitle="Accept a count to set the system stock to what was found in the warehouse."
                  dense
                  rows={counts?.items}
                  empty="No counts yet. Receiving staff enter them from the Operations app."
                  columns={[
                    { key: 'at', header: 'When', render: (c) => formatDateTime(c.createdAt) },
                    { key: 'by', header: 'Counted by', render: (c) => c.countedBy?.name },
                    { key: 'loc', header: 'Warehouse', render: (c) => c.location?.name },
                    { key: 'mat', header: 'Product', render: (c) => c.material?.name },
                    { key: 'grade', header: 'Grade', render: (c) => STOCK_GRADE_LABELS[c.grade] },
                    { key: 'phys', header: 'Counted', align: 'right', render: (c) => formatNumber(c.physicalQty, 3) },
                    { key: 'book', header: 'System then', align: 'right', render: (c) => formatNumber(c.bookQty, 3) },
                    { key: 'diff', header: 'Difference', align: 'right', render: (c) => `${formatNumber(c.diffQty, 3)} (${c.diffPct != null ? formatPct(c.diffPct) : '—'})` },
                    {
                      key: 'act',
                      header: '',
                      align: 'right',
                      render: (c) =>
                        c.adjustedAt ? (
                          <StatusBadge tone="good">Accepted</StatusBadge>
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
      )}
      <ConfirmDialog
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        needReason
        loading={adjust.isPending}
        title="Accept this stock count?"
        message="System stock will be changed to the counted quantity. The change is saved with your reason."
        confirmLabel="Accept count"
        onConfirm={(reason) => adjust.mutate({ id: adjusting._id, reason })}
      />
    </>
  );
}
