import { Anchor, Download01, Plus, Train } from '@untitledui/icons';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  CONSIGNMENT_MODE_LABELS,
  CONSIGNMENT_MODES,
  CONSIGNMENT_STATUS_LABELS,
  formatDateTime,
  formatNumber,
  formatQty,
  LATE_FEE_BASIS,
  LATE_FEE_BASIS_LABELS,
  PAPER_UNIT_LABELS,
  PAPER_UNITS,
  paperQtyToUnit,
  REFERENCE_TYPE_BY_MODE,
} from '@feather/shared';
import {
  Alert,
  Button,
  ConsignmentStatusBadge,
  DataTable,
  MiniTracker,
  Modal,
  NumberField,
  PageHeader,
  SelectField,
  shipmentTracking,
  TextAreaField,
  TextField,
  useApi,
  useForm,
  useToast,
} from '@feather/ui';
import { DocumentPicker, uploadDocuments } from '@/components/Documents.jsx';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';

const STATUS_FILTERS = [{ value: 'all', label: 'All shipments' }, ...Object.entries(CONSIGNMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))];
const MODE_ICON = { rail_rake: Train, river_barge: Anchor, coastal_ship: Anchor };
/** Rupees with paise (formatINR rounds to whole rupees; a per-unit rate needs paise). */
const formatINR2 = (v) => `₹${formatNumber(v, 2)}`;

export default function ConsignmentsPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('all');
  const [seller, setSeller] = useState('all');
  const creating = params.get('new') === '1';
  const setCreating = (on) => setParams(on ? { new: '1' } : {}, { replace: true });
  const { data, isLoading } = useGet('/consignments', { status: status === 'all' ? undefined : status, seller: seller === 'all' ? undefined : seller, limit: 300 });
  const { data: sellers } = useGet('/masters/sellers', { active: 'all' });
  const sellerFilters = [{ value: 'all', label: 'All sellers' }, ...toOptions(sellers?.items)];
  const navigate = useNavigate();
  const api = useApi();

  return (
    <>
      <PageHeader
        help="owner-rakes"
        title="Shipments"
        subtitle="Every train, barge or ship you buy, and the trucks loaded from it."
        actions={
          <>
            <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/consignments.xlsx')}>
              Excel
            </Button>
            <Button iconLeading={Plus} onPress={() => setCreating(true)}>
              New shipment
            </Button>
          </>
        }
      />
      <DataTable
        title="All shipments"
        badge={data ? <span className="text-sm text-tertiary">{data.items.length}</span> : undefined}
        actions={
          <div className="flex flex-wrap gap-3">
            <SelectField size="sm" value={seller} onChange={setSeller} options={sellerFilters} className="w-48" />
            <SelectField size="sm" value={status} onChange={setStatus} options={STATUS_FILTERS} className="w-44" />
          </div>
        }
        rows={isLoading ? undefined : data?.items}
        onRowClick={(c) => navigate(`/shipments/${c._id}`)}
        empty={isLoading ? 'Loading…' : 'No shipments yet. Add the first one.'}
        emptyIcon={Train}
        columns={[
          {
            key: 'ref',
            header: 'Shipment',
            sortable: true,
            sortValue: (c) => c.referenceNo,
            render: (c) => {
              const Icon = MODE_ICON[c.mode] ?? Train;
              return (
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium text-primary">{c.referenceNo}</p>
                    <p className="text-xs text-tertiary">{CONSIGNMENT_MODE_LABELS[c.mode]}</p>
                  </div>
                </div>
              );
            },
          },
          {
            key: 'seller',
            header: 'Seller',
            sortable: true,
            sortValue: (c) => c.seller?.name ?? c.supplier ?? '',
            // Older shipments have only the typed supplier name.
            render: (c) =>
              c.seller ? (
                <span className="text-primary">
                  {c.seller.name}
                  {!c.seller.active && <span className="text-tertiary"> (off)</span>}
                </span>
              ) : (
                <span className="text-tertiary">{c.supplier ?? '—'}</span>
              ),
          },
          { key: 'material', header: 'Material', render: (c) => c.material?.name },
          { key: 'location', header: 'Unloading point', render: (c) => c.location?.name },
          {
            key: 'progress',
            header: 'Progress',
            render: (c) => {
              const t = shipmentTracking(c);
              return <MiniTracker steps={t.steps} current={t.current} tone={t.tone} />;
            },
          },
          { key: 'qty', header: 'Unloaded / paper', align: 'right', render: (c) => `${formatQty(c.liftedQty, c.unit)} / ${formatQty(c.declaredQty, c.unit)}` },
          { key: 'trucks', header: 'Trucks', align: 'right', sortable: true, sortValue: (c) => c.tripCount, render: (c) => c.tripCount },
          { key: 'placed', header: 'Arrived', sortable: true, sortValue: (c) => c.placedAt ?? '', render: (c) => formatDateTime(c.placedAt) },
          { key: 'status', header: 'Status', render: (c) => <ConsignmentStatusBadge status={c.status} /> },
        ]}
      />
      {creating && <ConsignmentForm onClose={() => setCreating(false)} />}
    </>
  );
}

