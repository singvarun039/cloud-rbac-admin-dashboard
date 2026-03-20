import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// SSL configuration for pg.Pool (used by runtime queries and prisma db seed)
//
// IMPORTANT: DATABASE_URL must NOT contain sslmode=require.
//
// Why: pg uses Object.assign({}, explicitConfig, parse(connectionString))
// so URL-parsed ssl:{} (from sslmode=require) silently overwrites the explicit
// ssl:{rejectUnauthorized:false} option, reverting to Node.js TLS defaults
// (rejectUnauthorized:true) which reject the AWS RDS certificate chain (P1011).
//
// The fix: keep sslmode off the connection string; control SSL entirely via
// the explicit ssl option below. SSL encryption of data in transit remains
// fully active — only the CA chain verification is relaxed via rejectUnauthorized:false.
// ---------------------------------------------------------------------------
function buildPoolConfig(databaseUrl: string) {
  // Strip any sslmode/ssl query params the URL may carry to prevent pg from
  // overriding the explicit ssl option below.
  let cleanUrl = databaseUrl;
  try {
    const u = new URL(databaseUrl);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    cleanUrl = u.toString();
  } catch {
    // Not a valid URL — pass through as-is and let pg handle it
  }

  return {
    connectionString: cleanUrl,
    // In production (AWS RDS), require SSL but accept the AWS intermediate
    // certificate chain which is not in Node.js's default CA bundle.
    ssl:
      env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

const pool = new Pool(buildPoolConfig(env.DATABASE_URL));

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
