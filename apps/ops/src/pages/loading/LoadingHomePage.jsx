import { ArrowUpTrayIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatQty, formatTime, formatVehicleNo } from '@feather/shared';
import { Button, Card, ConfirmDialog, DemurrageClock, EmptyState, Loading, TripStatusBadge, useAction, useAuth, useGet } from '@feather/ui';

export default function LoadingHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useGet('/consignments', { status: 'expected,placed' }, { refetchInterval: 60_000 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: trips } = useGet('/trips', { from: today.toISOString(), limit: 30 }, { refetchInterval: 60_000 });
  const [confirm, setConfirm] = useState(null);
  const act = useAction((api, { id, action }) => api.post(`/consignments/${id}/${action}`, {}), {
    success: 'Done',
    invalidate: ['/consignments'],
    onSuccess: () => setConfirm(null),
  });

  return (
    <div className="space-y-5">
      <Button size="xl" icon={ArrowUpTrayIcon} onClick={() => navigate('/loading/new')}>
        Load a truck
      </Button>

      <section>
        <h1 className="mb-2 text-lg font-bold">Rakes & ships at your siding</h1>
        {isLoading ? (
          <Loading />
        ) : !data?.items.length ? (
          <Card>
            <EmptyState icon={TruckIcon} title="No rake or ship right now">The office adds each rake when the RR is received.</EmptyState>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.items.map((c) => (
              <div key={c._id}>
                <DemurrageClock consignment={c} />
                <div className="mt-2 flex gap-2">
                  {c.status === 'expected' && (
                    <Button variant="secondary" className="flex-1" onClick={() => setConfirm({ id: c._id, action: 'place', ref: c.referenceNo })}>
                      Rake has arrived — start clock
                    </Button>
                  )}
                  {c.status === 'placed' && (
                    <Button variant="secondary" className="flex-1" onClick={() => setConfirm({ id: c._id, action: 'release', ref: c.referenceNo })}>
                      Rake empty — release
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Trucks loaded today</h2>
        <Card>
          {!trips?.items.length ? (
            <EmptyState title="No trucks yet today" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {trips.items.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{formatVehicleNo(t.vehicleNo)}</p>
                    <p className="truncate text-sm text-ink-500">
                      {formatTime(t.loading?.at)} · {formatQty(t.loading?.qty, t.unit)} → {t.destination?.name}
                    </p>
                  </div>
                  <TripStatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="mt-2 text-xs text-ink-500">Logged in as {user.name}.</p>
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        loading={act.isPending}
        title={confirm?.action === 'place' ? 'Start the free-time clock?' : 'Release this rake?'}
        message={
          confirm?.action === 'place'
            ? `Do this only when rake ${confirm?.ref} is placed at the siding. The time now is saved.`
            : `Do this only when rake ${confirm?.ref} is fully empty. No more trucks can load from it.`
        }
        confirmLabel="Yes, confirm"
        onConfirm={() => act.mutate(confirm)}
      />
    </div>
  );
}
