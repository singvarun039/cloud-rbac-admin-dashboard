import "dotenv/config";

// ---------------------------------------------------------------------------
// Credential & configuration validation — fails early with actionable messages
// SECURITY: Never include secret values in error output or logs.
// ---------------------------------------------------------------------------

const PLACEHOLDER_SECRETS = new Set([
  "change-me-access",
  "change-me-refresh",
  "change-me-refresh-hash",
  "",
]);

// Validates required runtime environment variables before startup.
function validateEnv(): void {
  const errors: string[] = [];
  const isProd = (process.env.NODE_ENV ?? "development") === "production";

  // DATABASE_URL is always required — without it the app cannot connect to Postgres.
  if (!process.env.DATABASE_URL) {
    errors.push(
      "DATABASE_URL is not set.\n" +
        "     Set it to: postgresql://<DB_USERNAME>:<DB_PASSWORD>@<host>:5432/<DB_NAME>?schema=public\n" +
        "     Local dev:  use the value from .env (see .env.example)\n" +
        "     Production: set in .env.prod or via your secrets manager",
    );
  }

  // In production, reject placeholder / missing JWT secrets.
  if (isProd) {
    const secretKeys = [
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "REFRESH_TOKEN_HASH_SECRET",
    ] as const;

    for (const key of secretKeys) {
      const val = process.env[key] ?? "";
      if (PLACEHOLDER_SECRETS.has(val)) {
        errors.push(
          `${key} is missing or uses a placeholder value in production.\n` +
            "     Generate a strong random secret: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"",
        );
      }
    }

    if (!process.env.FRONTEND_ORIGIN) {
      errors.push(
        "FRONTEND_ORIGIN is required in production.\n" +
          "     Set it to the public URL of your frontend, e.g. https://your-domain.com",
      );
    }
  }

  if (errors.length > 0) {
    const msg = [
      "",
      "=== Application startup failed — credential/config errors ===",
      "",
      ...errors.map((e, i) => `  ${i + 1}. ${e}`),
      "",
      "  Copy .env.example → .env (dev) or .env.prod (prod) and fill in all required values.",
      "  NEVER commit .env or .env.prod to version control.",
      "=============================================================",
      "",
    ].join("\n");
    // Use process.stderr directly so the error appears even before the logger is ready.
    process.stderr.write(msg + "\n");
    process.exit(1);
  }
}

// Run validation before any module accesses env values.
validateEnv();

// Returns the database hostname without exposing credentials.
export function getDbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL!).hostname;
  } catch {
    return "unknown";
  }
}

export const env = {
  PORT: process.env.API_PORT
    ? Number(process.env.API_PORT)
    : process.env.PORT
      ? Number(process.env.PORT)
      : 4000,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  TRUST_PROXY: process.env.TRUST_PROXY === "true",
  // SECURITY: Never log this value — it contains the DB password.
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
  // SECURITY: Used to hash refresh tokens before DB storage (HMAC). Never store plaintext refresh tokens.
  REFRESH_TOKEN_HASH_SECRET:
    process.env.REFRESH_TOKEN_HASH_SECRET ?? "change-me-refresh-hash",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",

  // Explicit CORS allowlist. Supports a single origin or a comma-separated list.
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? "",

  // Auth endpoint rate limits (IP-keyed)
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
