import { CheckCircle, Edit03, ShoppingBag01, SlashCircle01, UserPlus01 } from '@untitledui/icons';
import { useState } from 'react';
import { formatDate } from '@feather/shared';
import { Avatar, Button, DataTable, Loading, MetricCard, Modal, PageHeader, Segmented, StatusBadge, SwitchField, TextAreaField, TextField, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const DAY_MS = 86_400_000;
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'off', label: 'Off' },
];

/** Sellers: who we buy material from. Owner only (the API refuses everyone else). */
export default function SellersPage() {
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const { data, isLoading } = useGet('/masters/sellers', { active: 'all' });
  const items = data?.items ?? [];
  const active = items.filter((s) => s.active).length;
  const recent = items.filter((s) => Date.now() - new Date(s.createdAt) <= 30 * DAY_MS).length;
  const rows = filter === 'all' ? items : items.filter((s) => s.active === (filter === 'active'));

  return (
    <>
      <PageHeader
        help="owner-sellers"
        title="Sellers"
        subtitle="Who you buy cement, sand and aggregate from. Only you can see and change this list."
      />

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <MetricCard label="Total sellers" icon={ShoppingBag01} tone="brand" value={items.length} sub="All sellers you have added" />
            <MetricCard label="Active" icon={CheckCircle} tone="good" value={active} sub="You are buying from them" />
            <MetricCard label="Off" icon={SlashCircle01} tone="neutral" value={items.length - active} sub="Switched off, kept for history" />
            <MetricCard label="New this month" icon={UserPlus01} tone="neutral" value={recent} sub="Added in the last 30 days" />
          </div>

          <div className="mb-5">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          </div>

          <DataTable
            title="All sellers"
            dense
            rows={rows}
            empty={items.length ? 'No sellers in this view.' : 'No sellers yet. Add them in Setup → Business setup → Sellers.'}
            emptyIcon={ShoppingBag01}
            columns={[
              {
                key: 'name',
                header: 'Seller',
                sortable: true,
                render: (s) => (
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" initials={initials(s.name)} />
                    <div className="min-w-0">
                      <p className="font-medium text-primary">{s.name}</p>
                      {s.contactPerson && <p className="text-xs text-tertiary">{s.contactPerson}</p>}
                    </div>
                  </div>
                ),
              },
              {
                key: 'phone',
                header: 'Phone',
                render: (s) =>
                  s.phone ? (
                    <a href={`tel:${s.phone}`} className="text-brand-secondary">
                      {s.phone}
                    </a>
                  ) : (
                    '—'
                  ),
              },
              { key: 'email', header: 'Email', render: (s) => s.email ?? '—' },
              { key: 'gstin', header: 'GSTIN', render: (s) => s.gstin ?? '—' },
              { key: 'createdAt', header: 'Added', sortable: true, sortValue: (s) => new Date(s.createdAt).getTime(), render: (s) => formatDate(s.createdAt) },
              { key: 'active', header: 'Status', render: (s) => <StatusBadge tone={s.active ? 'good' : 'neutral'}>{s.active ? 'Active' : 'Off'}</StatusBadge> },
              {
                key: 'edit',
                header: '',
                align: 'right',
                render: (s) => (
                  <Button size="sm" color="tertiary" iconLeading={Edit03} onPress={() => setEditing(s)}>
                    Edit
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}
      {editing && <SellerForm existing={editing._id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  );
}

export function SellerForm({ existing, onClose }) {
  const f = useForm({
    name: existing?.name ?? '',
    contactPerson: existing?.contactPerson ?? '',
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
    gstin: existing?.gstin ?? '',
    address: existing?.address ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, body) => (existing ? api.patch(`/masters/sellers/${existing._id}`, body) : api.post('/masters/sellers', body)), {
    success: existing ? 'Seller saved' : 'Seller added',
    invalidate: ['/masters/sellers'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      icon={ShoppingBag01}
      title={existing ? 'Edit seller' : 'New seller'}
      description="Who you buy material from."
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} onPress={() => save.mutate(v)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Seller name" placeholder="e.g. UltraTech Cement Ltd" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
        <TextField label="Contact person" value={v.contactPerson} onChange={f.set('contactPerson')} error={f.errors.contactPerson} />
        <TextField label="Phone" inputMode="tel" value={v.phone} onChange={f.set('phone')} error={f.errors.phone} />
        <TextField label="Email" type="email" value={v.email} onChange={f.set('email')} error={f.errors.email} />
        <TextField label="GSTIN" value={v.gstin} onChange={f.set('gstin')} error={f.errors.gstin} />
        <TextAreaField className="sm:col-span-2" label="Address" rows={2} value={v.address} onChange={f.set('address')} error={f.errors.address} />
        <SwitchField label="Active" hint="Switch off a seller you no longer buy from. Their history stays." checked={v.active} onChange={f.set('active')} />
      </div>
    </Modal>
  );
}
