import { ArrowPathIcon, ChevronRightIcon, MagnifyingGlassIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime, formatVehicleNo, normalizeVehicleNo } from '@feather/shared';
import { Button, Card, EmptyState, Loading, TextField } from '@feather/ui';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

export default function ArrivalsPage() {
  const { data, isLoading, refetch, isFetching } = useCachedGet('/trips/arrivals', undefined, { refetchInterval: 60_000 });
  const { items: outbox } = useOutbox();
  const [q, setQ] = useState('');
  // Hide trucks already received on this phone but still waiting in the outbox.
  const waiting = new Set(outbox.filter((o) => o.path.endsWith('/receive')).map((o) => o.path.split('/')[2]));
  const needle = normalizeVehicleNo(q);
  const trips = (data?.items ?? []).filter((t) => !waiting.has(t._id) && (!needle || t.vehicleNo.includes(needle)));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Trucks coming in</h1>
          <p className="text-sm text-ink-500">Tap a truck when it reaches your weighbridge.</p>
        </div>
        <Button variant="secondary" icon={ArrowPathIcon} loading={isFetching} onClick={() => refetch()} aria-label="Refresh" />
      </div>
      <TextField big placeholder="Search truck number" value={q} onChange={(e) => setQ(e.target.value)} suffix={<MagnifyingGlassIcon className="size-5" />} />
      {isLoading ? (
        <Loading />
      ) : !trips.length ? (
        <Card>
          <EmptyState icon={TruckIcon} title={needle ? 'No truck with this number' : 'No trucks on the way'}>
            {needle ? 'Check the number, or ask dispatch if the truck was entered at loading.' : 'New trucks appear here when they are loaded.'}
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2">
          {trips.map((t) => (
            <li key={t._id}>
              <Link to={`/gate/receive/${t._id}`} state={{ trip: t }} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-xs ring-1 ring-ink-200 active:bg-brand-50">
                <TruckIcon className="size-8 shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold tracking-wide">{formatVehicleNo(t.vehicleNo)}</p>
                  <p className="truncate text-sm text-ink-600">
                    {t.material?.name} · from {t.sourceLocation?.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    Left {formatDateTime(t.loading?.at)} · {t.transporter?.name} · {t.driverName}
                  </p>
                </div>
                <ChevronRightIcon className="size-6 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
