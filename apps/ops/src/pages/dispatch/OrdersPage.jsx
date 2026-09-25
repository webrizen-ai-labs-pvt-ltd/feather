import { PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { CREDIT_REASON_LABELS, formatDate, formatINR, formatLakh, formatNumber } from '@feather/shared';
import { Badge, Button, Card, ComboField, EmptyState, Loading, Meter, Modal, NumberField, SelectField, TextField, toOptions, useAction, useForm, useGet } from '@feather/ui';

export default function OrdersPage() {
  const { data, isLoading } = useGet('/sales/orders', { status: 'open' });
  const { data: credit } = useGet('/sales/credit');
  const [creating, setCreating] = useState(false);
  const creditOf = (customerId) => credit?.items.find((c) => c.customer._id === customerId);
  const close = useAction((api, id) => api.post(`/sales/orders/${id}/status`, { status: 'completed' }), { success: 'Order closed', invalidate: ['/sales'] });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-xl font-bold">Open orders</h1>
        <Button icon={PlusIcon} onClick={() => setCreating(true)}>New order</Button>
      </div>
      {isLoading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Card>
          <EmptyState title="No open orders" />
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.items.map((o) => {
            const c = creditOf(o.customer?._id);
            const left = o.qty - o.dispatchedQty;
            return (
              <li key={o._id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{o.customer?.name}</p>
                      <p className="text-sm text-ink-600">
                        {o.orderNo} · {o.material?.name} → {o.deliverySite?.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDate(o.createdAt)} · {formatINR(o.ratePerUnit)} / {o.material?.unit}
                      </p>
                    </div>
                    {c?.credit.blocked ? <Badge tone={c.override ? 'warn' : 'bad'}>{c.override ? 'Override' : 'Blocked'}</Badge> : <Badge tone="good">Credit OK</Badge>}
                  </div>
                  <Meter className="mt-3" value={o.dispatchedQty} max={o.qty} />
                  <p className="mt-1 text-sm text-ink-600">
                    Sent {formatNumber(o.dispatchedQty, 2)} of {formatNumber(o.qty, 2)} · delivered {formatNumber(o.deliveredQty, 2)} · <b>{formatNumber(left, 2)} left</b>
                  </p>
                  {c?.credit.blocked && <p className="mt-1 text-sm text-red-700">{c.credit.reasons.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>}
                  {left <= 0 && (
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => close.mutate(o._id)}>Close order</Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <OrderForm onClose={() => setCreating(false)} />}
    </div>
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
      <Modal open onClose={onClose} title="Order saved — but customer is blocked" footer={<Button onClick={onClose}>OK</Button>}>
        <p className="text-sm text-ink-700">No truck can be sent on this order until payment is received or the owner allows an override.</p>
        <p className="mt-2 text-sm font-semibold text-red-700">{credit.reasons.map((r) => CREDIT_REASON_LABELS[r]).join(' · ')}</p>
        <p className="mt-1 text-sm">
          Exposure {formatLakh(credit.exposure)} of {formatLakh(credit.creditLimit)} · overdue {formatLakh(credit.overdueAmount)}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New customer order"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate(v)}>Save order</Button>
        </>
      }
    >
      <div className="space-y-4">
        <ComboField label="Customer" value={v.customer} onChange={(val) => (f.set('customer')(val), f.set('deliverySite')(''))} options={toOptions(customers?.items)} error={f.errors.customer} required />
        <SelectField label="Delivery site" value={v.deliverySite} onChange={f.set('deliverySite')} options={toOptions(customerSites)} error={f.errors.deliverySite} placeholder={v.customer && !customerSites.length ? 'No site — ask owner to add one' : 'Choose…'} required />
        <SelectField label="Material" value={v.material} onChange={f.set('material')} options={toOptions(materials?.items, (m) => m.unit)} error={f.errors.material} required />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Quantity" suffix={unit} value={v.qty} onChange={f.set('qty')} error={f.errors.qty} required />
          <NumberField label="Rate" suffix={`₹/${unit}`} value={v.ratePerUnit} onChange={f.set('ratePerUnit')} error={f.errors.ratePerUnit} required />
        </div>
        <TextField label="Notes" value={v.notes} onChange={f.set('notes')} />
      </div>
    </Modal>
  );
}
