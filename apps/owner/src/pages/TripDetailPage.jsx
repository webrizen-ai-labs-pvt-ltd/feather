import { AlertTriangle, BankNote01, CheckCircle, CurrencyRupeeCircle, Edit03, MarkerPin01, Phone, Scales02, Truck01, Users01, XCircle } from '@untitledui/icons';
import { useState } from 'react';
import { useParams } from 'react-router';
import { formatDateTime, formatHours, formatINR, formatNumber, formatPct, formatQty, formatVehicleNo, PRICE_REQUEST_KINDS, TRIP_FLAG_LABELS } from '@feather/shared';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  cx,
  DetailList,
  FreightBadge,
  Loading,
  Modal,
  NumberField,
  PageHeader,
  StatusBadge,
  TextAreaField,
  TrackingProgress,
  TrackingTimeline,
  TripStatusBadge,
  truckTracking,
  useForm,
} from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

function Photo({ side, label }) {
  if (!side?.photo?.url) return <div className="flex h-40 items-center justify-center rounded-lg bg-secondary text-sm text-tertiary">No photo</div>;
  const { lat, lng, accuracy } = side.photo;
  return (
    <figure>
      <a href={side.photo.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-secondary">
        <img src={side.photo.url} alt={label} className="h-48 w-full bg-secondary object-contain" />
      </a>
      <figcaption className="mt-2 flex items-center gap-1.5 text-xs text-tertiary">
        <MarkerPin01 className="size-3.5" aria-hidden />
        {lat != null ? (
          <a className="underline" href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer">
            Taken at {lat.toFixed(4)}, {lng.toFixed(4)} (±{accuracy} m)
          </a>
        ) : (
          'No GPS location'
        )}
      </figcaption>
    </figure>
  );
}

/** One weighbridge reading, shown as a column of the side-by-side comparison. */
function Weighing({ title, side, place, extra = [] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-primary">{title}</p>
        <p className="text-xs text-tertiary">{side?.at ? `${place ?? ''} · ${formatDateTime(side.at)}${side.wasOffline ? ' · entered offline' : ''}` : 'Not yet'}</p>
      </div>
      {side?.at ? (
        <>
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-secondary p-3 text-center">
            {[
              ['Full truck', side.gross],
              ['Empty truck', side.tare],
              ['Material', side.net],
            ].map(([l, v], i) => (
              <div key={l}>
                <dt className="text-xs text-tertiary">{l}</dt>
                <dd className={cx('mt-0.5 font-semibold tabular-nums', i === 2 ? 'text-lg text-primary' : 'text-md text-secondary')}>{formatNumber(v, 3)}</dd>
              </div>
            ))}
          </dl>
          <DetailList columns={1} items={[['Slip no.', side.slipNo], ...extra]} />
          <Photo side={side} label={title} />
        </>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-primary text-sm text-tertiary">Waiting for the truck to arrive</div>
      )}
    </div>
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
  // New price per truck / labour cost asked by loading staff. vars = { kind, reason? }
  const approveRate = useAction((api, { kind }) => api.post(`/trips/${id}/${PRICE_REQUEST_KINDS[kind].path}/approve`, {}), {
    ...done,
    success: (_d, { kind }) => (kind === 'truckPrice' ? 'New price approved. Truck payment updated.' : 'New labour cost approved'),
  });
  const rejectRate = useAction((api, { kind, reason }) => api.post(`/trips/${id}/${PRICE_REQUEST_KINDS[kind].path}/reject`, { reason }), { ...done, success: 'Kept your rate' });
  const reviewProps = (kind) => ({
    kind,
    approving: approveRate.isPending && approveRate.variables?.kind === kind,
    onApprove: () => approveRate.mutate({ kind }),
    onReject: () => setDialog(`reject:${kind}`),
  });

  if (isLoading) return <Loading />;
  const t = data.item;
  const bagged = t.unit === 'bag';
  const b = t.receipt?.bags;
  const fr = t.freight ?? {};
  const tp = t.truckPrice;
  const lc = t.labourCost;
  const pricePending = tp?.status === 'pending';
  const rejecting = dialog?.startsWith('reject:') ? dialog.slice(7) : null;
  const rejectingReq = rejecting && t[rejecting];
  const track = truckTracking(t);
  const problems = (t.flags ?? []).filter((f) => !['offline_entry', 'credit_override'].includes(f));

  return (
    <>
      <PageHeader
        help="owner-freight"
        breadcrumbs={[{ label: 'Truck trips', href: '/trips' }]}
        title={formatVehicleNo(t.vehicleNo)}
        crumbLabel={t.tripNo}
        subtitle={`Trip ${t.tripNo}${t.challanNo ? ` · Delivery note ${t.challanNo}` : ''} · ${t.material?.name}${t.customer ? ` for ${t.customer.name}` : ''}`}
        actions={
          <>
            <TripStatusBadge status={t.status} />
            <Button color="secondary" iconLeading={Edit03} isDisabled={t.status === 'cancelled'} onPress={() => setDialog('correct')}>
              Correct weights
            </Button>
            {t.status === 'in_transit' && (
              <Button color="secondary-destructive" iconLeading={XCircle} onPress={() => setDialog('cancel')}>
                Cancel trip
              </Button>
            )}
          </>
        }
      />

      <TrackingProgress className="mb-6" steps={track.steps} current={track.current} tone={track.tone} headline={track.headline} subline={track.subline} />

      {problems.length > 0 && (
        <Alert tone={fr.status === 'locked' ? 'error' : 'warning'} icon={AlertTriangle} className="mb-6" title="Problems found on this trip">
          <ul className="mt-1 list-inside list-disc">
            {problems.map((f) => (
              <li key={f}>{TRIP_FLAG_LABELS[f]}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader icon={Scales02} title="Weight check" subtitle="Weighed when it left and again when it arrived. Feather compares the two." />
            <div className="grid gap-6 p-5 md:grid-cols-2 md:p-6">
              <Weighing
                title="When it left"
                place={t.sourceLocation?.name}
                side={t.loading}
                extra={[
                  t.loading?.method === 'bags' && ['Worked out by', `Bag count × ${formatNumber(t.material?.bagWeightKg ?? 50, 0)} kg (no weighbridge)`],
                  bagged && ['Bags loaded', formatNumber(t.loading?.bags, 0)],
                ].filter(Boolean)}
              />
              <Weighing title="When it arrived" place={t.destination?.name} side={t.receipt} extra={[['Receipt no.', t.receipt?.grnNo], t.receipt?.remarks && ['Remarks', t.receipt.remarks]].filter(Boolean)} />
            </div>
            {t.variance?.lossPct != null && (
              <div className="grid grid-cols-2 gap-4 border-t border-secondary p-5 md:grid-cols-4 md:p-6">
                <Stat label="Lost on the way" value={`${formatQty(t.variance.lossQty)}`} sub={formatPct(t.variance.lossPct)} bad={t.variance.lossPct > t.variance.tolerancePct} />
                <Stat label="Allowed loss" value={formatQty(t.variance.allowedQty)} sub={formatPct(t.variance.tolerancePct)} />
                <Stat label="Charged loss" value={formatQty(t.variance.excessLossQty)} bad={t.variance.excessLossQty > 0} />
                <Stat label="Time on the road" value={t.receipt?.at ? formatHours((new Date(t.receipt.at) - new Date(t.loading.at)) / 3_600_000) : '—'} />
              </div>
            )}
          </Card>

          {bagged && (
            <Card>
              <CardHeader title="Bag count" subtitle="Counted by receiving staff. Missing bags are worked out by Feather." />
              {b ? (
                <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-6 md:p-6">
                  {[
                    ['Billed', b.invoice, 'neutral'],
                    ['Good', b.sound, 'good'],
                    ['Torn', b.burst, b.burst ? 'warn' : 'neutral'],
                    ['Hard / wet', b.lumpy, b.lumpy ? 'bad' : 'neutral'],
                    [`Light (${b.underweightAvgKg ?? '—'} kg)`, b.underweight, b.underweight ? 'warn' : 'neutral'],
                    ['Missing', b.missing, b.missing ? 'bad' : 'neutral'],
                  ].map(([label, value, tone]) => (
                    <Stat key={label} label={label} value={formatNumber(value ?? 0, 0)} bad={tone === 'bad'} warn={tone === 'warn'} good={tone === 'good'} />
                  ))}
                </div>
              ) : (
                <p className="p-6 text-sm text-tertiary">Not counted yet.</p>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader icon={BankNote01} title="Truck payment" badge={<FreightBadge status={fr.status} />} />
            <div className="p-5 md:p-6">
              {tp && (
                <RateRequestBox
                  req={tp}
                  {...reviewProps('truckPrice')}
                  where={tp.distanceKm ? `${formatNumber(tp.distanceKm, 1)} km` : null}
                  pendingNote="Until you decide, your price is used and the payment cannot be marked paid."
                />
              )}
              <dl className="space-y-3 text-sm">
                <Row
                  label={fr.pricePerTruck != null ? 'Price per truck (agreed)' : `Truck rate ${formatINR(fr.rate)} × ${formatNumber(t.loading?.qty, 3)}`}
                  value={formatINR(fr.amount)}
                />
                <Row label="Advance paid" value={`− ${formatINR(fr.advance)}`} />
                <Row label="Cut for loss / damage" value={`− ${formatINR(fr.deduction)}`} bad={fr.deduction > 0} />
                <div className="border-t border-secondary pt-3">
                  <Row label={<span className="font-semibold text-primary">Balance to pay</span>} value={<span className="text-lg font-semibold text-primary">{formatINR(fr.balance)}</span>} />
                </div>
              </dl>
              {fr.recoverable > 0 && <Alert className="mt-4" title={`Recover ${formatINR(fr.recoverable)} from the truck company.`} />}
              {fr.waived && <p className="mt-4 text-sm text-tertiary">Paid in full: {fr.reviewNote}</p>}
              {t.credit?.overrideReason && (
                <div className="mt-4">
                  <StatusBadge tone="warn">Allowed anyway: {t.credit.overrideReason}</StatusBadge>
                </div>
              )}
              <div className="mt-5 flex flex-col gap-3">
                {fr.status === 'locked' && (
                  <>
                    <Button iconLeading={CheckCircle} isLoading={approve.isPending} onPress={() => approve.mutate()}>
                      Pay with cut
                    </Button>
                    <Button color="secondary" onPress={() => setDialog('waive')}>
                      Pay in full
                    </Button>
                  </>
                )}
                {fr.status === 'ready' && (
                  <>
                    <Button iconLeading={BankNote01} isLoading={paid.isPending} isDisabled={pricePending} onPress={() => paid.mutate()}>
                      Mark paid
                    </Button>
                    {fr.deduction > 0 && (
                      <Button color="secondary" onPress={() => setDialog('waive')}>
                        Pay in full
                      </Button>
                    )}
                  </>
                )}
                {['on_hold', 'locked', 'ready'].includes(fr.status) && (
                  <Button color="link-gray" onPress={() => setDialog('advance')}>
                    Record advance
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {lc && (
            <Card>
              <CardHeader icon={Users01} title="Labour cost" subtitle={`Unloading labour for this truck at ${t.sourceLocation?.name ?? 'the station / port'}.`} />
              <div className="p-5 md:p-6">
                <RateRequestBox req={lc} {...reviewProps('labourCost')} pendingNote="Until you decide, your labour cost is used." />
                <dl className="text-sm">
                  <Row label={<span className="font-semibold text-primary">Labour cost for this truck</span>} value={<span className="text-lg font-semibold text-primary">{formatINR(lc.agreed)}</span>} />
                </dl>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader icon={Truck01} title="Truck & driver" />
            <div className="p-5 md:p-6">
              <DetailList
                columns={1}
                items={[
                  ['Truck company', t.transporter?.name],
                  ['Driver', t.driverName],
                  [
                    'Driver mobile',
                    t.driverPhone ? (
                      <a href={`tel:${t.driverPhone}`} className="inline-flex items-center gap-1 text-brand-secondary">
                        <Phone className="size-4" aria-hidden /> {t.driverPhone}
                      </a>
                    ) : (
                      '—'
                    ),
                  ],
                  ['From', t.sourceLocation?.name],
                  ['To', t.destination?.name],
                  t.consignment && ['Shipment', t.consignment.referenceNo],
                ]}
              />
            </div>
          </Card>

          <TrackingTimeline events={track.events} />
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'waive'}
        onClose={() => setDialog(null)}
        loading={waive.isPending}
        needReason
        title="Pay in full?"
        message="The truck company will be paid without any cut. Your reason is saved in History."
        confirmLabel="Pay in full"
        variant="danger"
        onConfirm={(r) => waive.mutate(r)}
      />
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setDialog(null)}
        loading={rejectRate.isPending}
        needReason
        title="Keep your rate?"
        message={
          rejecting === 'truckPrice'
            ? `The new price ${formatINR(rejectingReq?.requested)} is rejected and ${rejectingReq?.quoted != null ? `your price ${formatINR(rejectingReq.quoted)}` : 'the normal truck rate'} is paid. Your reason is saved in History.`
            : `The new labour cost ${formatINR(rejectingReq?.requested)} is rejected and ${rejectingReq?.quoted != null ? `your cost ${formatINR(rejectingReq.quoted)}` : 'no labour cost'} is used. Your reason is saved in History.`
        }
        confirmLabel="Reject"
        variant="danger"
        onConfirm={(reason) => rejectRate.mutate({ kind: rejecting, reason })}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        loading={cancel.isPending}
        needReason
        title="Cancel this trip?"
        message="Use this only for a wrong entry. The quantity goes back to the shipment or warehouse."
        confirmLabel="Cancel trip"
        variant="danger"
        onConfirm={(r) => cancel.mutate(r)}
      />
      {dialog === 'correct' && <CorrectDialog trip={t} onClose={() => setDialog(null)} />}
      {dialog === 'advance' && <AdvanceDialog trip={t} onClose={() => setDialog(null)} />}
    </>
  );
}

/**
 * One owner rate on this trip (price per truck or labour cost): your rate, and any new amount
 * loading staff asked for — with Approve / Keep buttons while it waits.
 */
function RateRequestBox({ kind, req, where, pendingNote, approving, onApprove, onReject }) {
  const name = PRICE_REQUEST_KINDS[kind].label.toLowerCase();
  const yours = req.quoted != null ? formatINR(req.quoted) : 'not set';
  const at = where ? ` · ${where}` : '';
  if (req.status === 'pending') {
    return (
      <Alert tone="warning" icon={CurrencyRupeeCircle} className="mb-5" title={`New ${name} asked: ${formatINR(req.requested)}`}>
        <p>
          Your {name}: {yours}
          {at}. Asked by {req.requestedBy?.name ?? 'loading staff'} on {formatDateTime(req.requestedAt)}.
        </p>
        <p className="mt-1">Reason: {req.reason}</p>
        <p className="mt-1">{pendingNote}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button size="sm" iconLeading={CheckCircle} isLoading={approving} onPress={onApprove}>
            Approve new amount
          </Button>
          <Button size="sm" color="secondary" onPress={onReject}>
            Keep my rate
          </Button>
        </div>
      </Alert>
    );
  }
  const by = req.reviewedBy?.name ? ` by ${req.reviewedBy.name}` : '';
  return (
    <div className="mb-5 rounded-lg bg-secondary p-3 text-sm text-tertiary">
      <p>
        Your {name}: <span className="font-medium text-secondary">{yours}</span>
        {at}
      </p>
      {req.status === 'approved' && (
        <p className="mt-1">
          New amount <span className="font-medium text-secondary">{formatINR(req.requested)}</span> approved{by} on {formatDateTime(req.reviewedAt)}. Reason asked: {req.reason}
        </p>
      )}
      {req.status === 'rejected' && (
        <p className="mt-1">
          New amount {formatINR(req.requested)} rejected{by}: {req.reviewNote}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub, bad, warn, good }) {
  return (
    <div>
      <p className="text-xs text-tertiary">{label}</p>
      <p className={cx('mt-0.5 text-lg font-semibold tabular-nums', bad ? 'text-error-primary' : warn ? 'text-warning-primary' : good ? 'text-success-primary' : 'text-primary')}>{value}</p>
      {sub && <p className="text-xs text-tertiary">{sub}</p>}
    </div>
  );
}

function Row({ label, value, bad }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-tertiary">{label}</dt>
      <dd className={cx('font-medium tabular-nums', bad ? 'text-error-primary' : 'text-secondary')}>{value}</dd>
    </div>
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
      icon={Edit03}
      title="Correct weights"
      description="Use only when the typed weight does not match the slip photo. Loss, cuts, stock and bills are worked out again."
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={save.isPending}
            onPress={() =>
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
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Full weight at loading" suffix="MT" value={v.loadingGross} onChange={f.set('loadingGross')} error={f.errors.loadingGross} />
        <NumberField label="Empty weight at loading" suffix="MT" value={v.loadingTare} onChange={f.set('loadingTare')} error={f.errors.loadingTare} />
        {received && (
          <>
            <NumberField label="Full weight at receiving" suffix="MT" value={v.receiptGross} onChange={f.set('receiptGross')} error={f.errors.receiptGross} />
            <NumberField label="Empty weight at receiving" suffix="MT" value={v.receiptTare} onChange={f.set('receiptTare')} error={f.errors.receiptTare} />
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
      icon={BankNote01}
      title="Advance paid to truck company"
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} onPress={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <NumberField label="Total advance" prefix="₹" value={advance} onChange={setAdvance} />
    </Modal>
  );
}
