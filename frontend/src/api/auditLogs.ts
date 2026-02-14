import { api } from "./client";
import { unwrapData } from "../types/api";

export type AuditActor = {
  id: string;
  email: string;
  name: string | null;
};

export type AuditLogRow = {
  id: string;
  createdAt: string;
  action: string;
  actorUserId: string | null;
  actor?: AuditActor;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  meta: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuditLogsResponse = {
  data: AuditLogRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
};

export type GetAuditLogsParams = {
  page: number;
  limit: number;
  action?: string;
  actorUserId?: string;
  actorEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  entityType?: string;
  entityId?: string;
  requestId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isAuditLogsData(value: unknown): value is {
  items: AuditLogRow[];
  meta: { page: number; limit: number; total: number; hasNext: boolean };
} {
  if (!value || typeof value !== "object") return false;
  return "items" in value && "meta" in value;
}

function unwrapAuditLogsResponse(payload: unknown): AuditLogsResponse {
  const unwrapped = unwrapData<unknown>(payload) ?? payload;
  if (isAuditLogsData(unwrapped)) {
    return {
      data: unwrapped.items,
      meta: unwrapped.meta,
    };
  }

  const record = asRecord(unwrapped);
  if (record && Array.isArray(record.items) && record.meta) {
    return {
      data: record.items as AuditLogRow[],
      meta: record.meta as AuditLogsResponse["meta"],
    };
  }

  throw new Error("Unexpected audit logs response format");
}

export async function getAuditLogs(
  params: GetAuditLogsParams,
  options?: { signal?: AbortSignal },
): Promise<AuditLogsResponse> {
  const query: Record<string, unknown> = {
    page: params.page,
    limit: params.limit,
  };

  const trimmedAction = (params.action ?? "").trim();
  if (trimmedAction && trimmedAction !== "ALL") query.action = trimmedAction;

  const actorUserId = (params.actorUserId ?? "").trim();
  if (actorUserId) query.actorUserId = actorUserId;

  const actorEmail = (params.actorEmail ?? "").trim();
  if (actorEmail) query.actorEmail = actorEmail;

  const entityType = (params.entityType ?? "").trim();
  if (entityType) query.entityType = entityType;

  const entityId = (params.entityId ?? "").trim();
  if (entityId) query.entityId = entityId;

  const requestId = (params.requestId ?? "").trim();
  if (requestId) query.requestId = requestId;

  const dateFrom = (params.dateFrom ?? "").trim();
  if (dateFrom) query.dateFrom = dateFrom;

  const dateTo = (params.dateTo ?? "").trim();
  if (dateTo) query.dateTo = dateTo;

  const res = await api.get("/api/audit-logs", {
    params: query,
    signal: options?.signal,
  });

  return unwrapAuditLogsResponse(res.data);
}
