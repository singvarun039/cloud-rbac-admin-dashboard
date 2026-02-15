import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

const databaseUrl = env.DATABASE_URL;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
