import { useAuth } from "../auth/useAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Day 11: basic app shell + auth + /auth/me proof
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signed in user</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Name
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {user?.name ?? (isAuthenticated ? "Loading user…" : "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Email
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {user?.email ?? (isAuthenticated ? "Loading user…" : "—")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
