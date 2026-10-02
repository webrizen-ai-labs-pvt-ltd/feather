import { CheckDone01, ClipboardCheck, Plus } from '@untitledui/icons';
import { useState } from 'react';
import { CREDIT_REASON_LABELS, formatDate, formatINR, formatLakh, formatNumber } from '@feather/shared';
import {
  Alert,
  Avatar,
  Button,
  Card,
  ComboField,
  EmptyState,
  Loading,
  Meter,
  Modal,
  NumberField,
  PageHeader,
  SelectField,
  StatusBadge,
  TextField,
  toOptions,
  useAction,
  useForm,
  useGet,
} from '@feather/ui';

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function OrdersPage() {
  const { data, isLoading } = useGet('/sales/orders', { status: 'open' });
  const { data: credit } = useGet('/sales/credit');
  const [creating, setCreating] = useState(false);
  const creditOf = (customerId) => credit?.items.find((c) => c.customer._id === customerId);
  const close = useAction((api, id) => api.post(`/sales/orders/${id}/status`, { status: 'completed' }), { success: 'Order closed', invalidate: ['/sales'] });

  return (
    <>
      <PageHeader
        help="orders"
        title="Orders"
        subtitle="Open customer orders and how much is sent. Customers on hold cannot get trucks."
        actions={
          <Button iconLeading={Plus} onPress={() => setCreating(true)}>
            New order
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : !data?.items.length ? (
        <EmptyState icon={ClipboardCheck} title="No open orders" action={<Button iconLeading={Plus} onPress={() => setCreating(true)}>New order</Button>} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.items.map((o) => {
            const c = creditOf(o.customer?._id);
            const left = o.qty - o.dispatchedQty;
            const pct = o.qty ? Math.round((o.dispatchedQty / o.qty) * 100) : 0;
            return (
              <li key={o._id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar size="md" initials={initials(o.customer?.name)} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-primary">{o.customer?.name}</p>
                        <p className="truncate text-sm text-tertiary">
                          {o.orderNo} · {formatDate(o.createdAt)}
                        </p>
                      </div>
                    </div>
                    {c?.credit.blocked ? <StatusBadge tone={c.override ? 'warn' : 'bad'}>{c.override ? 'Allowed anyway' : 'On hold'}</StatusBadge> : <StatusBadge tone="good">Credit OK</StatusBadge>}
                  </div>
                  <p className="mt-4 text-sm text-secondary">
                    <span className="font-medium">{o.material?.name}</span> → {o.deliverySite?.name}
                  </p>
                  <p className="text-xs text-tertiary">
                    {formatINR(o.ratePerUnit)} / {o.material?.unit}
                  </p>
                  <div className="mt-4">
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-tertiary">
                        Sent {formatNumber(o.dispatchedQty, 2)} of {formatNumber(o.qty, 2)} · delivered {formatNumber(o.deliveredQty, 2)}
                      </span>
                      <span className="font-semibold text-primary">{pct}%</span>
                    </div>
                    <Meter value={o.dispatchedQty} max={o.qty} />
                    <p className="mt-2 text-sm font-semibold text-primary">{formatNumber(Math.max(0, left), 2)} left to send</p>
                  </div>
                  {c?.credit.blocked && <p className="mt-2 text-sm text-error-primary">{c.credit.reasons.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>}
                  {left <= 0 && (
                    <div className="mt-4">
                      <Button size="sm" color="secondary" iconLeading={CheckDone01} onPress={() => close.mutate(o._id)}>
                        Close order
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <OrderForm onClose={() => setCreating(false)} />}
    </>
  );
}

function OrderForm({ onClose }) {
  const { data: customers } = useGet('/masters/customers');
  const { data: materials } = useGet('/masters/materials');
  const { data: sites } = useGet('/masters/locations', { type: 'customer_site' });
  const f = useForm({ customer: '', material: '', deliverySite: '', qty: '', ratePerUnit: '', notes: '' });
  const v = f.values;
  const [credit, setCredit] = useState(null);
  const save = useAction((api, body) => api.post('/sales/orders', body), {
    success: 'Order saved',
    invalidate: ['/sales'],
    onSuccess: (res) => (res.credit?.blocked ? setCredit(res.credit) : onClose()),
    onError: (e) => f.setErrors(e.fields ?? { customer: e.message }),
  });
  const unit = materials?.items.find((m) => m._id === v.material)?.unit ?? 'unit';
  const customerSites = (sites?.items ?? []).filter((s) => (s.customer?._id ?? s.customer) === v.customer);

  if (credit) {
    return (
      <Modal
        open
        onClose={onClose}
        icon={ClipboardCheck}
        tone="warning"
        title="Order saved — but the customer is on hold"
        footer={<Button onPress={onClose}>OK</Button>}
      >
        <Alert tone="warning" title={credit.reasons.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}>
          No truck can be sent on this order until they pay or the owner allows it anyway. They owe {formatLakh(credit.exposure)} of {formatLakh(credit.creditLimit)} · overdue {formatLakh(credit.overdueAmount)}.
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={ClipboardCheck}
      tone="brand"
      title="New customer order"
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} onPress={() => save.mutate(v)}>
            Save order
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ComboField label="Customer" value={v.customer} onChange={(val) => (f.set('customer')(val), f.set('deliverySite')(''))} options={toOptions(customers?.items)} error={f.errors.customer} required />
        <SelectField
          label="Delivery site"
          value={v.deliverySite}
          onChange={f.set('deliverySite')}
          options={toOptions(customerSites)}
          error={f.errors.deliverySite}
          placeholder={v.customer && !customerSites.length ? 'No site — ask the owner to add one' : 'Choose…'}
          required
        />
        <SelectField label="Product" value={v.material} onChange={f.set('material')} options={toOptions(materials?.items, (m) => m.unit)} error={f.errors.material} required />
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Quantity" suffix={unit} value={v.qty} onChange={f.set('qty')} error={f.errors.qty} required />
          <NumberField label="Rate" prefix="₹" suffix={`/${unit}`} value={v.ratePerUnit} onChange={f.set('ratePerUnit')} error={f.errors.ratePerUnit} required />
        </div>
        <TextField label="Notes" value={v.notes} onChange={f.set('notes')} />
      </div>
    </Modal>
  );
}
