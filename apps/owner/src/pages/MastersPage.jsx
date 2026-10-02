import { Building01, Edit03, Grid01, MarkerPin01, Package, Plus } from '@untitledui/icons';
import { useState } from 'react';
import { formatINR, formatPct, LOCATION_TYPE_LABELS, MATERIAL_KINDS } from '@feather/shared';
import { Button, DataTable, Modal, NumberField, PageHeader, SelectField, StatusBadge, SwitchField, Tabs, TextField, useForm } from '@feather/ui';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';

export default function MastersPage() {
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(null);
  const { data: materials } = useGet('/masters/materials', { active: 'all' });
  const { data: locations } = useGet('/masters/locations', { active: 'all' });
  const { data: settings } = useGet('/admin/settings');
  const defTol = settings?.settings.defaultTransitLossTolerancePct;
  const edit = (kind, item) => (
    <Button size="sm" color="tertiary" iconLeading={Edit03} onPress={() => setEditing({ kind, item })}>
      Edit
    </Button>
  );

  return (
    <>
      <PageHeader
        help="owner-setup"
        breadcrumbs={[{ label: 'Setup' }]}
        title="Products & places"
        subtitle="What you buy and sell, and every place material moves between."
        actions={
          <Button iconLeading={Plus} onPress={() => setEditing({ kind: tab === 0 ? 'material' : 'location' })}>
            {tab === 0 ? 'New product' : 'New place'}
          </Button>
        }
      />
      <Tabs
        selectedIndex={tab}
        onChange={setTab}
        tabs={[
          {
            label: 'Products',
            icon: Package,
            count: materials?.items.length,
            content: (
              <DataTable
                dense
                rows={materials?.items}
                empty="No products yet."
                emptyIcon={Package}
                columns={[
                  { key: 'name', header: 'Name', sortable: true, render: (m) => <span className="font-medium text-primary">{m.name}</span> },
                  { key: 'kind', header: 'Counted in', render: (m) => (m.kind === 'bagged' ? `Bags of ${m.bagWeightKg} kg` : 'Weight (MT)') },
                  { key: 'tol', header: 'Allowed loss on the way', align: 'right', render: (m) => `${formatPct(m.transitLossTolerancePct ?? defTol)}${m.transitLossTolerancePct == null ? ' (default)' : ''}` },
                  { key: 'density', header: 'Density t/m³', align: 'right', render: (m) => m.densityTPerM3 ?? '—' },
                  { key: 'cost', header: 'Your cost', align: 'right', render: (m) => `${formatINR(m.landedCostPerUnit)} / ${m.unit}` },
                  { key: 'active', header: 'Status', render: (m) => <StatusBadge tone={m.active ? 'good' : 'neutral'}>{m.active ? 'Active' : 'Off'}</StatusBadge> },
                  { key: 'e', header: '', align: 'right', render: (m) => edit('material', m) },
                ]}
              />
            ),
          },
          {
            label: 'Places',
            icon: MarkerPin01,
            count: locations?.items.length,
            content: (
              <DataTable
                dense
                rows={locations?.items}
                empty="No places yet."
                emptyIcon={MarkerPin01}
                columns={[
                  { key: 'name', header: 'Name', sortable: true, render: (l) => <span className="font-medium text-primary">{l.name}</span> },
                  { key: 'type', header: 'Type', sortable: true, render: (l) => LOCATION_TYPE_LABELS[l.type] },
                  { key: 'customer', header: 'Customer', render: (l) => l.customer?.name ?? '—' },
                  { key: 'hours', header: 'Normal road time', align: 'right', render: (l) => (l.expectedTransitHours ? `${l.expectedTransitHours} h` : '—') },
                  { key: 'active', header: 'Status', render: (l) => <StatusBadge tone={l.active ? 'good' : 'neutral'}>{l.active ? 'Active' : 'Off'}</StatusBadge> },
                  { key: 'e', header: '', align: 'right', render: (l) => edit('location', l) },
                ]}
              />
            ),
          },
        ]}
      />
      {editing?.kind === 'material' && <MaterialForm existing={editing.item} onClose={() => setEditing(null)} />}
      {editing?.kind === 'location' && <LocationForm existing={editing.item} onClose={() => setEditing(null)} />}
    </>
  );
}

function FormModal({ title, icon, onClose, onSave, saving, children }) {
  return (
    <Modal
      open
      onClose={onClose}
      icon={icon}
      title={title}
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={saving} onPress={onSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
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
    <FormModal title={existing ? 'Edit product' : 'New product'} icon={Package} onClose={onClose} saving={save.isPending} onSave={() => save.mutate(v)}>
      <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
      <SelectField
        label="Counted in"
        value={v.kind}
        onChange={f.set('kind')}
        disabled={Boolean(existing)}
        options={[
          { value: 'bulk', label: 'Weight (MT)', hint: 'sand, aggregate, soil' },
          { value: 'bagged', label: 'Bags', hint: 'cement' },
        ]}
      />
      {v.kind === 'bagged' && <NumberField label="Bag weight" suffix="kg" value={v.bagWeightKg} onChange={f.set('bagWeightKg')} />}
      <NumberField label="Allowed loss on the way" suffix="%" hint="e.g. 0.5 for wet sand. Blank = default." value={v.transitLossTolerancePct} onChange={f.set('transitLossTolerancePct')} error={f.errors.transitLossTolerancePct} />
      {v.kind === 'bulk' && <NumberField label="Density" suffix="t/m³" hint="For brass ↔ MT." value={v.densityTPerM3} onChange={f.set('densityTPerM3')} />}
      <NumberField label={`Your cost per ${unit}`} prefix="₹" hint="Used to value losses. Only you see it." value={v.landedCostPerUnit} onChange={f.set('landedCostPerUnit')} />
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
    <FormModal title={existing ? 'Edit place' : 'New place'} icon={v.type === 'customer_site' ? Building01 : Grid01} onClose={onClose} saving={save.isPending} onSave={() => save.mutate(v)}>
      <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
      <SelectField label="Type" value={v.type} onChange={f.set('type')} options={Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      {v.type === 'customer_site' && <SelectField label="Customer" value={v.customer} onChange={f.set('customer')} options={toOptions(customers?.items)} error={f.errors.customer} required />}
      {['stockyard', 'customer_site'].includes(v.type) && (
        <NumberField label="Normal road time to reach" suffix="hours" hint="Slower trucks are flagged as late." value={v.expectedTransitHours} onChange={f.set('expectedTransitHours')} />
      )}
      <TextField className="sm:col-span-2" label="Address" value={v.address} onChange={f.set('address')} />
      <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
    </FormModal>
  );
}
