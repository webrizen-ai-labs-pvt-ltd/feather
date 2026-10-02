import { Download01, SearchLg, Truck01 } from '@untitledui/icons';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { useNavigate, useSearchParams } from 'react-router';
import { formatDateTime, formatINR, formatNumber, formatPct, formatVehicleNo } from '@feather/shared';
import { Button, DataTable, FlagList, FreightBadge, Loading, MiniTracker, PageHeader, Pager, Segmented, TextField, truckTracking, useApi } from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

/** Quick views, like order tabs in a shop: each maps to API filters. */
const VIEWS = [
  { value: 'all', label: 'All', query: {} },
  { value: 'road', label: 'On the way', query: { status: 'in_transit' } },
  { value: 'hold', label: 'Payment on hold', query: { freight: 'locked' } },
  { value: 'ready', label: 'Ready to pay', query: { freight: 'ready' } },
  { value: 'problems', label: 'With problems', query: { flagged: 'true' } },
  { value: 'paid', label: 'Paid', query: { freight: 'paid' } },
];

function viewFromParams(params) {
  if (params.get('status') === 'in_transit') return 'road';
  const fr = params.get('freight');
  if (fr === 'locked') return 'hold';
  if (fr === 'ready') return 'ready';
  if (fr === 'paid') return 'paid';
  if (params.get('flagged') === 'true') return 'problems';
  return 'all';
}

export default function TripsPage() {
  const [params, setParams] = useSearchParams();
  const view = viewFromParams(params);
  const search = params.get('search') ?? '';
  const [draft, setDraft] = useState(search);
  const [page, setPage] = useState(1);
  const query = { ...VIEWS.find((v) => v.value === view).query, search: search || undefined, page, limit: 25 };
  const { data, isLoading } = useGet('/trips', query);
  const navigate = useNavigate();
  const api = useApi();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const setView = (v) => {
    const next = new URLSearchParams(VIEWS.find((x) => x.value === v).query);
    if (search) next.set('search', search);
    setParams(next, { replace: true });
    setPage(1);
  };
  const runSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (draft.trim()) next.set('search', draft.trim());
    else next.delete('search');
    setParams(next, { replace: true });
    setPage(1);
  };

  return (
    <>
      <PageHeader
        help="owner-trips"
        title="Truck trips"
        subtitle="Track every truck from loading to payment, like a parcel."
        actions={
          <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/trips.xlsx')}>
            Excel
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Segmented options={VIEWS} value={view} onChange={setView} />
        <Form onSubmit={runSearch} className="w-full lg:w-80">
          <TextField icon={SearchLg} placeholder="Truck no., trip no., delivery note" aria-label="Search trips" value={draft} onChange={setDraft} />
        </Form>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          title={VIEWS.find((v) => v.value === view).label === 'All' ? 'All truck trips' : VIEWS.find((v) => v.value === view).label}
          badge={<span className="text-sm text-tertiary">{data?.total ?? 0}</span>}
          rows={data?.items}
          onRowClick={(t) => navigate(`/trips/${t._id}`)}
          empty={search ? `No trip matches “${search}”.` : 'No trips here.'}
          emptyIcon={Truck01}
          footer={<Pager page={page} pages={pages} onChange={setPage} />}
          columns={[
            {
              key: 'truck',
              header: 'Truck',
              render: (t) => (
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
                    <Truck01 className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium text-primary">{formatVehicleNo(t.vehicleNo)}</p>
                    <p className="text-xs text-tertiary">
                      {t.tripNo} · {t.transporter?.name}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: 'route',
              header: 'From → To',
              render: (t) => (
                <div>
                  <p className="text-secondary">
                    {t.sourceLocation?.name} → {t.destination?.name}
                  </p>
                  <p className="text-xs text-tertiary">
                    {t.material?.name} · {formatDateTime(t.loading?.at)}
                  </p>
                </div>
              ),
            },
            {
              key: 'track',
              header: 'Tracking',
              render: (t) => {
                const k = truckTracking(t);
                return <MiniTracker steps={k.steps} current={k.current} tone={k.tone} />;
              },
            },
            { key: 'net', header: 'Sent / received', align: 'right', render: (t) => `${formatNumber(t.loading?.net, 3)} / ${t.receipt?.net != null ? formatNumber(t.receipt.net, 3) : '—'}` },
            { key: 'loss', header: 'Lost', align: 'right', render: (t) => (t.variance?.lossPct != null ? formatPct(t.variance.lossPct) : '—') },
            { key: 'freight', header: 'Payment', render: (t) => <FreightBadge status={t.freight?.status} /> },
            { key: 'balance', header: 'Balance', align: 'right', render: (t) => formatINR(t.freight?.balance) },
            { key: 'flags', header: 'Problems', render: (t) => <FlagList flags={t.flags} compact /> },
          ]}
        />
      )}
    </>
  );
}
