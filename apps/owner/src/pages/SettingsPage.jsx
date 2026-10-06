import { BellRinging01, Package, Save01, Scales02, Wallet02 } from '@untitledui/icons';
import { useEffect } from 'react';
import { Button, Card, FeaturedIcon, Loading, NumberField, PageHeader, SwitchField, TextField, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

/** Settings laid out like a settings page: what it is on the left, the fields on the right. */
function Group({ icon, title, description, children }) {
  return (
    <div className="grid gap-5 border-b border-secondary py-6 last:border-b-0 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-8">
      <div className="flex gap-3">
        <FeaturedIcon icon={icon} color="gray" theme="modern" size="md" className="shrink-0" />
        <div>
          <p className="text-sm font-semibold text-primary">{title}</p>
          <p className="mt-0.5 text-sm text-tertiary">{description}</p>
        </div>
      </div>
      <div className="grid max-w-2xl gap-5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

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
    body.alertEmails = String(v.alertEmails)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    save.mutate(body);
  }

  return (
    <>
      <PageHeader
        help="owner-settings"
        breadcrumbs={[{ label: 'Setup' }]}
        title="Settings"
        subtitle="The rules Feather enforces on the ground."
        actions={
          <Button iconLeading={Save01} isLoading={save.isPending} onPress={submit}>
            Save settings
          </Button>
        }
      />
      <Card className="px-5 md:px-8">
        <Group icon={Scales02} title="Lost material & weighbridges" description="When a truck's payment is put on hold, and when a truck counts as late.">
          {num('defaultTransitLossTolerancePct', 'Allowed loss on the way (default)', { suffix: '%', hint: 'Above this, the truck payment is put on hold. Each product can have its own.' })}
          {num('tareDeviationPct', 'Empty truck weight warning', { suffix: '%', hint: 'Compared with the same truck’s last 10 trips.' })}
          {num('tareMismatchTons', 'Empty weight difference between weighbridges', { suffix: 'MT' })}
          {num('defaultExpectedTransitHours', 'Normal road time (default)', { suffix: 'hours' })}
          {num('slowTransitFactor', 'Late truck alert after', { suffix: '× normal', hint: '1.5 = alert when 50% slower than normal.' })}
        </Group>
        <Group icon={Package} title="Cement bags" description="How damaged bags are valued and who pays for them, and how long cement keeps.">
          {num('burstDiscountPct', 'Discount on re-bagged torn cement', { suffix: '%' })}
          {num('shelfLifeDays', 'Cement shelf life', { suffix: 'days', hint: 'Counted from the date of manufacturing on the shipment.' })}
          {num('shelfLifeWarnDays', 'Mark stock “use first” when', { suffix: 'days left' })}
          <SwitchField className="sm:col-span-2" label="Charge torn-bag discount to truck company" hint="Hard/wet, missing and light bags are always charged." checked={v.chargeBurstLossToTransporter} onChange={f.set('chargeBurstLossToTransporter')} />
        </Group>
        <Group icon={Wallet02} title="Customer dues" description="When a customer is put on hold and gets no new trucks.">
          {num('defaultCreditLimit', 'Default credit limit', { prefix: '₹' })}
          {num('defaultCreditDays', 'Default credit days', { suffix: 'days', hint: 'Bills older than this put the customer on hold.' })}
        </Group>
        <Group icon={BellRinging01} title="Alerts" description="When Feather warns you, and who else gets the emails.">
          {num('demurrageWarnHours', 'Warn before free hours end', { suffix: 'hours' })}
          {num('stockMismatchPct', 'Stock count mismatch alert', { suffix: '%' })}
          <TextField className="sm:col-span-2" label="Extra alert emails" hint="Comma separated. All owners get alerts anyway." value={v.alertEmails} onChange={f.set('alertEmails')} error={f.errors.alertEmails} />
        </Group>
      </Card>
    </>
  );
}
