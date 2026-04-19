import type { MeUser } from "../types/user";
import { unwrapData } from "../types/api";

// Narrows unknown values into plain object records.
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

// Extracts an access token from several tolerated response shapes.
export function extractAccessToken(payload: unknown): string | null {
  const unwrapped = unwrapData<Record<string, unknown>>(payload);
  const candidate = asRecord(unwrapped ?? payload);
  if (!candidate) return null;
  const data = asRecord(candidate.data);
  const direct = candidate.accessToken ?? candidate.token ?? data?.accessToken ?? data?.token;
  return typeof direct === "string" && direct.length > 0 ? direct : null;
}

// Extracts a refresh token from several tolerated response shapes.
export function extractRefreshToken(payload: unknown): string | null {
  const unwrapped = unwrapData<Record<string, unknown>>(payload);
  const candidate = asRecord(unwrapped ?? payload);
  if (!candidate) return null;
  const data = asRecord(candidate.data);
  const direct = candidate.refreshToken ?? data?.refreshToken;
  return typeof direct === "string" && direct.length > 0 ? direct : null;
}

type ApiErrorEnvelope = {
  ok: false;
  error: { code: string; message: string };
  requestId: string;
};

// Converts a login failure into a user-facing message.
export function extractErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: unknown } };
  const data = anyErr?.response?.data;
  const envelope = (data && typeof data === "object" ? data : null) as ApiErrorEnvelope | null;
  const serverMessage = envelope?.error?.message;
  if (typeof serverMessage === "string" && serverMessage.length > 0) return serverMessage;
  return "Login failed. Please try again.";
}

// Normalizes a user-shaped payload into the MeUser type.
export function unwrapMeUser(payload: unknown): MeUser | null {
  const unwrapped = unwrapData<MeUser>(payload);
  const candidate = (unwrapped ?? payload) as unknown;
  const record = asRecord(candidate);
  if (!record) return null;
  if (typeof record.id === "string" && typeof record.email === "string") {
    return record as unknown as MeUser;
  }
  return null;
}

// Checks whether a value is a string array.
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

// Normalizes the /auth/me response into user and permission data.
export function unwrapMeResponse(payload: unknown): { user: MeUser | null; permissions: string[] } {
  const unwrapped = unwrapData<unknown>(payload);
  const candidate = asRecord(unwrapped ?? payload);
  if (!candidate) return { user: null, permissions: [] };

  const innerData = asRecord(candidate.data);
  const source = innerData && ("user" in innerData || "permissions" in innerData) ? innerData : candidate;

  const nestedUser = asRecord(source.user);
  const user = unwrapMeUser(nestedUser ?? source);

  const permissionsFromTop = source.permissions;
  const permissionsFromNestedUser = nestedUser?.permissions;

  const permissions =
    (isStringArray(permissionsFromTop) ? permissionsFromTop : null) ??
    (isStringArray(permissionsFromNestedUser) ? permissionsFromNestedUser : null) ??
    [];

  return { user, permissions };
}
