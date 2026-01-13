import type { ApiEnvelope } from './api'
import type { MeUser } from './user'

export type LoginRequest = {
  email: string
  password: string
}

export type LoginData = {
  accessToken?: string
  refreshToken?: string
  user?: Partial<MeUser>
}

export type LoginResponse = ApiEnvelope<LoginData> | LoginData | Record<string, unknown>

export type MeResponse = ApiEnvelope<MeUser> | MeUser | Record<string, unknown>
