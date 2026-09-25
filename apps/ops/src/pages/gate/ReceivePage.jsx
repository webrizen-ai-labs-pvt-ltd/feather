import { CheckCircleIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { BAG_BUCKETS, fieldErrors, formatDateTime, formatNumber, formatVehicleNo, receiptSchema } from '@feather/shared';
import { Button, Card, EmptyState, ErrorNote, NumberField, PhotoCapture, TextAreaField, TextField, newId, useForm } from '@feather/ui';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

/**
 * Blind receipt: the inspector never sees the loading weight or the billed bag
 * count. They weigh and count what is physically there; the server works out
 * loss, missing bags and freight deduction.
 */
export default function ReceivePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { submit } = useOutbox();
  const { data } = useCachedGet('/trips/arrivals');
  const trip = location.state?.trip ?? data?.items.find((t) => t._id === id);
  const f = useForm({ grossWeight: '', tareWeight: '', slipNo: '', sound: '', burst: '', lumpy: '', underweight: '', underweightAvgKg: '', remarks: '' });
  const v = f.values;
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  if (!trip) {
    return (
      <Card>
        <EmptyState title="Truck not found" action={<Link className="font-semibold text-brand-700" to="/gate">Back to arrivals</Link>}>
          It may already be received.
        </EmptyState>
      </Card>
    );
  }
  const isBagged = trip.unit === 'bag' || trip.material?.unit === 'bag';
  const net = Number(v.grossWeight) > Number(v.tareWeight) && Number(v.tareWeight) > 0 ? Number(v.grossWeight) - Number(v.tareWeight) : null;
  const counted = BAG_BUCKETS.reduce((s, b) => s + (Number(v[b.key]) || 0), 0);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const fields = {
      ...Object.fromEntries(Object.entries(v).filter(([, val]) => val !== '')),
      clientId: newId(),
      deviceTime: new Date().toISOString(),
    };
    if (isBagged) for (const b of BAG_BUCKETS) fields[b.key] = Number(v[b.key]) || 0;
    const check = receiptSchema.safeParse(fields);
    const errs = check.success ? {} : fieldErrors(check.error);
    if (isBagged && counted === 0) errs.sound = 'Count the bags';
    if (!photo) errs.photo = 'Take a photo of the weighbridge slip';
    if (Object.keys(errs).length) {
      f.setErrors(errs);
      setError('Please fix the boxes marked in red.');
      return;
    }
    setBusy(true);
    try {
      const res = await submit({ path: `/trips/${trip._id}/receive`, fields, photo, label: `Receipt ${formatVehicleNo(trip.vehicleNo)}` });
      setDone({ queued: res.queued, grnNo: res.data?.item?.receipt?.grnNo });
      qc.invalidateQueries();
    } catch (err) {
      if (err.fields) f.setErrors(err.fields);
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        {done.queued ? <CloudArrowUpIcon className="mx-auto size-14 text-brand-600" /> : <CheckCircleIcon className="mx-auto size-14 text-emerald-600" />}
        <h2 className="mt-3 text-xl font-bold">{done.queued ? 'Saved on phone' : 'Truck received'}</h2>
        <p className="mt-1 text-ink-600">
          {formatVehicleNo(trip.vehicleNo)}
          {done.grnNo && (
            <>
              {' · '}GRN <b>{done.grnNo}</b>
            </>
          )}
        </p>
        {done.queued && <p className="mt-2 text-sm text-ink-500">It will be sent when the network comes back.</p>}
        <Button size="xl" className="mt-6" onClick={() => navigate('/gate')}>Next truck</Button>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card className="p-4">
        <p className="text-2xl font-bold tracking-wide">{formatVehicleNo(trip.vehicleNo)}</p>
        <p className="text-ink-600">
          {trip.material?.name} · from {trip.sourceLocation?.name}
        </p>
        <p className="text-sm text-ink-500">
          Left {formatDateTime(trip.loading?.at)} · Driver {trip.driverName} {trip.driverPhone}
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <p className="font-semibold">Your weighbridge slip</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField big required label="Gross (loaded)" suffix="T" value={v.grossWeight} onChange={f.set('grossWeight')} error={f.errors.grossWeight} />
          <NumberField big required label="Empty truck" suffix="T" hint="Weigh after unloading" value={v.tareWeight} onChange={f.set('tareWeight')} error={f.errors.tareWeight} />
        </div>
        <div className="rounded-lg bg-ink-100 px-4 py-3 text-center">
          <span className="text-sm text-ink-600">Net received</span>
          <p className="tabular text-2xl font-bold">{net === null ? '—' : `${formatNumber(net, 3)} T`}</p>
        </div>
        <TextField label="Slip number" value={v.slipNo} onChange={f.set('slipNo')} />
      </Card>

      {isBagged && (
        <Card className="space-y-4 p-4">
          <div>
            <p className="font-semibold">Count every bag</p>
            <p className="text-sm text-ink-500">Put each bag in one box. Missing bags are worked out by the system.</p>
          </div>
          {BAG_BUCKETS.map((b) => (
            <NumberField key={b.key} big inputMode="numeric" label={b.label} hint={b.help} value={v[b.key]} onChange={f.set(b.key)} error={f.errors[b.key]} />
          ))}
          {Number(v.underweight) > 0 && (
            <NumberField big label="Average weight of light bags" suffix="kg" hint="Weigh 5 light bags on the platform scale, enter the average." value={v.underweightAvgKg} onChange={f.set('underweightAvgKg')} error={f.errors.underweightAvgKg} />
          )}
          <div className="rounded-lg bg-ink-100 px-4 py-3 text-center">
            <span className="text-sm text-ink-600">Bags counted</span>
            <p className="tabular text-2xl font-bold">{formatNumber(counted, 0)}</p>
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-4">
        <PhotoCapture label={isBagged ? 'Photo of slip or damaged bags' : 'Photo of weighbridge slip'} value={photo} onChange={(p) => (setPhoto(p), f.setErrors((e) => ({ ...e, photo: undefined })))} error={f.errors.photo} />
        <TextAreaField label="Remarks (optional)" placeholder="e.g. tarpaulin torn, rain water in truck" value={v.remarks} onChange={f.set('remarks')} />
      </Card>

      <ErrorNote error={error} />
      <Button type="submit" size="xl" loading={busy}>Submit receipt</Button>
      <p className="text-center text-xs text-ink-500">After submit you cannot change it. Only the owner can correct an entry.</p>
    </form>
  );
}
