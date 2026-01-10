-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "requestId" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "AuditLog" RENAME CONSTRAINT "AuditLog_actorId_fkey" TO "AuditLog_actorUserId_fkey";
