-- DropIndex
DROP INDEX "Task_createdAt_idx";

-- DropIndex
DROP INDEX "Task_userId_idx";

-- DropIndex
DROP INDEX "Task_userId_status_idx";

-- CreateIndex
CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_userId_status_createdAt_idx" ON "Task"("userId", "status", "createdAt");
