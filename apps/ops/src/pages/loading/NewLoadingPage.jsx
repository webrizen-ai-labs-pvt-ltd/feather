import TruckLoadingForm from '@/components/TruckLoadingForm.jsx';

export default function NewLoadingPage() {
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Load a truck</h1>
      <TruckLoadingForm source="rake" />
    </>
  );
}
