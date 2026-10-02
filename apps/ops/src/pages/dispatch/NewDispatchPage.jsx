import { PageHeader } from '@feather/ui';
import TruckLoadingForm from '@/components/TruckLoadingForm.jsx';

export default function NewDispatchPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader help="dispatch-yard" breadcrumbs={[{ label: 'Today', href: '/dispatch' }]} title="Send from warehouse" subtitle="A delivery note is made only if the customer is within credit." />
      <TruckLoadingForm source="yard" />
    </div>
  );
}
