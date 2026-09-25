import { useEffect } from 'react';
import { Button, Card, CardHeader, Loading, NumberField, PageHeader, SwitchField, TextField, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

export default function SettingsPage() {
  const { data, isLoading } = useGet('/admin/settings');
  const f = useForm(null);
  useEffect(() => {
    if (data?.settings) f.setValues({ ...data.settings, alertEmails: (data.settings.alertEmails ?? []).join(', ') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const save = useAction((api, body) => api.put('/admin/settings', body), {
    success: 'Settings saved',
    invalidate: ['/admin'],
    onError: (e) => f.setErrors(e.fields ?? {}),
  });
  if (isLoading || !f.values) return <Loading />;
  const v = f.values;
  const num = (key, label, props = {}) => <NumberField label={label} value={v[key]} onChange={f.set(key)} error={f.errors[key]} {...props} />;

  function submit() {
    const body = {};
    for (const [k, val] of Object.entries(v)) {
      if (['_id', 'createdAt', 'updatedAt', '__v'].includes(k)) continue;
      body[k] = val;
    }
    body.alertEmails = String(v.alertEmails).split(',').map((s) => s.trim()).filter(Boolean);
    save.mutate(body);
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Rules the system enforces on the ground." actions={<Button loading={save.isPending} onClick={submit}>Save settings</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Transit loss & weighbridge" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {num('defaultTransitLossTolerancePct', 'Default allowed road loss', { suffix: '%', hint: 'Above this, freight is locked. Each material can have its own.' })}
            {num('tareDeviationPct', 'Empty truck weight warning', { suffix: '%', hint: 'Compared with the same truck’s last 10 trips.' })}
            {num('tareMismatchTons', 'Tare difference between weighbridges', { suffix: 'MT' })}
            {num('defaultExpectedTransitHours', 'Normal road time (default)', { suffix: 'hours' })}
            {num('slowTransitFactor', 'Delay alert after', { suffix: '× normal', hint: '1.5 = alert when 50% slower than normal.' })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Cement bags" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {num('burstDiscountPct', 'Discount on re-bagged torn cement', { suffix: '%' })}
            <SwitchField
              className="sm:col-span-2"
              label="Charge torn-bag discount to transporter"
              hint="Hard/wet, missing and light bags are always charged."
              checked={v.chargeBurstLossToTransporter}
              onChange={f.set('chargeBurstLossToTransporter')}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Customer credit" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {num('defaultCreditLimit', 'Default credit limit', { suffix: '₹' })}
            {num('defaultCreditDays', 'Default credit days', { suffix: 'days', hint: 'Bills older than this block new dispatch.' })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Alerts" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {num('demurrageWarnHours', 'Warn before free time ends', { suffix: 'hours' })}
            {num('stockMismatchPct', 'Stock count mismatch alert', { suffix: '%' })}
            <TextField className="sm:col-span-2" label="Extra alert emails" hint="Comma separated. All owners get alerts anyway." value={v.alertEmails} onChange={f.set('alertEmails')} error={f.errors.alertEmails} />
          </div>
        </Card>
      </div>
    </>
  );
}
