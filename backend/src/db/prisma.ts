import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

// SECURITY: In production (AWS RDS), SSL is always required.
// rejectUnauthorized: false accepts the AWS RDS certificate chain without
// requiring the Amazon CA bundle to be present in Node's default trust store.
// SSL encryption of data in transit is still fully active.
// To upgrade to full cert verification, set DB_SSL_CA to the PEM contents of
// the AWS RDS CA bundle (https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).
const sslConfig =
  env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
