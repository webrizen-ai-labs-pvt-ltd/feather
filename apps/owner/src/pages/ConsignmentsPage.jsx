import { ArrowDownTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CONSIGNMENT_MODE_LABELS,
  CONSIGNMENT_MODES,
  CONSIGNMENT_STATUS_LABELS,
  formatDateTime,
  formatQty,
  REFERENCE_TYPE_BY_MODE,
} from '@feather/shared';
import {
  Button,
  Card,
  ConsignmentStatusBadge,
  DataTable,
  Loading,
  Modal,
  NumberField,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
  useApi,
  useForm,
} from '@feather/ui';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';

const STATUS_FILTERS = [{ value: '', label: 'All' }, ...Object.entries(CONSIGNMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))];

export default function ConsignmentsPage() {
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useGet('/consignments', { status: status || undefined, limit: 300 });
  const navigate = useNavigate();
  const api = useApi();

  return (
    <>
      <PageHeader
        title="Rakes & ships"
        subtitle="Each parent consignment (RR / Bill of Lading) and the trucks lifted from it."
        actions={
          <>
            <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/consignments.xlsx')}>
              Excel
            </Button>
            <Button icon={PlusIcon} onClick={() => setCreating(true)}>
              New rake / ship
            </Button>
          </>
        }
      />
      <div className="mb-4 max-w-56">
        <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>
      <Card>
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={data?.items}
            onRowClick={(c) => navigate(`/consignments/${c._id}`)}
            empty="No rakes or ships yet. Add the first one."
            columns={[
              { key: 'ref', header: 'RR / BL', render: (c) => <span className="font-semibold">{c.referenceType} {c.referenceNo}</span> },
              { key: 'mode', header: 'Type', render: (c) => CONSIGNMENT_MODE_LABELS[c.mode] },
              { key: 'material', header: 'Material', render: (c) => c.material?.name },
              { key: 'location', header: 'Siding / port', render: (c) => c.location?.name },
              { key: 'declared', header: 'Declared', align: 'right', render: (c) => formatQty(c.declaredQty, c.unit) },
              { key: 'lifted', header: 'Lifted', align: 'right', render: (c) => formatQty(c.liftedQty, c.unit) },
              { key: 'trucks', header: 'Trucks', align: 'right', render: (c) => c.tripCount },
              { key: 'placed', header: 'Placed', render: (c) => formatDateTime(c.placedAt) },
              { key: 'status', header: 'Status', render: (c) => <ConsignmentStatusBadge status={c.status} /> },
            ]}
          />
        )}
      </Card>
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
  const save = useAction(
    (api, body) => (existing ? api.patch(`/consignments/${existing._id}`, body) : api.post('/consignments', body)),
    { success: 'Saved', invalidate: ['/consignments', '/admin'], onSuccess: onClose, onError: (e) => f.setErrors(e.fields ?? { _: e.message }) },
  );
  const refType = REFERENCE_TYPE_BY_MODE[v.mode];
  const pick = ({ mode, referenceNo, supplier, material, location, declaredQty, wagonCount, freeTimeHours, demurrageRatePerWagonHour, purchaseRatePerUnit, freightRatePerUnit, expectedAt, notes }) => ({
    mode, referenceNo, supplier, material, location, declaredQty, wagonCount, freeTimeHours, demurrageRatePerWagonHour, purchaseRatePerUnit, freightRatePerUnit, expectedAt, notes,
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={existing ? 'Edit rake / ship' : 'New rake / ship'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate(pick(v))}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" value={v.mode} onChange={f.set('mode')} options={Object.entries(CONSIGNMENT_MODE_LABELS).map(([value, label]) => ({ value, label }))} />
        <TextField label={refType === 'RR' ? 'Railway Receipt (RR) no.' : 'Bill of Lading no.'} value={v.referenceNo} onChange={f.set('referenceNo')} error={f.errors.referenceNo} required />
        <TextField label="Supplier" value={v.supplier} onChange={f.set('supplier')} error={f.errors.supplier} required />
        <SelectField label="Material" value={v.material} onChange={f.set('material')} options={toOptions(materials?.items, (m) => m.unit)} error={f.errors.material} required />
        <SelectField label="Siding / port" value={v.location} onChange={f.set('location')} options={toOptions(places?.items, (l) => l.type)} error={f.errors.location} required />
        <NumberField label={`Quantity on ${refType}`} suffix={unit} value={v.declaredQty} onChange={f.set('declaredQty')} error={f.errors.declaredQty} required />
        {v.mode === CONSIGNMENT_MODES.RAIL_RAKE && <NumberField label="Wagons" value={v.wagonCount} onChange={f.set('wagonCount')} error={f.errors.wagonCount} />}
        <NumberField label="Free time" suffix="hours" hint="Usually 5 to 9 hours for a rake." value={v.freeTimeHours} onChange={f.set('freeTimeHours')} error={f.errors.freeTimeHours} required />
        <NumberField label={v.mode === CONSIGNMENT_MODES.RAIL_RAKE ? 'Demurrage ₹ per wagon per hour' : 'Penalty ₹ per hour'} value={v.demurrageRatePerWagonHour} onChange={f.set('demurrageRatePerWagonHour')} error={f.errors.demurrageRatePerWagonHour} />
        <NumberField label={`Purchase rate ₹ per ${unit}`} hint="Only you can see this." value={v.purchaseRatePerUnit} onChange={f.set('purchaseRatePerUnit')} />
        <NumberField label={`Road freight ₹ per ${unit}`} hint="Blank = transporter's usual rate." value={v.freightRatePerUnit} onChange={f.set('freightRatePerUnit')} />
        <TextField label="Expected arrival" type="datetime-local" value={v.expectedAt} onChange={f.set('expectedAt')} />
        <TextAreaField className="sm:col-span-2" label="Notes" value={v.notes ?? ''} onChange={f.set('notes')} />
      </div>
      {f.errors._ && <p className="mt-3 text-sm font-medium text-red-700">{f.errors._}</p>}
    </Modal>
  );
}
