/// <reference types="node" />
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// ---------------------------------------------------------------------------
// Prisma CLI URL split
//
// PRISMA_DATABASE_URL  — URL used exclusively by the Prisma CLI (migrate, generate).
//                        Should include sslmode=require for RDS.
//                        Prisma's own Wasm engine handles AWS RDS certs natively.
//
// DATABASE_URL         — URL used at runtime and by prisma db seed via pg.Pool.
//                        Must NOT include sslmode=require.
//                        SSL is controlled by the explicit `ssl: { rejectUnauthorized: false }`
//                        option on the pg.Pool in src/db/prisma.ts.
//                        Including sslmode=require here causes pg-connection-string to
//                        inject ssl:{} which silently overwrites the explicit ssl option,
//                        reverting rejectUnauthorized to true and breaking the RDS cert chain.
//
// When PRISMA_DATABASE_URL is not set, DATABASE_URL is used as the fallback
// (correct for local dev where no RDS/SSL is involved).
// ---------------------------------------------------------------------------

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.PRISMA_DATABASE_URL ? env('PRISMA_DATABASE_URL') : env('DATABASE_URL'),
  },
});
