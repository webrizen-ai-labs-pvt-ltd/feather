import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AGING_BUCKETS, CREDIT_REASON_LABELS, formatDate, formatDateTime, formatINR, formatLakh } from '@feather/shared';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Loading,
  Modal,
  NumberField,
  PageHeader,
  SelectField,
  Stat,
  Tabs,
  TextAreaField,
  TextField,
  useForm,
} from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';
import { CustomerForm } from '@/pages/CustomersPage.jsx';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useGet(`/sales/customers/${id}/ledger`);
  const [dialog, setDialog] = useState(null);
  const revoke = useAction((api, { overrideId, reason }) => api.post(`/sales/overrides/${overrideId}/revoke`, { reason }), {
    success: 'Override stopped',
    invalidate: ['/sales', '/admin'],
    onSuccess: () => setDialog(null),
  });
  if (isLoading) return <Loading />;
  const { customer, credit, aging, invoices, payments, overrides, sites } = data;
  const now = new Date();
  const liveOverride = overrides.find((o) => !o.revokedAt && new Date(o.validUntil) > now && o.uses < o.maxUses);

  return (
    <>
      <PageHeader
        back={
          <Link to="/customers" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800">
            <ArrowLeftIcon className="size-4" /> Customer credit
          </Link>
        }
        title={customer.name}
        subtitle={[customer.phone, customer.email, customer.gstin].filter(Boolean).join(' · ')}
        actions={
          <>
            {credit.blocked ? <Badge tone={liveOverride ? 'warn' : 'bad'}>{liveOverride ? 'Override active' : 'Dispatch blocked'}</Badge> : <Badge tone="good">Dispatch allowed</Badge>}
            <Button variant="secondary" icon={PencilSquareIcon} onClick={() => setDialog('edit')}>Edit</Button>
            <Button variant="secondary" onClick={() => setDialog('invoice')}>Add bill</Button>
            <Button onClick={() => setDialog('payment')}>Record payment</Button>
            {credit.blocked && !liveOverride && <Button variant="danger" onClick={() => setDialog('override')}>Allow override</Button>}
          </>
        }
      />

      {credit.blocked && (
        <Card className="mb-6 border-l-4 border-red-500 p-4 text-sm">
          <p className="font-semibold text-ink-900">Why blocked</p>
          <ul className="mt-1 list-inside list-disc text-ink-700">
            {credit.reasons.map((r) => (
              <li key={r}>
                {CREDIT_REASON_LABELS[r]}
                {r === 'overdue' && ` — ${formatINR(credit.overdueAmount)} overdue, oldest ${credit.oldestOverdueDays} days`}
              </li>
            ))}
          </ul>
          {liveOverride && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              <span>
                Override: {liveOverride.maxUses - liveOverride.uses} challan(s) left until {formatDateTime(liveOverride.validUntil)} — “{liveOverride.reason}”
              </span>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ revoke: liveOverride._id })}>Stop override</Button>
            </div>
          )}
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credit limit" value={formatLakh(credit.creditLimit)} sub={`${customer.creditDays ?? 'Default'} credit days`} />
        <Stat label="Unpaid bills" value={formatLakh(credit.outstanding)} />
        <Stat label="On the road (not billed)" value={formatLakh(credit.unbilledValue)} />
        <Stat label="Available" value={formatLakh(credit.available)} tone={credit.available < 0 ? 'bad' : 'good'} />
      </div>

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AGING_BUCKETS.map((b) => (
            <div key={b.key}>
              <p className="text-xs text-ink-500">{b.label}</p>
              <p className={`tabular text-lg font-bold ${b.min > 45 && aging[b.key] ? 'text-red-700' : 'text-ink-900'}`}>{formatLakh(aging[b.key])}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <Tabs
          tabs={[
            {
              label: 'Bills',
              count: invoices.length,
              content: (
                <DataTable
                  dense
                  rows={invoices}
                  empty="No bills yet. Bills are made automatically when a delivery is received at site."
                  columns={[
                    { key: 'no', header: 'Bill no.', render: (i) => i.invoiceNo },
                    { key: 'date', header: 'Date', render: (i) => formatDate(i.invoiceDate) },
                    { key: 'trip', header: 'Challan / truck', render: (i) => (i.trip ? `${i.trip.challanNo ?? i.trip.tripNo} · ${i.trip.vehicleNo}` : i.reference ?? 'Manual') },
                    { key: 'amt', header: 'Amount', align: 'right', render: (i) => formatINR(i.amount) },
                    { key: 'paid', header: 'Paid', align: 'right', render: (i) => formatINR(i.paidAmount) },
                    { key: 'due', header: 'Due', align: 'right', render: (i) => <b>{formatINR(i.amount - i.paidAmount)}</b> },
                  ]}
                />
              ),
            },
            {
              label: 'Payments',
              count: payments.length,
              content: (
                <DataTable
                  dense
                  rows={payments}
                  empty="No payments yet."
                  columns={[
                    { key: 'date', header: 'Received', render: (p) => formatDate(p.receivedAt) },
                    { key: 'ref', header: 'Reference', render: (p) => p.reference ?? '—' },
                    { key: 'amt', header: 'Amount', align: 'right', render: (p) => formatINR(p.amount) },
                    { key: 'adv', header: 'Advance left', align: 'right', render: (p) => (p.unallocated ? formatINR(p.unallocated) : '—') },
                  ]}
                />
              ),
            },
            {
              label: 'Overrides',
              count: overrides.length,
              content: (
                <DataTable
                  dense
                  rows={overrides}
                  empty="No overrides given."
                  columns={[
                    { key: 'at', header: 'Given', render: (o) => formatDateTime(o.createdAt) },
                    { key: 'by', header: 'By', render: (o) => o.grantedBy?.name },
                    { key: 'reason', header: 'Reason', render: (o) => o.reason },
                    { key: 'uses', header: 'Used', render: (o) => `${o.uses} / ${o.maxUses}` },
                    { key: 'until', header: 'Valid until', render: (o) => (o.revokedAt ? 'Stopped' : formatDateTime(o.validUntil)) },
                  ]}
                />
              ),
            },
            {
              label: 'Sites',
              count: sites.length,
              content: <DataTable dense rows={sites} empty="No delivery sites. Add one under Materials & places." columns={[{ key: 'name', header: 'Site' }, { key: 'address', header: 'Address' }]} />,
            },
          ]}
        />
      </Card>

      {dialog === 'edit' && <CustomerForm existing={customer} onClose={() => setDialog(null)} />}
      {dialog === 'payment' && <MoneyDialog kind="payment" customerId={id} onClose={() => setDialog(null)} />}
      {dialog === 'invoice' && <MoneyDialog kind="invoice" customerId={id} onClose={() => setDialog(null)} />}
      {dialog === 'override' && <OverrideDialog customer={customer} credit={credit} onClose={() => setDialog(null)} />}
      {dialog?.revoke && (
        <ConfirmDialog
          open
          needReason
          title="Stop this override?"
          confirmLabel="Stop override"
          variant="danger"
          loading={revoke.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => revoke.mutate({ overrideId: dialog.revoke, reason })}
        />
      )}
    </>
  );
}

