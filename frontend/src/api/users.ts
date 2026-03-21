import { api } from "./client";
import { unwrapData, type ApiEnvelope } from "../types/api";

export type UserStatus = "ACTIVE" | "INACTIVE";

export type User = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles?: Array<{ id: string; name: string }>;
  roleId?: string;
  roleName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UsersResponse = {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
};

export type GetUsersParams = {
  page: number;
  limit: number;
  search?: string;
  status?: "ALL" | UserStatus;
};

// Narrows unknown values into plain object records.
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

// Checks whether a value already matches the normalized users response shape.
function isUsersResponse(value: unknown): value is UsersResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    "data" in value &&
    "meta" in value
  );
}

// Checks whether a value matches the backend's users list payload.
function isUsersListData(value: unknown): value is {
  items: User[];
  meta: UsersResponse["meta"];
} {
  if (!value || typeof value !== "object") return false;
  return "items" in value && "meta" in value;
}

// Builds a readable error message for malformed user responses.
function getUsersFormatErrorMessage(payload: unknown): string {
  const record = asRecord(payload);
  const error = record?.error;
  const errorMessage =
    error && typeof error === "object" && error !== null && "message" in error
      ? (error as { message?: unknown }).message
      : undefined;

  if (typeof errorMessage === "string" && errorMessage.trim()) {
    return errorMessage;
  }

  const message = record?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return "Failed to load users.";
}

// Normalizes backend user list responses into the frontend shape.
function unwrapUsersResponse(payload: unknown): UsersResponse {
  // Accept:
  // - { data, meta } (legacy / normalized)
  // - { items, meta }
  // - envelope: { ok: true, data: { items, meta } }
  // - envelope: { data: { items, meta } }
  const unwrapped = unwrapData<unknown>(payload) ?? payload;

  if (isUsersResponse(unwrapped)) return unwrapped;

  if (isUsersListData(unwrapped)) {
    return {
      data: unwrapped.items,
      meta: unwrapped.meta,
    };
  }

  // Defensive: only throw a helpful message when items/meta are missing.
  const msg = getUsersFormatErrorMessage(payload);
  throw new Error(msg);
}

// Loads a paginated list of users.
export async function getUsers(
  params: GetUsersParams,
  options?: { signal?: AbortSignal },
): Promise<UsersResponse> {
  const query: Record<string, unknown> = {
    page: params.page,
    limit: params.limit,
  };

  const trimmedSearch = (params.search ?? "").trim();
  if (trimmedSearch) query.search = trimmedSearch;

  if (params.status && params.status !== "ALL") {
    query.status = params.status;
  }

  const res = await api.get("/api/users", {
    params: query,
    signal: options?.signal,
  });

  return unwrapUsersResponse(res.data);
}

export type CreateUserRequest = {
  name: string;
  email: string;
  password: string;
  status?: UserStatus;
  roleId?: string;
};

export type UpdateUserRequest = {
  name: string;
  email: string;
  status: UserStatus;
  roleId?: string;
  password?: string;
};

// Creates a new user record through the API.
export async function createUser(payload: CreateUserRequest): Promise<User> {
  const res = await api.post("/api/users", payload);

  // tolerate either { data: user } or just user
  const body = res.data as unknown;
  const record = asRecord(body);
  if (record && "data" in record) {
    return (body as ApiEnvelope<User>).data as User;
  }
  return body as User;
}

// Updates an existing user through the API.
export async function updateUser(
  id: string,
  payload: UpdateUserRequest,
): Promise<User> {
  const res = await api.patch(`/api/users/${id}`, payload);
  const body = res.data as unknown;
  const record = asRecord(body);
  if (record && "data" in record) {
    return (body as ApiEnvelope<User>).data as User;
  }
  return body as User;
}

// Soft-deletes a user through the API.
export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`);
}

// Permanently deletes a user through the API.
export async function permanentlyDeleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}/permanent`);
}
