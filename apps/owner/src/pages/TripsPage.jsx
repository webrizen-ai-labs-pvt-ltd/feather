import { ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { FREIGHT_STATUS_LABELS, formatDateTime, formatINR, formatNumber, formatPct, formatVehicleNo, TRIP_STATUS_LABELS } from '@feather/shared';
import { Button, Card, DataTable, FlagList, FreightBadge, Loading, PageHeader, SelectField, TextField, TripStatusBadge, useApi } from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

const opts = (labels) => [{ value: '', label: 'All' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))];

export default function TripsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [page, setPage] = useState(1);
  const filters = {
    status: params.get('status') ?? '',
    freight: params.get('freight') ?? '',
    flagged: params.get('flagged') ?? '',
    search: params.get('search') ?? '',
  };
  const setFilter = (key) => (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };
  const { data, isLoading } = useGet('/trips', { ...filters, page, limit: 50 });
  const navigate = useNavigate();
  const api = useApi();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Trips & freight"
        subtitle="Every truck, both weighments side by side, and its freight lock."
        actions={
          <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/trips.xlsx')}>
            Excel
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilter('search')(search.trim());
          }}
        >
          <TextField label="Search" placeholder="Truck no, trip no, challan" value={search} onChange={(e) => setSearch(e.target.value)} suffix={<MagnifyingGlassIcon className="size-5" />} />
        </form>
        <SelectField label="Trip status" value={filters.status} onChange={setFilter('status')} options={opts(TRIP_STATUS_LABELS)} />
        <SelectField label="Freight" value={filters.freight} onChange={setFilter('freight')} options={opts(FREIGHT_STATUS_LABELS)} />
        <SelectField
          label="Issues"
          value={filters.flagged}
          onChange={setFilter('flagged')}
          options={[
            { value: '', label: 'All trips' },
            { value: 'true', label: 'Only trips with issues' },
          ]}
        />
      </div>
      <Card>
        {isLoading ? (
          <Loading />
        ) : (
          <DataTable
            dense
            rows={data?.items}
            onRowClick={(t) => navigate(`/trips/${t._id}`)}
            empty="No trips match."
            columns={[
              { key: 'no', header: 'Trip', render: (t) => <span className="font-medium">{t.tripNo}</span> },
              { key: 'vehicle', header: 'Vehicle', render: (t) => formatVehicleNo(t.vehicleNo) },
              { key: 'transporter', header: 'Transporter', render: (t) => t.transporter?.name },
              { key: 'material', header: 'Material', render: (t) => t.material?.name },
              { key: 'route', header: 'From → To', render: (t) => `${t.sourceLocation?.name ?? ''} → ${t.destination?.name ?? ''}` },
              { key: 'loaded', header: 'Loaded', render: (t) => formatDateTime(t.loading?.at) },
              { key: 'net', header: 'Load / Recv net', align: 'right', render: (t) => `${formatNumber(t.loading?.net, 3)} / ${t.receipt?.net != null ? formatNumber(t.receipt.net, 3) : '—'}` },
              { key: 'loss', header: 'Loss', align: 'right', render: (t) => (t.variance?.lossPct != null ? formatPct(t.variance.lossPct) : '—') },
              { key: 'status', header: 'Status', render: (t) => <TripStatusBadge status={t.status} /> },
              { key: 'freight', header: 'Freight', render: (t) => <FreightBadge status={t.freight?.status} /> },
              { key: 'balance', header: 'Balance', align: 'right', render: (t) => formatINR(t.freight?.balance) },
              { key: 'flags', header: 'Issues', render: (t) => <FlagList flags={t.flags} compact /> },
            ]}
          />
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-ink-600">Page {page} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
