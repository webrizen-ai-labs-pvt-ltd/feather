import { ArrowLeft, HelpCircle, LogIn01, Mail01, Phone01 } from '@untitledui/icons';
import { useState } from 'react';
import { Form, Link as AriaLink } from 'react-aria-components';
import { Navigate } from 'react-router';
import { COMPANY_NAME } from '@feather/shared';
import { Button, ErrorNote, FeaturedIcon, Logo, Tabs, TextField, useAuth } from '@feather/ui';

function PinLogin() {
  const { api, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      login(await api.post('/auth/pin/login', { phone, pin }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={submit} className="flex flex-col gap-5">
      <TextField label="Mobile number" big inputMode="tel" autoComplete="tel" prefix="+91" placeholder="98765 43210" value={phone} onChange={setPhone} required />
      <TextField label="PIN" big type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ''))} required />
      <ErrorNote error={error} />
      <Button type="submit" size="xl" className="w-full" iconLeading={LogIn01} isLoading={busy}>
        Log in
      </Button>
      <p className="text-center text-sm text-tertiary">Forgot PIN? Ask the owner to set a new one.</p>
    </Form>
  );
}

function EmailLogin() {
  const { api, login } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!sent) {
        await api.post('/auth/otp/request', { email });
        setSent(true);
      } else {
        login(await api.post('/auth/otp/verify', { email, code }));
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={submit} className="flex flex-col gap-5">
      <TextField label="Office email" big type="email" autoComplete="email" value={email} onChange={setEmail} isDisabled={sent} required />
      {sent && <TextField label="6 digit code from email" big inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))} required />}
      <ErrorNote error={error} />
      <Button type="submit" size="xl" className="w-full" iconLeading={sent ? LogIn01 : Mail01} isLoading={busy} isDisabled={sent && code.length !== 6}>
        {sent ? 'Log in' : 'Send code'}
      </Button>
      {sent && (
        <Button color="link-gray" iconLeading={ArrowLeft} onPress={() => (setSent(false), setCode(''))}>
          Change email
        </Button>
      )}
    </Form>
  );
}

export default function LoginPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-dvh flex-col bg-primary px-4 py-6 sm:px-8">
      <Logo className="h-9" nameClassName="text-lg" subtitle="Operations" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <FeaturedIcon icon={Phone01} color="gray" theme="modern" size="xl" />
        <h1 className="mt-6 text-display-xs font-semibold text-primary">Log in to Feather</h1>
        <p className="mt-2 text-md text-tertiary">Field staff use their mobile number and PIN. Office staff get a code by email.</p>
        <Tabs
          className="mt-8"
          type="button-gray"
          tabs={[
            { label: 'Field staff (PIN)', content: <PinLogin /> },
            { label: 'Office (email)', content: <EmailLogin /> },
          ]}
        />
        <AriaLink href="/help#login" className="mt-8 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-tertiary outline-focus-ring hover:text-secondary">
          <HelpCircle className="size-4" aria-hidden /> Need help logging in?
        </AriaLink>
      </div>
      <p className="text-center text-sm text-tertiary">© {COMPANY_NAME}</p>
    </div>
  );
}
