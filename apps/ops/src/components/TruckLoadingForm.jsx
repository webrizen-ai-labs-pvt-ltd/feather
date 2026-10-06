import { Archive, Send01, SlashCircle01, Truck01 } from '@untitledui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as AriaLink, Form } from 'react-aria-components';
import {
  CREDIT_REASON_LABELS,
  fieldErrors,
  formatDate,
  formatINR,
  formatNumber,
  formatQty,
  formatVehicleNo,
  loadingSchema,
  LOCATION_TYPE_LABELS,
  LOCATION_TYPES,
  normalizeVehicleNo,
  PRICE_REQUEST_KINDS,
  routeFrom,
  UNLOADING_POINT_TYPES,
  WEIGH_METHOD_LABELS,
  WEIGH_METHODS,
} from '@feather/shared';
import { Alert, Button, ErrorNote, NumberField, PhotoCapture, SelectField, TextField, newId, toOptions, useApi, useAuth, useForm } from '@feather/ui';
import { FormStep, RateRequest, Readout, SavedScreen } from '@/components/FieldKit.jsx';
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
  weighMethod: 'weight',
  truckPrice: '',
  truckPriceReason: '',
  labourCost: '',
  labourCostReason: '',
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
  // Which owner rates staff are asking to change: { truckPrice?: true, labourCost?: true }
  const [asking, setAsking] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const fromRake = source === 'rake';
  // Only shipments that have arrived can be loaded from (not those still on the way).
  const { data: rakes } = useCachedGet(fromRake ? '/consignments' : null, { status: 'placed' });
  const { data: yards } = useCachedGet(fromRake ? null : '/masters/locations', { type: 'stockyard' });
  const { data: places } = useCachedGet('/masters/locations', { type: 'stockyard,customer_site' });
  const { data: transporters } = useCachedGet('/masters/transporters');
  const { data: orders } = useCachedGet('/sales/orders', { status: 'open' });
  const { data: stations } = useCachedGet(fromRake ? '/masters/locations' : null, { type: UNLOADING_POINT_TYPES.join(',') });

  const rake = rakes?.items.find((c) => c._id === v.consignment);
  const destination = places?.items.find((l) => l._id === v.destination);
  const toCustomer = destination?.type === LOCATION_TYPES.CUSTOMER_SITE;
  const order = orders?.items.find((o) => o._id === v.order);
  const materialId = rake?.material?._id ?? order?.material?._id;
  // First in, first out: which shipment's stock to load from this warehouse.
  const { data: fifo } = useCachedGet(!fromRake && v.sourceLocation && materialId ? '/stock/fifo-next' : null, { location: v.sourceLocation, material: materialId });
  const fifoNext = fifo?.items?.[0];
  const material = rake?.material ?? order?.material;
  const isBagged = material?.unit === 'bag';
  // Bag count only works for bagged material; until the material is known, offer both.
  const knownBulk = Boolean(material) && !isBagged;
  const method = knownBulk ? WEIGH_METHODS.WEIGHT : v.weighMethod;
  const byBags = method === WEIGH_METHODS.BAGS;
  const bagWeightKg = material?.bagWeightKg ?? 50;
  const methodOptions = Object.entries(WEIGH_METHOD_LABELS)
    .filter(([value]) => !(knownBulk && value === WEIGH_METHODS.BAGS))
    .map(([value, label]) => ({ value, label, hint: value === WEIGH_METHODS.BAGS ? 'Cement in bags' : 'From the weighbridge slip' }));
  const siteOrders = (orders?.items ?? []).filter((o) => (o.deliverySite?._id ?? o.deliverySite) === v.destination && (!materialId || !rake || (o.material?._id ?? o.material) === materialId));
  const bags = Number(v.loadedBags);
  const net = byBags
    ? Number.isInteger(bags) && bags > 0
      ? (bags * bagWeightKg) / 1000
      : null
    : Number(v.grossWeight) > Number(v.tareWeight) && Number(v.tareWeight) > 0
      ? Number(v.grossWeight) - Number(v.tareWeight)
      : null;
  // Owner's price per truck for this shipment's unloading point → the chosen place (from the cached places list, so it works offline).
  const route = fromRake ? routeFrom(destination, rake?.location?._id) : null;
  const quoted = route?.pricePerTruck;
  // Unloading labour at the shipment's station / port (also from the cached list).
  const station = stations?.items.find((s) => s._id === rake?.location?._id);
  const labourQuoted = station?.labourCostPerTruck;
  const otherLabourRates = [
    station?.labourCostPerWagon != null && `${formatINR(station.labourCostPerWagon)} per wagon`,
    station?.labourCostPerKg != null && `₹${formatNumber(station.labourCostPerKg, 2)} per kg`,
  ]
    .filter(Boolean)
    .join(' · ');
  const quotes = { truckPrice: quoted, labourCost: labourQuoted };

  /** Props for one RateRequest: its switch, new amount and reason, wired to the form. */
  const rateProps = (kind) => ({
    asking: Boolean(asking[kind]),
    onAskingChange: (on) => {
      setAsking((a) => ({ ...a, [kind]: on }));
      f.setErrors((e) => ({ ...e, [kind]: undefined, [`${kind}Reason`]: undefined }));
    },
    value: v[kind],
    onChange: f.set(kind),
    error: f.errors[kind],
    reason: v[`${kind}Reason`],
    onReasonChange: f.set(`${kind}Reason`),
    reasonError: f.errors[`${kind}Reason`],
  });

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
    // Only shipment trucks carry owner rates; send a new amount + reason only where staff are asking.
    const asked = Object.keys(PRICE_REQUEST_KINDS).filter((kind) => fromRake && asking[kind]);
    const requestFields = Object.fromEntries(
      Object.keys(PRICE_REQUEST_KINDS).flatMap((kind) => {
        const on = asked.includes(kind);
        return [
          [kind, on ? v[kind] : undefined],
          [`${kind}Reason`, on ? v[`${kind}Reason`] : undefined],
        ];
      }),
    );
    const fields = {
      ...Object.fromEntries(Object.entries(v).filter(([, val]) => val !== '')),
      order: toCustomer ? v.order : undefined,
      loadedBags: isBagged || byBags ? v.loadedBags : undefined,
      weighMethod: method,
      grossWeight: byBags ? undefined : v.grossWeight || undefined,
      tareWeight: byBags ? undefined : v.tareWeight || undefined,
      consignment: fromRake ? v.consignment : undefined,
      sourceLocation: fromRake ? undefined : v.sourceLocation,
      ...requestFields,
      clientId: newId(),
      deviceTime: new Date().toISOString(),
    };
    // Same rules as the server, checked on the phone first (works offline).
    const check = loadingSchema.safeParse(fields);
    const errs = check.success ? {} : fieldErrors(check.error);
    if (toCustomer && !v.order) errs.order = 'Choose the customer order';
    if (isBagged && !v.loadedBags) errs.loadedBags = 'Enter number of bags';
    for (const kind of asked) {
      const name = PRICE_REQUEST_KINDS[kind].label.toLowerCase();
      if (v[kind] === '') errs[kind] = `Enter the new ${name}`;
      else if (Number(v[kind]) === quotes[kind]) errs[kind] = `This is the same as the owner's ${name}. Turn off the switch.`;
    }
    if (!photo) errs.photo = 'Take a photo of the weighbridge slip';
    if (Object.keys(errs).length) {
      f.setErrors(errs);
      setError('Please fix the boxes marked in red.');
      return;
    }
    setBusy(true);
    try {
      const res = await submit({ path: '/trips/loading', fields, photo, label: `Loading ${formatVehicleNo(fields.vehicleNo)}` });
      setDone({ queued: res.queued, trip: res.data?.item, vehicleNo: fields.vehicleNo, asked: asked.map((kind) => [kind, Number(v[kind])]) });
      qc.invalidateQueries();
    } catch (err) {
      if (err.fields) f.setErrors(err.fields);
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    // Keep where it's going and how it's weighed — the next truck is usually the same.
    f.setValues((s) => ({ ...EMPTY, consignment: s.consignment, sourceLocation: s.sourceLocation, destination: s.destination, order: s.order, weighMethod: s.weighMethod }));
    f.setErrors({});
    setPhoto(null);
    setAsking({});
    setDone(null);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <SavedScreen
        queued={done.queued}
        title="Truck sent"
        lines={[
          formatVehicleNo(done.vehicleNo),
          done.trip && `Trip ${done.trip.tripNo}${done.trip.challanNo ? ` · Delivery note ${done.trip.challanNo}` : ''}`,
          ...done.asked.map(([kind, amount]) => `New ${PRICE_REQUEST_KINDS[kind].label.toLowerCase()} ${formatINR(amount)} sent to the owner for approval`),
        ].filter(Boolean)}
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
            hint={rakes && !rakes.items.length ? undefined : 'Only shipments that have arrived are shown.'}
            options={(rakes?.items ?? []).map((c) => ({ value: c._id, label: c.referenceNo, hint: `${c.material?.name} · ${c.location?.name}` }))}
          />
        ) : (
          <SelectField big required label="From warehouse" value={v.sourceLocation} onChange={f.set('sourceLocation')} error={f.errors.consignment} options={toOptions(yards?.items)} />
        )}
        {fromRake && rakes && !rakes.items.length && (
          <Alert tone="warning" title="No shipment has arrived yet">
            When the train or ship reaches the unloading point, mark it as arrived on the{' '}
            <AriaLink href="/loading" className="font-semibold underline outline-focus-ring focus-visible:outline-2">
              Shipments
            </AriaLink>{' '}
            screen. Then it shows here.
          </Alert>
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
        {fifoNext && (
          <Alert tone={fifoNext.shelf?.status === 'expired' ? 'warning' : 'brand'} icon={Archive} title={`Load from ${fifoNext.stockId ? `stock ${fifoNext.stockId}` : fifoNext.shipment ? `${fifoNext.shipment.referenceType} ${fifoNext.shipment.referenceNo}` : 'the older stock'}`}>
            Oldest stock first{fifoNext.stockId && fifoNext.shipment ? ` (shipment ${fifoNext.shipment.referenceNo})` : ''}. {formatQty(fifoNext.qty, fifoNext.unit)} left from it
            {fifoNext.manufacturedAt ? `, made ${formatDate(fifoNext.manufacturedAt)}` : fifoNext.arrivedAt ? `, arrived ${formatDate(fifoNext.arrivedAt)}` : ''}
            {fifoNext.shelf?.status === 'expired' ? ' — past shelf life, check the bags before loading.' : '.'}
            {fifo.items[1] && ` Then ${fifo.items[1].stockId ?? fifo.items[1].shipment?.referenceNo ?? 'older stock'}.`}
          </Alert>
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

      <FormStep
        n={3}
        title="Weighbridge slip"
        description={byBags ? 'Count the bags loaded on the truck, then take a photo of the loaded truck or bag challan.' : 'Type the numbers exactly as printed, then take a photo of the slip.'}
      >
        <SelectField
          big
          required
          label="Calculation method"
          hint={knownBulk ? 'This material is weighed. Bag count is only for cement in bags.' : 'How the material weight is worked out.'}
          value={method}
          onChange={f.set('weighMethod')}
          error={f.errors.weighMethod}
          options={methodOptions}
        />
        {byBags ? (
          <NumberField big required label="Bags loaded" inputMode="numeric" value={v.loadedBags} onChange={f.set('loadedBags')} error={f.errors.loadedBags} />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <NumberField big required label="Full truck" suffix="T" value={v.grossWeight} onChange={f.set('grossWeight')} error={f.errors.grossWeight} />
            <NumberField big required label="Empty truck" suffix="T" value={v.tareWeight} onChange={f.set('tareWeight')} error={f.errors.tareWeight} />
          </div>
        )}
        <Readout label={byBags ? `Material weight (${formatNumber(bagWeightKg, 0)} kg per bag)` : 'Material weight'} value={net === null ? '—' : `${formatNumber(net, 3)} T`} />
        {isBagged && !byBags && <NumberField big required label="Bags loaded" inputMode="numeric" value={v.loadedBags} onChange={f.set('loadedBags')} error={f.errors.loadedBags} />}
        <TextField label={byBags ? 'Challan / slip number' : 'Slip number'} value={v.slipNo} onChange={f.set('slipNo')} />
        <PhotoCapture
          label={byBags ? 'Photo of loaded truck or bag challan' : undefined}
          value={photo}
          onChange={(p) => (setPhoto(p), f.setErrors((e) => ({ ...e, photo: undefined })))}
          error={f.errors.photo}
        />
      </FormStep>

      {fromRake && (
        <FormStep n={4} title="Labour cost" description="Unloading labour for this truck, set by the owner for this station / port. You can ask for a different cost — the owner must approve it.">
          {!rake ? (
            <p className="text-sm text-tertiary">Choose the shipment to see the labour cost.</p>
          ) : (
            <RateRequest
              {...rateProps('labourCost')}
              label="Labour cost per truck"
              quoted={labourQuoted}
              details={[
                `${rake.location?.name ?? 'Unloading point'}${station ? ` · ${LOCATION_TYPE_LABELS[station.type]}` : ''}`,
                otherLabourRates,
                labourQuoted == null && 'the owner has not set a per-truck labour cost here yet',
              ]
                .filter(Boolean)
                .join(' · ')}
              askLabel="Ask for a different labour cost"
              askHint="For example, extra labour was needed for wet or torn bags."
              reasonPlaceholder="e.g. 2 extra labourers for torn bags"
            />
          )}
        </FormStep>
      )}

      {fromRake && (
        <FormStep n={5} title="Payment" description="Price per truck set by the owner for this route. You can ask for a different price — the owner must approve it.">
          {!rake || !destination ? (
            <p className="text-sm text-tertiary">Choose the shipment and where the truck is going to see the price.</p>
          ) : (
            <RateRequest
              {...rateProps('truckPrice')}
              label="Price per truck"
              quoted={quoted}
              details={`${rake.location?.name} → ${destination.name}${route?.distanceKm ? ` · ${formatNumber(route.distanceKm, 1)} km` : ''}${quoted == null ? ' · the owner has not set a price for this route yet' : ''}`}
              askLabel="Ask for a different price"
              askHint="For example, the truck company wants more because of a longer road."
              reasonPlaceholder="e.g. main road closed, truck has to go the long way"
            />
          )}
        </FormStep>
      )}

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