export function ConsignmentForm({ onClose, existing }) {
  const { data: materials } = useGet('/masters/materials');
  const { data: places } = useGet('/masters/locations', { type: 'siding,port' });
  const { data: sellers } = useGet('/masters/sellers', { active: 'all' });
  const blank = {
    mode: CONSIGNMENT_MODES.RAIL_RAKE,
    referenceNo: '',
    seller: '',
    material: '',
    location: '',
    declaredQty: '',
    declaredUnit: PAPER_UNITS.TONS,
    wagonCount: '',
    freeTimeHours: '9',
    demurrageBasis: LATE_FEE_BASIS.HOUR,
    demurrageRate: '',
    purchaseAmount: '',
    expectedAt: '',
    notes: '',
  };
  const initial = existing
    ? Object.fromEntries(
        Object.keys(blank).map((k) => {
          const val = existing[k];
          if (k === 'material' || k === 'location' || k === 'seller') return [k, val?._id ?? val ?? ''];
          if (k === 'expectedAt') return [k, val ? String(val).slice(0, 16) : ''];
          // Older shipments: late fee was per wagon per hour; purchase was a rate per unit.
          // Older shipments only have the quantity in the product's unit (bags → Bags, MT → Metric Tonne).
          if (k === 'declaredQty') return [k, existing.paperQty ?? val ?? ''];
          if (k === 'declaredUnit') return [k, val ?? (existing.unit === 'bag' ? PAPER_UNITS.BAGS : PAPER_UNITS.TONS)];
          if (k === 'demurrageBasis') return [k, val ?? LATE_FEE_BASIS.HOUR];
          if (k === 'demurrageRate') return [k, val ?? existing.demurrageRatePerWagonHour ?? ''];
          if (k === 'purchaseAmount') return [k, val ?? (existing.purchaseRatePerUnit ? Math.round(existing.purchaseRatePerUnit * existing.declaredQty * 100) / 100 : '')];
          return [k, val ?? ''];
        }),
      )
    : blank;
  const f = useForm(initial);
  const v = f.values;
  const findMaterial = (id) => materials?.items.find((m) => m._id === id);
  const material = findMaterial(v.material);
  const unit = material?.unit ?? 'unit';
  const productSeller = (id) => {
    const s = findMaterial(id)?.seller;
    return s?._id ?? s ?? '';
  };
  // Choosing a product fills in its seller (unless one was picked by hand) and a unit that suits it:
  // Bags for bagged cement, Metric Tonne for weighed material (Bags cannot be used for those).
  const chooseMaterial = (id) =>
    f.setValues((s) => {
      const m = findMaterial(id);
      const declaredUnit = m?.unit === 'bag' ? (s.declaredUnit === PAPER_UNITS.TONS && !s.declaredQty ? PAPER_UNITS.BAGS : s.declaredUnit) : s.declaredUnit === PAPER_UNITS.BAGS ? PAPER_UNITS.TONS : s.declaredUnit;
      return { ...s, material: id, declaredUnit, seller: !s.seller || s.seller === productSeller(s.material) ? productSeller(id) || s.seller : s.seller };
    });
  const unitOptions = Object.entries(PAPER_UNIT_LABELS)
    .filter(([value]) => !(material && material.unit !== 'bag' && value === PAPER_UNITS.BAGS))
    .map(([value, label]) => ({ value, label }));
  // The quantity in the product's own unit (what unloading is measured against), e.g. "= 50,000 bags".
  let qtyInUnit = null;
  try {
    qtyInUnit = material && Number(v.declaredQty) > 0 ? paperQtyToUnit(v.declaredQty, v.declaredUnit, material) : null;
  } catch {
    qtyInUnit = null;
  }
  const converts = material && qtyInUnit != null && !((material.unit === 'bag' && v.declaredUnit === PAPER_UNITS.BAGS) || (material.unit !== 'bag' && v.declaredUnit === PAPER_UNITS.TONS));
  const sellerOptions = (sellers?.items ?? [])
    .filter((s) => s.active || s._id === v.seller)
    .map((s) => ({ value: s._id, label: s.name, hint: s._id === productSeller(v.material) ? "This product's seller" : s.active ? undefined : 'Off' }));
  // Files to attach. They are uploaded right after the shipment is saved (they need its id).
  const [attachments, setAttachments] = useState([]);
  const toast = useToast();
  const save = useAction(
    async (api, body) => {
      const res = existing ? await api.patch(`/consignments/${existing._id}`, body) : await api.post('/consignments', body);
      const failed = attachments.length ? await uploadDocuments(api, res.item._id, attachments) : [];
      return { ...res, attached: attachments.length - failed.length, failed };
    },
    {
      success: (r) => (r.attached ? `Shipment saved with ${r.attached} document${r.attached === 1 ? '' : 's'}` : 'Shipment saved'),
      invalidate: ['/consignments', '/admin'],
      onSuccess: (r) => {
        // The shipment is saved either way; a file that failed can be added from the shipment page.
        if (r.failed.length) toast(`Could not attach: ${r.failed.join(', ')}. Add it from the shipment page.`, 'bad');
        onClose();
      },
      onError: (e) => f.setErrors(e.fields ?? { _: e.message }),
    },
  );
  const refType = REFERENCE_TYPE_BY_MODE[v.mode];
  const isTrain = v.mode === CONSIGNMENT_MODES.RAIL_RAKE;
  // "per hour", "per day", "one time" — shown in the amount's label (a unit box would wrap in the half-width column).
  const feeUnit = { hour: 'per hour', day: 'per day', once: 'one time' }[v.demurrageBasis];
  const feeHint = {
    hour: isTrain ? 'Charged for each started hour after free hours, × wagons.' : 'Charged for each started hour after free hours.',
    day: isTrain ? 'Charged for each started day after free hours, × wagons.' : 'Charged for each started day after free hours.',
    once: isTrain ? 'Charged once if late at all, × wagons.' : 'Charged once if late at all.',
  }[v.demurrageBasis];
  const perUnit = Number(v.purchaseAmount) > 0 && qtyInUnit > 0 ? Number(v.purchaseAmount) / qtyInUnit : null;

  // Default bill = quantity (in the product's unit) × the product's "Your cost" from Business setup.
  // It follows product / quantity / unit changes until the owner types their own amount.
  const cost = Number(material?.landedCostPerUnit) || 0;
  const defaultBill = cost > 0 && qtyInUnit > 0 ? Math.round(qtyInUnit * cost * 100) / 100 : null;
  // An existing shipment keeps the bill it was saved with.
  const [billTyped, setBillTyped] = useState(Boolean(existing && initial.purchaseAmount !== ''));
  useEffect(() => {
    if (billTyped) return;
    f.setValues((s) => (String(s.purchaseAmount) === String(defaultBill ?? '') ? s : { ...s, purchaseAmount: defaultBill ?? '' }));
    // f.setValues is a fresh function each render; only the default and the typed flag matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBill, billTyped]);
  const typeBill = (value) => {
    setBillTyped(true);
    f.set('purchaseAmount')(value);
  };
  const billHint = (() => {
    const worksOut = perUnit != null ? ` Works out to ${formatINR2(perUnit)} per ${unit}.` : '';
    if (!material) return "The total on the seller's bill. Only you can see this.";
    if (!cost) return `Set "Your cost" for ${material.name} in Business setup → Products to fill this in automatically.${worksOut}`;
    if (defaultBill == null) return `Fills in as quantity × your cost (${formatINR2(cost)} per ${unit}).`;
    const sum = `${formatQty(qtyInUnit, unit)} × ${formatINR2(cost)} = ${formatINR2(defaultBill)}`;
    return billTyped && Number(v.purchaseAmount) !== defaultBill ? `Default would be ${sum}.${worksOut}` : `${sum} (your cost from Business setup). Change it if the bill differs.`;
  })();
  // Wagons belong to a train only.
  const submit = () => save.mutate({ ...v, wagonCount: isTrain ? v.wagonCount : '' });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={Train}
      tone="brand"
      title={existing ? 'Edit shipment' : 'New shipment'}
      description="Add it when the shipment paper (RR or Bill of Lading) reaches you."
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} onPress={submit}>
            Save shipment
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Type" value={v.mode} onChange={f.set('mode')} options={Object.entries(CONSIGNMENT_MODE_LABELS).map(([value, label]) => ({ value, label, icon: MODE_ICON[value] }))} />
        <TextField label={refType === 'RR' ? 'Shipment paper no. (RR)' : 'Shipment paper no. (Bill of Lading)'} value={v.referenceNo} onChange={f.set('referenceNo')} error={f.errors.referenceNo} required />
        <SelectField label="Material" value={v.material} onChange={chooseMaterial} options={toOptions(materials?.items, (m) => m.unit)} error={f.errors.material} required />
        <SelectField
          label="Seller"
          value={v.seller}
          onChange={f.set('seller')}
          options={sellerOptions}
          error={f.errors.seller}
          hint={existing && !existing.seller && existing.supplier ? `Was typed as "${existing.supplier}". Choose the seller.` : 'Fills in from the product. Only you see it.'}
          required
        />
        <SelectField label="Unloading point" value={v.location} onChange={f.set('location')} options={toOptions(places?.items)} error={f.errors.location} required />
        {/* Full width: "Metric Tonne (MT)" needs a wide unit box, and the quantity still needs room for big numbers. */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="grid grid-cols-[minmax(0,1fr)_13rem] items-start gap-3">
            <NumberField label="Quantity" value={v.declaredQty} onChange={f.set('declaredQty')} error={f.errors.declaredQty} required />
            <SelectField label="Unit" value={v.declaredUnit} onChange={f.set('declaredUnit')} options={unitOptions} error={f.errors.declaredUnit} />
          </div>
          {converts && (
            <p className="text-sm text-tertiary">
              = {formatQty(qtyInUnit, unit)}
              {unit === 'bag' && ` (${formatNumber(material.bagWeightKg ?? 50, 0)} kg bags)`}
            </p>
          )}
        </div>
        {isTrain && <NumberField label="Wagons" inputMode="numeric" value={v.wagonCount} onChange={f.set('wagonCount')} error={f.errors.wagonCount} required />}
        <NumberField label="Free hours" suffix="hours" hint="Usually 5 to 9 hours for a train." value={v.freeTimeHours} onChange={f.set('freeTimeHours')} error={f.errors.freeTimeHours} required />
        <SelectField
          label={isTrain ? 'Late fee per wagon' : 'Late fee'}
          value={v.demurrageBasis}
          onChange={f.set('demurrageBasis')}
          error={f.errors.demurrageBasis}
          options={Object.entries(LATE_FEE_BASIS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <NumberField
          label={isTrain ? `Amount per wagon (${feeUnit})` : `Late fee amount (${feeUnit})`}
          prefix="₹"
          hint={feeHint}
          value={v.demurrageRate}
          onChange={f.set('demurrageRate')}
          error={f.errors.demurrageRate}
        />
        <div className="flex flex-col gap-1.5">
          <NumberField label="Total billing amount" prefix="₹" hint={billHint} value={v.purchaseAmount} onChange={typeBill} error={f.errors.purchaseAmount} />
          {billTyped && defaultBill != null && Number(v.purchaseAmount) !== defaultBill && (
            <Button size="sm" color="link-color" className="self-start" onPress={() => setBillTyped(false)}>
              Use default ({formatINR2(defaultBill)})
            </Button>
          )}
        </div>
        <TextField label="Expected arrival" type="datetime-local" value={v.expectedAt} onChange={f.set('expectedAt')} />
        <TextAreaField className="sm:col-span-2" label="Notes" value={v.notes ?? ''} onChange={f.set('notes')} />
        <fieldset className="flex flex-col gap-3 border-t border-secondary pt-5 sm:col-span-2">
          <div>
            <legend className="text-sm font-semibold text-primary">Attach bill / documents</legend>
            <p className="mt-0.5 text-sm text-tertiary">
              Optional. The seller&apos;s bill, the RR / Bill of Lading or other papers. Only you can see them.
              {existing && ' Documents already attached are on the shipment page.'}
            </p>
          </div>
          <DocumentPicker files={attachments} onChange={setAttachments} />
        </fieldset>
      </div>
      {f.errors._ && <Alert className="mt-5" title={f.errors._} />}
    </Modal>
  );
}
