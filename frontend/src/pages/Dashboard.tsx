import { useAuth } from "../auth/useAuth";

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="muted">Day 11: basic app shell + auth + /auth/me proof</p>

      <div className="card">
        <div className="card-title">Signed in user</div>
        <div className="kv">
          <div className="kv-row">
            <div className="kv-key">Name</div>
            <div className="kv-val">
              {user?.name ?? (isAuthenticated ? "Loading user…" : "—")}
            </div>
          </div>
          <div className="kv-row">
            <div className="kv-key">Email</div>
            <div className="kv-val">
              {user?.email ?? (isAuthenticated ? "Loading user…" : "—")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
