import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from '../components/ui/use-toast';

// Renders the login screen and handles sign-in submission.
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuth();

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: unknown } | null | undefined;
    return typeof state?.from === 'string' ? state.from : '/';
  }, [location.state]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Acceptance: visiting /login while logged in redirects to /
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const emailValid = email.trim().length > 0 && email.includes('@');
  const passwordValid = password.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!emailValid || !passwordValid) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Signed in');
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(closest-side_at_50%_50%,rgba(2,6,23,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:24px_24px] opacity-40" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6 text-slate-900"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1.75 3.5 5.5V11c0 5.25 3.3 9.8 8.5 11.25C17.2 20.8 20.5 16.25 20.5 11V5.5L12 1.75Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 11.75 11 13.5l3.75-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Cloud-Ready RBAC Admin Dashboard</p>
        </div>

        <Card className="w-full border-slate-200/60 shadow-md shadow-slate-900/5">
          <CardContent className="space-y-5 pt-6">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-10"
                />
              </div>

              <Button className="h-10 w-full" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
