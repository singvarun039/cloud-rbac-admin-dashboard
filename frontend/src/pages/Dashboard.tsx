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
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
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

type SourceMeta = { key: string; label: string; description: string };

type Kpi = {
  key: "users" | "projects" | "roles" | "audit";
  label: string;
  value: number | null;
  loading: boolean;
};

type InsightBlock = {
  summary: string | null;
  anomalies: string[];
  recommendations: string[];
};

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

function renderSources(sources: SourceMeta[] | undefined) {
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

function parseInsightText(value: string | undefined): InsightBlock {
  if (!value?.trim()) {
    return { summary: null, anomalies: [], recommendations: [] };
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentSection: "summary" | "anomalies" | "recommendations" | null = null;
  const summary: string[] = [];
  const anomalies: string[] = [];
  const recommendations: string[] = [];

  for (const line of lines) {
    const normalized = line.toLowerCase();

    if (normalized.startsWith("summary:")) {
      currentSection = "summary";
      const next = line.slice("summary:".length).trim();
      if (next) summary.push(next);
      continue;
    }

    if (normalized.startsWith("anomalies:")) {
      currentSection = "anomalies";
      const next = line.slice("anomalies:".length).trim();
      if (next) anomalies.push(next.replace(/^[-*]\s*/, ""));
      continue;
    }

    if (normalized.startsWith("recommendations:")) {
      currentSection = "recommendations";
      const next = line.slice("recommendations:".length).trim();
      if (next) recommendations.push(next.replace(/^[-*]\s*/, ""));
      continue;
    }

    if (currentSection === "summary") {
      summary.push(line);
      continue;
    }

    if (currentSection === "anomalies") {
      anomalies.push(line.replace(/^[-*]\s*/, ""));
      continue;
    }

    if (currentSection === "recommendations") {
      recommendations.push(line.replace(/^[-*]\s*/, ""));
    }
  }

  return {
    summary: summary.join(" ").trim() || null,
    anomalies,
    recommendations,
  };
}

function KpiCard(props: { label: string; value: number | null; loading: boolean }) {
  const { label, value, loading } = props;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
          {loading ? <Skeleton className="h-9 w-20" /> : (value ?? "—")}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function InsightSection(props: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  const { title, items, emptyText } = props;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {title}
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${title}-${item}`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { permissions } = useAuth();

  const windowDays = 14;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantSources, setAssistantSources] = useState<SourceMeta[]>([]);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [auditInsights, setAuditInsights] = useState<AuditInsightsResponse | null>(
    null,
  );
  const [auditInsightsLoading, setAuditInsightsLoading] = useState(false);
  const [auditInsightsError, setAuditInsightsError] = useState<string | null>(null);

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
        label: `Audit Events (${windowDays}d)`,
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

  const submitAssistantPrompt = useCallback(async (prompt: string) => {
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
  }, []);

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

  const parsedAuditInsights = useMemo(
    () => parseInsightText(auditInsights?.answer),
    [auditInsights?.answer],
  );

  return (
    <div className="w-full space-y-6 pb-8">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            loading={kpi.loading}
          />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Audit activity trend
              </CardTitle>
              <CardDescription>
                Daily audit volume over the last {windowDays} days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-[320px] w-full rounded-xl" />
                </div>
              ) : chartData === null ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  Audit trend is not available.
                </div>
              ) : chartData.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  No audit data in this window.
                </div>
              ) : (
                <div className="h-[320px] rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                      <defs>
                        <linearGradient id="audit-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f172a" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        interval={1}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        width={28}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#0f172a"
                        fill="url(#audit-fill)"
                        strokeWidth={2.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                RBAC AI Assistant
              </CardTitle>
              <CardDescription>
                Ask grounded questions about access health, risks, and next steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">Your question</div>
                <textarea
                  id="assistant-prompt"
                  className="min-h-[144px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  placeholder="Example: Explain whether our current roles look too broad for a production admin dashboard."
                  value={assistantPrompt}
                  onChange={(e) => setAssistantPrompt(e.target.value)}
                  disabled={assistantLoading}
                />
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
              </div>

              {assistantError ? (
                <Alert variant="destructive">
                  <AlertTitle>Assistant unavailable</AlertTitle>
                  <AlertDescription>{assistantError}</AlertDescription>
                </Alert>
              ) : null}

              <Separator />

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Latest answer
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  {assistantLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ) : assistantAnswer ? (
                    <div className="whitespace-pre-wrap">{assistantAnswer}</div>
                  ) : (
                    "No answer yet. Try a starter prompt or ask a custom question."
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Data sources
                </div>
                {renderSources(assistantSources)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg text-slate-950">
                  Audit anomaly insights
                </CardTitle>
                <CardDescription>
                  Concise AI review of recent audit behavior.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadAuditInsights({ userInitiated: true })}
                disabled={auditInsightsLoading}
              >
                {auditInsightsLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {auditInsightsError ? (
                <Alert variant="destructive">
                  <AlertTitle>Insights unavailable</AlertTitle>
                  <AlertDescription>{auditInsightsError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Total events
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">
                    {auditInsightsLoading && !auditInsights
                      ? "..."
                      : (auditInsights?.analytics.totalEvents ?? "—")}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Failures
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">
                    {auditInsightsLoading && !auditInsights
                      ? "..."
                      : (auditInsights?.analytics.totalFailures ?? "—")}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Summary
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  {auditInsightsLoading && !auditInsights ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ) : parsedAuditInsights.summary ? (
                    parsedAuditInsights.summary
                  ) : (
                    "No summary available yet."
                  )}
                </div>
              </div>

              <InsightSection
                title="Anomalies"
                items={parsedAuditInsights.anomalies}
                emptyText="No clear anomaly beyond normal variation."
              />

              <InsightSection
                title="Recommendations"
                items={parsedAuditInsights.recommendations}
                emptyText="No follow-up recommendations yet."
              />

              <Separator />

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Top actions
                </div>
                <div className="flex flex-wrap gap-2">
                  {(auditInsights?.analytics.topActions ?? []).slice(0, 4).map((item) => (
                    <Badge key={item.action} variant="secondary">
                      {item.action}: {item.count}
                    </Badge>
                  ))}
                  {!auditInsights?.analytics.topActions?.length && !auditInsightsLoading ? (
                    <span className="text-sm text-slate-500">Not available.</span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Data sources
                </div>
                {renderSources(auditInsights?.sources)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">Recent activity</CardTitle>
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
                  Recent activity is not available.
                </div>
              ) : recent.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No recent activity.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200">
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
                            <Badge variant="secondary">{row.action}</Badge>
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
