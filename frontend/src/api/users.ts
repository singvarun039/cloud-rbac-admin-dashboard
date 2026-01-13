import { api } from "./client";
import type { ApiEnvelope } from "../types/api";

export type UserStatus = "ACTIVE" | "INACTIVE";

export type User = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt?: string;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isUsersResponse(value: unknown): value is UsersResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    "data" in value &&
    "meta" in value
  );
}

function unwrapUsersResponse(payload: unknown): UsersResponse {
  // Backend may return either { data, meta } or an envelope { data: { data, meta } }
  if (isUsersResponse(payload)) return payload;

  const envelope = payload as ApiEnvelope<unknown>;
  if (envelope && typeof envelope === "object") {
    const inner = envelope.data;
    if (isUsersResponse(inner)) return inner;
  }

  throw new Error("Unexpected users list response format");
}

export async function getUsers(
  params: GetUsersParams,
  options?: { signal?: AbortSignal }
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
};

export type UpdateUserRequest = {
  name: string;
  email: string;
  status: UserStatus;
};

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

export async function updateUser(
  id: string,
  payload: UpdateUserRequest
): Promise<User> {
  const res = await api.patch(`/api/users/${id}`, payload);
  const body = res.data as unknown;
  const record = asRecord(body);
  if (record && "data" in record) {
    return (body as ApiEnvelope<User>).data as User;
  }
  return body as User;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`);
}
