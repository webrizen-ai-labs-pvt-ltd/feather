import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { COMPANY_NAME } from '@feather/shared';
import { Button, Card, ErrorNote, Logo, TextField, useAuth } from '@feather/ui';

export default function LoginPage() {
  const { user, api, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />;

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/auth/otp/request', { email });
      setInfo(res.message);
      setStep('code');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api.post('/auth/otp/verify', { email, code });
      login(session);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-900 px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <Logo className="h-10" nameClassName="text-2xl" />
        <h1 className="mt-6 text-lg font-semibold text-ink-900">Owner login</h1>
        <p className="mt-1 text-sm text-ink-500">We will email you a 6 digit code.</p>

        {step === 'email' ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <ErrorNote error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            {info && <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{info}</p>}
            <TextField
              label="6 digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              big
              className="[&_input]:tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <ErrorNote error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>
              Log in
            </Button>
            <button type="button" className="w-full text-sm font-medium text-ink-500 hover:text-ink-800" onClick={() => (setStep('email'), setCode(''), setError(null))}>
              Use a different email
            </button>
          </form>
        )}
      </Card>
      <p className="mt-6 text-xs text-ink-400">{COMPANY_NAME}</p>
    </div>
  );
}
