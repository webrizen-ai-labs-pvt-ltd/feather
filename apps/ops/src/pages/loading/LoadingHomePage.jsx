import { Package, Play, Train, Truck01, Upload01 } from '@untitledui/icons';
import { useState } from 'react';
import { formatQty, formatTime, formatVehicleNo } from '@feather/shared';
import { Button, ConfirmDialog, DataTable, DemurrageClock, EmptyState, Loading, PageHeader, Section, TripStatusBadge, useAction, useAuth, useGet } from '@feather/ui';

export default function LoadingHomePage() {
  const { user } = useAuth();
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
    <>
      <PageHeader
        help="siding-rakes"
        title={`Hello, ${user.name?.split(' ')[0]}`}
        crumbLabel="Shipments"
        subtitle="Shipments at your unloading point, and trucks you loaded today."
        actions={
          <Button size="lg" iconLeading={Upload01} href="/loading/new" className="w-full sm:w-auto">
            Load a truck
          </Button>
        }
      />

      <Section title="Shipments at your unloading point">
        {isLoading ? (
          <Loading />
        ) : !data?.items.length ? (
          <EmptyState icon={Train} title="No shipment right now">
            The office adds each shipment when its paper (RR) arrives.
          </EmptyState>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {data.items.map((c) => (
              <div key={c._id} className="flex flex-col gap-3">
                <DemurrageClock consignment={c} />
                {c.status === 'expected' && (
                  <Button size="lg" color="secondary" iconLeading={Play} onPress={() => setConfirm({ id: c._id, action: 'place', ref: c.referenceNo })}>
                    Train has arrived — start timer
                  </Button>
                )}
                {c.status === 'placed' && (
                  <Button size="lg" color="secondary" iconLeading={Package} onPress={() => setConfirm({ id: c._id, action: 'release', ref: c.referenceNo })}>
                    All unloaded — finish
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <DataTable
        title="Trucks loaded today"
        badge={<span className="text-sm text-tertiary">{trips?.items.length ?? 0}</span>}
        dense
        rows={trips?.items}
        empty="No trucks yet today."
        emptyIcon={Truck01}
        columns={[
          { key: 'truck', header: 'Truck', render: (t) => <span className="font-medium text-primary">{formatVehicleNo(t.vehicleNo)}</span> },
          { key: 'time', header: 'Left at', render: (t) => formatTime(t.loading?.at) },
          { key: 'qty', header: 'Loaded', align: 'right', render: (t) => formatQty(t.loading?.qty, t.unit) },
          { key: 'to', header: 'Going to', render: (t) => t.destination?.name },
          { key: 'status', header: 'Status', render: (t) => <TripStatusBadge status={t.status} /> },
        ]}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        loading={act.isPending}
        icon={confirm?.action === 'place' ? Play : Package}
        title={confirm?.action === 'place' ? 'Start the free-hours timer?' : 'Finish this shipment?'}
        message={
          confirm?.action === 'place'
            ? `Do this only when shipment ${confirm?.ref} has arrived at the unloading point. The time now is saved.`
            : `Do this only when shipment ${confirm?.ref} is fully empty. No more trucks can load from it.`
        }
        confirmLabel="Yes, confirm"
        onConfirm={() => act.mutate(confirm)}
      />
    </>
  );
}
