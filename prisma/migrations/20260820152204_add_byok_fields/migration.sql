-- CreateEnum
CREATE TYPE "ApiKeyProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiAnalysisCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "apiKeyEncrypted" TEXT,
ADD COLUMN     "apiKeyProvider" "ApiKeyProvider",
ADD COLUMN     "lastAiAnalysisReset" TIMESTAMP(3),
ADD COLUMN     "resumeUrl" TEXT;
