import { CheckCircleIcon, CloudArrowUpIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  CREDIT_REASON_LABELS,
  fieldErrors,
  formatINR,
  formatNumber,
  formatVehicleNo,
  loadingSchema,
  LOCATION_TYPES,
  normalizeVehicleNo,
} from '@feather/shared';
import { Button, Card, ErrorNote, NumberField, PhotoCapture, SelectField, TextField, newId, toOptions, useApi, useAuth, useForm } from '@feather/ui';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

const EMPTY = {
  consignment: '',
  sourceLocation: '',
  destination: '',
  order: '',
  vehicleNo: '',
  driverName: '',
  driverPhone: '',
  transporter: '',
  grossWeight: '',
  tareWeight: '',
  loadedBags: '',
  slipNo: '',
};

/**
 * One form for every truck that leaves: from a rake / ship (siding supervisor)
 * or from our stockyard to a customer (dispatch). Works offline.
 * @param {{ source: 'rake' | 'yard' }} props
 */
export default function TruckLoadingForm({ source }) {
  const api = useApi();
  const { user } = useAuth();
  const { submit } = useOutbox();
  const qc = useQueryClient();
  const f = useForm(EMPTY);
  const v = f.values;
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const fromRake = source === 'rake';
  const { data: rakes } = useCachedGet(fromRake ? '/consignments' : null, { status: 'expected,placed' });
  const { data: yards } = useCachedGet(fromRake ? null : '/masters/locations', { type: 'stockyard' });
  const { data: places } = useCachedGet('/masters/locations', { type: 'stockyard,customer_site' });
  const { data: transporters } = useCachedGet('/masters/transporters');
  const { data: orders } = useCachedGet('/sales/orders', { status: 'open' });

  const rake = rakes?.items.find((c) => c._id === v.consignment);
  const destination = places?.items.find((l) => l._id === v.destination);
  const toCustomer = destination?.type === LOCATION_TYPES.CUSTOMER_SITE;
  const order = orders?.items.find((o) => o._id === v.order);
  const materialId = rake?.material?._id ?? order?.material?._id;
  const isBagged = (rake?.material?.unit ?? order?.material?.unit) === 'bag';
  const siteOrders = (orders?.items ?? []).filter((o) => (o.deliverySite?._id ?? o.deliverySite) === v.destination && (!materialId || !rake || (o.material?._id ?? o.material) === materialId));
  const net = Number(v.grossWeight) > Number(v.tareWeight) && Number(v.tareWeight) > 0 ? Number(v.grossWeight) - Number(v.tareWeight) : null;

  const destinationOptions = useMemo(
    () =>
      (places?.items ?? [])
        .filter((l) => (fromRake ? true : l.type === LOCATION_TYPES.CUSTOMER_SITE))
        .map((l) => ({ value: l._id, label: l.name, hint: l.type === 'stockyard' ? 'Our stockyard' : `Customer site${l.customer?.name ? ` · ${l.customer.name}` : ''}` })),
    [places, fromRake],
  );

  async function lookupVehicle() {
    const no = normalizeVehicleNo(v.vehicleNo);
    if (no.length < 6) return;
    try {
      const { vehicle } = await api.get(`/masters/vehicles/${no}`);
      if (vehicle) {
        f.setValues((s) => ({
          ...s,
          driverName: s.driverName || vehicle.lastDriverName || '',
          driverPhone: s.driverPhone || vehicle.lastDriverPhone || '',
          transporter: s.transporter || vehicle.transporter?._id || '',
        }));
      }
    } catch {
      /* offline — staff types it */
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const fields = {
      ...Object.fromEntries(Object.entries(v).filter(([, val]) => val !== '')),
      order: toCustomer ? v.order : undefined,
      loadedBags: isBagged ? v.loadedBags : undefined,
      consignment: fromRake ? v.consignment : undefined,
      sourceLocation: fromRake ? undefined : v.sourceLocation,
      clientId: newId(),
      deviceTime: new Date().toISOString(),
    };
    // Same rules as the server, checked on the phone first (works offline).
    const check = loadingSchema.safeParse(fields);
    const errs = check.success ? {} : fieldErrors(check.error);
    if (toCustomer && !v.order) errs.order = 'Choose the customer order';
    if (isBagged && !v.loadedBags) errs.loadedBags = 'Enter number of bags';
    if (!photo) errs.photo = 'Take a photo of the weighbridge slip';
    if (Object.keys(errs).length) {
      f.setErrors(errs);
      setError('Please fix the boxes marked in red.');
      return;
    }
    setBusy(true);
    try {
      const res = await submit({ path: '/trips/loading', fields, photo, label: `Loading ${formatVehicleNo(fields.vehicleNo)}` });
      setDone({ queued: res.queued, trip: res.data?.item, vehicleNo: fields.vehicleNo });
      qc.invalidateQueries();
    } catch (err) {
      if (err.fields) f.setErrors(err.fields);
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    f.setValues((s) => ({ ...EMPTY, consignment: s.consignment, sourceLocation: s.sourceLocation, destination: s.destination, order: s.order }));
    f.setErrors({});
    setPhoto(null);
    setDone(null);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        {done.queued ? <CloudArrowUpIcon className="mx-auto size-14 text-brand-600" /> : <CheckCircleIcon className="mx-auto size-14 text-emerald-600" />}
        <h2 className="mt-3 text-xl font-bold">{done.queued ? 'Saved on phone' : 'Truck sent'}</h2>
        <p className="mt-1 text-ink-600">
          {formatVehicleNo(done.vehicleNo)}
          {done.trip && (
            <>
              {' · '}Trip <b>{done.trip.tripNo}</b>
              {done.trip.challanNo && (
                <>
                  {' · '}Challan <b>{done.trip.challanNo}</b>
                </>
              )}
            </>
          )}
        </p>
        {done.queued && <p className="mt-2 text-sm text-ink-500">No network now. It will be sent automatically when the signal comes back.</p>}
        <Button size="xl" className="mt-6" onClick={reset}>Load next truck</Button>
      </Card>
    );
  }

  const blocked = error?.code === 'CREDIT_BLOCKED';

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card className="space-y-4 p-4">
        {fromRake ? (
          <SelectField
            big
            required
            label="Rake / ship"
            value={v.consignment}
            onChange={f.set('consignment')}
            error={f.errors.consignment}
            options={(rakes?.items ?? []).map((c) => ({ value: c._id, label: `${c.referenceType} ${c.referenceNo}`, hint: `${c.material?.name} · ${c.location?.name}` }))}
          />
        ) : (
          <SelectField big required label="From stockyard" value={v.sourceLocation} onChange={f.set('sourceLocation')} error={f.errors.consignment} options={toOptions(yards?.items)} />
        )}
        <SelectField big required label="Going to" value={v.destination} onChange={(val) => (f.set('destination')(val), f.set('order')(''))} error={f.errors.destination} options={destinationOptions} />
        {toCustomer && (
          <SelectField
            big
            required
            label="Customer order"
            value={v.order}
            onChange={f.set('order')}
            error={f.errors.order}
            options={siteOrders.map((o) => ({ value: o._id, label: `${o.orderNo} · ${o.customer?.name}`, hint: `${o.material?.name} · ${formatNumber(o.qty - o.dispatchedQty, 2)} ${o.material?.unit} left` }))}
            placeholder={siteOrders.length ? 'Choose order' : 'No open order for this site'}
          />
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <TextField big required label="Truck number" placeholder="MH12AB1234" autoCapitalize="characters" value={v.vehicleNo} onChange={f.set('vehicleNo')} onBlur={lookupVehicle} error={f.errors.vehicleNo} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField big required label="Driver name" value={v.driverName} onChange={f.set('driverName')} error={f.errors.driverName} />
          <TextField big required label="Driver mobile" inputMode="tel" value={v.driverPhone} onChange={f.set('driverPhone')} error={f.errors.driverPhone} />
        </div>
        <SelectField big required label="Transporter" value={v.transporter} onChange={f.set('transporter')} error={f.errors.transporter} options={toOptions(transporters?.items)} />
      </Card>

      <Card className="space-y-4 p-4">
        <p className="font-semibold">Weighbridge slip</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField big required label="Gross (loaded)" suffix="T" value={v.grossWeight} onChange={f.set('grossWeight')} error={f.errors.grossWeight} />
          <NumberField big required label="Empty truck" suffix="T" value={v.tareWeight} onChange={f.set('tareWeight')} error={f.errors.tareWeight} />
        </div>
        <div className="rounded-lg bg-ink-100 px-4 py-3 text-center">
          <span className="text-sm text-ink-600">Net load</span>
          <p className="tabular text-2xl font-bold">{net === null ? '—' : `${formatNumber(net, 3)} T`}</p>
        </div>
        {isBagged && <NumberField big required label="Bags loaded" inputMode="numeric" value={v.loadedBags} onChange={f.set('loadedBags')} error={f.errors.loadedBags} />}
        <TextField label="Slip number" value={v.slipNo} onChange={f.set('slipNo')} />
        <PhotoCapture value={photo} onChange={(p) => (setPhoto(p), f.setErrors((e) => ({ ...e, photo: undefined })))} error={f.errors.photo} />
      </Card>

      {blocked ? (
        <div role="alert" className="rounded-xl bg-red-700 p-4 text-white">
          <p className="flex items-center gap-2 text-lg font-bold">
            <NoSymbolIcon className="size-6" /> Dispatch blocked
          </p>
          <p className="mt-1">{error.message}</p>
          {error.data?.reasons && <p className="mt-1 text-sm">{error.data.reasons.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>}
          {error.data?.exposure !== undefined && (
            <p className="mt-1 text-sm">
              Exposure {formatINR(error.data.exposure)} · limit {formatINR(error.data.creditLimit)} · overdue {formatINR(error.data.overdueAmount)}
            </p>
          )}
          <p className="mt-2 text-sm">Do not load this truck. The owner has been told.</p>
        </div>
      ) : (
        <ErrorNote error={error} />
      )}

      <Button type="submit" size="xl" loading={busy}>
        Save & send truck
      </Button>
      <p className="text-center text-xs text-ink-500">Out time is taken from the server clock. Entered by {user.name}.</p>
    </form>
  );
}
