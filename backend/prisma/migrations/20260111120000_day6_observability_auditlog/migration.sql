-- Day 6: Observability + Audit Logs (schema alignment)

-- 1) Make action a plain string (drop enum)
ALTER TABLE "AuditLog"
  ALTER COLUMN "action" TYPE TEXT USING "action"::text;

-- 2) Rename columns to match new schema
ALTER TABLE "AuditLog" RENAME COLUMN "actorId" TO "actorUserId";
ALTER TABLE "AuditLog" RENAME COLUMN "metadata" TO "meta";
ALTER TABLE "AuditLog" RENAME COLUMN "entity" TO "entityType";

-- 3) Ensure entityType is non-null
UPDATE "AuditLog" SET "entityType" = COALESCE("entityType", 'Unknown');
ALTER TABLE "AuditLog" ALTER COLUMN "entityType" SET NOT NULL;

-- 4) Add requestId (required)
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT NOT NULL DEFAULT '';

-- 5) Drop enum type now that no columns depend on it
DROP TYPE IF EXISTS "AuditAction";

-- 6) Indexes (safe add; existing indexes may remain with old names)
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
