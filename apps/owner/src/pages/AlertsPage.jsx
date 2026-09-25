import { CheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime } from '@feather/shared';
import { Badge, Button, Card, EmptyState, Loading, PageHeader, SelectField } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const TONE = { critical: 'bad', warning: 'warn', info: 'info' };

export default function AlertsPage() {
  const [unread, setUnread] = useState('true');
  const { data, isLoading } = useGet('/admin/alerts', { unread, limit: 100 });
  const markAll = useAction((api) => api.post('/admin/alerts/read', {}), { success: 'All marked as read', invalidate: ['/admin'] });
  const markOne = useAction((api, id) => api.post('/admin/alerts/read', { ids: [id] }), { invalidate: ['/admin'] });

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Losses, damage, credit blocks, demurrage risk and delays. Serious ones are also emailed to you."
        actions={
          <>
            <div className="w-44">
              <SelectField value={unread} onChange={setUnread} options={[{ value: 'true', label: 'Unread only' }, { value: 'false', label: 'All alerts' }]} />
            </div>
            <Button variant="secondary" icon={CheckIcon} loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
          </>
        }
      />
      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.items.length ? (
          <EmptyState icon={CheckIcon} title="All clear">No alerts to show.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.items.map((a) => (
              <li key={a._id} className={a.readAt ? 'px-4 py-4 opacity-70 sm:px-5' : 'px-4 py-4 sm:px-5'}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[a.severity]}>{a.severity}</Badge>
                      <p className="font-semibold text-ink-900">{a.title}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{a.message}</p>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {formatDateTime(a.createdAt)}
                      {a.trip && (
                        <>
                          {' · '}
                          <Link className="font-medium text-brand-700 underline" to={`/trips/${a.trip._id}`}>Open trip {a.trip.tripNo}</Link>
                        </>
                      )}
                      {a.customer && (
                        <>
                          {' · '}
                          <Link className="font-medium text-brand-700 underline" to={`/customers/${a.customer._id}`}>{a.customer.name}</Link>
                        </>
                      )}
                      {a.consignment && (
                        <>
                          {' · '}
                          <Link className="font-medium text-brand-700 underline" to={`/consignments/${a.consignment}`}>Open rake / ship</Link>
                        </>
                      )}
                    </p>
                  </div>
                  {!a.readAt && (
                    <Button size="sm" variant="ghost" onClick={() => markOne.mutate(a._id)}>Mark read</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
