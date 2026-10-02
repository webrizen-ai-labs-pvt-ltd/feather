import { ArrowLeft, CheckCircle, MarkerPin01, PackageCheck, Phone, Truck01 } from '@untitledui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { useLocation, useNavigate, useParams } from 'react-router';
import { BAG_BUCKETS, fieldErrors, formatDateTime, formatHours, formatNumber, formatVehicleNo, receiptSchema } from '@feather/shared';
import { Alert, Button, Card, EmptyState, ErrorNote, NumberField, PageHeader, PhotoCapture, TextAreaField, TextField, newId, useForm } from '@feather/ui';
import { FormStep, Readout, SavedScreen } from '@/components/FieldKit.jsx';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

/**
 * Blind receipt: receiving staff never see the loading weight or the billed bag
 * count. They weigh and count what is physically there; the server works out
 * loss, missing bags and the truck payment cut.
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
      <EmptyState icon={Truck01} title="Truck not found" action={<Button color="secondary" iconLeading={ArrowLeft} href="/gate">Back to incoming trucks</Button>}>
        It may already be received.
      </EmptyState>
    );
  }
  const isBagged = trip.unit === 'bag' || trip.material?.unit === 'bag';
  const net = Number(v.grossWeight) > Number(v.tareWeight) && Number(v.tareWeight) > 0 ? Number(v.grossWeight) - Number(v.tareWeight) : null;
  const counted = BAG_BUCKETS.reduce((s, b) => s + (Number(v[b.key]) || 0), 0);
  const hours = trip.loading?.at ? (Date.now() - new Date(trip.loading.at)) / 3_600_000 : null;

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
      <div className="mx-auto max-w-2xl">
        <SavedScreen
          queued={done.queued}
          title="Truck received"
          lines={[formatVehicleNo(trip.vehicleNo), done.grnNo && `Receipt no. ${done.grnNo}`].filter(Boolean)}
          action={
            <Button size="xl" className="w-full" iconLeading={PackageCheck} onPress={() => navigate('/gate')}>
              Next truck
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader help="receive-truck" breadcrumbs={[{ label: 'Incoming trucks', href: '/gate' }]} title={formatVehicleNo(trip.vehicleNo)} subtitle="Weigh and count what you see. Feather does the comparing." />

      <Card className="mb-5 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-fg-brand-primary">
            <Truck01 className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-primary">{trip.material?.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-tertiary">
              <MarkerPin01 className="size-4" aria-hidden /> from {trip.sourceLocation?.name}
            </p>
            <p className="text-tertiary">
              Left {formatDateTime(trip.loading?.at)}
              {hours != null && ` · ${formatHours(hours)} ago`}
            </p>
            <p className="text-tertiary">
              {trip.transporter?.name} · Driver {trip.driverName}{' '}
              {trip.driverPhone && (
                <a href={`tel:${trip.driverPhone}`} className="inline-flex items-center gap-1 font-semibold text-brand-secondary">
                  <Phone className="size-3.5" aria-hidden /> {trip.driverPhone}
                </a>
              )}
            </p>
          </div>
        </div>
      </Card>

      <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-5">
        <FormStep n={1} title="Your weighbridge slip" description="Weigh full, unload, then weigh the empty truck.">
          <div className="grid grid-cols-2 gap-4">
            <NumberField big required label="Full truck" suffix="T" value={v.grossWeight} onChange={f.set('grossWeight')} error={f.errors.grossWeight} />
            <NumberField big required label="Empty truck" suffix="T" hint="After unloading" value={v.tareWeight} onChange={f.set('tareWeight')} error={f.errors.tareWeight} />
          </div>
          <Readout label="Material received" value={net === null ? '—' : `${formatNumber(net, 3)} T`} />
          <TextField label="Slip number" value={v.slipNo} onChange={f.set('slipNo')} />
        </FormStep>

        {isBagged && (
          <FormStep n={2} title="Count every bag" description="Put each bag in one box. Missing bags are worked out by Feather.">
            <div className="grid gap-5 sm:grid-cols-2">
              {BAG_BUCKETS.map((b) => (
                <NumberField key={b.key} big inputMode="numeric" label={b.label} hint={b.help} value={v[b.key]} onChange={f.set(b.key)} error={f.errors[b.key]} />
              ))}
            </div>
            {Number(v.underweight) > 0 && (
              <NumberField big label="Average weight of light bags" suffix="kg" hint="Weigh 5 light bags on the platform scale, enter the average." value={v.underweightAvgKg} onChange={f.set('underweightAvgKg')} error={f.errors.underweightAvgKg} />
            )}
            <Readout label="Bags counted" value={formatNumber(counted, 0)} />
          </FormStep>
        )}

        <FormStep n={isBagged ? 3 : 2} title="Photo and notes">
          <PhotoCapture label={isBagged ? 'Photo of slip or damaged bags' : 'Photo of weighbridge slip'} value={photo} onChange={(p) => (setPhoto(p), f.setErrors((e) => ({ ...e, photo: undefined })))} error={f.errors.photo} />
          <TextAreaField label="Remarks (optional)" placeholder="e.g. tarpaulin torn, rain water in truck" value={v.remarks} onChange={f.set('remarks')} />
        </FormStep>

        <ErrorNote error={error} />
        <Alert tone="gray" title="After you submit, it cannot be changed.">
          Only the owner can correct an entry.
        </Alert>
        <Button type="submit" size="xl" className="w-full" iconLeading={CheckCircle} isLoading={busy}>
          Submit receipt
        </Button>
      </Form>
    </div>
  );
}
