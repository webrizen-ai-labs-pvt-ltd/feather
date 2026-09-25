import { ExclamationTriangleIcon, PhoneIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { CREDIT_REASON_LABELS, formatDateTime, formatHours, formatINR, formatNumber, formatVehicleNo } from '@feather/shared';
import {
  Badge,
  Button,
  Card,
  DemurrageClock,
  EmptyState,
  ErrorNote,
  Loading,
  Modal,
  SelectField,
  Tabs,
  TextAreaField,
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

  return (
    <div className="space-y-5">
      <section>
        <h1 className="mb-2 text-xl font-bold">Rakes & ships unloading</h1>
        {isLoading ? (
          <Loading />
        ) : !rakes?.items.length ? (
          <Card>
            <EmptyState title="No rake is unloading now" />
          </Card>
        ) : (
          <div className="space-y-3">
            {rakes.items.map((c) => (
              <DemurrageClock key={c._id} consignment={c} showMoney />
            ))}
          </div>
        )}
      </section>

      <Card className="p-4">
        <Tabs
          tabs={[
            {
              label: 'Delayed',
              count: delayed?.items.length ?? 0,
              content: !delayed?.items.length ? (
                <EmptyState title="No delayed trucks" />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {delayed.items.map((t) => (
                    <li key={t._id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold">{formatVehicleNo(t.vehicleNo)}</p>
                          <p className="text-sm text-ink-600">
                            {t.sourceLocation?.name} → {t.destination?.name} · {t.transporter?.name}
                          </p>
                          <p className="text-sm text-ink-500">
                            On road {formatHours(t.hoursOnRoad)}
                            {t.overdueHours > 0 && <span className="font-semibold text-red-700"> ({formatHours(t.overdueHours)} late)</span>}
                          </p>
                          {t.breakdown?.active && (
                            <Badge tone="bad" className="mt-1">
                              Breakdown: {t.breakdown.note}
                            </Badge>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          {t.driverPhone && (
                            <a href={`tel:${t.driverPhone}`} className="inline-flex items-center gap-1 rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-semibold">
                              <PhoneIcon className="size-4" /> Call
                            </a>
                          )}
                          {t.breakdown?.active ? (
                            <Button size="sm" variant="secondary" onClick={() => clear.mutate(t._id)}>Moving again</Button>
                          ) : (
                            <Button size="sm" variant="secondary" icon={WrenchScrewdriverIcon} onClick={() => setBreakdown(t)}>Breakdown</Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              label: 'Send to customer',
              count: unassigned.length,
              content: !unassigned.length ? (
                <EmptyState title="All rake trucks are assigned">Trucks lifted from a rake to the yard can be sent straight to a customer order here.</EmptyState>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {unassigned.map((t) => (
                    <li key={t._id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-bold">{formatVehicleNo(t.vehicleNo)}</p>
                        <p className="truncate text-sm text-ink-600">
                          {t.material?.name} · {formatNumber(t.loading?.qty, 3)} {t.unit} · to {t.destination?.name}
                        </p>
                        <p className="text-xs text-ink-500">Left {formatDateTime(t.loading?.at)}</p>
                      </div>
                      <Button size="sm" onClick={() => setAssigning(t)}>Assign order</Button>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              label: 'All on road',
              count: onRoad?.items.length ?? 0,
              content: (
                <ul className="divide-y divide-ink-100">
                  {(onRoad?.items ?? []).map((t) => (
                    <li key={t._id} className="py-2.5 text-sm">
                      <span className="font-semibold">{formatVehicleNo(t.vehicleNo)}</span> · {t.sourceLocation?.name} → {t.destination?.name}
                      <span className="block text-xs text-ink-500">
                        {t.transporter?.name} · left {formatDateTime(t.loading?.at)}
                        {t.challanNo && ` · ${t.challanNo}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </Card>

      {breakdown && <BreakdownDialog trip={breakdown} onClose={() => setBreakdown(null)} />}
      {assigning && <AssignDialog trip={assigning} onClose={() => setAssigning(null)} />}
    </div>
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
      title={`Breakdown — ${formatVehicleNo(trip.vehicleNo)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={save.isPending} disabled={note.trim().length < 3} onClick={() => save.mutate()}>Report</Button>
        </>
      }
    >
      <TextAreaField label="What happened and where?" placeholder="e.g. tyre burst near Km 42, driver waiting for mechanic" value={note} onChange={(e) => setNote(e.target.value)} />
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
    success: (d) => `Challan ${d.item.challanNo} made`,
    invalidate: ['/trips'],
    onSuccess: onClose,
    onError: setError,
  });
  const blocked = error?.code === 'CREDIT_BLOCKED';
  return (
    <Modal
      open
      onClose={onClose}
      title={`Send ${formatVehicleNo(trip.vehicleNo)} to a customer`}
      description="The truck's destination changes to the order's site. Credit is checked first."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!order} onClick={() => (setError(null), save.mutate())}>Make challan</Button>
        </>
      }
    >
      <SelectField
        big
        label="Customer order"
        value={order}
        onChange={setOrder}
        placeholder={matching.length ? 'Choose order' : 'No open order for this material'}
        options={matching.map((o) => ({ value: o._id, label: `${o.orderNo} · ${o.customer?.name}`, hint: `${o.deliverySite?.name} · ${formatNumber(o.qty - o.dispatchedQty, 2)} left · ${formatINR(o.ratePerUnit)}/${o.material?.unit}` }))}
      />
      {blocked ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
          <p className="flex items-center gap-1.5 font-bold">
            <ExclamationTriangleIcon className="size-5" /> Blocked
          </p>
          <p>{error.data?.reasons?.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>
          <p>
            Exposure {formatINR(error.data?.exposure)} of {formatINR(error.data?.creditLimit)} · overdue {formatINR(error.data?.overdueAmount)}
          </p>
          <p className="mt-1">Ask the owner for an override.</p>
        </div>
      ) : (
        <ErrorNote className="mt-4" error={error} />
      )}
    </Modal>
  );
}
