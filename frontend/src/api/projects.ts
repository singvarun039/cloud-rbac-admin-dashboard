import { api } from "./client";
import { unwrapData } from "../types/api";

export type Project = {
  id: string;
  name: string;
  ownerId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsResponse = {
  data: Project[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
};

export type GetProjectsParams = {
  page: number;
  limit: number;
  search?: string;
  ownerId?: string;
  includeArchived?: boolean;
};

// Narrows unknown values into plain object records.
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

// Checks whether a value matches the backend's projects list payload.
function isProjectsListData(value: unknown): value is {
  items: Project[];
  meta: ProjectsResponse["meta"];
} {
  if (!value || typeof value !== "object") return false;
  return "items" in value && "meta" in value;
}

// Normalizes backend project list responses into the frontend shape.
function unwrapProjectsResponse(payload: unknown): ProjectsResponse {
  const unwrapped = unwrapData<unknown>(payload) ?? payload;
  if (isProjectsListData(unwrapped)) {
    return {
      data: unwrapped.items,
      meta: unwrapped.meta,
    };
  }

  const record = asRecord(unwrapped);
  if (record && Array.isArray(record.items) && record.meta) {
    return {
      data: record.items as Project[],
      meta: record.meta as ProjectsResponse["meta"],
    };
  }

  throw new Error("Unexpected projects list response format");
}

// Loads a paginated list of projects.
export async function getProjects(
  params: GetProjectsParams,
  options?: { signal?: AbortSignal },
): Promise<ProjectsResponse> {
  const query: Record<string, unknown> = {
    page: params.page,
    limit: params.limit,
  };

  const trimmedSearch = (params.search ?? "").trim();
  if (trimmedSearch) query.search = trimmedSearch;

  const ownerId = (params.ownerId ?? "").trim();
  if (ownerId) query.ownerId = ownerId;

  if (typeof params.includeArchived === "boolean") {
    query.includeArchived = params.includeArchived;
  }

  const res = await api.get("/api/projects", {
    params: query,
    signal: options?.signal,
  });

  return unwrapProjectsResponse(res.data);
}
