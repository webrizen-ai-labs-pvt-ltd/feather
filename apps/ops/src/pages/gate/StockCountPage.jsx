import { Archive, Save01 } from '@untitledui/icons';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { fieldErrors, STOCK_GRADE_LABELS, stockCountSchema } from '@feather/shared';
import { Button, ErrorNote, NumberField, PageHeader, SelectField, TextField, newId, toOptions, useForm } from '@feather/ui';
import { FormStep, SavedScreen } from '@/components/FieldKit.jsx';
import { useCachedGet } from '@/lib/cached.js';
import { useOutbox } from '@/lib/outbox.jsx';

/** Physical stock count. Blind: the system figure is never shown here. */
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
      setDone({ queued: res.queued });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader help="stock-count" title="Count stock" subtitle="Count or measure what is in the warehouse. Enter only what you see." />
      {done ? (
        <SavedScreen
          queued={done.queued}
          title="Count saved. Thank you."
          action={
            <Button size="xl" className="w-full" iconLeading={Archive} onPress={() => (setDone(null), f.setValues((s) => ({ ...s, material: '', physicalQty: '', method: '' })))}>
              Count another
            </Button>
          }
        />
      ) : (
        <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-5">
          <FormStep n={1} title="What are you counting?">
            <SelectField big required label="Warehouse" value={v.location} onChange={f.set('location')} error={f.errors.location} options={toOptions(data?.locations)} />
            <SelectField big required label="Product" value={v.material} onChange={f.set('material')} error={f.errors.material} options={toOptions(data?.materials, (m) => (m.unit === 'bag' ? 'count in bags' : 'measure in MT'))} />
            <SelectField big label="Grade" value={v.grade} onChange={f.set('grade')} options={Object.entries(STOCK_GRADE_LABELS).map(([value, label]) => ({ value, label }))} />
          </FormStep>
          <FormStep n={2} title="How much did you find?">
            <NumberField big required label="Quantity found" suffix={material?.unit === 'bag' ? 'bags' : 'MT'} value={v.physicalQty} onChange={f.set('physicalQty')} error={f.errors.physicalQty} />
            <TextField label="How measured (optional)" placeholder="e.g. heap measured 12 × 8 × 2.5 m" value={v.method} onChange={f.set('method')} />
          </FormStep>
          <ErrorNote error={error} />
          <Button type="submit" size="xl" className="w-full" iconLeading={Save01} isLoading={busy}>
            Save count
          </Button>
        </Form>
      )}
    </div>
  );
}
