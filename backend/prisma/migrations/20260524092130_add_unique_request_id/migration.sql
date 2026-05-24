-- Create unique index on requestId for idempotent ingestion
CREATE UNIQUE INDEX "InferenceLog_requestId_key" ON "InferenceLog"("requestId");

-- Drop the non-unique index since the unique one covers it
DROP INDEX IF EXISTS "InferenceLog_requestId_idx";
