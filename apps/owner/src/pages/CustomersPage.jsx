import { Download01, Plus, Wallet02 } from '@untitledui/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AGING_BUCKETS, CREDIT_REASON_LABELS, formatLakh } from '@feather/shared';
import { Avatar, Button, DataTable, Loading, Meter, MetricCard, Modal, NumberField, PageHeader, Segmented, StatusBadge, SwitchField, TextField, useApi, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function CustomersPage() {
  const { data, isLoading } = useGet('/sales/credit');
  const { data: settings } = useGet('/admin/settings');
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState('all');
  const navigate = useNavigate();
  const api = useApi();
  const items = data?.items ?? [];
  const rows = view === 'hold' ? items.filter((r) => r.credit.blocked) : view === 'overdue' ? items.filter((r) => r.credit.overdueAmount > 0) : items;
  const totalOwed = items.reduce((s, r) => s + r.credit.exposure, 0);
  const overdue = items.reduce((s, r) => s + r.credit.overdueAmount, 0);

  return (
    <>
      <PageHeader
        help="owner-credit"
        title="Customers"
        subtitle={`Default limit ${formatLakh(settings?.settings.defaultCreditLimit)} · ${settings?.settings.defaultCreditDays ?? '—'} days. Customers on hold cannot get a new truck until they pay or you allow it anyway.`}
        actions={
          <>
            <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/credit.xlsx')}>
              Excel
            </Button>
            <Button iconLeading={Plus} onPress={() => setCreating(true)}>
              New customer
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
        <MetricCard label="Total owed to you" value={formatLakh(totalOwed)} sub={`${items.length} customers`} />
        <MetricCard label="Overdue" tone={overdue ? 'warn' : 'good'} value={formatLakh(overdue)} sub="Past their credit days" />
        <MetricCard label="On hold" tone={items.some((r) => r.credit.blocked) ? 'bad' : 'good'} value={items.filter((r) => r.credit.blocked).length} sub="No new trucks until they pay" />
      </div>

      <div className="mb-5">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: 'All customers' },
            { value: 'hold', label: 'On hold' },
            { value: 'overdue', label: 'Overdue' },
          ]}
        />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          title="Customer dues"
          rows={rows}
          rowKey={(r) => r.customer._id}
          onRowClick={(r) => navigate(`/customers/${r.customer._id}`)}
          empty="No customers here."
          emptyIcon={Wallet02}
          columns={[
            {
              key: 'name',
              header: 'Customer',
              sortable: true,
              sortValue: (r) => r.customer.name,
              render: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar size="md" initials={initials(r.customer.name)} />
                  <div>
                    <p className="font-medium text-primary">{r.customer.name}</p>
                    {r.credit.blocked ? (
                      <StatusBadge tone={r.override ? 'warn' : 'bad'}>{r.override ? 'Allowed anyway' : 'On hold'}</StatusBadge>
                    ) : (
                      <StatusBadge tone="good">Can get trucks</StatusBadge>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'used',
              header: 'Total owed / limit',
              sortable: true,
              sortValue: (r) => r.credit.exposure / (r.credit.creditLimit || 1),
              render: (r) => (
                <div className="min-w-48">
                  <Meter value={r.credit.exposure} max={r.credit.creditLimit} tone={r.credit.exposure > r.credit.creditLimit ? 'bad' : r.credit.exposure > 0.8 * r.credit.creditLimit ? 'warn' : 'good'} />
                  <span className="mt-1 block text-xs text-tertiary">
                    {formatLakh(r.credit.exposure)} of {formatLakh(r.credit.creditLimit)}
                  </span>
                </div>
              ),
            },
            { key: 'road', header: 'On the road', align: 'right', render: (r) => formatLakh(r.credit.unbilledValue) },
            ...AGING_BUCKETS.map((b) => ({ key: b.key, header: b.label, align: 'right', render: (r) => (r.aging[b.key] ? formatLakh(r.aging[b.key]) : '—') })),
            { key: 'why', header: 'Reason', render: (r) => r.credit.reasons.map((x) => CREDIT_REASON_LABELS[x]).join(', ') || '—' },
          ]}
        />
      )}
      {creating && <CustomerForm onClose={() => setCreating(false)} />}
    </>
  );
}

export function CustomerForm({ existing, onClose }) {
  const f = useForm({
    name: existing?.name ?? '',
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
    gstin: existing?.gstin ?? '',
    creditLimit: existing?.creditLimit ?? '',
    creditDays: existing?.creditDays ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, body) => (existing ? api.patch(`/masters/customers/${existing._id}`, body) : api.post('/masters/customers', body)), {
    success: 'Customer saved',
    invalidate: ['/sales', '/masters', '/admin'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      icon={Wallet02}
      title={existing ? 'Edit customer' : 'New customer'}
      description="Add delivery sites for this customer under Products & places."
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
        <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
        <TextField label="Phone" value={v.phone} onChange={f.set('phone')} error={f.errors.phone} />
        <TextField label="Email" value={v.email} onChange={f.set('email')} error={f.errors.email} />
        <TextField label="GSTIN" value={v.gstin} onChange={f.set('gstin')} />
        <NumberField label="Credit limit" prefix="₹" hint="Blank = default limit" value={v.creditLimit} onChange={f.set('creditLimit')} error={f.errors.creditLimit} />
        <NumberField label="Credit days" suffix="days" hint="Blank = default days" value={v.creditDays} onChange={f.set('creditDays')} error={f.errors.creditDays} />
        {existing && <SwitchField className="sm:col-span-2" label="Active" checked={v.active} onChange={f.set('active')} />}
      </div>
    </Modal>
  );
}
