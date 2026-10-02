import { Anchor, Download01, Plus, Train } from '@untitledui/icons';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CONSIGNMENT_MODE_LABELS, CONSIGNMENT_MODES, CONSIGNMENT_STATUS_LABELS, formatDateTime, formatQty, REFERENCE_TYPE_BY_MODE } from '@feather/shared';
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
} from '@feather/ui';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';

const STATUS_FILTERS = [{ value: 'all', label: 'All shipments' }, ...Object.entries(CONSIGNMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))];
const MODE_ICON = { rail_rake: Train, river_barge: Anchor, coastal_ship: Anchor };

export default function ConsignmentsPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('all');
  const creating = params.get('new') === '1';
  const setCreating = (on) => setParams(on ? { new: '1' } : {}, { replace: true });
  const { data, isLoading } = useGet('/consignments', { status: status === 'all' ? undefined : status, limit: 300 });
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
        actions={<SelectField size="sm" value={status} onChange={setStatus} options={STATUS_FILTERS} className="w-44" />}
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
                    <p className="text-xs text-tertiary">
                      {CONSIGNMENT_MODE_LABELS[c.mode]} · {c.supplier}
                    </p>
                  </div>
                </div>
              );
            },
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
  const blank = { mode: CONSIGNMENT_MODES.RAIL_RAKE, referenceNo: '', supplier: '', material: '', location: '', declaredQty: '', wagonCount: '', freeTimeHours: '7', demurrageRatePerWagonHour: '', purchaseRatePerUnit: '', freightRatePerUnit: '', expectedAt: '', notes: '' };
  const initial = existing
    ? Object.fromEntries(
        Object.keys(blank).map((k) => {
          const val = existing[k];
          if (k === 'material' || k === 'location') return [k, val?._id ?? val ?? ''];
          if (k === 'expectedAt') return [k, val ? String(val).slice(0, 16) : ''];
          return [k, val ?? ''];
        }),
      )
    : blank;
  const f = useForm(initial);
  const v = f.values;
  const unit = materials?.items.find((m) => m._id === v.material)?.unit ?? 'unit';
  const save = useAction((api, body) => (existing ? api.patch(`/consignments/${existing._id}`, body) : api.post('/consignments', body)), {
    success: 'Shipment saved',
    invalidate: ['/consignments', '/admin'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { _: e.message }),
  });
  const refType = REFERENCE_TYPE_BY_MODE[v.mode];
  const isTrain = v.mode === CONSIGNMENT_MODES.RAIL_RAKE;

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
          <Button isLoading={save.isPending} onPress={() => save.mutate(v)}>
            Save shipment
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Type" value={v.mode} onChange={f.set('mode')} options={Object.entries(CONSIGNMENT_MODE_LABELS).map(([value, label]) => ({ value, label, icon: MODE_ICON[value] }))} />
        <TextField label={refType === 'RR' ? 'Shipment paper no. (RR)' : 'Shipment paper no. (Bill of Lading)'} value={v.referenceNo} onChange={f.set('referenceNo')} error={f.errors.referenceNo} required />
        <TextField label="Supplier" value={v.supplier} onChange={f.set('supplier')} error={f.errors.supplier} required />
        <SelectField label="Material" value={v.material} onChange={f.set('material')} options={toOptions(materials?.items, (m) => m.unit)} error={f.errors.material} required />
        <SelectField label="Unloading point" value={v.location} onChange={f.set('location')} options={toOptions(places?.items)} error={f.errors.location} required />
        <NumberField label="Quantity on the paper" suffix={unit} value={v.declaredQty} onChange={f.set('declaredQty')} error={f.errors.declaredQty} required />
        {isTrain && <NumberField label="Wagons" value={v.wagonCount} onChange={f.set('wagonCount')} error={f.errors.wagonCount} />}
        <NumberField label="Free hours" suffix="hours" hint="Usually 5 to 9 hours for a train." value={v.freeTimeHours} onChange={f.set('freeTimeHours')} error={f.errors.freeTimeHours} required />
        <NumberField label={isTrain ? 'Late fee per wagon per hour' : 'Late fee per hour'} prefix="₹" value={v.demurrageRatePerWagonHour} onChange={f.set('demurrageRatePerWagonHour')} error={f.errors.demurrageRatePerWagonHour} />
        <NumberField label={`Purchase rate per ${unit}`} prefix="₹" hint="Only you can see this." value={v.purchaseRatePerUnit} onChange={f.set('purchaseRatePerUnit')} />
        <NumberField label={`Truck rate per ${unit}`} prefix="₹" hint="Blank = truck company's usual rate." value={v.freightRatePerUnit} onChange={f.set('freightRatePerUnit')} />
        <TextField label="Expected arrival" type="datetime-local" value={v.expectedAt} onChange={f.set('expectedAt')} />
        <TextAreaField className="sm:col-span-2" label="Notes" value={v.notes ?? ''} onChange={f.set('notes')} />
      </div>
      {f.errors._ && <Alert className="mt-5" title={f.errors._} />}
    </Modal>
  );
}
