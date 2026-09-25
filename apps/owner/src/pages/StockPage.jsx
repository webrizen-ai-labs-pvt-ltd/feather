import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatDateTime, formatNumber, formatPct, STOCK_GRADE_LABELS } from '@feather/shared';
import { Badge, Button, Card, CardHeader, ConfirmDialog, DataTable, Loading, PageHeader, useApi } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

export default function StockPage() {
  const { data, isLoading } = useGet('/stock/reconciliation');
  const { data: counts } = useGet('/stock/counts');
  const [adjusting, setAdjusting] = useState(null);
  const api = useApi();
  const adjust = useAction((a, { id, reason }) => a.post(`/stock/counts/${id}/adjust`, { reason }), {
    success: 'Book stock now matches the physical count',
    invalidate: ['/stock', '/admin'],
    onSuccess: () => setAdjusting(null),
  });

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Book stock is worked out from every truck received and dispatched. Yard staff count physical stock without seeing the book figure."
        actions={
          <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/stock.xlsx')}>
            Excel
          </Button>
        }
      />
      <Card className="mb-6">
        <CardHeader title="Book vs physical" />
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={data?.items}
            rowKey={(r) => `${r.location._id}${r.material._id}${r.grade}`}
            empty="No stock yet. Stock appears when trucks are received at a stockyard."
            columns={[
              { key: 'loc', header: 'Yard', render: (r) => r.location.name },
              { key: 'mat', header: 'Material', render: (r) => r.material.name },
              { key: 'grade', header: 'Grade', render: (r) => <Badge tone={r.grade === 'prime' ? 'good' : r.grade === 'seconds' ? 'warn' : 'bad'}>{STOCK_GRADE_LABELS[r.grade]}</Badge> },
              { key: 'book', header: 'Book now', align: 'right', render: (r) => `${formatNumber(r.qty, 3)} ${r.unit}` },
              { key: 'phys', header: 'Last count', align: 'right', render: (r) => (r.lastCount ? `${formatNumber(r.lastCount.physicalQty, 3)} ${r.unit}` : '—') },
              {
                key: 'diff',
                header: 'Difference at count',
                align: 'right',
                render: (r) =>
                  r.lastCount ? (
                    <span className={Math.abs(r.lastCount.diffPct ?? 0) > 1 ? 'font-semibold text-red-700' : ''}>
                      {formatNumber(r.lastCount.diffQty, 3)} ({r.lastCount.diffPct != null ? formatPct(r.lastCount.diffPct) : '—'})
                    </span>
                  ) : (
                    '—'
                  ),
              },
              { key: 'at', header: 'Counted', render: (r) => formatDateTime(r.lastCount?.at) },
            ]}
          />
        )}
      </Card>
      <Card>
        <CardHeader title="Physical counts" subtitle="Accept a count to set the book stock to what was physically found." />
        <DataTable
          dense
          rows={counts?.items}
          empty="No counts yet. Gate inspectors enter them from the Operations app."
          columns={[
            { key: 'at', header: 'When', render: (c) => formatDateTime(c.createdAt) },
            { key: 'by', header: 'Counted by', render: (c) => c.countedBy?.name },
            { key: 'loc', header: 'Yard', render: (c) => c.location?.name },
            { key: 'mat', header: 'Material', render: (c) => c.material?.name },
            { key: 'grade', header: 'Grade', render: (c) => STOCK_GRADE_LABELS[c.grade] },
            { key: 'phys', header: 'Physical', align: 'right', render: (c) => formatNumber(c.physicalQty, 3) },
            { key: 'book', header: 'Book then', align: 'right', render: (c) => formatNumber(c.bookQty, 3) },
            { key: 'diff', header: 'Diff', align: 'right', render: (c) => `${formatNumber(c.diffQty, 3)} (${c.diffPct != null ? formatPct(c.diffPct) : '—'})` },
            {
              key: 'act',
              header: '',
              render: (c) =>
                c.adjustedAt ? (
                  <Badge tone="good">Accepted</Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setAdjusting(c)}>Accept count</Button>
                ),
            },
          ]}
        />
      </Card>
      <ConfirmDialog
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        needReason
        loading={adjust.isPending}
        title="Accept this physical count?"
        message="Book stock will be changed to the counted quantity. The change is saved as an adjustment with your reason."
        confirmLabel="Accept"
        onConfirm={(reason) => adjust.mutate({ id: adjusting._id, reason })}
      />
    </>
  );
}
