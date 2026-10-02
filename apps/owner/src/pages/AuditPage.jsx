import { ClockRewind } from '@untitledui/icons';
import { useState } from 'react';
import { formatDateTime, ROLE_LABELS } from '@feather/shared';
import { Avatar, DataTable, Loading, Modal, PageHeader, Pager } from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const pretty = (action = '') => action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useGet('/admin/audit', { page, limit: 25 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        help="owner-settings"
        breadcrumbs={[{ label: 'Setup' }]}
        title="History"
        subtitle="Every change, special permission and correction — who did it, when and why. Nothing here can be edited or deleted."
      />
      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          title="All changes"
          badge={<span className="text-sm text-tertiary">{data?.total}</span>}
          rows={data?.items}
          onRowClick={setOpen}
          emptyIcon={ClockRewind}
          footer={<Pager page={page} pages={pages} onChange={setPage} />}
          columns={[
            { key: 'at', header: 'When', render: (a) => formatDateTime(a.createdAt) },
            {
              key: 'who',
              header: 'Who',
              render: (a) => (
                <div className="flex items-center gap-3">
                  <Avatar size="sm" initials={initials(a.actorName)} />
                  <div>
                    <p className="font-medium text-primary">{a.actorName ?? '—'}</p>
                    <p className="text-xs text-tertiary">{ROLE_LABELS[a.actorRole] ?? a.actorRole ?? ''}</p>
                  </div>
                </div>
              ),
            },
            { key: 'action', header: 'What', render: (a) => <span className="text-secondary">{pretty(a.action)}</span> },
            { key: 'reason', header: 'Reason', className: 'max-w-md truncate', render: (a) => a.reason ?? '—' },
          ]}
        />
      )}
      {open && (
        <Modal open size="lg" icon={ClockRewind} onClose={() => setOpen(null)} title={pretty(open.action)} description={`${open.actorName} · ${formatDateTime(open.createdAt)} · IP ${open.ip ?? '—'}`}>
          {open.reason && (
            <p className="mb-4 text-sm text-secondary">
              <span className="font-semibold">Reason:</span> {open.reason}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Before', open.before],
              ['After', open.after],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="mb-1.5 text-xs font-semibold text-tertiary uppercase">{label}</p>
                <pre className="max-h-80 overflow-auto rounded-lg bg-secondary p-3 font-mono text-xs text-secondary">{JSON.stringify(value ?? null, null, 2)}</pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
