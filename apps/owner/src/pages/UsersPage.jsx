import { KeyIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { EMAIL_LOGIN_ROLES, formatDateTime, ROLE_LABELS, ROLES } from '@feather/shared';
import { Badge, Button, Card, DataTable, Loading, Modal, PageHeader, SelectField, SwitchField, TextField, useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const isOffice = (role) => EMAIL_LOGIN_ROLES.includes(role);

export default function UsersPage() {
  const { data, isLoading } = useGet('/users');
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Office staff log in with an email code. Field staff log in with phone + PIN. Each person only sees what their role needs."
        actions={<Button icon={PlusIcon} onClick={() => setEditing({})}>New user</Button>}
      />
      <Card>
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={data?.users}
            columns={[
              { key: 'name', header: 'Name', render: (u) => <span className="font-medium">{u.name}</span> },
              { key: 'role', header: 'Role', render: (u) => <Badge tone={u.role === ROLES.OWNER ? 'brand' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge> },
              { key: 'login', header: 'Login', render: (u) => (isOffice(u.role) ? u.email : `+91 ${u.phone}`) },
              { key: 'where', header: 'Works at', render: (u) => (u.locations?.length ? u.locations.map((l) => l.name).join(', ') : 'All places') },
              { key: 'last', header: 'Last login', render: (u) => formatDateTime(u.lastLoginAt) },
              { key: 'active', header: 'Status', render: (u) => (u.active ? <Badge tone="good">Active</Badge> : <Badge>Off</Badge>) },
              {
                key: 'act',
                header: '',
                render: (u) => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={PencilSquareIcon} onClick={() => setEditing(u)}>Edit</Button>
                    {!isOffice(u.role) && <Button size="sm" variant="ghost" icon={KeyIcon} onClick={() => setResetting(u)}>PIN</Button>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      {editing && <UserForm existing={editing._id ? editing : null} onClose={() => setEditing(null)} />}
      {resetting && <PinDialog user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function UserForm({ existing, onClose }) {
  const { data: locations } = useGet('/masters/locations');
  const f = useForm({
    name: existing?.name ?? '',
    role: existing?.role ?? ROLES.SIDING_SUPERVISOR,
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    pin: '',
    locations: existing?.locations?.map((l) => l._id ?? l) ?? [],
    active: existing?.active ?? true,
  });
  const v = f.values;
  const save = useAction(
    (api, b) => (existing ? api.patch(`/users/${existing._id}`, b) : api.post('/users', b)),
    { success: 'User saved', invalidate: ['/users'], onSuccess: onClose, onError: (e) => f.setErrors(e.fields ?? { name: e.message }) },
  );
  const office = isOffice(v.role);
  const relevant = (locations?.items ?? []).filter((l) =>
    v.role === ROLES.SIDING_SUPERVISOR ? ['siding', 'port'].includes(l.type) : v.role === ROLES.GATE_INSPECTOR ? ['stockyard', 'customer_site'].includes(l.type) : false,
  );
  const toggle = (id) => f.set('locations')(v.locations.includes(id) ? v.locations.filter((x) => x !== id) : [...v.locations, id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Edit user' : 'New user'}
      description={existing ? 'Changing role or turning a user off logs them out on every phone.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={save.isPending}
            onClick={() => save.mutate({ ...v, email: office ? v.email : undefined, phone: office ? undefined : v.phone, pin: office || existing ? undefined : v.pin, locations: office ? [] : v.locations })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
        <SelectField className="sm:col-span-2" label="Role" value={v.role} onChange={f.set('role')} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
        {office ? (
          <TextField className="sm:col-span-2" label="Email (for login code)" type="email" value={v.email} onChange={f.set('email')} error={f.errors.email} required />
        ) : (
          <>
            <TextField label="Mobile number" inputMode="tel" value={v.phone} onChange={f.set('phone')} error={f.errors.phone} required />
            {!existing && <TextField label="PIN (4–6 digits)" inputMode="numeric" value={v.pin} onChange={f.set('pin')} error={f.errors.pin} required />}
          </>
        )}
        {!office && (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-semibold text-ink-800">Works at</legend>
            <p className="text-xs text-ink-500">They only see trucks and rakes for these places.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {relevant.map((l) => (
                <label key={l._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ring-ink-200">
                  <input type="checkbox" className="size-4 accent-brand-600" checked={v.locations.includes(l._id)} onChange={() => toggle(l._id)} />
                  {l.name}
                </label>
              ))}
              {relevant.length === 0 && <p className="text-sm text-ink-500">No matching places yet.</p>}
            </div>
          </fieldset>
        )}
        {existing && <SwitchField className="sm:col-span-2" label="Active" hint="Turn off to block login immediately." checked={v.active} onChange={f.set('active')} />}
      </div>
    </Modal>
  );
}

function PinDialog({ user, onClose }) {
  const [pin, setPin] = useState('');
  const save = useAction((api) => api.post(`/users/${user._id}/reset-pin`, { pin }), { success: `PIN changed for ${user.name}`, invalidate: ['/users'], onSuccess: onClose });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={`New PIN for ${user.name}`}
      description="They will be logged out on all phones. Tell them the new PIN in person."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!/^\d{4,6}$/.test(pin)} onClick={() => save.mutate()}>Set PIN</Button>
        </>
      }
    >
      <TextField label="New PIN (4–6 digits)" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
    </Modal>
  );
}
