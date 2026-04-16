import { api, getApiErrorMessage } from "./client";
import { unwrapData } from "../types/api";

export type RoleRecommendationsResponse = {
  windowDays: number;
  answer: string;
  analytics: {
    totalRoles: number;
    totalDistinctPermissions: number;
    rolesWithNoPermissions: string[];
    broadestRoles: Array<{ role: string; permissionCount: number }>;
    overlapPairs: Array<{
      roleA: string;
      roleB: string;
      sharedPermissions: string[];
      overlapCount: number;
    }>;
    auditSignals: Array<{ action: string; count: number }>;
    roleAuditVisible: boolean;
  };
};

// Loads AI-backed role and permission recommendations for the Roles page.
export async function getRoleRecommendations(
  windowDays = 30,
  options?: { signal?: AbortSignal },
): Promise<RoleRecommendationsResponse> {
  try {
    const res = await api.get("/api/ai/role-recommendations", {
      params: { windowDays },
      signal: options?.signal,
    });

    const unwrapped = unwrapData<RoleRecommendationsResponse>(res.data);
    if (unwrapped) return unwrapped;
    return res.data as RoleRecommendationsResponse;
  } catch (err) {
    throw new Error(
      getApiErrorMessage(err, "Failed to load role recommendations."),
    );
  }
}
