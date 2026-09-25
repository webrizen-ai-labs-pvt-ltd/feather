import { useState } from 'react';
import { Navigate } from 'react-router';
import { COMPANY_NAME } from '@feather/shared';
import { Button, Card, ErrorNote, Logo, Tabs, TextField, useAuth } from '@feather/ui';

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
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Mobile number" big inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <TextField
        label="PIN"
        big
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        required
      />
      <ErrorNote error={error} />
      <Button type="submit" size="xl" loading={busy}>Log in</Button>
      <p className="text-center text-sm text-ink-500">Forgot PIN? Ask the owner to set a new one.</p>
    </form>
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
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Office email" big type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} required />
      {sent && (
        <TextField
          label="6 digit code from email"
          big
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
      )}
      <ErrorNote error={error} />
      <Button type="submit" size="xl" loading={busy} disabled={sent && code.length !== 6}>
        {sent ? 'Log in' : 'Send code'}
      </Button>
      {sent && (
        <button type="button" className="w-full text-sm font-medium text-ink-500" onClick={() => (setSent(false), setCode(''))}>
          Change email
        </button>
      )}
    </form>
  );
}

export default function LoginPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-900 px-4 py-8">
      <Card className="w-full max-w-md p-5 sm:p-7">
        <Logo className="h-10" nameClassName="text-2xl" />
        <p className="mt-1 text-sm text-ink-500">Operations</p>
        <Tabs
          className="mt-5"
          tabs={[
            { label: 'Field staff (PIN)', content: <PinLogin /> },
            { label: 'Office (email)', content: <EmailLogin /> },
          ]}
        />
      </Card>
      <p className="mt-6 text-xs text-ink-400">{COMPANY_NAME}</p>
    </div>
  );
}
