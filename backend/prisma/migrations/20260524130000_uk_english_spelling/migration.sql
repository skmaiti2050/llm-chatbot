-- AlterEnum
ALTER TYPE "ConversationStatus" RENAME TO "ConversationStatus_old";
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'paused', 'cancelled');
ALTER TABLE "Conversation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Conversation" ALTER COLUMN "status" TYPE "ConversationStatus" USING ("status"::text::"ConversationStatus");
ALTER TABLE "Conversation" ALTER COLUMN "status" SET DEFAULT 'active';
DROP TYPE "ConversationStatus_old";

-- RenameColumn
ALTER TABLE "Conversation" RENAME COLUMN "canceledAt" TO "cancelledAt";
