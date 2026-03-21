import { api, getApiErrorMessage } from "./client";
import { unwrapData } from "../types/api";

export type DashboardSummary = {
  kpis: {
    usersTotal?: number | null;
    rolesTotal?: number | null;
    projectsTotal?: number | null;
    auditTotalWindow?: number | null;
  };
  auditTrend?: { date: string; count: number }[] | null;
  recentAudit?:
    | {
        id: string;
        action: string;
        entityType?: string | null;
        entityId?: string | null;
        actorUserId?: string | null;
        actorEmail?: string | null;
        createdAt: string;
      }[]
    | null;
};

// Loads the dashboard summary metrics and activity feed.
export async function getDashboardSummary(
  windowDays = 14,
  options?: { signal?: AbortSignal },
): Promise<DashboardSummary> {
  try {
    const res = await api.get("/api/dashboard/summary", {
      params: { windowDays },
      signal: options?.signal,
    });

    const unwrapped = unwrapData<DashboardSummary>(res.data);
    if (unwrapped) return unwrapped;

    const record = res.data as unknown as { data?: unknown };
    if (record && typeof record === "object" && record.data) {
      return record.data as DashboardSummary;
    }

    return res.data as DashboardSummary;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to load dashboard."));
  }
}
