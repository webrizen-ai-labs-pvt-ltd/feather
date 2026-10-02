import { Edit03, Key01, Plus, UserPlus01, Users01 } from '@untitledui/icons';
import { useState } from 'react';
import { EMAIL_LOGIN_ROLES, formatDateTime, ROLE_LABELS, ROLES } from '@feather/shared';
import { Avatar, Button, CheckboxField, DataTable, Loading, Modal, PageHeader, SelectField, StatusBadge, SwitchField, TextField } from '@feather/ui';
import { useForm } from '@feather/ui';
import { useAction, useGet } from '@/lib/hooks.js';

const isOffice = (role) => EMAIL_LOGIN_ROLES.includes(role);
const initials = (n = '') => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const ROLE_TONE = { owner: 'brand', dispatch_operator: 'info', siding_supervisor: 'neutral', gate_inspector: 'neutral' };

export default function UsersPage() {
  const { data, isLoading } = useGet('/users');
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);

  return (
    <>
      <PageHeader
        help="owner-setup"
        breadcrumbs={[{ label: 'Setup' }]}
        title="Staff"
        subtitle="Office staff log in with an email code. Field staff log in with phone + PIN. Each person only sees what their job needs."
        actions={
          <Button iconLeading={Plus} onPress={() => setEditing({})}>
            New staff member
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          title="Everyone with access"
          badge={<span className="text-sm text-tertiary">{data?.users.length}</span>}
          rows={data?.users}
          emptyIcon={Users01}
          columns={[
            {
              key: 'name',
              header: 'Name',
              sortable: true,
              render: (u) => (
                <div className="flex items-center gap-3">
                  <Avatar size="md" initials={initials(u.name)} />
                  <div>
                    <p className="font-medium text-primary">{u.name}</p>
                    <p className="text-xs text-tertiary">{isOffice(u.role) ? u.email : `+91 ${u.phone}`}</p>
                  </div>
                </div>
              ),
            },
            { key: 'role', header: 'Role', sortable: true, render: (u) => <StatusBadge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</StatusBadge> },
            { key: 'login', header: 'Logs in with', render: (u) => (isOffice(u.role) ? 'Email code' : 'Phone + PIN') },
            { key: 'where', header: 'Works at', render: (u) => (u.locations?.length ? u.locations.map((l) => l.name).join(', ') : 'All places') },
            { key: 'last', header: 'Last login', sortable: true, sortValue: (u) => u.lastLoginAt ?? '', render: (u) => formatDateTime(u.lastLoginAt) },
            { key: 'active', header: 'Status', render: (u) => <StatusBadge tone={u.active ? 'good' : 'neutral'}>{u.active ? 'Active' : 'Off'}</StatusBadge> },
            {
              key: 'act',
              header: '',
              align: 'right',
              render: (u) => (
                <div className="flex justify-end gap-1">
                  {!isOffice(u.role) && (
                    <Button size="sm" color="tertiary" iconLeading={Key01} onPress={() => setResetting(u)}>
                      PIN
                    </Button>
                  )}
                  <Button size="sm" color="tertiary" iconLeading={Edit03} onPress={() => setEditing(u)}>
                    Edit
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
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
  const save = useAction((api, b) => (existing ? api.patch(`/users/${existing._id}`, b) : api.post('/users', b)), {
    success: 'Staff member saved',
    invalidate: ['/users'],
    onSuccess: onClose,
    onError: (e) => f.setErrors(e.fields ?? { name: e.message }),
  });
  const office = isOffice(v.role);
  const relevant = (locations?.items ?? []).filter((l) =>
    v.role === ROLES.SIDING_SUPERVISOR ? ['siding', 'port'].includes(l.type) : v.role === ROLES.GATE_INSPECTOR ? ['stockyard', 'customer_site'].includes(l.type) : false,
  );
  const toggle = (id) => f.set('locations')(v.locations.includes(id) ? v.locations.filter((x) => x !== id) : [...v.locations, id]);

  return (
    <Modal
      open
      onClose={onClose}
      icon={UserPlus01}
      title={existing ? 'Edit staff member' : 'New staff member'}
      description={existing ? 'Changing role or turning someone off logs them out on every phone.' : undefined}
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={save.isPending}
            onPress={() => save.mutate({ ...v, email: office ? v.email : undefined, phone: office ? undefined : v.phone, pin: office || existing ? undefined : v.pin, locations: office ? [] : v.locations })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Name" value={v.name} onChange={f.set('name')} error={f.errors.name} required />
        <SelectField className="sm:col-span-2" label="Role" value={v.role} onChange={f.set('role')} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
        {office ? (
          <TextField className="sm:col-span-2" label="Email (for login code)" type="email" value={v.email} onChange={f.set('email')} error={f.errors.email} required />
        ) : (
          <>
            <TextField label="Mobile number" inputMode="tel" prefix="+91" value={v.phone} onChange={f.set('phone')} error={f.errors.phone} required />
            {!existing && <TextField label="PIN (4–6 digits)" inputMode="numeric" value={v.pin} onChange={f.set('pin')} error={f.errors.pin} required />}
          </>
        )}
        {!office && (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-secondary">Works at</legend>
            <p className="text-sm text-tertiary">They only see trucks and shipments for these places.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {relevant.map((l) => (
                <div key={l._id} className="rounded-lg p-3 ring-1 ring-secondary">
                  <CheckboxField label={l.name} checked={v.locations.includes(l._id)} onChange={() => toggle(l._id)} />
                </div>
              ))}
              {relevant.length === 0 && <p className="text-sm text-tertiary">No matching places yet.</p>}
            </div>
          </fieldset>
        )}
        {existing && <SwitchField className="sm:col-span-2" label="Active" hint="Turn off to block login at once." checked={v.active} onChange={f.set('active')} />}
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
      icon={Key01}
      title={`New PIN for ${user.name}`}
      description="They will be logged out on all phones. Tell them the new PIN in person."
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} isDisabled={!/^\d{4,6}$/.test(pin)} onPress={() => save.mutate()}>
            Set PIN
          </Button>
        </>
      }
    >
      <TextField label="New PIN (4–6 digits)" inputMode="numeric" maxLength={6} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ''))} />
    </Modal>
  );
}
