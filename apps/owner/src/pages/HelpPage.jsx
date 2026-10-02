import { HelpCenter, PageHeader, useAuth } from '@feather/ui';

/** The user guide inside the Owner app. The owner sees every section, including the staff ones. */
export default function HelpPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Help & guide" subtitle="How to use Feather, in simple words. The staff sections explain what your team sees in the Operations app." />
      <HelpCenter role={user.role} groupOrder={['start', 'owner', 'siding', 'gate', 'dispatch', 'offline', 'faq']} />
    </>
  );
}
