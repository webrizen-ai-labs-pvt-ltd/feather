import { ArrowLeft, Mail01, ShieldTick, Train, Truck01, Wallet02 } from '@untitledui/icons';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { COMPANY_NAME } from '@feather/shared';
import { Button, ErrorNote, FeaturedIcon, Logo, TextField, useAuth } from '@feather/ui';

const POINTS = [
  { icon: Train, title: 'Every shipment, live', text: 'Free hours, unloading speed and late fee for each train, barge and ship.' },
  { icon: Truck01, title: 'Every truck, tracked', text: 'Weighed when it leaves and when it arrives. Losses are caught on their own.' },
  { icon: Wallet02, title: 'Money protected', text: 'Truck payments held on loss, and no trucks for customers who have not paid.' },
];

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
      login(await api.post('/auth/otp/verify', { email, code }));
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-primary lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-8 md:px-16">
        <Logo className="h-9" nameClassName="text-lg" subtitle="Owner" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <FeaturedIcon icon={step === 'email' ? Mail01 : ShieldTick} color="gray" theme="modern" size="xl" />
          <h1 className="mt-6 text-display-xs font-semibold text-primary">{step === 'email' ? 'Log in to Feather' : 'Check your email'}</h1>
          <p className="mt-2 text-md text-tertiary">
            {step === 'email' ? 'We will email you a 6 digit login code.' : info ?? `We sent a code to ${email}.`}
          </p>

          {step === 'email' ? (
            <Form onSubmit={requestCode} className="mt-8 flex flex-col gap-5">
              <TextField label="Email" type="email" autoComplete="email" placeholder="you@company.com" required value={email} onChange={setEmail} />
              <ErrorNote error={error} />
              <Button type="submit" size="lg" isLoading={busy}>
                Send code
              </Button>
            </Form>
          ) : (
            <Form onSubmit={verify} className="mt-8 flex flex-col gap-5">
              <TextField
                label="6 digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                size="lg"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, ''))}
              />
              <ErrorNote error={error} />
              <Button type="submit" size="lg" isLoading={busy} isDisabled={code.length !== 6}>
                Log in
              </Button>
              <Button color="link-gray" iconLeading={ArrowLeft} onPress={() => (setStep('email'), setCode(''), setError(null))}>
                Use a different email
              </Button>
            </Form>
          )}
        </div>
        <p className="text-sm text-tertiary">© {COMPANY_NAME}</p>
      </div>

      <div className="relative hidden overflow-hidden bg-brand-section lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-solid opacity-30 blur-3xl" aria-hidden />
        <div className="relative max-w-md">
          <h2 className="text-display-sm font-semibold text-white">From train to site, nothing goes missing.</h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/20">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">{p.title}</p>
                  <p className="mt-1 text-md text-white/70">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
