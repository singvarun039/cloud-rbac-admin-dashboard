import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getDashboardSummary, type DashboardSummary } from "../api/dashboard";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "../components/ui/use-toast";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatYmdLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Kpi = {
  key: "users" | "projects" | "roles" | "audit";
  label: string;
  value: number | null;
  loading: boolean;
};

function KpiCard(props: {
  label: string;
  value: number | null;
  loading: boolean;
}) {
  const { label, value, loading } = props;
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {loading ? <Skeleton className="h-7 w-24" /> : (value ?? "—")}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();

  const windowDays = 14;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);

  const loadSummary = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      const seq = ++fetchSeqRef.current;
      const controller = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const res = await getDashboardSummary(windowDays, {
          signal: controller.signal,
        });

        if (fetchSeqRef.current !== seq) return;
        setSummary(res);
      } catch (err) {
        if (fetchSeqRef.current !== seq) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load dashboard.";
        setError(msg);

        if (opts?.userInitiated) {
          toast.error("Failed to refresh dashboard", { description: msg });
        }
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }

      return () => controller.abort();
    },
    [windowDays],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const kpis = useMemo<Kpi[]>(() => {
    const k = summary?.kpis;
    return [
      {
        key: "users",
        label: "Total Users",
        value:
          typeof k?.usersTotal === "number" || k?.usersTotal === null
            ? (k.usersTotal ?? null)
            : null,
        loading,
      },
      {
        key: "projects",
        label: "Total Projects",
        value:
          typeof k?.projectsTotal === "number" || k?.projectsTotal === null
            ? (k.projectsTotal ?? null)
            : null,
        loading,
      },
      {
        key: "roles",
        label: "Total Roles",
        value:
          typeof k?.rolesTotal === "number" || k?.rolesTotal === null
            ? (k.rolesTotal ?? null)
            : null,
        loading,
      },
      {
        key: "audit",
        label: `Audit Events (${windowDays}d window)`,
        value:
          typeof k?.auditTotalWindow === "number" ||
          k?.auditTotalWindow === null
            ? (k.auditTotalWindow ?? null)
            : null,
        loading,
      },
    ];
  }, [loading, summary?.kpis, windowDays]);

  const chartData = useMemo(() => {
    const trend = summary?.auditTrend;
    if (!trend || !Array.isArray(trend)) return null;

    return trend
      .filter(
        (p): p is { date: string; count: number } =>
          Boolean(p) &&
          typeof p.date === "string" &&
          typeof p.count === "number",
      )
      .map((p) => ({
        date: p.date,
        label: formatYmdLabel(p.date),
        count: p.count,
      }));
  }, [summary?.auditTrend]);

  const recent = useMemo(() => {
    const rows = summary?.recentAudit;
    if (!rows || !Array.isArray(rows)) return null;
    return rows.slice(0, 5);
  }, [summary?.recentAudit]);

  return (
    <div className="w-full space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>{error}</div>
            <div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void loadSummary({ userInitiated: true })}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid w-full grid-cols-12 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          >
            <KpiCard
              label={kpi.label}
              value={kpi.value}
              loading={kpi.loading}
            />
          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base">
                Audit events over time
              </CardTitle>
              <CardDescription>{windowDays} day window</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-[260px] w-full" />
                </div>
              ) : chartData === null ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Not available.
                </div>
              ) : chartData.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No audit data in this window.
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        interval={1}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        width={24}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="count"
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="w-full space-y-4">
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-base">Signed in user</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      NAME
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {user?.name ?? (isAuthenticated ? "Loading user…" : "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      EMAIL
                    </dt>
                    <dd className="mt-1 break-all text-sm font-medium text-slate-900">
                      {user?.email ?? (isAuthenticated ? "Loading user…" : "—")}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Latest 5 audit events</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : recent === null ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    Not available.
                  </div>
                ) : recent.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    No recent activity.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{row.action}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {row.actorEmail || row.actorUserId || "—"}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {formatDateTime(row.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
