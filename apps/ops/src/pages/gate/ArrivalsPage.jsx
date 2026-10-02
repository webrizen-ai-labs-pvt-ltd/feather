import { ChevronRight, MarkerPin01, PackageCheck, RefreshCw01, SearchLg, Truck01 } from '@untitledui/icons';
import { useState } from 'react';
import { Link as AriaLink } from 'react-aria-components';
import { formatDateTime, formatHours, formatVehicleNo, normalizeVehicleNo } from '@feather/shared';
import { Button, cx, EmptyState, Loading, PageHeader, StatusBadge, TextField } from '@feather/ui';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

/** Incoming trucks, shown like parcels "arriving today". */
export default function ArrivalsPage() {
  const { data, isLoading, refetch, isFetching } = useCachedGet('/trips/arrivals', undefined, { refetchInterval: 60_000 });
  const { items: outbox } = useOutbox();
  const [q, setQ] = useState('');
  // Hide trucks already received on this phone but still waiting in the outbox.
  const waiting = new Set(outbox.filter((o) => o.path.endsWith('/receive')).map((o) => o.path.split('/')[2]));
  const needle = normalizeVehicleNo(q);
  const trips = (data?.items ?? []).filter((t) => !waiting.has(t._id) && (!needle || t.vehicleNo.includes(needle)));

  return (
    <>
      <PageHeader
        help="arrivals"
        title="Incoming trucks"
        subtitle="Tap a truck when it reaches your weighbridge."
        actions={
          <Button color="secondary" iconLeading={RefreshCw01} isLoading={isFetching} onPress={() => refetch()}>
            Refresh
          </Button>
        }
      />
      <TextField size="lg" icon={SearchLg} placeholder="Search truck number" aria-label="Search truck number" value={q} onChange={setQ} className="mb-5" />

      {isLoading ? (
        <Loading />
      ) : !trips.length ? (
        <EmptyState icon={PackageCheck} title={needle ? 'No truck with this number' : 'No trucks on the way'}>
          {needle ? 'Check the number, or ask dispatch if the truck was entered at loading.' : 'New trucks appear here when they are loaded.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {trips.map((t) => {
            const hours = (Date.now() - new Date(t.loading?.at)) / 3_600_000;
            const late = t.expectedTransitHours && hours > t.expectedTransitHours;
            return (
              <li key={t._id}>
                <AriaLink
                  href={`/gate/receive/${t._id}`}
                  routerOptions={{ state: { trip: t } }}
                  className="group flex items-center gap-4 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary outline-focus-ring transition hover:shadow-md focus-visible:outline-2"
                >
                  <span className={cx('flex size-12 shrink-0 items-center justify-center rounded-full', late ? 'bg-warning-secondary text-fg-warning-primary' : 'bg-brand-primary text-fg-brand-primary')}>
                    <Truck01 className="size-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-wide text-primary">{formatVehicleNo(t.vehicleNo)}</p>
                      <StatusBadge tone={late ? 'warn' : 'info'}>{late ? 'Running late' : 'On the way'}</StatusBadge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-secondary">
                      <MarkerPin01 className="size-4 shrink-0" aria-hidden /> {t.material?.name} · from {t.sourceLocation?.name}
                    </p>
                    <p className="text-xs text-tertiary">
                      Left {formatDateTime(t.loading?.at)} · {formatHours(hours)} on road · {t.transporter?.name}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-fg-quaternary transition group-hover:translate-x-0.5" aria-hidden />
                </AriaLink>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
