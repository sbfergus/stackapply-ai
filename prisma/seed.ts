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

  console.log("Database seeded successfully with demo job!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });