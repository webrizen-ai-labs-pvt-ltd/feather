import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router';
import {
  AGING_BUCKETS,
  CREDIT_REASON_LABELS,
  formatDateTime,
  formatLakh,
  formatNumber,
  formatPct,
} from '@feather/shared';
import { Badge, Button, Card, CardHeader, DataTable, DemurrageClock, EmptyState, Loading, Meter, PageHeader, Stat, useApi } from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

const tons = (b) => `${formatNumber(b?.tons ?? 0, 1)} MT`;
const bagsNote = (b) => (b?.bags ? `incl. ${formatNumber(b.bags, 0)} bags` : null);

export default function DashboardPage() {
  const { data, isLoading, error } = useGet('/admin/dashboard', undefined, { refetchInterval: 60_000 });
  const api = useApi();
  const navigate = useNavigate();
  if (isLoading) return <Loading />;
  if (error) return <EmptyState title="Could not load dashboard">{error.message}</EmptyState>;
  const { pipeline: p, scorecard, credit, freight, liveRakes, delayedTrips, recentAlerts } = data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live position of material, money and discipline on the ground."
        actions={
          <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/trips.xlsx')}>
            Trips Excel
          </Button>
        }
      />

      <section aria-labelledby="pipeline" className="mb-6">
        <h2 id="pipeline" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Material in the chain now
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="On rail / sea (not arrived)" value={tons(p.onRailOrSea)} sub={bagsNote(p.onRailOrSea) ?? `${p.onRailOrSea.count} rakes / ships`} />
          <Stat label="At siding / port" value={tons(p.atSidingOrPort)} sub={`${p.atSidingOrPort.count} being unloaded`} tone={p.atSidingOrPort.tons > 0 ? 'warn' : 'neutral'} />
          <Stat label="On the road" value={tons(p.onRoad)} sub={`${p.onRoad.count} trucks · ${delayedTrips} delayed`} tone={delayedTrips ? 'warn' : 'neutral'} icon={TruckIcon} />
          <Stat label="In our yards (book)" value={tons(p.inYards)} sub={bagsNote(p.inYards) ?? `${p.inYards.count} yards`} icon={ArchiveBoxIcon} />
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Freight locked"
          icon={LockClosedIcon}
          tone={freight.locked?.count ? 'bad' : 'good'}
          value={freight.locked?.count ?? 0}
          sub={freight.locked ? `${formatLakh(freight.locked.deduction)} to deduct` : 'Nothing to review'}
        />
        <Stat label="Freight ready to pay" icon={BanknotesIcon} value={formatLakh(freight.ready?.balance ?? 0)} sub={`${freight.ready?.count ?? 0} trips`} />
        <Stat label="Customers blocked" icon={ExclamationTriangleIcon} tone={credit.blocked ? 'bad' : 'good'} value={credit.blocked} sub="Dispatch hard-stop active" />
        <Stat label="Overdue payments" tone={credit.totalOverdue ? 'bad' : 'good'} value={formatLakh(credit.totalOverdue)} sub={`of ${formatLakh(credit.totalOutstanding)} outstanding`} />
      </div>

      {liveRakes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Rakes & ships unloading now</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {liveRakes.map((c) => (
              <Link key={c._id} to={`/consignments/${c._id}`} className="block rounded-xl focus:outline-2 focus:outline-brand-500">
                <DemurrageClock consignment={c} showMoney />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Transporters — last 30 days"
            subtitle="Highest problem rate first. Problem = weight loss, damage or shortage beyond limit."
            actions={
              <Button size="sm" variant="ghost" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/transporters.xlsx')}>
                Excel
              </Button>
            }
          />
          <DataTable
            dense
            rowKey={(r) => r.transporter._id}
            rows={scorecard}
            empty="No trucks received in the last 30 days."
            columns={[
              { key: 'name', header: 'Transporter', render: (r) => <span className="font-medium">{r.transporter.name}</span> },
              { key: 'trips', header: 'Trips', align: 'right' },
              { key: 'lossPct', header: 'Weight loss', align: 'right', render: (r) => formatPct(r.lossPct) },
              { key: 'bagDamagePct', header: 'Bag loss', align: 'right', render: (r) => (r.billedBags ? formatPct(r.bagDamagePct) : '—') },
              {
                key: 'problemRatePct',
                header: 'Problem trips',
                render: (r) => (
                  <div className="flex min-w-32 items-center gap-2">
                    <Meter value={r.problemRatePct} max={100} tone={r.problemRatePct > 20 ? 'bad' : r.problemRatePct > 5 ? 'warn' : 'good'} />
                    <span className="w-12 text-right">{formatPct(r.problemRatePct, 0)}</span>
                  </div>
                ),
              },
              { key: 'deductions', header: 'Deducted', align: 'right', render: (r) => formatLakh(r.deductions) },
            ]}
          />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Latest alerts" actions={<Button size="sm" variant="ghost" onClick={() => navigate('/alerts')}>See all</Button>} />
          {recentAlerts.length === 0 ? (
            <EmptyState title="No alerts" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentAlerts.map((a) => (
                <li key={a._id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                    <Badge tone={a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'info'}>{a.severity}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Customer credit & ageing"
          subtitle="Exposure = unpaid bills + material already on the road. Blocked customers cannot get a new dispatch challan."
          actions={
            <Button size="sm" variant="ghost" icon={ArrowDownTrayIcon} onClick={() => api.download('/exports/credit.xlsx')}>
              Excel
            </Button>
          }
        />
        <DataTable
          dense
          rows={credit.top}
          rowKey={(r) => r.customer._id}
          onRowClick={(r) => navigate(`/customers/${r.customer._id}`)}
          empty="No customers yet."
          columns={[
            {
              key: 'name',
              header: 'Customer',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.customer.name}</span>
                  {r.credit.blocked && <Badge tone={r.override ? 'warn' : 'bad'}>{r.override ? 'Override active' : 'Blocked'}</Badge>}
                </div>
              ),
            },
            {
              key: 'used',
              header: 'Credit used',
              render: (r) => (
                <div className="min-w-40">
                  <Meter value={r.credit.exposure} max={r.credit.creditLimit} tone={r.credit.exposure > r.credit.creditLimit ? 'bad' : r.credit.exposure > 0.8 * r.credit.creditLimit ? 'warn' : 'good'} />
                  <span className="text-xs text-ink-500">
                    {formatLakh(r.credit.exposure)} of {formatLakh(r.credit.creditLimit)}
                  </span>
                </div>
              ),
            },
            ...AGING_BUCKETS.map((b) => ({ key: b.key, header: b.label, align: 'right', render: (r) => (r.aging[b.key] ? formatLakh(r.aging[b.key]) : '—') })),
            { key: 'why', header: 'Reason', render: (r) => r.credit.reasons.map((x) => CREDIT_REASON_LABELS[x]).join(', ') || '—' },
          ]}
        />
      </Card>
    </>
  );
}
