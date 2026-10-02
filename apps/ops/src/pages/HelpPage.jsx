import { ArrowLeft } from '@untitledui/icons';
import { useNavigate } from 'react-router';
import { ROLE_LABELS } from '@feather/shared';
import { Button, HelpCenter, Logo, useAuth } from '@feather/ui';

/**
 * The user guide inside the Operations app. Open to everyone (also before login,
 * so a new user can read how to log in). Each role sees only its own sections.
 */
export default function HelpPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(user ? '/' : '/login'));

  return (
    <div className="min-h-dvh bg-secondary">
      <header className="sticky top-0 z-40 border-b border-secondary bg-primary/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Button color="tertiary" iconLeading={ArrowLeft} onPress={back}>
            Back
          </Button>
          <div className="flex-1" />
          <Logo className="h-7" nameClassName="text-md" subtitle="Help & guide" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16">
        <h1 className="text-display-xs font-semibold text-primary">Help & guide</h1>
        <p className="mt-1 mb-6 text-md text-tertiary">
          {user ? (
            <>
              How to do your work in Feather. Showing the help for <span className="font-semibold text-secondary">{ROLE_LABELS[user.role]}</span>.
            </>
          ) : (
            'How to log in and start using Feather.'
          )}
        </p>
        <HelpCenter role={user?.role} groupOrder={['start', 'siding', 'gate', 'dispatch', 'offline', 'owner', 'faq']} />
      </main>
    </div>
  );
}