function MoneyDialog({ kind, customerId, onClose }) {
  const isPayment = kind === 'payment';
  const f = useForm({ amount: '', date: new Date().toISOString().slice(0, 10), reference: '' });
  const save = useAction(
    (api, v) =>
      api.post(`/sales/customers/${customerId}/${isPayment ? 'payments' : 'invoices'}`, {
        amount: v.amount,
        reference: v.reference,
        [isPayment ? 'receivedAt' : 'invoiceDate']: v.date,
      }),
    { success: isPayment ? 'Payment recorded — oldest bills cleared first' : 'Bill added', invalidate: ['/sales', '/admin'], onSuccess: onClose, onError: (e) => f.setErrors(e.fields ?? { amount: e.message }) },
  );
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isPayment ? 'Record payment' : 'Add bill (e.g. opening balance)'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate(v)}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <NumberField label="Amount" suffix="₹" value={v.amount} onChange={f.set('amount')} error={f.errors.amount} required />
        <TextField label={isPayment ? 'Received on' : 'Bill date'} type="date" value={v.date} onChange={f.set('date')} />
        <TextField label={isPayment ? 'Cheque / UTR no.' : 'Reference'} value={v.reference} onChange={f.set('reference')} />
      </div>
    </Modal>
  );
}

function OverrideDialog({ customer, credit, onClose }) {
  const f = useForm({ reason: '', hours: '24', maxUses: '1' });
  const save = useAction((api, v) => api.post(`/sales/customers/${customer._id}/override`, v), {
    success: 'Override given. Dispatch can make the allowed challans now.',
    invalidate: ['/sales', '/admin'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { reason: e.message }),
  });
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Allow dispatch for ${customer.name}?`}
      description={`Exposure is ${formatINR(credit.exposure)} against a limit of ${formatINR(credit.creditLimit)}. This lets supervisors make a limited number of challans.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={save.isPending} onClick={() => save.mutate(v)}>Give override</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Valid for" value={v.hours} onChange={f.set('hours')} options={[['4', '4 hours'], ['12', '12 hours'], ['24', '1 day'], ['72', '3 days'], ['168', '7 days']].map(([value, label]) => ({ value, label }))} />
        <NumberField label="Number of challans" value={v.maxUses} onChange={f.set('maxUses')} error={f.errors.maxUses} />
        <TextAreaField className="sm:col-span-2" label="Reason" hint="Saved in audit log and emailed." value={v.reason} onChange={f.set('reason')} error={f.errors.reason} />
      </div>
    </Modal>
  );
}
