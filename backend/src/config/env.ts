import "dotenv/config";

export const env = {
  PORT: process.env.API_PORT
    ? Number(process.env.API_PORT)
    : process.env.PORT
      ? Number(process.env.PORT)
      : 4000,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  TRUST_PROXY: process.env.TRUST_PROXY === "true",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
  // SECURITY: Used to hash refresh tokens before DB storage (HMAC). Never store plaintext refresh tokens.
  REFRESH_TOKEN_HASH_SECRET:
    process.env.REFRESH_TOKEN_HASH_SECRET ?? "change-me-refresh-hash",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",

  // Day 16: explicit CORS allowlist
  // Supports a single origin or a comma-separated list.
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? "",

  // Day 16: auth endpoint rate limits (IP-keyed)
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS
    ? Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS)
    : 10 * 60 * 1000,
  AUTH_LOGIN_RATE_LIMIT_MAX: process.env.AUTH_LOGIN_RATE_LIMIT_MAX
    ? Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX)
    : 10,
  AUTH_REFRESH_RATE_LIMIT_WINDOW_MS: process.env
    .AUTH_REFRESH_RATE_LIMIT_WINDOW_MS
    ? Number(process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS)
    : 10 * 60 * 1000,
  AUTH_REFRESH_RATE_LIMIT_MAX: process.env.AUTH_REFRESH_RATE_LIMIT_MAX
    ? Number(process.env.AUTH_REFRESH_RATE_LIMIT_MAX)
    : 30,
};
