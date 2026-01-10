import "dotenv/config";

export const env = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 4000,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
  // SECURITY: Used to hash refresh tokens before DB storage (HMAC). Never store plaintext refresh tokens.
  REFRESH_TOKEN_HASH_SECRET: process.env.REFRESH_TOKEN_HASH_SECRET ?? "change-me-refresh-hash",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",
};
