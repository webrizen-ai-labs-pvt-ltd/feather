import { ArrowDownTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AGING_BUCKETS, CREDIT_REASON_LABELS, formatLakh } from '@feather/shared';
import { Badge, Button, Card, DataTable, Loading, Meter, Modal, NumberField, PageHeader, SwitchField, TextField, useApi, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

export default function CustomersPage() {
  const { data, isLoading } = useGet('/sales/credit');
  const { data: settings } = useGet('/admin/settings');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const api = useApi();

  return (
    <>
      <PageHeader
        title="Customer credit"
        subtitle={`Default limit ${formatLakh(settings?.settings.defaultCreditLimit)} · ${settings?.settings.defaultCreditDays ?? '—'} days. Blocked customers cannot get a new challan until paid or you allow an override.`}
        actions={
          <>
            <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/credit.xlsx')}>Excel</Button>
            <Button icon={PlusIcon} onClick={() => setCreating(true)}>New customer</Button>
          </>
        }
      />
      <Card>
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={data?.items}
            rowKey={(r) => r.customer._id}
            onRowClick={(r) => navigate(`/customers/${r.customer._id}`)}
            empty="No customers yet."
            columns={[
              {
                key: 'name',
                header: 'Customer',
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.customer.name}</span>
                    {r.credit.blocked && <Badge tone={r.override ? 'warn' : 'bad'}>{r.override ? 'Override active' : 'Blocked'}</Badge>}
                  </div>
                ),
              },
              {
                key: 'used',
                header: 'Exposure / limit',
                render: (r) => (
                  <div className="min-w-44">
                    <Meter value={r.credit.exposure} max={r.credit.creditLimit} tone={r.credit.exposure > r.credit.creditLimit ? 'bad' : r.credit.exposure > 0.8 * r.credit.creditLimit ? 'warn' : 'good'} />
                    <span className="text-xs text-ink-500">
                      {formatLakh(r.credit.exposure)} / {formatLakh(r.credit.creditLimit)}
                    </span>
                  </div>
                ),
              },
              { key: 'road', header: 'On road', align: 'right', render: (r) => formatLakh(r.credit.unbilledValue) },
              ...AGING_BUCKETS.map((b) => ({ key: b.key, header: b.label, align: 'right', render: (r) => (r.aging[b.key] ? formatLakh(r.aging[b.key]) : '—') })),
              { key: 'why', header: 'Reason', render: (r) => r.credit.reasons.map((x) => CREDIT_REASON_LABELS[x]).join(', ') || '—' },
            ]}
          />
        )}
      </Card>
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
      title={existing ? 'Edit customer' : 'New customer'}
      description="Add delivery sites for this customer under Materials & places."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate(v)}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
        <TextField label="Phone" value={v.phone} onChange={f.set('phone')} error={f.errors.phone} />
        <TextField label="Email" value={v.email} onChange={f.set('email')} error={f.errors.email} />
        <TextField label="GSTIN" value={v.gstin} onChange={f.set('gstin')} />
        <NumberField label="Credit limit" suffix="₹" hint="Blank = default limit" value={v.creditLimit} onChange={f.set('creditLimit')} error={f.errors.creditLimit} />
        <NumberField label="Credit days" hint="Blank = default days" value={v.creditDays} onChange={f.set('creditDays')} error={f.errors.creditDays} />
        {existing && <SwitchField className="sm:col-span-2" label="Active" checked={v.active} onChange={f.set('active')} />}
      </div>
    </Modal>
  );
}
