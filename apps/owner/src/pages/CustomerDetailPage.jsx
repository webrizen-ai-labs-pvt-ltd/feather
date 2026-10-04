import { BankNote01, Edit03, File06, Key01, ShieldTick, Wallet02 } from '@untitledui/icons';
import { useState } from 'react';
import { useParams } from 'react-router';
import { AGING_BUCKETS, CREDIT_REASON_LABELS, formatDate, formatDateTime, formatINR, formatLakh } from '@feather/shared';
import {
  Alert,
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  cx,
  DataTable,
  Loading,
  Meter,
  MetricCard,
  Modal,
  NumberField,
  PageHeader,
  SelectField,
  StatusBadge,
  Tabs,
  TextAreaField,
  TextField,
  useForm,
} from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';
import { CustomerForm } from '@/pages/CustomersPage.jsx';

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useGet(`/sales/customers/${id}/ledger`);
  const [dialog, setDialog] = useState(null);
  const revoke = useAction((api, { overrideId, reason }) => api.post(`/sales/overrides/${overrideId}/revoke`, { reason }), {
    success: 'Special permission stopped',
    invalidate: ['/sales', '/admin'],
    onSuccess: () => setDialog(null),
  });
  if (isLoading) return <Loading />;
  const { customer, credit, aging, invoices, payments, overrides, sites } = data;
  const now = new Date();
  const liveOverride = overrides.find((o) => !o.revokedAt && new Date(o.validUntil) > now && o.uses < o.maxUses);
  const usedPct = credit.creditLimit ? (credit.exposure / credit.creditLimit) * 100 : 0;

  return (
    <>
      <PageHeader
        help="owner-credit"
        breadcrumbs={[{ label: 'Customers', href: '/customers' }]}
        title={customer.name}
        subtitle={[customer.phone, customer.email, customer.gstin].filter(Boolean).join(' · ') || 'No contact details yet'}
        actions={
          <>
            <Button color="secondary" iconLeading={Edit03} onPress={() => setDialog('edit')}>
              Edit
            </Button>
            <Button color="secondary" iconLeading={File06} onPress={() => setDialog('invoice')}>
              Add bill
            </Button>
            <Button iconLeading={BankNote01} onPress={() => setDialog('payment')}>
              Record payment
            </Button>
          </>
        }
      />

      <Card className="mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <Avatar size="xl" initials={initials(customer.name)} />
            <div>
              <p className="text-lg font-semibold text-primary">{customer.name}</p>
              <div className="mt-1">
                {credit.blocked ? (
                  <StatusBadge tone={liveOverride ? 'warn' : 'bad'} size="md">
                    {liveOverride ? 'Allowed anyway' : 'On hold — no new trucks'}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="good" size="md">
                    Can get trucks
                  </StatusBadge>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-medium text-secondary">
                {formatLakh(credit.exposure)} owed of {formatLakh(credit.creditLimit)} limit
              </span>
              <span className={cx('font-semibold', usedPct > 100 ? 'text-error-primary' : 'text-tertiary')}>{Math.round(usedPct)}% used</span>
            </div>
            <Meter value={credit.exposure} max={credit.creditLimit} tone={usedPct > 100 ? 'bad' : usedPct > 80 ? 'warn' : 'good'} />
          </div>
        </div>
      </Card>

      {credit.blocked && (
        <Alert
          tone={liveOverride ? 'warning' : 'error'}
          className="mb-6"
          title={liveOverride ? 'Allowed anyway for now' : 'Why this customer is on hold'}
          actions={
            liveOverride ? (
              <Button size="sm" color="secondary" onPress={() => setDialog({ revoke: liveOverride._id })}>
                Stop allowing
              </Button>
            ) : (
              <Button size="sm" color="primary-destructive" iconLeading={Key01} onPress={() => setDialog('override')}>
                Allow anyway
              </Button>
            )
          }
        >
          <ul className="list-inside list-disc">
            {credit.reasons.map((r) => (
              <li key={r}>
                {CREDIT_REASON_LABELS[r]}
                {r === 'overdue' && ` — ${formatINR(credit.overdueAmount)} overdue, oldest ${credit.oldestOverdueDays} days`}
              </li>
            ))}
          </ul>
          {liveOverride && (
            <p className="mt-2">
              {liveOverride.maxUses - liveOverride.uses} truck(s) left until {formatDateTime(liveOverride.validUntil)} — “{liveOverride.reason}”
            </p>
          )}
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <MetricCard label="Credit limit" value={formatLakh(credit.creditLimit)} sub={`${customer.creditDays ?? 'Default'} credit days`} />
        <MetricCard label="Unpaid bills" value={formatLakh(credit.outstanding)} />
        <MetricCard label="On the road (not billed)" value={formatLakh(credit.unbilledValue)} />
        <MetricCard label="Still available" value={formatLakh(credit.available)} tone={credit.available < 0 ? 'bad' : 'good'} />
      </div>

      <Card className="mb-6 p-5 md:p-6">
        <p className="mb-4 text-sm font-semibold text-primary">How old the dues are</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {AGING_BUCKETS.map((b) => (
            <div key={b.key} className={cx('rounded-lg p-4 ring-1 ring-secondary', b.min > 45 && aging[b.key] ? 'bg-error-primary' : 'bg-secondary')}>
              <p className="text-xs text-tertiary">{b.label}</p>
              <p className={cx('mt-1 text-lg font-semibold tabular-nums', b.min > 45 && aging[b.key] ? 'text-error-primary' : 'text-primary')}>{formatLakh(aging[b.key])}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <Tabs
          tabs={[
            {
              label: 'Bills',
              count: invoices.length,
              content: (
                <DataTable
                  dense
                  rows={invoices}
                  empty="No bills yet. Bills are made by Feather when a delivery is received at the site."
                  columns={[
                    { key: 'no', header: 'Bill no.', render: (i) => <span className="font-medium text-primary">{i.invoiceNo}</span> },
                    { key: 'date', header: 'Date', sortable: true, sortValue: (i) => i.invoiceDate, render: (i) => formatDate(i.invoiceDate) },
                    { key: 'trip', header: 'Delivery note / truck', render: (i) => (i.trip ? `${i.trip.challanNo ?? i.trip.tripNo} · ${i.trip.vehicleNo}` : i.reference ?? 'Manual') },
                    { key: 'amt', header: 'Amount', align: 'right', render: (i) => formatINR(i.amount) },
                    { key: 'paid', header: 'Paid', align: 'right', render: (i) => formatINR(i.paidAmount) },
                    {
                      key: 'due',
                      header: 'Due',
                      align: 'right',
                      render: (i) => (i.amount - i.paidAmount > 0 ? <span className="font-semibold text-primary">{formatINR(i.amount - i.paidAmount)}</span> : <StatusBadge tone="good">Paid</StatusBadge>),
                    },
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
                    { key: 'ref', header: 'Cheque / UTR', render: (p) => p.reference ?? '—' },
                    { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-medium text-primary">{formatINR(p.amount)}</span> },
                    { key: 'adv', header: 'Advance left', align: 'right', render: (p) => (p.unallocated ? formatINR(p.unallocated) : '—') },
                  ]}
                />
              ),
            },
            {
              label: 'Allowed anyway',
              count: overrides.length,
              content: (
                <DataTable
                  dense
                  rows={overrides}
                  empty="You have not allowed this customer anyway yet."
                  columns={[
                    { key: 'at', header: 'Given', render: (o) => formatDateTime(o.createdAt) },
                    { key: 'by', header: 'By', render: (o) => o.grantedBy?.name },
                    { key: 'reason', header: 'Reason', render: (o) => o.reason },
                    { key: 'uses', header: 'Trucks used', render: (o) => `${o.uses} / ${o.maxUses}` },
                    { key: 'until', header: 'Valid until', render: (o) => (o.revokedAt ? 'Stopped' : formatDateTime(o.validUntil)) },
                  ]}
                />
              ),
            },
            {
              label: 'Delivery sites',
              count: sites.length,
              content: <DataTable dense rows={sites} empty="No delivery sites. Add one under Business setup." columns={[{ key: 'name', header: 'Site' }, { key: 'address', header: 'Address' }]} />,
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
          title="Stop this special permission?"
          confirmLabel="Stop allowing"
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
      icon={isPayment ? BankNote01 : File06}
      tone={isPayment ? 'success' : 'gray'}
      title={isPayment ? 'Record payment' : 'Add bill'}
      description={isPayment ? 'The oldest unpaid bills are cleared first.' : 'For old amounts from your earlier books (opening balance).'}
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
      <div className="flex flex-col gap-5">
        <NumberField label="Amount" prefix="₹" value={v.amount} onChange={f.set('amount')} error={f.errors.amount} required />
        <TextField label={isPayment ? 'Received on' : 'Bill date'} type="date" value={v.date} onChange={f.set('date')} />
        <TextField label={isPayment ? 'Cheque / UTR no.' : 'Reference'} value={v.reference} onChange={f.set('reference')} />
      </div>
    </Modal>
  );
}

function OverrideDialog({ customer, credit, onClose }) {
  const f = useForm({ reason: '', hours: '24', maxUses: '1' });
  const save = useAction((api, v) => api.post(`/sales/customers/${customer._id}/override`, v), {
    success: 'Special permission given. Dispatch can send the allowed trucks now.',
    invalidate: ['/sales', '/admin'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { reason: e.message }),
  });
  const v = f.values;
  return (
    <Modal
      open
      onClose={onClose}
      icon={ShieldTick}
      tone="warning"
      title={`Allow trucks for ${customer.name} anyway?`}
      description={`They owe ${formatINR(credit.exposure)} against a limit of ${formatINR(credit.creditLimit)}. This lets your staff send a limited number of trucks.`}
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary-destructive" isLoading={save.isPending} onPress={() => save.mutate(v)}>
            Allow anyway
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Valid for"
          value={v.hours}
          onChange={f.set('hours')}
          options={[
            ['4', '4 hours'],
            ['12', '12 hours'],
            ['24', '1 day'],
            ['72', '3 days'],
            ['168', '7 days'],
          ].map(([value, label]) => ({ value, label }))}
        />
        <NumberField label="Number of trucks" value={v.maxUses} onChange={f.set('maxUses')} error={f.errors.maxUses} />
        <TextAreaField className="sm:col-span-2" label="Reason" hint="Saved in History and emailed to you." value={v.reason} onChange={f.set('reason')} error={f.errors.reason} />
      </div>
    </Modal>
  );
}
