import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getDashboardSummary, type DashboardSummary } from "../api/dashboard";
import { askAdminAssistant } from "../api/ai";
import {
  getAuditInsights,
  type AuditInsightsResponse,
} from "../api/auditInsights";
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

// Formats an ISO timestamp for local display.
function formatDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

// Formats a YYYY-MM-DD value for chart labels.
function formatYmdLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderSources(
  sources:
    | Array<{ key: string; label: string; description: string }>
    | undefined,
) {
  if (!sources?.length) {
    return <div className="text-sm text-slate-500">No source metadata.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <Badge key={source.key} variant="secondary" title={source.description}>
          {source.label}
        </Badge>
      ))}
    </div>
  );
}

type Kpi = {
  key: "users" | "projects" | "roles" | "audit";
  label: string;
  value: number | null;
  loading: boolean;
};

// Renders a single dashboard KPI card.
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

// Renders the summary dashboard and recent activity widgets.
export default function DashboardPage() {
  const { isAuthenticated, permissions, user } = useAuth();

  const windowDays = 14;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantSources, setAssistantSources] = useState<
    Array<{ key: string; label: string; description: string }>
  >([]);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [auditInsights, setAuditInsights] =
    useState<AuditInsightsResponse | null>(null);
  const [auditInsightsLoading, setAuditInsightsLoading] = useState(false);
  const [auditInsightsError, setAuditInsightsError] = useState<string | null>(
    null,
  );

  const fetchSeqRef = useRef(0);
  const assistantAbortRef = useRef<AbortController | null>(null);
  const auditInsightsAbortRef = useRef<AbortController | null>(null);
  const auditInsightsLoadedRef = useRef(false);

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

  useEffect(() => {
    return () => {
      assistantAbortRef.current?.abort();
      auditInsightsAbortRef.current?.abort();
    };
  }, []);

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

  const canReadAudit = useMemo(
    () =>
      permissions.includes("audit.read") &&
      Boolean(summary?.auditTrend && summary?.recentAudit),
    [permissions, summary?.auditTrend, summary?.recentAudit],
  );

  const suggestedPrompts = useMemo(
    () => [
      "Summarize what this dashboard says about access health.",
      "What risks or anomalies stand out from recent audit activity?",
      "Based on these metrics, what RBAC improvements should I prioritize next?",
    ],
    [],
  );

  const submitAssistantPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (trimmed.length < 5) {
        setAssistantError(
          "Ask a slightly longer question so the assistant has enough context.",
        );
        return;
      }

      assistantAbortRef.current?.abort();
      const controller = new AbortController();
      assistantAbortRef.current = controller;

      setAssistantLoading(true);
      setAssistantError(null);

      try {
        const res = await askAdminAssistant(trimmed, {
          signal: controller.signal,
        });
        setAssistantAnswer(res.answer);
        setAssistantSources(res.sources ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to get an AI assistant response.";
        setAssistantError(msg);
        toast.error("AI assistant failed", { description: msg });
      } finally {
        if (!controller.signal.aborted) {
          setAssistantLoading(false);
        }
      }
    },
    [],
  );

  const loadAuditInsights = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      auditInsightsAbortRef.current?.abort();
      const controller = new AbortController();
      auditInsightsAbortRef.current = controller;

      setAuditInsightsLoading(true);
      setAuditInsightsError(null);

      try {
        const res = await getAuditInsights(windowDays, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setAuditInsights(res);
        auditInsightsLoadedRef.current = true;
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load audit anomaly insights.";
        setAuditInsightsError(msg);
        if (opts?.userInitiated) {
          toast.error("Audit insights failed", { description: msg });
        }
      } finally {
        if (!controller.signal.aborted) {
          setAuditInsightsLoading(false);
        }
      }
    },
    [windowDays],
  );

  useEffect(() => {
    if (!canReadAudit) return;
    if (auditInsightsLoadedRef.current) return;
    void loadAuditInsights();
  }, [canReadAudit, loadAuditInsights]);

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
                <CardTitle className="text-base">
                  Audit anomaly insights
                </CardTitle>
                <CardDescription>
                  AI-generated review of the last {windowDays} days of audit
                  activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void loadAuditInsights({ userInitiated: true })
                    }
                    disabled={auditInsightsLoading}
                  >
                    {auditInsightsLoading
                      ? "Refreshing..."
                      : "Refresh insights"}
                  </Button>
                </div>

                {auditInsightsError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Insights unavailable</AlertTitle>
                    <AlertDescription>{auditInsightsError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total events
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {auditInsightsLoading && !auditInsights
                        ? "..."
                        : (auditInsights?.analytics.totalEvents ?? "—")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Failures
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {auditInsightsLoading && !auditInsights
                        ? "..."
                        : (auditInsights?.analytics.totalFailures ?? "—")}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    AI summary
                  </div>
                  {auditInsightsLoading && !auditInsights ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ) : auditInsights?.answer ? (
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {auditInsights.answer}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">
                      No insight summary yet.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Data sources
                  </div>
                  {renderSources(auditInsights?.sources)}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Top actions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(auditInsights?.analytics.topActions ?? [])
                      .slice(0, 4)
                      .map((item) => (
                        <Badge key={item.action} variant="secondary">
                          {item.action}: {item.count}
                        </Badge>
                      ))}
                    {!auditInsights?.analytics.topActions?.length &&
                    !auditInsightsLoading ? (
                      <span className="text-sm text-slate-500">Not available.</span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-base">RBAC AI Assistant</CardTitle>
                <CardDescription>
                  Ask for summaries, risks, or next-step recommendations grounded
                  in your visible dashboard data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal text-left"
                      onClick={() => {
                        setAssistantPrompt(prompt);
                        void submitAssistantPrompt(prompt);
                      }}
                      disabled={assistantLoading}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="assistant-prompt"
                    className="text-sm font-medium text-slate-700"
                  >
                    Your question
                  </label>
                  <textarea
                    id="assistant-prompt"
                    className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    placeholder="Example: Explain whether our current roles look too broad for a production admin dashboard."
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    disabled={assistantLoading}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void submitAssistantPrompt(assistantPrompt)}
                    disabled={assistantLoading}
                  >
                    {assistantLoading ? "Thinking..." : "Ask assistant"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setAssistantPrompt("");
                      setAssistantAnswer("");
                      setAssistantSources([]);
                      setAssistantError(null);
                    }}
                    disabled={assistantLoading}
                  >
                    Clear
                  </Button>
                </div>

                {assistantError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Assistant unavailable</AlertTitle>
                    <AlertDescription>{assistantError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Latest answer
                  </div>
                  {assistantLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : assistantAnswer ? (
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {assistantAnswer}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">
                      No answer yet. Try one of the starter prompts above.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Data sources
                  </div>
                  {renderSources(assistantSources)}
                </div>
              </CardContent>
            </Card>

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
