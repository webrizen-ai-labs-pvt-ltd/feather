import { Building01, Building07, Edit03, Grid01, MarkerPin01, Package, Plus, ShoppingBag01, Trash01, Wallet02 } from '@untitledui/icons';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatINR, formatLakh, formatNumber, formatPct, LOCATION_TYPE_LABELS, MATERIAL_KINDS, ROUTED_LOCATION_TYPES, UNLOADING_POINT_TYPES } from '@feather/shared';
import { Avatar, Button, DataTable, Modal, NumberField, PageHeader, SelectField, StatusBadge, SwitchField, Tabs, TextField, useForm } from '@feather/ui';
import { toOptions, useAction, useGet } from '@/lib/hooks.js';
import { CustomerForm } from '@/pages/CustomersPage.jsx';
import { SellerForm } from '@/pages/SellersPage.jsx';
import { TransporterForm } from '@/pages/TransportersPage.jsx';

/** Tabs of Business setup: key (also ?tab= in the address), the record kind it adds, and its New button. */
const TABS = [
  { key: 'products', kind: 'material', newLabel: 'New product' },
  { key: 'places', kind: 'location', newLabel: 'New place' },
  { key: 'customers', kind: 'customer', newLabel: 'New customer' },
  { key: 'sellers', kind: 'seller', newLabel: 'New seller' },
  { key: 'truck-companies', kind: 'transporter', newLabel: 'New truck company' },
];

const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const activeBadge = (r) => <StatusBadge tone={r.active ? 'good' : 'neutral'}>{r.active ? 'Active' : 'Off'}</StatusBadge>;
const nameWithAvatar = (name, sub) => (
  <div className="flex items-center gap-3">
    <Avatar size="sm" initials={initials(name)} />
    <div className="min-w-0">
      <p className="font-medium text-primary">{name}</p>
      {sub && <p className="text-xs text-tertiary">{sub}</p>}
    </div>
  </div>
);

/**
 * Business setup: everything you add once and use every day — products, places, customers,
 * sellers and truck companies. Money pages (Customers, Sellers, Truck companies) show the numbers.
 */
