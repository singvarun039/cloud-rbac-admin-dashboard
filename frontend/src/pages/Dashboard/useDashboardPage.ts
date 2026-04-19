import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getDashboardSummary, type DashboardSummary } from '../../api/dashboard';
import { askAdminAssistant } from '../../api/ai';
import { getAuditInsights, type AuditInsightsResponse } from '../../api/auditInsights';
import { toast } from '../../components/ui/use-toast';
import { parseInsightText, type SourceMeta } from './dashboardUtils';

export function useDashboardPage() {
  const { permissions } = useAuth();
  const windowDays = 14;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
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

  const loadSummary = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      const seq = ++fetchSeqRef.current;
      const controller = new AbortController();
      setLoading(true);
      setError(null);
      try {
        const res = await getDashboardSummary(windowDays, { signal: controller.signal });
        if (fetchSeqRef.current !== seq) return;
        setSummary(res);
      } catch (err) {
        if (fetchSeqRef.current !== seq) return;
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard.';
        setError(msg);
        if (opts?.userInitiated) toast.error('Failed to refresh dashboard', { description: msg });
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
      return () => controller.abort();
    },
    [windowDays]
  );

  const loadAuditInsights = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      auditInsightsAbortRef.current?.abort();
      const controller = new AbortController();
      auditInsightsAbortRef.current = controller;
      setAuditInsightsLoading(true);
      setAuditInsightsError(null);
      try {
        const res = await getAuditInsights(windowDays, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setAuditInsights(res);
        auditInsightsLoadedRef.current = true;
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load audit anomaly insights.';
        setAuditInsightsError(msg);
        if (opts?.userInitiated) toast.error('Audit insights failed', { description: msg });
      } finally {
        if (!controller.signal.aborted) setAuditInsightsLoading(false);
      }
    },
    [windowDays]
  );

  const submitAssistantPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (trimmed.length < 5) {
      setAssistantError('Ask a slightly longer question so the assistant has enough context.');
      return;
    }
    assistantAbortRef.current?.abort();
    const controller = new AbortController();
    assistantAbortRef.current = controller;
    setAssistantLoading(true);
    setAssistantError(null);
    try {
      const res = await askAdminAssistant(trimmed, { signal: controller.signal });
      setAssistantAnswer(res.answer);
      setAssistantSources(res.sources ?? []);
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Failed to get an AI assistant response.';
      setAssistantError(msg);
      toast.error('AI assistant failed', { description: msg });
    } finally {
      if (!controller.signal.aborted) setAssistantLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    return () => {
      assistantAbortRef.current?.abort();
      auditInsightsAbortRef.current?.abort();
    };
  }, []);

  const canReadAudit = useMemo(
    () =>
      permissions.includes('audit.read') && Boolean(summary?.auditTrend && summary?.recentAudit),
    [permissions, summary?.auditTrend, summary?.recentAudit]
  );

  useEffect(() => {
    if (!canReadAudit || auditInsightsLoadedRef.current) return;
    void loadAuditInsights();
  }, [canReadAudit, loadAuditInsights]);

  const kpis = useMemo(() => {
    const k = summary?.kpis;
    return [
      { key: 'users', label: 'Total Users', value: k?.usersTotal ?? null, loading },
      { key: 'projects', label: 'Total Projects', value: k?.projectsTotal ?? null, loading },
      { key: 'roles', label: 'Total Roles', value: k?.rolesTotal ?? null, loading },
      {
        key: 'audit',
        label: `Audit Events (${windowDays}d)`,
        value: k?.auditTotalWindow ?? null,
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
          Boolean(p) && typeof p.date === 'string' && typeof p.count === 'number'
      )
      .map((p) => {
        const d = new Date(p.date);
        const label = Number.isNaN(d.getTime())
          ? p.date
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return { date: p.date, label, count: p.count };
      });
  }, [summary?.auditTrend]);

  const recent = useMemo(() => {
    const rows = summary?.recentAudit;
    if (!rows || !Array.isArray(rows)) return null;
    return rows.slice(0, 5);
  }, [summary?.recentAudit]);

  const parsedAuditInsights = useMemo(
    () => parseInsightText(auditInsights?.answer),
    [auditInsights?.answer]
  );

  const suggestedPrompts = useMemo(
    () => [
      'Summarize what this dashboard says about access health.',
      'What risks or anomalies stand out from recent audit activity?',
      'Based on these metrics, what RBAC improvements should I prioritize next?',
    ],
    []
  );

  return {
    windowDays,
    loading,
    error,
    assistantPrompt,
    setAssistantPrompt,
    assistantAnswer,
    setAssistantAnswer,
    assistantSources,
    setAssistantSources,
    assistantError,
    setAssistantError,
    assistantLoading,
    auditInsights,
    auditInsightsLoading,
    auditInsightsError,
    loadSummary,
    loadAuditInsights,
    submitAssistantPrompt,
    kpis,
    chartData,
    recent,
    parsedAuditInsights,
    suggestedPrompts,
  };
}
