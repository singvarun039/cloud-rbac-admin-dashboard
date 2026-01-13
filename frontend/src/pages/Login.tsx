import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuth();

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: unknown } | null | undefined;
    return typeof state?.from === "string" ? state.from : "/";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Acceptance: visiting /login while logged in redirects to /
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const emailValid = email.trim().length > 0 && email.includes("@");
  const passwordValid = password.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!emailValid || !passwordValid) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Sign in</div>
        <div className="muted">Cloud-Ready RBAC Admin Dashboard</div>

        {error ? <div className="alert">{error}</div> : null}

        <form onSubmit={onSubmit} className="form">
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="label">
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
