import { AlertTriangle, File06, Phone, Plus, SlashCircle01, Tool01, Train, Truck01 } from '@untitledui/icons';
import { useState } from 'react';
import { CREDIT_REASON_LABELS, formatDateTime, formatHours, formatINR, formatNumber, formatVehicleNo } from '@feather/shared';
import {
  Alert,
  Button,
  Card,
  DataTable,
  DemurrageClock,
  EmptyState,
  ErrorNote,
  Loading,
  MetricCard,
  MiniTracker,
  Modal,
  PageHeader,
  Section,
  SelectField,
  StatusBadge,
  Tabs,
  TextAreaField,
  truckTracking,
  useAction,
  useGet,
} from '@feather/ui';

export default function DispatchBoardPage() {
  const { data: rakes, isLoading } = useGet('/consignments', { status: 'placed' }, { refetchInterval: 60_000 });
  const { data: delayed } = useGet('/trips/delayed', undefined, { refetchInterval: 60_000 });
  const { data: onRoad } = useGet('/trips', { status: 'in_transit', limit: 200 }, { refetchInterval: 60_000 });
  const [breakdown, setBreakdown] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const clear = useAction((api, id) => api.post(`/trips/${id}/breakdown/clear`, {}), { success: 'Breakdown cleared', invalidate: ['/trips'] });
  const unassigned = (onRoad?.items ?? []).filter((t) => t.source === 'consignment' && !t.order);
  const breakdowns = (delayed?.items ?? []).filter((t) => t.breakdown?.active).length;

  return (
    <>
      <PageHeader
        help="dispatch-board"
        title="Today"
        subtitle="Shipments being unloaded, late trucks and breakdowns — live."
        actions={
          <Button iconLeading={Plus} href="/dispatch/new">
            Send a truck
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <MetricCard icon={Train} label="Shipments unloading" value={rakes?.items.length ?? '—'} />
        <MetricCard icon={Truck01} label="Trucks on the road" value={onRoad?.items.length ?? '—'} />
        <MetricCard icon={AlertTriangle} label="Late trucks" tone={delayed?.items.length ? 'warn' : 'good'} value={delayed?.items.length ?? 0} />
        <MetricCard icon={Tool01} label="Breakdowns" tone={breakdowns ? 'bad' : 'good'} value={breakdowns} />
      </div>

      <Section title="Shipments being unloaded">
        {isLoading ? (
          <Loading />
        ) : !rakes?.items.length ? (
          <EmptyState icon={Train} title="No shipment is unloading now" />
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {rakes.items.map((c) => (
              <DemurrageClock key={c._id} consignment={c} showMoney />
            ))}
          </div>
        )}
      </Section>

      <Card className="p-4 sm:p-6">
        <Tabs
          tabs={[
            {
              label: 'Late & breakdowns',
              count: delayed?.items.length ?? 0,
              content: !delayed?.items.length ? (
                <EmptyState icon={Truck01} title="No late trucks" />
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {delayed.items.map((t) => (
                    <li key={t._id} className="rounded-xl p-4 ring-1 ring-secondary">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-primary">{formatVehicleNo(t.vehicleNo)}</p>
                            {t.breakdown?.active ? <StatusBadge tone="bad">Breakdown</StatusBadge> : <StatusBadge tone="warn">{formatHours(t.overdueHours)} late</StatusBadge>}
                          </div>
                          <p className="mt-0.5 text-sm text-secondary">
                            {t.sourceLocation?.name} → {t.destination?.name}
                          </p>
                          <p className="text-xs text-tertiary">
                            {t.transporter?.name} · on road {formatHours(t.hoursOnRoad)}
                          </p>
                          {t.breakdown?.active && <p className="mt-2 text-sm text-error-primary">{t.breakdown.note}</p>}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {t.driverPhone && (
                          <Button size="sm" color="secondary" iconLeading={Phone} href={`tel:${t.driverPhone}`}>
                            Call driver
                          </Button>
                        )}
                        {t.breakdown?.active ? (
                          <Button size="sm" color="secondary" onPress={() => clear.mutate(t._id)}>
                            Moving again
                          </Button>
                        ) : (
                          <Button size="sm" color="secondary-destructive" iconLeading={Tool01} onPress={() => setBreakdown(t)}>
                            Report breakdown
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              label: 'Send to customer',
              count: unassigned.length,
              content: (
                <DataTable
                  dense
                  rows={unassigned}
                  empty="All shipment trucks are assigned. Trucks going to the warehouse can be sent straight to a customer here."
                  columns={[
                    { key: 'truck', header: 'Truck', render: (t) => <span className="font-medium text-primary">{formatVehicleNo(t.vehicleNo)}</span> },
                    { key: 'what', header: 'Load', render: (t) => `${t.material?.name} · ${formatNumber(t.loading?.qty, 3)} ${t.unit}` },
                    { key: 'to', header: 'Going to', render: (t) => t.destination?.name },
                    { key: 'left', header: 'Left', render: (t) => formatDateTime(t.loading?.at) },
                    {
                      key: 'act',
                      header: '',
                      align: 'right',
                      render: (t) => (
                        <Button size="sm" iconLeading={File06} onPress={() => setAssigning(t)}>
                          Assign order
                        </Button>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              label: 'All on the road',
              count: onRoad?.items.length ?? 0,
              content: (
                <DataTable
                  dense
                  rows={onRoad?.items}
                  empty="No trucks on the road."
                  columns={[
                    {
                      key: 'truck',
                      header: 'Truck',
                      render: (t) => (
                        <div>
                          <p className="font-medium text-primary">{formatVehicleNo(t.vehicleNo)}</p>
                          <p className="text-xs text-tertiary">
                            {t.transporter?.name}
                            {t.challanNo && ` · ${t.challanNo}`}
                          </p>
                        </div>
                      ),
                    },
                    { key: 'route', header: 'From → To', render: (t) => `${t.sourceLocation?.name} → ${t.destination?.name}` },
                    {
                      key: 'track',
                      header: 'Tracking',
                      render: (t) => {
                        const k = truckTracking(t, { money: false });
                        return <MiniTracker steps={k.steps} current={k.current} tone={k.tone} />;
                      },
                    },
                    { key: 'left', header: 'Left', render: (t) => formatDateTime(t.loading?.at) },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      {breakdown && <BreakdownDialog trip={breakdown} onClose={() => setBreakdown(null)} />}
      {assigning && <AssignDialog trip={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
}

function BreakdownDialog({ trip, onClose }) {
  const [note, setNote] = useState('');
  const save = useAction((api) => api.post(`/trips/${trip._id}/breakdown`, { note }), { success: 'Breakdown reported', invalidate: ['/trips'], onSuccess: onClose });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      icon={Tool01}
      tone="error"
      title={`Breakdown — ${formatVehicleNo(trip.vehicleNo)}`}
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary-destructive" isLoading={save.isPending} isDisabled={note.trim().length < 3} onPress={() => save.mutate()}>
            Report
          </Button>
        </>
      }
    >
      <TextAreaField label="What happened and where?" placeholder="e.g. tyre burst near Km 42, driver waiting for mechanic" value={note} onChange={setNote} />
    </Modal>
  );
}

function AssignDialog({ trip, onClose }) {
  const { data: orders } = useGet('/sales/orders', { status: 'open' });
  const [order, setOrder] = useState('');
  const [error, setError] = useState(null);
  const materialId = trip.material?._id ?? trip.material;
  const matching = (orders?.items ?? []).filter((o) => (o.material?._id ?? o.material) === materialId);
  const save = useAction((api) => api.post(`/trips/${trip._id}/assign`, { order }), {
    success: (d) => `Delivery note ${d.item.challanNo} made`,
    invalidate: ['/trips'],
    onSuccess: onClose,
    onError: setError,
  });
  const blocked = error?.code === 'CREDIT_BLOCKED';
  return (
    <Modal
      open
      onClose={onClose}
      icon={File06}
      tone="brand"
      title={`Send ${formatVehicleNo(trip.vehicleNo)} to a customer`}
      description="The truck's destination changes to the order's site. Credit is checked first."
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} isDisabled={!order} onPress={() => (setError(null), save.mutate())}>
            Make delivery note
          </Button>
        </>
      }
    >
      <SelectField
        big
        label="Customer order"
        value={order}
        onChange={setOrder}
        placeholder={matching.length ? 'Choose order' : 'No open order for this product'}
        options={matching.map((o) => ({ value: o._id, label: `${o.orderNo} · ${o.customer?.name}`, hint: `${o.deliverySite?.name} · ${formatNumber(o.qty - o.dispatchedQty, 2)} left · ${formatINR(o.ratePerUnit)}/${o.material?.unit}` }))}
      />
      {blocked ? (
        <Alert className="mt-5" icon={SlashCircle01} title="Customer on hold">
          <p>{error.data?.reasons?.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>
          <p>
            Total owed {formatINR(error.data?.exposure)} of {formatINR(error.data?.creditLimit)} · overdue {formatINR(error.data?.overdueAmount)}
          </p>
          <p className="mt-1">Ask the owner to allow it anyway.</p>
        </Alert>
      ) : (
        <ErrorNote className="mt-5" error={error} />
      )}
    </Modal>
  );
}
