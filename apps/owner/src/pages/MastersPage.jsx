import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatINR, formatPct, LOCATION_TYPE_LABELS, MATERIAL_KINDS } from '@feather/shared';
import { Button, Card, DataTable, Modal, NumberField, PageHeader, SelectField, SwitchField, Tabs, TextField, useForm } from '@feather/ui';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';

export default function MastersPage() {
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(null);
  const { data: materials } = useGet('/masters/materials', { active: 'all' });
  const { data: locations } = useGet('/masters/locations', { active: 'all' });
  const { data: settings } = useGet('/admin/settings');
  const defTol = settings?.settings.defaultTransitLossTolerancePct;

  return (
    <>
      <PageHeader
        title="Materials & places"
        actions={<Button icon={PlusIcon} onClick={() => setEditing({ kind: tab === 0 ? 'material' : 'location' })}>{tab === 0 ? 'New material' : 'New place'}</Button>}
      />
      <Card className="p-4">
        <Tabs
          selectedIndex={tab}
          onChange={setTab}
          tabs={[
            {
              label: 'Materials',
              count: materials?.items.length,
              content: (
                <DataTable
                  dense
                  rows={materials?.items}
                  columns={[
                    { key: 'name', header: 'Name', render: (m) => <span className="font-medium">{m.name}</span> },
                    { key: 'kind', header: 'Counted in', render: (m) => (m.kind === 'bagged' ? `Bags of ${m.bagWeightKg} kg` : 'MT (weight)') },
                    { key: 'tol', header: 'Allowed road loss', align: 'right', render: (m) => formatPct(m.transitLossTolerancePct ?? defTol) + (m.transitLossTolerancePct == null ? ' (default)' : '') },
                    { key: 'density', header: 'Density t/m³', align: 'right', render: (m) => m.densityTPerM3 ?? '—' },
                    { key: 'cost', header: 'Landed cost', align: 'right', render: (m) => `${formatINR(m.landedCostPerUnit)} / ${m.unit}` },
                    { key: 'active', header: 'Active', render: (m) => (m.active ? 'Yes' : 'No') },
                    { key: 'e', header: '', render: (m) => <Button size="sm" variant="ghost" icon={PencilSquareIcon} onClick={() => setEditing({ kind: 'material', item: m })}>Edit</Button> },
                  ]}
                />
              ),
            },
            {
              label: 'Sidings, yards & sites',
              count: locations?.items.length,
              content: (
                <DataTable
                  dense
                  rows={locations?.items}
                  columns={[
                    { key: 'name', header: 'Name', render: (l) => <span className="font-medium">{l.name}</span> },
                    { key: 'type', header: 'Type', render: (l) => LOCATION_TYPE_LABELS[l.type] },
                    { key: 'customer', header: 'Customer', render: (l) => l.customer?.name ?? '—' },
                    { key: 'hours', header: 'Normal road time', align: 'right', render: (l) => (l.expectedTransitHours ? `${l.expectedTransitHours} h` : '—') },
                    { key: 'active', header: 'Active', render: (l) => (l.active ? 'Yes' : 'No') },
                    { key: 'e', header: '', render: (l) => <Button size="sm" variant="ghost" icon={PencilSquareIcon} onClick={() => setEditing({ kind: 'location', item: l })}>Edit</Button> },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
      {editing?.kind === 'material' && <MaterialForm existing={editing.item} onClose={() => setEditing(null)} />}
      {editing?.kind === 'location' && <LocationForm existing={editing.item} onClose={() => setEditing(null)} />}
    </>
  );
}

function FormModal({ title, onClose, onSave, saving, children }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={onSave}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Modal>
  );
}

function MaterialForm({ existing, onClose }) {
  const f = useForm({
    name: existing?.name ?? '',
    kind: existing?.kind ?? MATERIAL_KINDS.BULK,
    bagWeightKg: existing?.bagWeightKg ?? 50,
    transitLossTolerancePct: existing?.transitLossTolerancePct ?? '',
    densityTPerM3: existing?.densityTPerM3 ?? '',
    landedCostPerUnit: existing?.landedCostPerUnit ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, b) => (existing ? api.patch(`/masters/materials/${existing._id}`, b) : api.post('/masters/materials', b)), {
    success: 'Saved',
    invalidate: ['/masters'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  const unit = v.kind === 'bagged' ? 'bag' : 'MT';
  return (
    <FormModal title={existing ? 'Edit material' : 'New material'} onClose={onClose} saving={save.isPending} onSave={() => save.mutate(v)}>
      <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
      <SelectField label="Counted in" value={v.kind} onChange={f.set('kind')} disabled={Boolean(existing)} options={[{ value: 'bulk', label: 'Weight (MT) — sand, aggregate, soil' }, { value: 'bagged', label: 'Bags — cement' }]} />
      {v.kind === 'bagged' && <NumberField label="Bag weight" suffix="kg" value={v.bagWeightKg} onChange={f.set('bagWeightKg')} />}
      <NumberField label="Allowed road loss" suffix="%" hint="e.g. 0.5 for wet sand. Blank = default." value={v.transitLossTolerancePct} onChange={f.set('transitLossTolerancePct')} error={f.errors.transitLossTolerancePct} />
      {v.kind === 'bulk' && <NumberField label="Density" suffix="t/m³" hint="For brass ↔ MT." value={v.densityTPerM3} onChange={f.set('densityTPerM3')} />}
      <NumberField label={`Landed cost per ${unit}`} suffix="₹" hint="Used to value losses. Only you see this." value={v.landedCostPerUnit} onChange={f.set('landedCostPerUnit')} />
      <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
    </FormModal>
  );
}

function LocationForm({ existing, onClose }) {
  const { data: customers } = useGet('/masters/customers');
  const f = useForm({
    name: existing?.name ?? '',
    type: existing?.type ?? 'stockyard',
    address: existing?.address ?? '',
    customer: existing?.customer?._id ?? existing?.customer ?? '',
    expectedTransitHours: existing?.expectedTransitHours ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, b) => (existing ? api.patch(`/masters/locations/${existing._id}`, b) : api.post('/masters/locations', b)), {
    success: 'Saved',
    invalidate: ['/masters'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  return (
    <FormModal title={existing ? 'Edit place' : 'New place'} onClose={onClose} saving={save.isPending} onSave={() => save.mutate(v)}>
      <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
      <SelectField label="Type" value={v.type} onChange={f.set('type')} options={Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      {v.type === 'customer_site' && <SelectField label="Customer" value={v.customer} onChange={f.set('customer')} options={toOptions(customers?.items)} error={f.errors.customer} required />}
      {['stockyard', 'customer_site'].includes(v.type) && (
        <NumberField label="Normal road time to reach" suffix="hours" hint="Trucks slower than this are flagged." value={v.expectedTransitHours} onChange={f.set('expectedTransitHours')} />
      )}
      <TextField className="sm:col-span-2" label="Address" value={v.address} onChange={f.set('address')} />
      <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
    </FormModal>
  );
}
