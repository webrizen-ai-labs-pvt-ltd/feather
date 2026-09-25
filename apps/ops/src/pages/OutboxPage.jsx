import { ArrowPathIcon, CheckCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatDateTime } from '@feather/shared';
import { Badge, Button, Card, ConfirmDialog, EmptyState, useOnline } from '@feather/ui';
import { useOutbox } from '@/lib/outbox.jsx';

export default function OutboxPage() {
  const { items, flush, retry, remove } = useOutbox();
  const online = useOnline();
  const [deleting, setDeleting] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Saved on this phone</h1>
          <p className="text-sm text-ink-500">Entries made without network. They are sent automatically.</p>
        </div>
        <Button variant="secondary" icon={ArrowPathIcon} disabled={!online || !items.length} onClick={flush}>Send now</Button>
      </div>
      <Card>
        {!items.length ? (
          <EmptyState icon={CheckCircleIcon} title="Nothing waiting">Everything has reached the office.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((i) => (
              <li key={i.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.label}</p>
                    <p className="text-xs text-ink-500">Saved {formatDateTime(i.createdAt)}</p>
                    {i.error && <p className="mt-1 text-sm text-red-700">{i.error}</p>}
                  </div>
                  {i.status === 'failed' ? <Badge tone="bad">Not accepted</Badge> : <Badge tone="warn">Waiting</Badge>}
                </div>
                {i.status === 'failed' && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => retry(i.id)}>Try again</Button>
                    <Button size="sm" variant="ghost" icon={TrashIcon} onClick={() => setDeleting(i)}>Delete</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this saved entry?"
        message="It was not accepted by the office. Enter it again correctly after deleting."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          await remove(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
