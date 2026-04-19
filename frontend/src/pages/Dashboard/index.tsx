import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getDashboardSummary, type DashboardSummary } from "../../api/dashboard";
import { askAdminAssistant } from "../../api/ai";
import { getAuditInsights, type AuditInsightsResponse } from "../../api/auditInsights";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "../../components/ui/use-toast";
import { AuditTrendCard } from "./AuditTrendCard";
import { AssistantCard } from "./AssistantCard";
import { AuditInsightsCard } from "./AuditInsightsCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { formatDate } from "../../utils/format";

type SourceMeta = { key: string; label: string; description: string };

interface InsightBlock {
  summary: string | null;
  anomalies: string[];
  recommendations: string[];
}

function parseInsightText(value: string | undefined): InsightBlock {
  if (!value?.trim()) return { summary: null, anomalies: [], recommendations: [] };
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let currentSection: "summary" | "anomalies" | "recommendations" | null = null;
  const summary: string[] = [], anomalies: string[] = [], recommendations: string[] = [];

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (normalized.startsWith("summary:")) { currentSection = "summary"; const next = line.slice("summary:".length).trim(); if (next) summary.push(next); continue; }
    if (normalized.startsWith("anomalies:")) { currentSection = "anomalies"; const next = line.slice("anomalies:".length).trim(); if (next) anomalies.push(next.replace(/^[-*]\s*/, "")); continue; }
    if (normalized.startsWith("recommendations:")) { currentSection = "recommendations"; const next = line.slice("recommendations:".length).trim(); if (next) recommendations.push(next.replace(/^[-*]\s*/, "")); continue; }
    if (currentSection === "summary") { summary.push(line); continue; }
    if (currentSection === "anomalies") { anomalies.push(line.replace(/^[-*]\s*/, "")); continue; }
    if (currentSection === "recommendations") { recommendations.push(line.replace(/^[-*]\s*/, "")); }
  }

  return { summary: summary.join(" ").trim() || null, anomalies, recommendations };
}

