-- CreateEnum
CREATE TYPE "InferenceLogStatus" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "InferenceLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "traceId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "latencyMs" INTEGER NOT NULL,
    "status" "InferenceLogStatus" NOT NULL,
    "inputPreview" TEXT,
    "outputPreview" TEXT,
    "errorMessage" TEXT,
    "tokenUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InferenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InferenceLog_sessionId_startedAt_idx" ON "InferenceLog"("sessionId", "startedAt");

-- CreateIndex
CREATE INDEX "InferenceLog_requestId_idx" ON "InferenceLog"("requestId");

-- CreateIndex
CREATE INDEX "InferenceLog_createdAt_idx" ON "InferenceLog"("createdAt");
