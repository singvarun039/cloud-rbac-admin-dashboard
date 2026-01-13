import { api } from "./client";
import { unwrapData } from "../types/api";

export type Permission = {
  id: string;
  key: string;
  description: string | null;
  createdAt?: string;
};

export type PermissionsResponse = {
  data: Permission[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export async function getPermissions(options?: {
  signal?: AbortSignal;
}): Promise<PermissionsResponse> {
  const res = await api.get("/api/permissions", { signal: options?.signal });
  const body = res.data as unknown;

  // Backend: ok envelope { ok: true, data: { permissions } }
  const unwrapped = unwrapData<unknown>(body) ?? body;
  const record = asRecord(unwrapped);
  const permissions = record?.permissions;
  if (!Array.isArray(permissions)) {
    throw new Error("Unexpected permissions list response format");
  }

  return { data: permissions as Permission[] };
}
