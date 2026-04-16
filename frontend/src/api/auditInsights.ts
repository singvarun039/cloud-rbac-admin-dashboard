import { api, getApiErrorMessage } from "./client";
import { unwrapData } from "../types/api";

export type AuditInsightsResponse = {
  windowDays: number;
  answer: string;
  analytics: {
    totalEvents: number;
    totalFailures: number;
    peakDay: { date: string; count: number } | null;
    latestDay: { date: string; count: number } | null;
    topActions: Array<{ action: string; count: number }>;
    topActors: Array<{ actor: string; count: number }>;
    recentFailures: Array<{
      id: string;
      action: string;
      entityType: string | null;
      entityId: string | null;
      actorUserId: string | null;
      actorEmail: string | null;
      createdAt: string;
    }>;
  };
};

// Loads AI-generated audit anomaly insights for the dashboard.
export async function getAuditInsights(
  windowDays = 14,
  options?: { signal?: AbortSignal },
): Promise<AuditInsightsResponse> {
  try {
    const res = await api.get("/api/ai/audit-insights", {
      params: { windowDays },
      signal: options?.signal,
    });

    const unwrapped = unwrapData<AuditInsightsResponse>(res.data);
    if (unwrapped) return unwrapped;
    return res.data as AuditInsightsResponse;
  } catch (err) {
    throw new Error(
      getApiErrorMessage(err, "Failed to load audit anomaly insights."),
    );
  }
}
