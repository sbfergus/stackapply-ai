/*
  Warnings:

  - You are about to drop the column `linkedinData` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `linkedinSyncedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `linkedinUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "matchCalculatedWithResumeHash" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "linkedinData",
DROP COLUMN "linkedinSyncedAt",
DROP COLUMN "linkedinUrl",
ADD COLUMN     "parsedResume" JSONB,
ADD COLUMN     "resumeHash" TEXT,
ADD COLUMN     "resumeLastParsedAt" TIMESTAMP(3),
ADD COLUMN     "resumeUpdatedAt" TIMESTAMP(3);
