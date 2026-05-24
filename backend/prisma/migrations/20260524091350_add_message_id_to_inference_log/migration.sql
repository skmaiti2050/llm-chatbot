-- AlterTable
ALTER TABLE "InferenceLog" ADD COLUMN     "messageId" TEXT;

-- CreateIndex
CREATE INDEX "InferenceLog_messageId_idx" ON "InferenceLog"("messageId");
