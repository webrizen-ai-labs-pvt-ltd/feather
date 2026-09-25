import { ArrowDownTrayIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatINR, formatLakh, formatNumber, formatPct } from '@feather/shared';
import { Button, Card, CardHeader, DataTable, Loading, Meter, Modal, NumberField, PageHeader, SelectField, SwitchField, TextField, useApi, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

export default function TransportersPage() {
  const [days, setDays] = useState('30');
  const [editing, setEditing] = useState(null);
  const { data: board, isLoading } = useGet('/admin/scorecard', { days });
  const { data: list } = useGet('/masters/transporters', { active: 'all' });
  const api = useApi();
  const scorecard = board?.items ?? [];

  return (
    <>
      <PageHeader
        title="Transporters"
        subtitle="Who loses material, who damages bags, and how much was deducted."
        actions={
          <>
            <div className="w-40">
              <SelectField value={days} onChange={setDays} options={[['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 6 months'], ['365', 'Last 1 year']].map(([value, label]) => ({ value, label }))} />
            </div>
            <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/transporters.xlsx', { days })}>
              Scorecard Excel
            </Button>
            <Button icon={PlusIcon} onClick={() => setEditing({})}>New transporter</Button>
          </>
        }
      />
      <Card className="mb-6">
        <CardHeader title={`Scorecard — last ${days} days`} subtitle="Problem trips = freight was locked for loss, damage, shortage or weight mismatch." />
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={scorecard}
            rowKey={(r) => r.transporter._id}
            empty="No received trucks in this period."
            columns={[
              { key: 'name', header: 'Transporter', render: (r) => <span className="font-medium">{r.transporter.name}</span> },
              { key: 'trips', header: 'Trips', align: 'right' },
              { key: 'loaded', header: 'Loaded', align: 'right', render: (r) => `${formatNumber(r.loadedTons, 1)} MT` },
              { key: 'lost', header: 'Lost', align: 'right', render: (r) => `${formatNumber(r.lossTons, 2)} MT` },
              { key: 'lossPct', header: 'Loss %', align: 'right', render: (r) => formatPct(r.lossPct) },
              { key: 'bags', header: 'Bags damaged / missing', align: 'right', render: (r) => (r.billedBags ? `${r.damagedBags} / ${r.missingBags} (${formatPct(r.bagDamagePct)})` : '—') },
              {
                key: 'problem',
                header: 'Problem trips',
                render: (r) => (
                  <div className="flex min-w-36 items-center gap-2">
                    <Meter value={r.problemRatePct} max={100} tone={r.problemRatePct > 20 ? 'bad' : r.problemRatePct > 5 ? 'warn' : 'good'} />
                    <span className="w-16 text-right">{r.lockedTrips} ({formatPct(r.problemRatePct, 0)})</span>
                  </div>
                ),
              },
              { key: 'ded', header: 'Deducted', align: 'right', render: (r) => formatLakh(r.deductions) },
            ]}
          />
        )}
      </Card>
      <Card>
        <CardHeader title="All transporters" />
        <DataTable
          dense
          rows={list?.items}
          columns={[
            { key: 'name', header: 'Name', render: (t) => <span className="font-medium">{t.name}</span> },
            { key: 'phone', header: 'Phone' },
            { key: 'gstin', header: 'GSTIN' },
            { key: 'rate', header: 'Usual rate', align: 'right', render: (t) => formatINR(t.defaultRatePerUnit) },
            { key: 'active', header: 'Active', render: (t) => (t.active ? 'Yes' : 'No') },
            { key: 'edit', header: '', render: (t) => <Button size="sm" variant="ghost" icon={PencilSquareIcon} onClick={() => setEditing(t)}>Edit</Button> },
          ]}
        />
      </Card>
      {editing && <TransporterForm existing={editing._id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  );
}

function TransporterForm({ existing, onClose }) {
  const f = useForm({
    name: existing?.name ?? '',
    phone: existing?.phone ?? '',
    gstin: existing?.gstin ?? '',
    defaultRatePerUnit: existing?.defaultRatePerUnit ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, body) => (existing ? api.patch(`/masters/transporters/${existing._id}`, body) : api.post('/masters/transporters', body)), {
    success: 'Saved',
    invalidate: ['/masters', '/admin'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Edit transporter' : 'New transporter'}
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
        <TextField label="GSTIN" value={v.gstin} onChange={f.set('gstin')} />
        <NumberField label="Usual freight rate" suffix="₹ / unit" value={v.defaultRatePerUnit} onChange={f.set('defaultRatePerUnit')} />
        <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
      </div>
    </Modal>
  );
}
