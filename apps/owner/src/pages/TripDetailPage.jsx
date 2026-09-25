import { ArrowLeftIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  formatDateTime,
  formatHours,
  formatINR,
  formatNumber,
  formatPct,
  formatQty,
  formatVehicleNo,
  TRIP_FLAG_LABELS,
} from '@feather/shared';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DetailList,
  FlagList,
  FreightBadge,
  Loading,
  Modal,
  NumberField,
  PageHeader,
  TextAreaField,
  TripStatusBadge,
  useForm,
} from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

function Photo({ side, label }) {
  if (!side?.photo?.url) return <p className="text-sm text-ink-500">No photo</p>;
  const { lat, lng, accuracy } = side.photo;
  return (
    <figure>
      <a href={side.photo.url} target="_blank" rel="noreferrer">
        <img src={side.photo.url} alt={label} className="max-h-72 w-full rounded-lg bg-ink-100 object-contain ring-1 ring-ink-200" />
      </a>
      <figcaption className="mt-1.5 flex items-center gap-1 text-xs text-ink-500">
        <MapPinIcon className="size-4" />
        {lat != null ? (
          <a className="underline" href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer">
            {lat.toFixed(5)}, {lng.toFixed(5)} (±{accuracy} m)
          </a>
        ) : (
          'No GPS location'
        )}
      </figcaption>
    </figure>
  );
}

function Weighment({ title, side, extra }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={side?.at ? `${formatDateTime(side.at)}${side.wasOffline ? ' · entered offline' : ''}` : 'Not yet'} />
      {side?.at && (
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              ['Gross', formatQty(side.gross)],
              ['Empty (tare)', formatQty(side.tare)],
              ['Net', <b key="n">{formatQty(side.net)}</b>],
              ['Slip no.', side.slipNo],
              ...extra,
            ]}
          />
          <Photo side={side} label={title} />
        </div>
      )}
    </Card>
  );
}

