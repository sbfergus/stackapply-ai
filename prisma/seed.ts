import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in .env");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@stackapply.ai" },
    update: {},
    create: {
      email: "demo@stackapply.ai",
      fullName: "Scott Ferguson",
    },
  });

  // Job 1: Existing Demo Job
  await prisma.job.create({
    data: {
      userId: user.id,
      title: "Senior Full Stack Engineer",
      company: "Acme Corp",
      location: "Denver, CO",
      workSetting: "HYBRID",
      salaryMin: 150000,
      salaryMax: 185000,
      companyOverview: "Leading modern cloud infrastructure software.",
      roleSummary: "Building Next.js and Node microservices at scale.",
      techStack: ["Next.js", "TypeScript", "Tailwind CSS", "Prisma", "PostgreSQL"],
      benefits: ["Unlimited PTO", "Health/Dental", "401k match"],
      matchScore: 92,
      matchReasoning: "Strong alignment with TypeScript and Next.js full-stack experience.",
      status: "TO_REVIEW",
      sources: ["Manual"],
      originalUrls: ["https://example.com/job/123"],
    },
  });

  // Job 2: Second Demo Job to test multi-card column layout
  await prisma.job.create({
    data: {
      userId: user.id,
      title: "Senior React / Next.js Engineer",
      company: "Vercel Labs",
      location: "Remote",
      workSetting: "REMOTE",
      salaryMin: 165000,
      salaryMax: 195000,
      companyOverview: "Vercel is the platform for frontend developers, providing developer speed and reliability.",
      roleSummary: "Building Next.js App Router features and developer experience tooling.",
      techStack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "GraphQL", "SCSS", "JAVA", "COBALT"],
      benefits: ["Remote stipend", "Flexible hours", "Full health benefits"],
      matchScore: 96,
      matchReasoning: "Exceptional match for modern frontend architecture and Next.js performance optimization.",
      status: "TO_REVIEW",
      sources: ["Manual"],
      originalUrls: ["https://example.com/job/456"],
    },
  });

  console.log("Database seeded successfully with multiple demo jobs!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });