import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BankNote01,
  ChevronRight,
  Download01,
  InfoCircle,
  Lock01,
  Package,
  Plus,
  Train,
  Truck01,
  UserX01,
} from '@untitledui/icons';
import { Link as AriaLink } from 'react-aria-components';
import { useNavigate } from 'react-router';
import { AGING_BUCKETS, CREDIT_REASON_LABELS, formatDateTime, formatLakh, formatNumber, formatPct } from '@feather/shared';
import {
  Button,
  Card,
  CardHeader,
  cx,
  DataTable,
  DemurrageClock,
  EmptyState,
  Loading,
  Meter,
  MetricCard,
  PageHeader,
  Section,
  StatusBadge,
  useApi,
  useAuth,
} from '@feather/ui';
import { useGet } from '@/lib/hooks.js';

const tons = (b) => `${formatNumber(b?.tons ?? 0, 1)} MT`;
const bagsNote = (b) => (b?.bags ? `incl. ${formatNumber(b.bags, 0)} bags` : null);

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** One step of the material flow, like a parcel tracker. */
function FlowStep({ n, href, icon: Icon, label, value, sub, warn, last }) {
  return (
    <li className="relative">
      <AriaLink
        href={href}
        className={cx(
          'group flex h-full flex-col rounded-xl bg-primary p-5 shadow-xs ring-1 outline-focus-ring transition hover:shadow-md focus-visible:outline-2',
          warn ? 'ring-[var(--color-utility-orange-300)]' : 'ring-secondary',
        )}
      >
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-tertiary">
            <span className={cx('flex size-6 items-center justify-center rounded-full text-xs font-bold', warn ? 'bg-warning-secondary text-warning-primary' : 'bg-brand-secondary text-brand-secondary')}>{n}</span>
            {label}
          </span>
          <Icon className={cx('size-5', warn ? 'text-fg-warning-primary' : 'text-fg-quaternary')} aria-hidden />
        </span>
        <span className={cx('mt-3 text-display-xs font-semibold tabular-nums', warn ? 'text-warning-primary' : 'text-primary')}>{value}</span>
        <span className="mt-1 text-sm text-tertiary">{sub}</span>
      </AriaLink>
      {!last && (
        <span className="absolute top-1/2 -right-[18px] z-10 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-fg-quaternary shadow-xs ring-1 ring-secondary lg:flex" aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </li>
  );
}

const ALERT_ICON = { critical: AlertCircle, warning: AlertTriangle, info: InfoCircle };
const ALERT_TONE = { critical: 'bg-error-secondary text-fg-error-primary', warning: 'bg-warning-secondary text-fg-warning-primary', info: 'bg-tertiary text-fg-quaternary' };

export default function DashboardPage() {
  const { data, isLoading, error } = useGet('/admin/dashboard', undefined, { refetchInterval: 60_000 });
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  if (isLoading) return <Loading />;
  if (error) return <EmptyState title="Could not load the home page">{error.message}</EmptyState>;
  const { pipeline: p, scorecard, credit, freight, liveRakes, delayedTrips, recentAlerts } = data;

  return (
    <>
      <PageHeader
        help="owner-dashboard"
        title={`${greeting()}, ${user?.name?.split(' ')[0] ?? 'there'}`}
        crumbLabel="Home"
        subtitle="Where your material is, where money is stuck, and what needs you today."
        actions={
          <>
            <Button color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/trips.xlsx')}>
              Trips Excel
            </Button>
            <Button iconLeading={Plus} href="/shipments?new=1">
              New shipment
            </Button>
          </>
        }
      />

      <Section title="Where your material is right now" description="Follow it step by step, like a parcel. Click a step for details.">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <FlowStep n={1} href="/shipments" icon={Train} label="On the way" value={tons(p.onRailOrSea)} sub={bagsNote(p.onRailOrSea) ?? `${p.onRailOrSea.count} shipments not arrived`} />
          <FlowStep n={2} href="/shipments" icon={Package} label="Being unloaded" value={tons(p.atSidingOrPort)} sub={`${p.atSidingOrPort.count} at unloading points`} warn={p.atSidingOrPort.tons > 0 && liveRakes.some((c) => c.clock?.status !== 'ok')} />
          <FlowStep n={3} href="/trips?status=in_transit" icon={Truck01} label="On trucks" value={tons(p.onRoad)} sub={`${p.onRoad.count} trucks · ${delayedTrips} late`} warn={delayedTrips > 0} />
          <FlowStep n={4} href="/inventory" icon={Archive} label="In our warehouses" value={tons(p.inYards)} sub={bagsNote(p.inYards) ?? `${p.inYards.count} warehouses`} last />
        </ol>
      </Section>

      <Section title="Money">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <MetricCard
            href="/trips?freight=locked"
            label="Truck payments on hold"
            icon={Lock01}
            tone={freight.locked?.count ? 'bad' : 'good'}
            value={freight.locked?.count ?? 0}
            sub={freight.locked ? `${formatLakh(freight.locked.deduction)} to cut` : 'Nothing to review'}
          />
          <MetricCard href="/trips?freight=ready" label="Truck payments ready" icon={BankNote01} value={formatLakh(freight.ready?.balance ?? 0)} sub={`${freight.ready?.count ?? 0} trips`} />
          <MetricCard href="/customers" label="Customers on hold" icon={UserX01} tone={credit.blocked ? 'bad' : 'good'} value={credit.blocked} sub="No new trucks until they pay" />
          <MetricCard href="/customers" label="Overdue payments" icon={AlertTriangle} tone={credit.totalOverdue ? 'warn' : 'good'} value={formatLakh(credit.totalOverdue)} sub={`of ${formatLakh(credit.totalOutstanding)} unpaid`} />
        </div>
      </Section>

      {liveRakes.length > 0 && (
        <Section title="Shipments being unloaded now" actions={<Button color="link-color" href="/shipments" iconTrailing={ChevronRight}>All shipments</Button>}>
          <div className="grid gap-4 xl:grid-cols-2 xl:gap-6">
            {liveRakes.map((c) => (
              <AriaLink key={c._id} href={`/shipments/${c._id}`} className="block rounded-xl outline-focus-ring transition hover:shadow-md focus-visible:outline-2">
                <DemurrageClock consignment={c} showMoney />
              </AriaLink>
            ))}
          </div>
        </Section>
      )}

      <div className="mb-8 grid gap-6 xl:grid-cols-5">
        <DataTable
          className="xl:col-span-3"
          title="Truck companies — last 30 days"
          subtitle="Highest problem rate first. A problem = weight lost, damage or shortage beyond the limit."
          actions={
            <Button size="sm" color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/transporters.xlsx')}>
              Excel
            </Button>
          }
          dense
          rowKey={(r) => r.transporter._id}
          rows={scorecard}
          empty="No trucks received in the last 30 days."
          columns={[
            { key: 'name', header: 'Truck company', render: (r) => <span className="font-medium text-primary">{r.transporter.name}</span> },
            { key: 'trips', header: 'Trips', align: 'right', sortable: true },
            { key: 'lossPct', header: 'Weight lost', align: 'right', sortable: true, render: (r) => formatPct(r.lossPct) },
            {
              key: 'problemRatePct',
              header: 'Problem trips',
              sortable: true,
              render: (r) => (
                <div className="flex min-w-36 items-center gap-3">
                  <Meter value={r.problemRatePct} max={100} tone={r.problemRatePct > 20 ? 'bad' : r.problemRatePct > 5 ? 'warn' : 'good'} />
                  <span className="w-10 text-right text-sm font-medium text-secondary">{formatPct(r.problemRatePct, 0)}</span>
                </div>
              ),
            },
            { key: 'deductions', header: 'Cut', align: 'right', sortable: true, render: (r) => formatLakh(r.deductions) },
          ]}
        />

        <Card className="xl:col-span-2">
          <CardHeader title="Latest alerts" actions={<Button size="sm" color="link-color" href="/alerts" iconTrailing={ChevronRight}>See all</Button>} />
          {recentAlerts.length === 0 ? (
            <EmptyState title="All clear" />
          ) : (
            <ul className="divide-y divide-secondary">
              {recentAlerts.map((a) => {
                const Icon = ALERT_ICON[a.severity] ?? InfoCircle;
                return (
                  <li key={a._id} className="flex gap-3 px-5 py-4">
                    <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-full', ALERT_TONE[a.severity])}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{a.title}</p>
                      <p className="mt-0.5 text-xs text-tertiary">{formatDateTime(a.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <DataTable
        title="Customer dues"
        subtitle="Total owed = unpaid bills + material already on the road. Customers on hold cannot get a new truck."
        actions={
          <Button size="sm" color="secondary" iconLeading={Download01} onPress={() => api.download('/exports/credit.xlsx')}>
            Excel
          </Button>
        }
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
                <span className="font-medium text-primary">{r.customer.name}</span>
                {r.credit.blocked && <StatusBadge tone={r.override ? 'warn' : 'bad'}>{r.override ? 'Allowed anyway' : 'On hold'}</StatusBadge>}
              </div>
            ),
          },
          {
            key: 'used',
            header: 'Credit used',
            render: (r) => (
              <div className="min-w-44">
                <Meter value={r.credit.exposure} max={r.credit.creditLimit} tone={r.credit.exposure > r.credit.creditLimit ? 'bad' : r.credit.exposure > 0.8 * r.credit.creditLimit ? 'warn' : 'good'} />
                <span className="mt-1 block text-xs text-tertiary">
                  {formatLakh(r.credit.exposure)} of {formatLakh(r.credit.creditLimit)}
                </span>
              </div>
            ),
          },
          ...AGING_BUCKETS.map((b) => ({ key: b.key, header: b.label, align: 'right', render: (r) => (r.aging[b.key] ? formatLakh(r.aging[b.key]) : '—') })),
          { key: 'why', header: 'Reason', render: (r) => r.credit.reasons.map((x) => CREDIT_REASON_LABELS[x]).join(', ') || '—' },
        ]}
      />
    </>
  );
}
