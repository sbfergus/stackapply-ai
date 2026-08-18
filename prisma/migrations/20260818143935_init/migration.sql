-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('REMOTE', 'HYBRID', 'IN_OFFICE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('TO_REVIEW', 'READY_TO_APPLY', 'APPLIED', 'INTERVIEWING', 'REJECTED', 'OFFER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "avatarUrl" TEXT,
    "linkedinUrl" TEXT,
    "linkedinData" JSONB,
    "baseResumeText" TEXT,
    "baseCoverLetter" TEXT,
    "writingStyle" JSONB,
    "preferredWorkTypes" "WorkType"[] DEFAULT ARRAY['REMOTE', 'HYBRID']::"WorkType"[],
    "preferredTechStack" TEXT[],
    "targetSalaryMin" INTEGER,
    "preferredLocations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "workSetting" "WorkType" NOT NULL DEFAULT 'HYBRID',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "sources" TEXT[],
    "originalUrls" TEXT[],
    "companyOverview" TEXT NOT NULL,
    "roleSummary" TEXT NOT NULL,
    "techStack" TEXT[],
    "benefits" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'TO_REVIEW',
    "matchScore" INTEGER,
    "preferenceScore" INTEGER,
    "matchReasoning" TEXT,
    "tailoredResumeText" TEXT,
    "coverLetterText" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "listedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Job_userId_status_idx" ON "Job"("userId", "status");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
