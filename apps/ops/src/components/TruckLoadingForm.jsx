import { Send01, SlashCircle01, Truck01 } from '@untitledui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Form } from 'react-aria-components';
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
import { Alert, Button, ErrorNote, NumberField, PhotoCapture, SelectField, TextField, newId, toOptions, useApi, useAuth, useForm } from '@feather/ui';
import { FormStep, Readout, SavedScreen } from '@/components/FieldKit.jsx';
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
 * One form for every truck that leaves: from a shipment (loading staff)
 * or from our warehouse to a customer (dispatch). Works offline.
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
        .map((l) => ({ value: l._id, label: l.name, hint: l.type === 'stockyard' ? 'Our warehouse' : `Delivery site${l.customer?.name ? ` · ${l.customer.name}` : ''}` })),
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
      <SavedScreen
        queued={done.queued}
        title="Truck sent"
        lines={[formatVehicleNo(done.vehicleNo), done.trip && `Trip ${done.trip.tripNo}${done.trip.challanNo ? ` · Delivery note ${done.trip.challanNo}` : ''}`].filter(Boolean)}
        action={
          <Button size="xl" className="w-full" iconLeading={Truck01} onPress={reset}>
            Load next truck
          </Button>
        }
      />
    );
  }

  const blocked = error?.code === 'CREDIT_BLOCKED';

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-5">
      <FormStep n={1} title="Where is it going?" description={fromRake ? 'Pick the shipment the material comes from.' : 'Pick the warehouse and the customer order.'}>
        {fromRake ? (
          <SelectField
            big
            required
            label="Shipment"
            value={v.consignment}
            onChange={f.set('consignment')}
            error={f.errors.consignment}
            options={(rakes?.items ?? []).map((c) => ({ value: c._id, label: c.referenceNo, hint: `${c.material?.name} · ${c.location?.name}` }))}
          />
        ) : (
          <SelectField big required label="From warehouse" value={v.sourceLocation} onChange={f.set('sourceLocation')} error={f.errors.consignment} options={toOptions(yards?.items)} />
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
      </FormStep>

      <FormStep n={2} title="Truck and driver" description="If the truck came before, driver and company fill in by themselves.">
        <TextField big required label="Truck number" placeholder="MH12AB1234" autoCapitalize="characters" value={v.vehicleNo} onChange={f.set('vehicleNo')} onBlur={lookupVehicle} error={f.errors.vehicleNo} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField big required label="Driver name" value={v.driverName} onChange={f.set('driverName')} error={f.errors.driverName} />
          <TextField big required label="Driver mobile" inputMode="tel" value={v.driverPhone} onChange={f.set('driverPhone')} error={f.errors.driverPhone} />
        </div>
        <SelectField big required label="Truck company" value={v.transporter} onChange={f.set('transporter')} error={f.errors.transporter} options={toOptions(transporters?.items)} />
      </FormStep>

      <FormStep n={3} title="Weighbridge slip" description="Type the numbers exactly as printed, then take a photo of the slip.">
        <div className="grid grid-cols-2 gap-4">
          <NumberField big required label="Full truck" suffix="T" value={v.grossWeight} onChange={f.set('grossWeight')} error={f.errors.grossWeight} />
          <NumberField big required label="Empty truck" suffix="T" value={v.tareWeight} onChange={f.set('tareWeight')} error={f.errors.tareWeight} />
        </div>
        <Readout label="Material weight" value={net === null ? '—' : `${formatNumber(net, 3)} T`} />
        {isBagged && <NumberField big required label="Bags loaded" inputMode="numeric" value={v.loadedBags} onChange={f.set('loadedBags')} error={f.errors.loadedBags} />}
        <TextField label="Slip number" value={v.slipNo} onChange={f.set('slipNo')} />
        <PhotoCapture value={photo} onChange={(p) => (setPhoto(p), f.setErrors((e) => ({ ...e, photo: undefined })))} error={f.errors.photo} />
      </FormStep>

      {blocked ? (
        <Alert tone="error" icon={SlashCircle01} title="Customer on hold — do not load this truck">
          <p>{error.message}</p>
          {error.data?.reasons && <p className="mt-1">{error.data.reasons.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>}
          {error.data?.exposure !== undefined && (
            <p className="mt-1">
              Total owed {formatINR(error.data.exposure)} · limit {formatINR(error.data.creditLimit)} · overdue {formatINR(error.data.overdueAmount)}
            </p>
          )}
          <p className="mt-1">The owner has been told.</p>
        </Alert>
      ) : (
        <ErrorNote error={error} />
      )}

      <Button type="submit" size="xl" className="w-full" iconLeading={Send01} isLoading={busy}>
        Save & send truck
      </Button>
      <p className="text-center text-xs text-tertiary">The time is taken from the server clock. Entered by {user.name}.</p>
    </Form>
  );
}
