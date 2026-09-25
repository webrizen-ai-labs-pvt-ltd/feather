import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
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
  PageHeader,
  Stat,
  TripStatusBadge,
} from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';
import { ConsignmentForm } from '@/pages/ConsignmentsPage.jsx';

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

  return (
    <>
      <PageHeader
        back={
          <Link to="/consignments" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800">
            <ArrowLeftIcon className="size-4" /> Rakes & ships
          </Link>
        }
        title={`${c.referenceType} ${c.referenceNo}`}
        subtitle={`${CONSIGNMENT_MODE_LABELS[c.mode]} · ${c.material?.name} · ${c.supplier}`}
        actions={
          <>
            <ConsignmentStatusBadge status={c.status} />
            <Button variant="secondary" icon={PencilSquareIcon} onClick={() => setEditing(true)}>Edit</Button>
            {c.status === 'expected' && <Button onClick={() => setConfirm({ action: 'place' })}>Mark placed (start clock)</Button>}
            {c.status === 'placed' && <Button onClick={() => setConfirm({ action: 'release' })}>Mark released</Button>}
            {c.status === 'released' && <Button variant="secondary" onClick={() => setConfirm({ action: 'close', needReason: true })}>Close</Button>}
          </>
        }
      />

      {c.placedAt && <DemurrageClock consignment={c} showMoney className="mb-6" />}

      {r && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`On ${c.referenceType}`} value={formatQty(r.declaredQty, unit)} sub={`Lifted ${formatQty(r.liftedQty, unit)}`} />
          <Stat label="Left at siding" value={formatQty(r.balanceAtSiding, unit)} tone={r.balanceAtSiding > 0 && c.releasedAt ? 'bad' : 'neutral'} sub={c.releasedAt ? 'Not lifted — check with siding' : 'Still to lift'} />
          <Stat label="On the road" value={formatQty(r.onRoadQty, unit)} />
          <Stat
            label="Lost between siding and yard"
            value={formatQty(r.transitLossQty, unit)}
            tone={r.lockedTrips ? 'bad' : 'good'}
            sub={`${r.receivedLoadedQty ? formatPct((r.transitLossQty / r.receivedLoadedQty) * 100) : '—'} · ${r.lockedTrips} trucks locked`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              ['Siding / port', c.location?.name],
              ['Wagons', c.wagonCount || '—'],
              ['Free time', `${c.freeTimeHours} hours`],
              ['Demurrage rate', formatINR(c.demurrageRatePerWagonHour)],
              ['Purchase rate', c.purchaseRatePerUnit ? `${formatINR(c.purchaseRatePerUnit)} / ${unit}` : '—'],
              ['Freight rate', c.freightRatePerUnit ? `${formatINR(c.freightRatePerUnit)} / ${unit}` : 'Transporter rate'],
              ['Placed at', formatDateTime(c.placedAt)],
              ['Released at', formatDateTime(c.releasedAt)],
              c.demurrage?.finalPenalty != null && ['Final demurrage', formatINR(c.demurrage.finalPenalty)],
              c.notes && ['Notes', c.notes],
            ]}
          />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={`Trucks (${data.trips.length})`} />
          <DataTable
            dense
            rows={data.trips}
            onRowClick={(t) => navigate(`/trips/${t._id}`)}
            empty="No trucks loaded yet."
            columns={[
              { key: 'no', header: 'Trip', render: (t) => <span className="font-medium">{t.tripNo}</span> },
              { key: 'vehicle', header: 'Vehicle', render: (t) => formatVehicleNo(t.vehicleNo) },
              { key: 'to', header: 'To', render: (t) => t.destination?.name },
              { key: 'loaded', header: 'Loaded', align: 'right', render: (t) => formatNumber(t.loading?.qty, 3) },
              { key: 'recv', header: 'Received', align: 'right', render: (t) => (t.receipt?.qty != null ? formatNumber(t.receipt.qty, 3) : '—') },
              { key: 'loss', header: 'Loss', align: 'right', render: (t) => (t.variance?.lossPct != null ? formatPct(t.variance.lossPct) : '—') },
              { key: 'status', header: 'Status', render: (t) => <TripStatusBadge status={t.status} /> },
              { key: 'freight', header: 'Freight', render: (t) => <FreightBadge status={t.freight?.status} /> },
              { key: 'flags', header: 'Issues', render: (t) => <FlagList flags={t.flags} compact /> },
            ]}
          />
        </Card>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          onClose={() => setConfirm(null)}
          loading={act.isPending}
          needReason={confirm.needReason}
          title={{ place: 'Start the free-time clock?', release: 'Mark as released?', close: 'Close this consignment?' }[confirm.action]}
          message={
            {
              place: 'The server time now will be saved as the placement time.',
              release: 'Do this when the rake is empty and handed back. The final demurrage will be fixed.',
              close: 'Closed consignments cannot take more trucks.',
            }[confirm.action]
          }
          onConfirm={(reason) => act.mutate({ action: confirm.action, reason })}
        />
      )}
      {editing && <ConsignmentForm existing={c} onClose={() => setEditing(false)} />}
    </>
  );
}