export default function MastersPage() {
  const [params, setParams] = useSearchParams();
  const tab = Math.max(0, TABS.findIndex((t) => t.key === params.get('tab')));
  const setTab = (i) => setParams(i ? { tab: TABS[i].key } : {}, { replace: true });
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();
  const { data: materials } = useGet('/masters/materials', { active: 'all' });
  const { data: locations } = useGet('/masters/locations', { active: 'all' });
  const { data: customers } = useGet('/masters/customers', { active: 'all' });
  const { data: sellers } = useGet('/masters/sellers', { active: 'all' });
  const { data: transporters } = useGet('/masters/transporters', { active: 'all' });
  const { data: settings } = useGet('/admin/settings');
  const defTol = settings?.settings.defaultTransitLossTolerancePct;
  const edit = (kind, item) => (
    <Button size="sm" color="tertiary" iconLeading={Edit03} onPress={() => setEditing({ kind, item })}>
      Edit
    </Button>
  );
  // Counts that link the lists: delivery sites per customer, products per seller.
  const sitesOf = (customerId) => (locations?.items ?? []).filter((l) => (l.customer?._id ?? l.customer) === customerId).length;
  const productsOf = (sellerId) => (materials?.items ?? []).filter((m) => (m.seller?._id ?? m.seller) === sellerId).length;
  const close = () => setEditing(null);

  return (
    <>
      <PageHeader
        help="owner-setup"
        breadcrumbs={[{ label: 'Setup' }]}
        title="Business setup"
        subtitle="Add and change everything your business works with: products, places, customers, sellers and truck companies."
        actions={
          <Button iconLeading={Plus} onPress={() => setEditing({ kind: TABS[tab].kind })}>
            {TABS[tab].newLabel}
          </Button>
        }
      />
      <Tabs
        selectedIndex={tab}
        onChange={setTab}
        tabs={[
          {
            label: 'Products',
            icon: Package,
            count: materials?.items.length,
            content: (
              <DataTable
                dense
                rows={materials?.items}
                empty="No products yet."
                emptyIcon={Package}
                columns={[
                  { key: 'name', header: 'Name', sortable: true, render: (m) => <span className="font-medium text-primary">{m.name}</span> },
                  {
                    key: 'seller',
                    header: 'Seller name',
                    sortable: true,
                    sortValue: (m) => m.seller?.name ?? '',
                    render: (m) =>
                      m.seller ? (
                        <span className="text-primary">
                          {m.seller.name}
                          {!m.seller.active && <span className="text-tertiary"> (off)</span>}
                        </span>
                      ) : (
                        <StatusBadge tone="warn">Not set</StatusBadge>
                      ),
                  },
                  { key: 'kind', header: 'Counted in', render: (m) => (m.kind === 'bagged' ? `Bags of ${m.bagWeightKg} kg` : 'Weight (MT)') },
                  { key: 'tol', header: 'Allowed loss on the way', align: 'right', render: (m) => `${formatPct(m.transitLossTolerancePct ?? defTol)}${m.transitLossTolerancePct == null ? ' (default)' : ''}` },
                  { key: 'density', header: 'Density t/m³', align: 'right', render: (m) => m.densityTPerM3 ?? '—' },
                  { key: 'cost', header: 'Your cost', align: 'right', render: (m) => `${formatINR(m.landedCostPerUnit)} / ${m.unit}` },
                  { key: 'active', header: 'Status', render: (m) => <StatusBadge tone={m.active ? 'good' : 'neutral'}>{m.active ? 'Active' : 'Off'}</StatusBadge> },
                  { key: 'e', header: '', align: 'right', render: (m) => edit('material', m) },
                ]}
              />
            ),
          },
          {
            label: 'Places',
            icon: MarkerPin01,
            count: locations?.items.length,
            content: (
              <DataTable
                dense
                rows={locations?.items}
                empty="No places yet."
                emptyIcon={MarkerPin01}
                columns={[
                  { key: 'name', header: 'Name', sortable: true, render: (l) => <span className="font-medium text-primary">{l.name}</span> },
                  { key: 'type', header: 'Type', sortable: true, render: (l) => LOCATION_TYPE_LABELS[l.type] },
                  { key: 'customer', header: 'Customer', render: (l) => l.customer?.name ?? '—' },
                  { key: 'hours', header: 'Normal road time', align: 'right', render: (l) => (l.expectedTransitHours ? `${l.expectedTransitHours} h` : '—') },
                  {
                    key: 'routes',
                    header: 'Distances & costs',
                    render: (l) =>
                      UNLOADING_POINT_TYPES.includes(l.type) ? (
                        <LabourCosts place={l} />
                      ) : l.routes?.length ? (
                        <ul className="flex flex-col gap-0.5">
                          {l.routes.map((r) => (
                            <li key={r.from?._id ?? r.from} className="whitespace-nowrap">
                              <span className="text-primary">{r.from?.name ?? '—'}</span> · {formatNumber(r.distanceKm, 1)} km · {formatINR(r.pricePerTruck)}/truck
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      ),
                  },
                  { key: 'active', header: 'Status', render: (l) => <StatusBadge tone={l.active ? 'good' : 'neutral'}>{l.active ? 'Active' : 'Off'}</StatusBadge> },
                  { key: 'e', header: '', align: 'right', render: (l) => edit('location', l) },
                ]}
              />
            ),
          },
          {
            label: 'Customers',
            icon: Wallet02,
            count: customers?.items.length,
            content: (
              <DataTable
                dense
                rows={customers?.items}
                empty="No customers yet. Use New customer to add the first one."
                emptyIcon={Wallet02}
                columns={[
                  {
                    key: 'name',
                    header: 'Customer',
                    sortable: true,
                    // Name opens their dues page; Edit (right) changes their details.
                    render: (c) => (
                      <button type="button" className="rounded-md text-left outline-focus-ring hover:underline focus-visible:outline-2" onClick={() => navigate(`/customers/${c._id}`)}>
                        {nameWithAvatar(c.name, c.email)}
                      </button>
                    ),
                  },
                  { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
                  { key: 'gstin', header: 'GSTIN', render: (c) => c.gstin ?? '—' },
                  {
                    key: 'limit',
                    header: 'Credit limit',
                    align: 'right',
                    render: (c) => (c.creditLimit != null ? formatLakh(c.creditLimit) : <span className="text-tertiary">{formatLakh(settings?.settings.defaultCreditLimit)} (default)</span>),
                  },
                  {
                    key: 'days',
                    header: 'Credit days',
                    align: 'right',
                    render: (c) => (c.creditDays != null ? c.creditDays : <span className="text-tertiary">{settings?.settings.defaultCreditDays ?? '—'} (default)</span>),
                  },
                  { key: 'sites', header: 'Delivery sites', align: 'right', render: (c) => sitesOf(c._id) || <StatusBadge tone="warn">None</StatusBadge> },
                  { key: 'active', header: 'Status', render: activeBadge },
                  {
                    key: 'e',
                    header: '',
                    align: 'right',
                    render: (c) => (
                      <div className="flex items-center justify-end gap-1">
                        {/* Opens New place, already set to a delivery site of this customer. */}
                        <Button
                          size="sm"
                          color="tertiary"
                          iconLeading={MarkerPin01}
                          onPress={() => setEditing({ kind: 'location', preset: { type: 'customer_site', customer: c._id } })}
                        >
                          Add delivery site
                        </Button>
                        {edit('customer', c)}
                      </div>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            label: 'Sellers',
            icon: ShoppingBag01,
            count: sellers?.items.length,
            content: (
              <DataTable
                dense
                rows={sellers?.items}
                empty="No sellers yet. Use New seller to add the first one."
                emptyIcon={ShoppingBag01}
                columns={[
                  { key: 'name', header: 'Seller', sortable: true, render: (s) => nameWithAvatar(s.name, s.contactPerson) },
                  { key: 'phone', header: 'Phone', render: (s) => s.phone ?? '—' },
                  { key: 'email', header: 'Email', render: (s) => s.email ?? '—' },
                  { key: 'gstin', header: 'GSTIN', render: (s) => s.gstin ?? '—' },
                  { key: 'products', header: 'Products', align: 'right', render: (s) => productsOf(s._id) },
                  { key: 'active', header: 'Status', render: activeBadge },
                  { key: 'e', header: '', align: 'right', render: (s) => edit('seller', s) },
                ]}
              />
            ),
          },
          {
            label: 'Truck companies',
            icon: Building07,
            count: transporters?.items.length,
            content: (
              <DataTable
                dense
                rows={transporters?.items}
                empty="No truck companies yet. Use New truck company to add the first one."
                emptyIcon={Building07}
                columns={[
                  { key: 'name', header: 'Truck company', sortable: true, render: (t) => nameWithAvatar(t.name) },
                  { key: 'phone', header: 'Phone', render: (t) => t.phone ?? '—' },
                  { key: 'gstin', header: 'GSTIN', render: (t) => t.gstin ?? '—' },
                  { key: 'rate', header: 'Usual truck rate', align: 'right', render: (t) => `${formatINR(t.defaultRatePerUnit)} / unit` },
                  { key: 'active', header: 'Status', render: activeBadge },
                  { key: 'e', header: '', align: 'right', render: (t) => edit('transporter', t) },
                ]}
              />
            ),
          },
        ]}
      />
      {editing?.kind === 'material' && <MaterialForm existing={editing.item} onClose={close} />}
      {editing?.kind === 'location' && <LocationForm existing={editing.item} preset={editing.preset} onClose={close} />}
      {editing?.kind === 'customer' && <CustomerForm existing={editing.item} onClose={close} />}
      {editing?.kind === 'seller' && <SellerForm existing={editing.item} onClose={close} />}
      {editing?.kind === 'transporter' && <TransporterForm existing={editing.item} onClose={close} />}
    </>
  );
}

/** Per kg rates are paise, so they keep two decimals (formatINR rounds to whole rupees). */
const formatPerKg = (v) => (v == null ? '—' : `₹${formatNumber(v, 2)}`);

/** Unloading labour rates of a station / port, for the places table. */
function LabourCosts({ place: l }) {
  const parts = [
    l.labourCostPerWagon != null && `${formatINR(l.labourCostPerWagon)}/wagon`,
    l.labourCostPerTruck != null && `${formatINR(l.labourCostPerTruck)}/truck`,
    l.labourCostPerKg != null && `${formatPerKg(l.labourCostPerKg)}/kg`,
  ].filter(Boolean);
  if (!parts.length) return '—';
  return (
    <span className="whitespace-nowrap">
      <span className="text-primary">Labour</span> · {parts.join(' · ')}
    </span>
  );
}

function FormModal({ title, icon, onClose, onSave, saving, size, children }) {
  return (
    <Modal
      open
      onClose={onClose}
      icon={icon}
      title={title}
      size={size}
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={saving} onPress={onSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </Modal>
  );
}

function MaterialForm({ existing, onClose }) {
  const { data: sellers } = useGet('/masters/sellers', { active: 'all' });
  const currentSeller = existing?.seller?._id ?? existing?.seller ?? '';
  // Active sellers to choose from, plus the current one even if it was switched off since.
  const sellerOptions = (sellers?.items ?? [])
    .filter((s) => s.active || s._id === currentSeller)
    .map((s) => ({ value: s._id, label: s.name, hint: s.active ? s.contactPerson : 'Off' }));
  const f = useForm({
    name: existing?.name ?? '',
    seller: currentSeller,
    kind: existing?.kind ?? MATERIAL_KINDS.BULK,
    bagWeightKg: existing?.bagWeightKg ?? 50,
    transitLossTolerancePct: existing?.transitLossTolerancePct ?? '',
    densityTPerM3: existing?.densityTPerM3 ?? '',
    landedCostPerUnit: existing?.landedCostPerUnit ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, b) => (existing ? api.patch(`/masters/materials/${existing._id}`, b) : api.post('/masters/materials', b)), {
    success: 'Saved',
    invalidate: ['/masters'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  const unit = v.kind === 'bagged' ? 'bag' : 'MT';
  return (
    <FormModal title={existing ? 'Edit product' : 'New product'} icon={Package} onClose={onClose} saving={save.isPending} onSave={() => save.mutate(v)}>
      <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
      <SelectField
        className="sm:col-span-2"
        label="Seller name"
        required
        value={v.seller}
        onChange={f.set('seller')}
        error={f.errors.seller}
        hint={sellers && !sellerOptions.length ? 'No sellers yet. Add one under Money → Sellers first.' : 'Who you buy this product from. Only you see it.'}
        options={sellerOptions}
      />
      <SelectField
        label="Counted in"
        value={v.kind}
        onChange={f.set('kind')}
        disabled={Boolean(existing)}
        options={[
          { value: 'bulk', label: 'Weight (MT)', hint: 'sand, aggregate, soil' },
          { value: 'bagged', label: 'Bags', hint: 'cement' },
        ]}
      />
      {v.kind === 'bagged' && <NumberField label="Bag weight" suffix="kg" value={v.bagWeightKg} onChange={f.set('bagWeightKg')} />}
      <NumberField label="Allowed loss on the way" suffix="%" hint="e.g. 0.5 for wet sand. Blank = default." value={v.transitLossTolerancePct} onChange={f.set('transitLossTolerancePct')} error={f.errors.transitLossTolerancePct} />
      {v.kind === 'bulk' && <NumberField label="Density" suffix="t/m³" hint="For brass ↔ MT." value={v.densityTPerM3} onChange={f.set('densityTPerM3')} />}
      <NumberField label={`Your cost per ${unit}`} prefix="₹" hint="Used to value losses. Only you see it." value={v.landedCostPerUnit} onChange={f.set('landedCostPerUnit')} />
      <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
    </FormModal>
  );
}

const EMPTY_ROUTE = { from: '', distanceKm: '', pricePerTruck: '' };

/** preset: starting values for a new place, e.g. { type: 'customer_site', customer } from a customer's "Add delivery site". */
function LocationForm({ existing, preset, onClose }) {
  const { data: customers } = useGet('/masters/customers');
  // 'all' so a route from a station that was later switched off still shows its name.
  const { data: unloadingPoints } = useGet('/masters/locations', { type: UNLOADING_POINT_TYPES.join(','), active: 'all' });
  const f = useForm({
    name: existing?.name ?? '',
    type: existing?.type ?? preset?.type ?? 'stockyard',
    address: existing?.address ?? '',
    customer: existing?.customer?._id ?? existing?.customer ?? preset?.customer ?? '',
    expectedTransitHours: existing?.expectedTransitHours ?? '',
    routes: (existing?.routes ?? []).map((r) => ({ from: r.from?._id ?? r.from, distanceKm: r.distanceKm, pricePerTruck: r.pricePerTruck })),
    labourCostPerWagon: existing?.labourCostPerWagon ?? '',
    labourCostPerTruck: existing?.labourCostPerTruck ?? '',
    labourCostPerKg: existing?.labourCostPerKg ?? '',
    active: existing?.active ?? true,
  });
  const save = useAction((api, b) => (existing ? api.patch(`/masters/locations/${existing._id}`, b) : api.post('/masters/locations', b)), {
    success: 'Saved',
    invalidate: ['/masters'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const v = f.values;
  const routed = ROUTED_LOCATION_TYPES.includes(v.type);
  const unloadingPoint = UNLOADING_POINT_TYPES.includes(v.type);

  // Row edits also clear that row's server error, like f.set does for plain fields.
  const setRoute = (i, key) => (value) => {
    f.setValues((s) => ({ ...s, routes: s.routes.map((r, j) => (j === i ? { ...r, [key]: value } : r)) }));
    f.setErrors((e) => ({ ...e, [`routes.${i}.${key}`]: undefined }));
  };
  // Removing a row shifts the indexes, so old row errors no longer line up — drop them.
  const dropRouteErrors = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('routes.')));
  const addRoute = () => f.setValues((s) => ({ ...s, routes: [...s.routes, { ...EMPTY_ROUTE }] }));
  const removeRoute = (i) => {
    f.setValues((s) => ({ ...s, routes: s.routes.filter((_, j) => j !== i) }));
    f.setErrors(dropRouteErrors);
  };

  return (
    <FormModal
      title={existing ? 'Edit place' : 'New place'}
      icon={v.type === 'customer_site' ? Building01 : Grid01}
      size={routed || unloadingPoint ? 'lg' : 'md'}
      onClose={onClose}
      saving={save.isPending}
      onSave={() => save.mutate({ ...v, routes: routed ? v.routes : [] })}
    >
      <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
      <SelectField label="Type" value={v.type} onChange={f.set('type')} options={Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      {v.type === 'customer_site' && <SelectField label="Customer" value={v.customer} onChange={f.set('customer')} options={toOptions(customers?.items)} error={f.errors.customer} required />}
      {routed && (
        <NumberField label="Normal road time to reach" suffix="hours" hint="Slower trucks are flagged as late." value={v.expectedTransitHours} onChange={f.set('expectedTransitHours')} />
      )}
      <TextField className="sm:col-span-2" label="Address" value={v.address} onChange={f.set('address')} />
      {unloadingPoint && (
        <fieldset className="flex flex-col gap-4 border-t border-secondary pt-5 sm:col-span-2">
          <div>
            <legend className="text-sm font-semibold text-primary">Unloading labour cost</legend>
            <p className="mt-0.5 text-sm text-tertiary">What you pay labour to unload here. Fill in the ones that apply. Loading staff see the per-truck cost on each truck and can ask you for a different one; receiving staff never see these.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <NumberField label="Per wagon" prefix="₹" value={v.labourCostPerWagon} onChange={f.set('labourCostPerWagon')} error={f.errors.labourCostPerWagon} />
            <NumberField label="Per truck" prefix="₹" value={v.labourCostPerTruck} onChange={f.set('labourCostPerTruck')} error={f.errors.labourCostPerTruck} />
            <NumberField label="Per kg" prefix="₹" hint="e.g. 0.15" value={v.labourCostPerKg} onChange={f.set('labourCostPerKg')} error={f.errors.labourCostPerKg} />
          </div>
        </fieldset>
      )}
      {routed && (
        <RoutesEditor
          routes={v.routes}
          errors={f.errors}
          points={(unloadingPoints?.items ?? []).filter((p) => p._id !== existing?._id)}
          onChange={setRoute}
          onAdd={addRoute}
          onRemove={removeRoute}
        />
      )}
      <SwitchField label="Active" checked={v.active} onChange={f.set('active')} />
    </FormModal>
  );
}

/** Distance and agreed truck price from each railway station / port to this place. */
function RoutesEditor({ routes, errors, points, onChange, onAdd, onRemove }) {
  const pointLabel = (p) => `${p.name} · ${LOCATION_TYPE_LABELS[p.type]}${p.active ? '' : ' (off)'}`;
  return (
    <fieldset className="flex flex-col gap-4 border-t border-secondary pt-5 sm:col-span-2">
      <div>
        <legend className="text-sm font-semibold text-primary">Distance from unloading points</legend>
        <p className="mt-0.5 text-sm text-tertiary">
          For each railway station or port that sends material here: how far it is and what you pay per truck. Loading staff see this price and can ask you for a different one; receiving staff never see it.
        </p>
      </div>
      {!points.length && <p className="text-sm text-tertiary">Add a railway station or port first — then you can set distances from it.</p>}
      {routes.map((r, i) => {
        // A station / port can appear only once; hide the ones other rows already use.
        const taken = new Set(routes.filter((_, j) => j !== i).map((o) => o.from));
        return (
          <div key={i} className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_auto]">
            <SelectField
              label="From unloading point"
              value={r.from}
              onChange={onChange(i, 'from')}
              error={errors[`routes.${i}.from`]}
              options={points.filter((p) => !taken.has(p._id)).map((p) => ({ value: p._id, label: pointLabel(p) }))}
              required
            />
            <NumberField label="Distance" suffix="km" value={r.distanceKm} onChange={onChange(i, 'distanceKm')} error={errors[`routes.${i}.distanceKm`]} required />
            <NumberField label="Price per truck" prefix="₹" value={r.pricePerTruck} onChange={onChange(i, 'pricePerTruck')} error={errors[`routes.${i}.pricePerTruck`]} required />
            <Button className="sm:mt-6" color="tertiary-destructive" iconLeading={Trash01} aria-label="Remove this unloading point" onPress={() => onRemove(i)}>
              <span className="sm:sr-only">Remove</span>
            </Button>
          </div>
        );
      })}
      {points.length > routes.length && (
        <div>
          <Button size="sm" color="secondary" iconLeading={Plus} onPress={onAdd}>
            Add unloading point
          </Button>
        </div>
      )}
    </fieldset>
  );
}
