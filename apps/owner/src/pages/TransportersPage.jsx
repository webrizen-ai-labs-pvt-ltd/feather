import { Building07, Download01, Edit03 } from '@untitledui/icons';
import { useState } from 'react';
import { formatINR, formatLakh, formatNumber, formatPct } from '@feather/shared';
import { Avatar, Button, DataTable, Loading, Meter, Modal, NumberField, PageHeader, Segmented, StatusBadge, SwitchField, TextField, useApi, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const PERIODS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
  { value: '365', label: '1 year' },
];

export default function TransportersPage() {
  const [days, setDays] = useState('30');
  const [editing, setEditing] = useState(null);
  const { data: board, isLoading } = useGet('/admin/scorecard', { days });
  const { data: list } = useGet('/masters/transporters', { active: 'all' });
  const api = useApi();

  return (
    <>
      <PageHeader
        help="owner-transporters"
        title="Truck companies"
        subtitle="Who loses material, who damages bags, and how much was cut from their payment."
        actions={
          <>
            {/* Finance view only — truck companies are added in Setup → Business setup. */}
            <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/transporters.xlsx', { days })}>
              Scorecard Excel
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <Segmented options={PERIODS} value={days} onChange={setDays} />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          className="mb-8"
          title={`Scorecard — last ${PERIODS.find((p) => p.value === days)?.label}`}
          subtitle="Worst first. A problem trip = truck payment was put on hold for loss, damage, shortage or weight mismatch."
          rows={board?.items}
          rowKey={(r) => r.transporter._id}
          empty="No received trucks in this period."
          emptyIcon={Building07}
          columns={[
            {
              key: 'name',
              header: 'Truck company',
              render: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar size="sm" initials={initials(r.transporter.name)} />
                  <span className="font-medium text-primary">{r.transporter.name}</span>
                </div>
              ),
            },
            { key: 'trips', header: 'Trips', align: 'right', sortable: true },
            { key: 'loadedTons', header: 'Loaded', align: 'right', sortable: true, render: (r) => `${formatNumber(r.loadedTons, 1)} MT` },
            { key: 'lossTons', header: 'Lost', align: 'right', sortable: true, render: (r) => `${formatNumber(r.lossTons, 2)} MT` },
            { key: 'lossPct', header: 'Loss %', align: 'right', sortable: true, render: (r) => formatPct(r.lossPct) },
            { key: 'bags', header: 'Bags damaged / missing', align: 'right', render: (r) => (r.billedBags ? `${r.damagedBags} / ${r.missingBags} (${formatPct(r.bagDamagePct)})` : '—') },
            {
              key: 'problemRatePct',
              header: 'Problem trips',
              sortable: true,
              render: (r) => (
                <div className="flex min-w-40 items-center gap-3">
                  <Meter value={r.problemRatePct} max={100} tone={r.problemRatePct > 20 ? 'bad' : r.problemRatePct > 5 ? 'warn' : 'good'} />
                  <span className="w-16 text-right text-sm font-medium text-secondary">
                    {r.lockedTrips} ({formatPct(r.problemRatePct, 0)})
                  </span>
                </div>
              ),
            },
            { key: 'deductions', header: 'Cut', align: 'right', sortable: true, render: (r) => formatLakh(r.deductions) },
          ]}
        />
      )}

      <DataTable
        title="All truck companies"
        dense
        rows={list?.items}
        empty="No truck companies yet."
        columns={[
          { key: 'name', header: 'Name', sortable: true, render: (t) => <span className="font-medium text-primary">{t.name}</span> },
          { key: 'phone', header: 'Phone', render: (t) => t.phone ?? '—' },
          { key: 'gstin', header: 'GSTIN', render: (t) => t.gstin ?? '—' },
          { key: 'rate', header: 'Usual rate', align: 'right', render: (t) => formatINR(t.defaultRatePerUnit) },
          { key: 'active', header: 'Status', render: (t) => <StatusBadge tone={t.active ? 'good' : 'neutral'}>{t.active ? 'Active' : 'Off'}</StatusBadge> },
          {
            key: 'edit',
            header: '',
            align: 'right',
            render: (t) => (
              <Button size="sm" color="tertiary" iconLeading={Edit03} onPress={() => setEditing(t)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      {editing && <TransporterForm existing={editing._id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  );
}

export function TransporterForm({ existing, onClose }) {
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
      icon={Building07}
      title={existing ? 'Edit truck company' : 'New truck company'}
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
        <TextField label="GSTIN" value={v.gstin} onChange={f.set('gstin')} />
        <NumberField label="Usual truck rate" prefix="₹" suffix="per unit" value={v.defaultRatePerUnit} onChange={f.set('defaultRatePerUnit')} />
        <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
      </div>
    </Modal>
  );
}
