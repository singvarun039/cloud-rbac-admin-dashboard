-- AlterTable
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'AuditLog'
			AND column_name = 'requestId'
	) THEN
		EXECUTE 'ALTER TABLE "AuditLog" ALTER COLUMN "requestId" DROP DEFAULT';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AuditLog_actorId_fkey'
	) THEN
		EXECUTE 'ALTER TABLE "AuditLog" RENAME CONSTRAINT "AuditLog_actorId_fkey" TO "AuditLog_actorUserId_fkey"';
	END IF;
END $$;
