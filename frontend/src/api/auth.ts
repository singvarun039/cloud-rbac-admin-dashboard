import { api } from "./client";
import type { LoginRequest, LoginResponse, MeResponse } from "../types/auth";

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await api.post("/api/auth/login", payload);
  return res.data;
}

export async function me(): Promise<MeResponse> {
  const res = await api.get("/api/auth/me");
  return res.data;
}

export async function refresh(payload: {
  refreshToken: string;
}): Promise<LoginResponse> {
  const res = await api.post("/api/auth/refresh", payload);
  return res.data;
}

export async function logout(payload: {
  refreshToken: string;
}): Promise<Record<string, unknown>> {
  const res = await api.post("/api/auth/logout", payload);
  return res.data;
}
