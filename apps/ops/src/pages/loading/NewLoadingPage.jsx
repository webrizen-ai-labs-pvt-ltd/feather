import { PageHeader } from '@feather/ui';
import TruckLoadingForm from '@/components/TruckLoadingForm.jsx';

export default function NewLoadingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader help="load-truck" breadcrumbs={[{ label: 'Shipments', href: '/loading' }]} title="Load a truck" subtitle="Three quick steps. Works without network too." />
      <TruckLoadingForm source="rake" />
    </div>
  );
}
