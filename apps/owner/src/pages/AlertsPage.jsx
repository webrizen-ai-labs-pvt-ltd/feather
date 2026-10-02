import { AlertCircle, AlertTriangle, BellRinging01, CheckDone01, ChevronRight, InfoCircle } from '@untitledui/icons';
import { useState } from 'react';
import { formatDateTime } from '@feather/shared';
import { Button, Card, cx, EmptyState, Loading, PageHeader, Segmented, StatusBadge } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const ICON = { critical: AlertCircle, warning: AlertTriangle, info: InfoCircle };
const ICON_TONE = { critical: 'bg-error-secondary text-fg-error-primary', warning: 'bg-warning-secondary text-fg-warning-primary', info: 'bg-tertiary text-fg-quaternary' };
const BADGE = { critical: ['bad', 'Urgent'], warning: ['warn', 'Check'], info: ['neutral', 'For info'] };

export default function AlertsPage() {
  const [unread, setUnread] = useState('true');
  const { data, isLoading } = useGet('/admin/alerts', { unread, limit: 100 });
  const markAll = useAction((api) => api.post('/admin/alerts/read', {}), { success: 'All marked as read', invalidate: ['/admin'] });
  const markOne = useAction((api, id) => api.post('/admin/alerts/read', { ids: [id] }), { invalidate: ['/admin'] });

  return (
    <>
      <PageHeader
        help="owner-alerts"
        title="Alerts"
        subtitle="Losses, damage, customers on hold, late fees and late trucks. Urgent ones are also emailed to you."
        actions={
          <Button color="secondary" iconLeading={CheckDone01} isLoading={markAll.isPending} onPress={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      <div className="mb-5">
        <Segmented
          value={unread}
          onChange={setUnread}
          options={[
            { value: 'true', label: 'Unread' },
            { value: 'false', label: 'All alerts' },
          ]}
        />
      </div>
      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.items.length ? (
          <EmptyState icon={BellRinging01} title="All clear">
            No alerts to show.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-secondary">
            {data.items.map((a) => {
              const Icon = ICON[a.severity] ?? InfoCircle;
              const [tone, label] = BADGE[a.severity] ?? BADGE.info;
              const link = a.trip ? [`/trips/${a.trip._id}`, `Open trip ${a.trip.tripNo}`] : a.customer ? [`/customers/${a.customer._id}`, a.customer.name] : a.consignment ? [`/shipments/${a.consignment}`, 'Open shipment'] : null;
              return (
                <li key={a._id} className={cx('flex gap-4 px-5 py-5 md:px-6', a.readAt && 'opacity-60')}>
                  <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', ICON_TONE[a.severity])}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-primary">{a.title}</p>
                      <StatusBadge tone={tone}>{label}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-tertiary">{a.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <span className="text-xs text-quaternary">{formatDateTime(a.createdAt)}</span>
                      {link && (
                        <Button size="sm" color="link-color" href={link[0]} iconTrailing={ChevronRight}>
                          {link[1]}
                        </Button>
                      )}
                    </div>
                  </div>
                  {!a.readAt && (
                    <Button size="sm" color="tertiary" onPress={() => markOne.mutate(a._id)}>
                      Mark read
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
