import { useState } from 'react';
import { formatDateTime, ROLE_LABELS } from '@feather/shared';
import { Button, Card, DataTable, Loading, Modal, PageHeader } from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useGet('/admin/audit', { page, limit: 50 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change, override and correction — who did it, when and why. Nothing here can be edited or deleted." />
      <Card>
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            dense
            rows={data?.items}
            onRowClick={setOpen}
            columns={[
              { key: 'at', header: 'When', render: (a) => formatDateTime(a.createdAt) },
              { key: 'who', header: 'Who', render: (a) => `${a.actorName ?? '—'} (${ROLE_LABELS[a.actorRole] ?? a.actorRole ?? ''})` },
              { key: 'action', header: 'Action', render: (a) => <code className="text-xs">{a.action}</code> },
              { key: 'reason', header: 'Reason', className: 'max-w-md truncate', render: (a) => a.reason ?? '—' },
            ]}
          />
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-ink-600">Page {page} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
      {open && (
        <Modal open size="lg" onClose={() => setOpen(null)} title={open.action} description={`${open.actorName} · ${formatDateTime(open.createdAt)} · IP ${open.ip ?? '—'}`}>
          {open.reason && <p className="mb-3 text-sm"><b>Reason:</b> {open.reason}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-ink-500">Before</p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-ink-50 p-3 text-xs">{JSON.stringify(open.before ?? null, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-ink-500">After</p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-ink-50 p-3 text-xs">{JSON.stringify(open.after ?? null, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
