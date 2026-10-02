import { CheckDone01, Edit03, FileCheck02, Package, Play, Truck01 } from '@untitledui/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CONSIGNMENT_MODE_LABELS, formatDateTime, formatINR, formatNumber, formatPct, formatQty, formatVehicleNo } from '@feather/shared';
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ConsignmentStatusBadge,
  DataTable,
  DemurrageClock,
  DetailList,
  FlagList,
  FreightBadge,
  Loading,
  MetricCard,
  PageHeader,
  shipmentTracking,
  TrackingProgress,
  TrackingTimeline,
  truckTracking,
  MiniTracker,
} from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';
import { ConsignmentForm } from '@/pages/ConsignmentsPage.jsx';

const ACTIONS = {
  place: { title: 'Start the free-hours timer?', message: 'The time now (from the server) is saved as the arrival time.', confirm: 'Start timer' },
  release: { title: 'Mark as emptied?', message: 'Do this when the shipment is fully unloaded and handed back. The final late fee is fixed.', confirm: 'Mark emptied' },
  close: { title: 'Close this shipment?', message: 'A closed shipment cannot take more trucks.', confirm: 'Close shipment', needReason: true },
};

export default function ConsignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useGet(`/consignments/${id}`, undefined, { refetchInterval: 60_000 });
  const [confirm, setConfirm] = useState(null);
  const [editing, setEditing] = useState(false);
  const act = useAction((api, { action, reason }) => api.post(`/consignments/${id}/${action}`, reason ? { reason } : undefined), {
    success: 'Updated',
    invalidate: ['/consignments', '/admin'],
    onSuccess: () => setConfirm(null),
  });
  if (isLoading) return <Loading />;
  const c = data.item;
  const r = c.reconciliation;
  const unit = c.unit;
  const track = shipmentTracking(c);
  const lossPct = r?.receivedLoadedQty ? (r.transitLossQty / r.receivedLoadedQty) * 100 : null;

  return (
    <>
      <PageHeader
        help="owner-rakes"
        breadcrumbs={[{ label: 'Shipments', href: '/shipments' }]}
        title={c.referenceNo}
        subtitle={`${CONSIGNMENT_MODE_LABELS[c.mode]} · ${c.material?.name} · from ${c.supplier}`}
        actions={
          <>
            <ConsignmentStatusBadge status={c.status} />
            <Button color="secondary" iconLeading={Edit03} onPress={() => setEditing(true)}>
              Edit
            </Button>
            {c.status === 'expected' && (
              <Button iconLeading={Play} onPress={() => setConfirm('place')}>
                Mark arrived
              </Button>
            )}
            {c.status === 'placed' && (
              <Button iconLeading={Package} onPress={() => setConfirm('release')}>
                Mark emptied
              </Button>
            )}
            {c.status === 'released' && (
              <Button color="secondary" iconLeading={CheckDone01} onPress={() => setConfirm('close')}>
                Close
              </Button>
            )}
          </>
        }
      />

      <TrackingProgress className="mb-6" steps={track.steps} current={track.current} tone={track.tone} headline={track.headline} subline={`${formatQty(c.liftedQty, unit)} of ${formatQty(c.declaredQty, unit)} unloaded`} />

      {c.placedAt && <DemurrageClock consignment={c} showMoney className="mb-6" />}

      {r && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <MetricCard icon={FileCheck02} label="On the paper" value={formatQty(r.declaredQty, unit)} sub={`Unloaded ${formatQty(r.liftedQty, unit)}`} />
          <MetricCard
            icon={Package}
            label="Left on the train"
            value={formatQty(r.balanceAtSiding, unit)}
            tone={r.balanceAtSiding > 0 && c.releasedAt ? 'bad' : 'neutral'}
            sub={c.releasedAt ? 'Not unloaded — check with loading staff' : 'Still to unload'}
          />
          <MetricCard icon={Truck01} label="On trucks now" value={formatQty(r.onRoadQty, unit)} sub={`${data.trips.filter((t) => t.status === 'in_transit').length} trucks on the way`} />
          <MetricCard
            label="Lost on the way"
            value={formatQty(r.transitLossQty, unit)}
            tone={r.lockedTrips ? 'bad' : 'good'}
            sub={`${lossPct === null ? '—' : formatPct(lossPct)} · ${r.lockedTrips} payments on hold`}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <DataTable
            title="Trucks from this shipment"
            badge={<span className="text-sm text-tertiary">{data.trips.length}</span>}
            dense
            rows={data.trips}
            onRowClick={(t) => navigate(`/trips/${t._id}`)}
            empty="No trucks loaded yet."
            emptyIcon={Truck01}
            columns={[
              {
                key: 'vehicle',
                header: 'Truck',
                render: (t) => (
                  <div>
                    <p className="font-medium text-primary">{formatVehicleNo(t.vehicleNo)}</p>
                    <p className="text-xs text-tertiary">
                      {t.tripNo} · to {t.destination?.name}
                    </p>
                  </div>
                ),
              },
              {
                key: 'track',
                header: 'Tracking',
                render: (t) => {
                  const k = truckTracking(t);
                  return <MiniTracker steps={k.steps} current={k.current} tone={k.tone} />;
                },
              },
              { key: 'loaded', header: 'Sent', align: 'right', render: (t) => formatNumber(t.loading?.qty, 3) },
              { key: 'recv', header: 'Received', align: 'right', render: (t) => (t.receipt?.qty != null ? formatNumber(t.receipt.qty, 3) : '—') },
              { key: 'loss', header: 'Lost', align: 'right', render: (t) => (t.variance?.lossPct != null ? formatPct(t.variance.lossPct) : '—') },
              { key: 'freight', header: 'Payment', render: (t) => <FreightBadge status={t.freight?.status} /> },
              { key: 'flags', header: 'Problems', render: (t) => <FlagList flags={t.flags} compact /> },
            ]}
          />
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5 md:p-6">
              <DetailList
                columns={1}
                items={[
                  ['Unloading point', c.location?.name],
                  ['Wagons', c.wagonCount || '—'],
                  ['Free hours', `${c.freeTimeHours} hours`],
                  ['Late fee rate', formatINR(c.demurrageRatePerWagonHour)],
                  ['Purchase rate', c.purchaseRatePerUnit ? `${formatINR(c.purchaseRatePerUnit)} / ${unit}` : '—'],
                  ['Truck rate', c.freightRatePerUnit ? `${formatINR(c.freightRatePerUnit)} / ${unit}` : "Truck company's rate"],
                  ['Arrived at', formatDateTime(c.placedAt)],
                  ['Emptied at', formatDateTime(c.releasedAt)],
                  c.demurrage?.finalPenalty != null && ['Final late fee', formatINR(c.demurrage.finalPenalty)],
                  c.notes && ['Notes', c.notes],
                ]}
              />
            </div>
          </Card>
          <TrackingTimeline events={track.events} />
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          onClose={() => setConfirm(null)}
          loading={act.isPending}
          needReason={ACTIONS[confirm].needReason}
          title={ACTIONS[confirm].title}
          message={ACTIONS[confirm].message}
          confirmLabel={ACTIONS[confirm].confirm}
          onConfirm={(reason) => act.mutate({ action: confirm, reason })}
        />
      )}
      {editing && <ConsignmentForm existing={c} onClose={() => setEditing(false)} />}
    </>
  );
}
