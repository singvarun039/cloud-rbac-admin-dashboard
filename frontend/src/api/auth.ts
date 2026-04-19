import { api } from './client';
import type { LoginRequest, LoginResponse, MeResponse } from '../types/auth';

// Sends a login request to the backend.
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await api.post('/api/auth/login', payload);
  return res.data;
}

// Loads the current authenticated user from the backend.
export async function me(): Promise<MeResponse> {
  const res = await api.get('/api/auth/me');
  return res.data;
}

// Exchanges a refresh token for a fresh token pair.
export async function refresh(payload: { refreshToken: string }): Promise<LoginResponse> {
  const res = await api.post('/api/auth/refresh', payload);
  return res.data;
}

// Revokes the current session on the backend.
export async function logout(payload: { refreshToken: string }): Promise<Record<string, unknown>> {
  const res = await api.post('/api/auth/logout', payload);
  return res.data;
}
