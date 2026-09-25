import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { fieldErrors, STOCK_GRADE_LABELS, stockCountSchema } from '@feather/shared';
import { Button, Card, ErrorNote, NumberField, SelectField, TextField, newId, toOptions, useForm } from '@feather/ui';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

/** Physical stock count. Blind: the book figure is never shown here. */
export default function StockCountPage() {
  const { data } = useCachedGet('/stock/count-options');
  const { submit } = useOutbox();
  const f = useForm({ location: '', material: '', grade: 'prime', physicalQty: '', method: '' });
  const v = f.values;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const material = data?.materials.find((m) => m._id === v.material);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const fields = { ...v, clientId: newId(), deviceTime: new Date().toISOString() };
    const check = stockCountSchema.safeParse(fields);
    if (!check.success) {
      f.setErrors(fieldErrors(check.error));
      return;
    }
    setBusy(true);
    try {
      const res = await submit({ path: '/stock/counts', fields, label: `Stock count ${material?.name ?? ''}` });
      setDone(res.queued ? 'Saved on phone. Will be sent when online.' : 'Count saved. Thank you.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <CheckCircleIcon className="mx-auto size-14 text-emerald-600" />
        <p className="mt-3 text-lg font-bold">{done}</p>
        <Button size="xl" className="mt-6" onClick={() => (setDone(null), f.setValues((s) => ({ ...s, material: '', physicalQty: '', method: '' })))}>
          Count another
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-bold">Stock count</h1>
        <p className="text-sm text-ink-500">Count or measure what is physically in the yard. Enter only what you see.</p>
      </div>
      <Card className="space-y-4 p-4">
        <SelectField big required label="Yard" value={v.location} onChange={f.set('location')} error={f.errors.location} options={toOptions(data?.locations)} />
        <SelectField big required label="Material" value={v.material} onChange={f.set('material')} error={f.errors.material} options={toOptions(data?.materials, (m) => (m.unit === 'bag' ? 'count in bags' : 'measure in MT'))} />
        <SelectField big label="Grade" value={v.grade} onChange={f.set('grade')} options={Object.entries(STOCK_GRADE_LABELS).map(([value, label]) => ({ value, label }))} />
        <NumberField big required label="Quantity found" suffix={material?.unit === 'bag' ? 'bags' : 'MT'} value={v.physicalQty} onChange={f.set('physicalQty')} error={f.errors.physicalQty} />
        <TextField label="How measured (optional)" placeholder="e.g. heap measured 12 × 8 × 2.5 m" value={v.method} onChange={f.set('method')} />
      </Card>
      <ErrorNote error={error} />
      <Button type="submit" size="xl" loading={busy}>Save count</Button>
    </form>
  );
}