function KpiCard({ label, value, loading }: { label: string; value: number | null; loading: boolean }) {
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
  const [auditInsights, setAuditInsights] = useState<AuditInsightsResponse | null>(null);
  const [auditInsightsLoading, setAuditInsightsLoading] = useState(false);
  const [auditInsightsError, setAuditInsightsError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);
  const assistantAbortRef = useRef<AbortController | null>(null);
  const auditInsightsAbortRef = useRef<AbortController | null>(null);
  const auditInsightsLoadedRef = useRef(false);

  const loadSummary = useCallback(async (opts?: { userInitiated?: boolean }) => {
    const seq = ++fetchSeqRef.current;
    const controller = new AbortController();
    setLoading(true); setError(null);
    try {
      const res = await getDashboardSummary(windowDays, { signal: controller.signal });
      if (fetchSeqRef.current !== seq) return;
      setSummary(res);
    } catch (err) {
      if (fetchSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : "Failed to load dashboard.";
      setError(msg);
      if (opts?.userInitiated) toast.error("Failed to refresh dashboard", { description: msg });
    } finally {
      if (fetchSeqRef.current === seq) setLoading(false);
    }
    return () => controller.abort();
  }, [windowDays]);

  const loadAuditInsights = useCallback(async (opts?: { userInitiated?: boolean }) => {
    auditInsightsAbortRef.current?.abort();
    const controller = new AbortController();
    auditInsightsAbortRef.current = controller;
    setAuditInsightsLoading(true); setAuditInsightsError(null);
    try {
      const res = await getAuditInsights(windowDays, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setAuditInsights(res);
      auditInsightsLoadedRef.current = true;
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to load audit anomaly insights.";
      setAuditInsightsError(msg);
      if (opts?.userInitiated) toast.error("Audit insights failed", { description: msg });
    } finally {
      if (!controller.signal.aborted) setAuditInsightsLoading(false);
    }
  }, [windowDays]);

  const submitAssistantPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (trimmed.length < 5) { setAssistantError("Ask a slightly longer question so the assistant has enough context."); return; }
    assistantAbortRef.current?.abort();
    const controller = new AbortController();
    assistantAbortRef.current = controller;
    setAssistantLoading(true); setAssistantError(null);
    try {
      const res = await askAdminAssistant(trimmed, { signal: controller.signal });
      setAssistantAnswer(res.answer);
      setAssistantSources(res.sources ?? []);
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to get an AI assistant response.";
      setAssistantError(msg);
      toast.error("AI assistant failed", { description: msg });
    } finally {
      if (!controller.signal.aborted) setAssistantLoading(false);
    }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { return () => { assistantAbortRef.current?.abort(); auditInsightsAbortRef.current?.abort(); }; }, []);

  const canReadAudit = useMemo(
    () => permissions.includes("audit.read") && Boolean(summary?.auditTrend && summary?.recentAudit),
    [permissions, summary?.auditTrend, summary?.recentAudit],
  );

  useEffect(() => {
    if (!canReadAudit || auditInsightsLoadedRef.current) return;
    void loadAuditInsights();
  }, [canReadAudit, loadAuditInsights]);

  const kpis = useMemo(() => {
    const k = summary?.kpis;
    return [
      { key: "users", label: "Total Users", value: k?.usersTotal ?? null, loading },
      { key: "projects", label: "Total Projects", value: k?.projectsTotal ?? null, loading },
      { key: "roles", label: "Total Roles", value: k?.rolesTotal ?? null, loading },
      { key: "audit", label: `Audit Events (${windowDays}d)`, value: k?.auditTotalWindow ?? null, loading },
    ];
  }, [loading, summary?.kpis, windowDays]);

  const chartData = useMemo(() => {
    const trend = summary?.auditTrend;
    if (!trend || !Array.isArray(trend)) return null;
    return trend
      .filter((p): p is { date: string; count: number } => Boolean(p) && typeof p.date === "string" && typeof p.count === "number")
      .map((p) => {
        const d = new Date(p.date);
        const label = Number.isNaN(d.getTime()) ? p.date : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return { date: p.date, label, count: p.count };
      });
  }, [summary?.auditTrend]);

  const recent = useMemo(() => {
    const rows = summary?.recentAudit;
    if (!rows || !Array.isArray(rows)) return null;
    return rows.slice(0, 5);
  }, [summary?.recentAudit]);

  const parsedAuditInsights = useMemo(() => parseInsightText(auditInsights?.answer), [auditInsights?.answer]);

  const suggestedPrompts = useMemo(() => [
    "Summarize what this dashboard says about access health.",
    "What risks or anomalies stand out from recent audit activity?",
    "Based on these metrics, what RBAC improvements should I prioritize next?",
  ], []);

  return (
    <div className="w-full space-y-6 pb-8">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>{error}</div>
            <div><Button variant="outline" size="sm" type="button" onClick={() => void loadSummary({ userInitiated: true })}>Retry</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} label={kpi.label} value={kpi.value} loading={kpi.loading} />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <AuditTrendCard loading={loading} chartData={chartData} windowDays={windowDays} />
          <AssistantCard
            assistantPrompt={assistantPrompt}
            setAssistantPrompt={setAssistantPrompt}
            assistantAnswer={assistantAnswer}
            assistantSources={assistantSources}
            assistantError={assistantError}
            assistantLoading={assistantLoading}
            onSubmit={(p) => void submitAssistantPrompt(p)}
            onClear={() => { setAssistantPrompt(""); setAssistantAnswer(""); setAssistantSources([]); setAssistantError(null); }}
            suggestedPrompts={suggestedPrompts}
          />
        </div>

        <div className="space-y-6">
          <AuditInsightsCard
            auditInsights={auditInsights}
            auditInsightsLoading={auditInsightsLoading}
            auditInsightsError={auditInsightsError}
            parsedInsights={parsedAuditInsights}
            onRefresh={() => void loadAuditInsights({ userInitiated: true })}
          />
          <RecentActivityCard loading={loading} recent={recent} />
        </div>
      </div>
    </div>
  );
}