export default function TripDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useGet(`/trips/${id}`);
  const [dialog, setDialog] = useState(null);
  const done = { success: 'Saved', invalidate: ['/trips', '/admin', '/consignments'], onSuccess: () => setDialog(null) };
  const approve = useAction((api) => api.post(`/trips/${id}/freight/approve`, {}), done);
  const waive = useAction((api, reason) => api.post(`/trips/${id}/freight/waive`, { reason }), done);
  const paid = useAction((api) => api.post(`/trips/${id}/freight/paid`, {}), done);
  const cancel = useAction((api, reason) => api.post(`/trips/${id}/cancel`, { reason }), done);

  if (isLoading) return <Loading />;
  const t = data.item;
  const bagged = t.unit === 'bag';
  const b = t.receipt?.bags;
  const fr = t.freight ?? {};

  return (
    <>
      <PageHeader
        back={
          <Link to="/trips" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800">
            <ArrowLeftIcon className="size-4" /> Trips
          </Link>
        }
        title={`${t.tripNo} · ${formatVehicleNo(t.vehicleNo)}`}
        subtitle={`${t.material?.name} · ${t.sourceLocation?.name} → ${t.destination?.name}${t.customer ? ` (${t.customer.name})` : ''}`}
        actions={
          <>
            <TripStatusBadge status={t.status} />
            <Button variant="secondary" onClick={() => setDialog('correct')} disabled={t.status === 'cancelled'}>Correct weights</Button>
            {t.status === 'in_transit' && <Button variant="danger" onClick={() => setDialog('cancel')}>Cancel trip</Button>}
          </>
        }
      />

      {t.flags?.length > 0 && (
        <Card className="mb-6 border-l-4 border-red-500 p-4">
          <p className="font-semibold text-ink-900">Issues found</p>
          <ul className="mt-2 list-inside list-disc text-sm text-ink-700">
            {t.flags.map((f) => (
              <li key={f}>{TRIP_FLAG_LABELS[f]}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Weighment
          title="Loading (source weighbridge)"
          side={t.loading}
          extra={[bagged && ['Bags loaded', formatNumber(t.loading?.bags, 0)], ['Driver', `${t.driverName ?? ''} ${t.driverPhone ?? ''}`], ['Transporter', t.transporter?.name]].filter(Boolean)}
        />
        <Weighment
          title="Receipt (destination weighbridge)"
          side={t.receipt}
          extra={[['GRN no.', t.receipt?.grnNo], t.receipt?.remarks && ['Remarks', t.receipt.remarks]].filter(Boolean)}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Weight check</h2>
          {t.variance?.lossPct != null ? (
            <DetailList
              className="sm:grid-cols-1"
              items={[
                ['Loss on road', `${formatQty(t.variance.lossQty)} (${formatPct(t.variance.lossPct)})`],
                ['Allowed', `${formatPct(t.variance.tolerancePct)} = ${formatQty(t.variance.allowedQty)}`],
                ['Chargeable loss', formatQty(t.variance.excessLossQty)],
                ['Time on road', t.receipt?.at ? formatHours((new Date(t.receipt.at) - new Date(t.loading.at)) / 3_600_000) : '—'],
              ]}
            />
          ) : (
            <p className="text-sm text-ink-500">Available after the truck is received.</p>
          )}
        </Card>

        {bagged && (
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Bag count</h2>
            {b ? (
              <table className="tabular w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {[
                    ['Billed', b.invoice],
                    ['Good', b.sound],
                    ['Torn / burst', b.burst],
                    ['Hard / wet', b.lumpy],
                    [`Light (avg ${b.underweightAvgKg ?? '—'} kg)`, b.underweight],
                    ['Missing', b.missing],
                    b.excess ? ['Extra (count error?)', b.excess] : null,
                  ]
                    .filter(Boolean)
                    .map(([label, value]) => (
                      <tr key={label}>
                        <td className="py-1.5 text-ink-600">{label}</td>
                        <td className="py-1.5 text-right font-semibold">{formatNumber(value ?? 0, 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-ink-500">Not counted yet.</p>
            )}
          </Card>
        )}

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Freight settlement</h2>
            <FreightBadge status={fr.status} />
          </div>
          <table className="tabular w-full text-sm">
            <tbody className="divide-y divide-ink-100">
              <tr><td className="py-1.5 text-ink-600">Freight ({formatINR(fr.rate)} × {formatNumber(t.loading?.qty, 3)})</td><td className="py-1.5 text-right">{formatINR(fr.amount)}</td></tr>
              <tr><td className="py-1.5 text-ink-600">Advance paid</td><td className="py-1.5 text-right">− {formatINR(fr.advance)}</td></tr>
              <tr><td className="py-1.5 text-ink-600">Deduction for loss / damage</td><td className="py-1.5 text-right text-red-700">− {formatINR(fr.deduction)}</td></tr>
              <tr className="font-bold"><td className="py-2">Balance to pay</td><td className="py-2 text-right">{formatINR(fr.balance)}</td></tr>
            </tbody>
          </table>
          {fr.recoverable > 0 && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">Recover {formatINR(fr.recoverable)} from the transporter.</p>}
          {fr.waived && <Badge tone="warn" className="mt-2">Deduction waived: {fr.reviewNote}</Badge>}
          {t.credit?.overrideReason && <Badge tone="warn" className="mt-2">Credit override: {t.credit.overrideReason}</Badge>}
          <div className="mt-4 flex flex-wrap gap-2">
            {fr.status === 'locked' && (
              <>
                <Button variant="success" loading={approve.isPending} onClick={() => approve.mutate()}>Approve with deduction</Button>
                <Button variant="secondary" onClick={() => setDialog('waive')}>Waive deduction</Button>
              </>
            )}
            {fr.status === 'ready' && (
              <>
                <Button loading={paid.isPending} onClick={() => paid.mutate()}>Mark paid</Button>
                {fr.deduction > 0 && <Button variant="secondary" onClick={() => setDialog('waive')}>Waive deduction</Button>}
              </>
            )}
            {['on_hold', 'locked', 'ready'].includes(fr.status) && <Button variant="ghost" onClick={() => setDialog('advance')}>Record advance</Button>}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 font-semibold">All issues</h2>
        <FlagList flags={t.flags} />
      </Card>

      <ConfirmDialog
        open={dialog === 'waive'}
        onClose={() => setDialog(null)}
        loading={waive.isPending}
        needReason
        title="Waive the deduction?"
        message="The transporter will be paid in full. Your reason is saved in the audit log."
        confirmLabel="Waive"
        variant="danger"
        onConfirm={(r) => waive.mutate(r)}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        loading={cancel.isPending}
        needReason
        title="Cancel this trip?"
        message="Use this only for a wrong entry. Quantities go back to the rake / yard."
        confirmLabel="Cancel trip"
        variant="danger"
        onConfirm={(r) => cancel.mutate(r)}
      />
      {dialog === 'correct' && <CorrectDialog trip={t} onClose={() => setDialog(null)} />}
      {dialog === 'advance' && <AdvanceDialog trip={t} onClose={() => setDialog(null)} />}
    </>
  );
}

function CorrectDialog({ trip, onClose }) {
  const received = trip.status === 'received';
  const f = useForm({
    loadingGross: trip.loading?.gross ?? '',
    loadingTare: trip.loading?.tare ?? '',
    receiptGross: trip.receipt?.gross ?? '',
    receiptTare: trip.receipt?.tare ?? '',
    reason: '',
  });
  const save = useAction((api, body) => api.post(`/trips/${trip._id}/correct`, body), {
    success: 'Weights corrected. All checks were run again.',
    invalidate: ['/trips', '/admin', '/consignments'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { reason: e.message }),
  });
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      title="Correct weights"
      description="Use only when the typed weight does not match the slip photo. Loss, deductions, stock and bills are worked out again."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                reason: v.reason,
                loadingGross: v.loadingGross,
                loadingTare: v.loadingTare,
                ...(received ? { receiptGross: v.receiptGross, receiptTare: v.receiptTare } : {}),
              })
            }
          >
            Save correction
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Loading gross" suffix="MT" value={v.loadingGross} onChange={f.set('loadingGross')} error={f.errors.loadingGross} />
        <NumberField label="Loading tare" suffix="MT" value={v.loadingTare} onChange={f.set('loadingTare')} error={f.errors.loadingTare} />
        {received && (
          <>
            <NumberField label="Receipt gross" suffix="MT" value={v.receiptGross} onChange={f.set('receiptGross')} error={f.errors.receiptGross} />
            <NumberField label="Receipt tare" suffix="MT" value={v.receiptTare} onChange={f.set('receiptTare')} error={f.errors.receiptTare} />
          </>
        )}
        <TextAreaField className="sm:col-span-2" label="Reason" value={v.reason} onChange={f.set('reason')} error={f.errors.reason} />
      </div>
    </Modal>
  );
}

function AdvanceDialog({ trip, onClose }) {
  const [advance, setAdvance] = useState(trip.freight?.advance ?? 0);
  const save = useAction((api) => api.patch(`/trips/${trip._id}/advance`, { advance }), {
    success: 'Advance saved',
    invalidate: ['/trips'],
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Advance paid to transporter"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <NumberField label="Total advance" suffix="₹" value={advance} onChange={(e) => setAdvance(e.target.value)} />
    </Modal>
  );
}
