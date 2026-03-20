import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// DATABASE_URL is required for all Prisma operations (migrate, seed, generate).
// env() from prisma/config throws a clear error if the variable is not set,
// so missing credentials surface immediately instead of silently falling back.
// Set DATABASE_URL in .env (dev) or .env.prod (prod) before running any Prisma command.
// Format: postgresql://<username>:<password>@<host>:5432/<dbname>?schema=public

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
