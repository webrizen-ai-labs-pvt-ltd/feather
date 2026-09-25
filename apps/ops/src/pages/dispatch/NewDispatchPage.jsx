import TruckLoadingForm from '@/components/TruckLoadingForm.jsx';

export default function NewDispatchPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Dispatch from stockyard</h1>
      <p className="mb-3 text-sm text-ink-500">A dispatch challan is made only if the customer is within credit.</p>
      <TruckLoadingForm source="yard" />
    </>
  );
}
