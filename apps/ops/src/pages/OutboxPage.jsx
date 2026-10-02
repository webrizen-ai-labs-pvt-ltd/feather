import { CheckCircle, Inbox01, RefreshCw01, Trash01 } from '@untitledui/icons';
import { useState } from 'react';
import { formatDateTime } from '@feather/shared';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, StatusBadge, useOnline } from '@feather/ui';
import { useOutbox } from '@/lib/outbox.jsx';

export default function OutboxPage() {
  const { items, flush, retry, remove } = useOutbox();
  const online = useOnline();
  const [deleting, setDeleting] = useState(null);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        help="offline"
        title="Saved on this phone"
        subtitle="Entries made without network. They are sent by themselves when the signal is back."
        actions={
          <Button color="secondary" iconLeading={RefreshCw01} isDisabled={!online || !items.length} onPress={flush}>
            Send now
          </Button>
        }
      />
      <Card>
        {!items.length ? (
          <EmptyState icon={CheckCircle} title="Nothing waiting">
            Everything has reached the office.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-secondary">
            {items.map((i) => (
              <li key={i.id} className="flex gap-4 px-5 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
                  <Inbox01 className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-primary">{i.label}</p>
                    {i.status === 'failed' ? <StatusBadge tone="bad">Not accepted</StatusBadge> : <StatusBadge tone="warn">Waiting</StatusBadge>}
                  </div>
                  <p className="text-xs text-tertiary">Saved {formatDateTime(i.createdAt)}</p>
                  {i.error && <p className="mt-1 text-sm text-error-primary">{i.error}</p>}
                  {i.status === 'failed' && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" color="secondary" iconLeading={RefreshCw01} onPress={() => retry(i.id)}>
                        Try again
                      </Button>
                      <Button size="sm" color="tertiary-destructive" iconLeading={Trash01} onPress={() => setDeleting(i)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
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
