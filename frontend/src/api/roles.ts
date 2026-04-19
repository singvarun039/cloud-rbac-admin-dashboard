import { api } from './client';
import { unwrapData, type ApiEnvelope } from '../types/api';

export type RolePermissionRef = {
  id: string;
  key: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
  permissions?: RolePermissionRef[];
  permissionCount?: number;
};

export type RolesResponse = {
  data: Role[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type GetRolesParams = {
  page?: number;
  limit?: number;
  search?: string;
};

// Narrows unknown values into plain object records.
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

// Normalizes backend role list responses into the frontend shape.
function unwrapRolesList(payload: unknown): RolesResponse {
  // Backend: ok envelope { ok: true, data: { roles, page, limit, total, totalPages } }
  const unwrapped = unwrapData<unknown>(payload) ?? payload;
  const record = asRecord(unwrapped);
  if (!record) throw new Error('Unexpected roles list response format');

  const roles = record.roles;
  const page = record.page;
  const limit = record.limit;
  const total = record.total;
  const totalPages = record.totalPages;

  if (!Array.isArray(roles)) throw new Error('Unexpected roles list response format');

  return {
    data: roles as Role[],
    meta: {
      page: typeof page === 'number' ? page : Number(page),
      limit: typeof limit === 'number' ? limit : Number(limit),
      total: typeof total === 'number' ? total : Number(total),
      totalPages: typeof totalPages === 'number' ? totalPages : Number(totalPages),
    },
  };
}

// Loads a paginated list of roles.
export async function getRoles(
  params?: GetRolesParams,
  options?: { signal?: AbortSignal }
): Promise<RolesResponse> {
  const query: Record<string, unknown> = {};

  if (typeof params?.page === 'number') query.page = params.page;
  if (typeof params?.limit === 'number') query.limit = params.limit;

  const trimmedSearch = (params?.search ?? '').trim();
  if (trimmedSearch) query.search = trimmedSearch;

  const res = await api.get('/api/roles', {
    params: Object.keys(query).length > 0 ? query : undefined,
    signal: options?.signal,
  });

  return unwrapRolesList(res.data);
}

export type CreateRoleRequest = {
  name: string;
  description?: string;
};

// Creates a new role through the API.
export async function createRole(payload: CreateRoleRequest): Promise<Role> {
  const res = await api.post('/api/roles', payload);
  const body = res.data as unknown;

  // backend: { ok: true, data: { role } }
  const unwrapped = unwrapData<unknown>(body) ?? body;
  const record = asRecord(unwrapped);
  const role = record?.role;
  if (role) return role as Role;

  // tolerate { data: role } / plain role
  const envelopeRecord = asRecord(body);
  if (envelopeRecord && 'data' in envelopeRecord) {
    return (body as ApiEnvelope<Role>).data as Role;
  }

  return body as Role;
}

export type UpdateRoleRequest = {
  name?: string;
  description?: string;
};

// Updates an existing role through the API.
export async function updateRole(id: string, payload: UpdateRoleRequest): Promise<Role> {
  const res = await api.patch(`/api/roles/${id}`, payload);
  const body = res.data as unknown;

  const unwrapped = unwrapData<unknown>(body) ?? body;
  const record = asRecord(unwrapped);
  const role = record?.role;
  if (role) return role as Role;

  const envelopeRecord = asRecord(body);
  if (envelopeRecord && 'data' in envelopeRecord) {
    return (body as ApiEnvelope<Role>).data as Role;
  }

  return body as Role;
}

// Replaces the permissions assigned to a role through the API.
export async function replaceRolePermissions(
  id: string,
  payload: { permissionIds: string[] }
): Promise<{ role: Role } & Record<string, unknown>> {
  const res = await api.post(`/api/roles/${id}/permissions`, payload);
  const body = res.data as unknown;

  const unwrapped = unwrapData<unknown>(body) ?? body;
  const record = asRecord(unwrapped);
  if (record && record.role) {
    return record as { role: Role } & Record<string, unknown>;
  }

  return body as { role: Role } & Record<string, unknown>;
}

// Permanently deletes a role through the API.
export async function permanentlyDeleteRole(id: string): Promise<void> {
  await api.delete(`/api/roles/${id}/permanent`);
}
