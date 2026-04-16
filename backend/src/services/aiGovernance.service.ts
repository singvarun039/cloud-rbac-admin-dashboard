import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env";
import { fail } from "../utils/apiResponse";
import { writeAuditLog } from "./auditLog.service";

export type AiDataSource = {
  key: string;
  label: string;
  description: string;
};

export const AI_DATA_SOURCES = {
  dashboardSummary: {
    key: "dashboard.summary",
    label: "Dashboard summary",
    description: "KPI totals, audit trend, and recent audit activity.",
  },
  signedInUserPermissions: {
    key: "auth.user_permissions",
    label: "Signed-in user permissions",
    description: "Effective permissions of the current authenticated user.",
  },
  auditAggregates: {
    key: "audit.aggregates",
    label: "Audit aggregates",
    description: "Aggregated audit counts, top actions, actors, and failures.",
  },
  roleMatrix: {
    key: "roles.matrix",
    label: "Role matrix",
    description: "Current roles and their assigned permissions.",
  },
  roleAuditSignals: {
    key: "roles.audit_signals",
    label: "Role audit signals",
    description: "Recent audit activity related to roles and permission changes.",
  },
  policySurfaceMap: {
    key: "policy.surface_map",
    label: "Policy surface map",
    description: "Modeled pages and API capabilities tied to permission requirements.",
  },
  proposedPermissionDraft: {
    key: "policy.proposed_permissions",
    label: "Proposed permission draft",
    description: "The unsaved permission set being simulated.",
  },
} satisfies Record<string, AiDataSource>;

export const aiRateLimiter = rateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.id ?? "";
    const ip = req.ip ?? "";
    return userId ? `${ip}|${userId}` : ip;
  },
  handler: (req, res) =>
    fail(
      res,
      req,
      429,
      "AI_RATE_LIMITED",
      "Too many AI requests. Please try again in a few minutes.",
    ),
});

// Writes a normalized audit trail entry for AI feature usage.
export async function writeAiUsageAuditLog(input: {
  req: Request;
  feature: string;
  model: string;
  dataSources: AiDataSource[];
  entityId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog({
    req: input.req,
    action: "AI_FEATURE_USED",
    entityType: "AI_FEATURE",
    entityId: input.entityId ?? input.feature,
    meta: {
      feature: input.feature,
      model: input.model,
      dataSources: input.dataSources.map((source) => source.key),
      ...(input.meta ?? {}),
    },
  });
}
