-- DropIndex
DROP INDEX "Session_refreshToken_key";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "refreshToken",
ADD COLUMN     "refreshTokenHash" TEXT NOT NULL,
ADD COLUMN     "replacedBySessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_replacedBySessionId_key" ON "Session"("replacedBySessionId");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_replacedBySessionId_fkey" FOREIGN KEY ("replacedBySessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
