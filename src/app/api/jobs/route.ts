import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus, WorkType } from "@prisma/client";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// Safely normalize any incoming work setting string to exact WorkType enum: REMOTE | HYBRID | IN_OFFICE
function parseWorkType(input?: string | null): WorkType {
  if (!input) return WorkType.REMOTE;

  const normalized = input.toUpperCase().replace(/[^A-Z]/g, "");

  // 1. Hybrid
  if (normalized.includes("HYBRID")) {
    return WorkType.HYBRID;
  }

  // 2. In-Office / On-Site (Maps directly to WorkType.IN_OFFICE)
  if (
    normalized.includes("SITE") ||
    normalized.includes("OFFICE") ||
    normalized.includes("PERSON")
  ) {
    return WorkType.IN_OFFICE;
  }

  // 3. Remote
  if (normalized.includes("REMOTE")) {
    return WorkType.REMOTE;
  }

  return WorkType.REMOTE;
}

// GET /api/jobs - List all jobs
export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      { success: true, count: jobs.length, jobs },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error("GET /api/jobs failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch jobs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST /api/jobs - Create new job (from Chrome/Safari Extension or UI)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      company,
      location,
      workSetting,
      setting,
      workType,
      salaryMin,
      salaryMax,
      techStack,
      companyOverview,
      roleSummary,
      benefits,
      matchScore,
      matchReasoning,
      sources,
      originalUrls,
      status,
    } = body;

    if (!title || !company) {
      return NextResponse.json(
        { error: "Title and Company are required fields" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Get primary user (or demo user)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "demo@stackapply.ai",
          fullName: "Scott Ferguson",
        },
      });
    }

    // Normalize text for fuzzy duplicate detection
    function normalizeText(text: string): string {
      return text
        .toLowerCase()
        .trim()
        // Remove common company suffixes
        .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/gi, "")
        // Remove "the" prefix
        .replace(/^the\s+/i, "")
        // Normalize punctuation and spacing
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Check for duplicate job (by URL or by normalized title + company)
    // First, try to find by URL if available
    let existingJob = null;

    if (originalUrls && Array.isArray(originalUrls) && originalUrls.length > 0) {
      const cleanUrl = originalUrls[0];
      
      existingJob = await prisma.job.findFirst({
        where: {
          userId: user.id,
          originalUrls: {
            has: cleanUrl,
          },
        },
      });
    }

    // If not found by URL, check by normalized title + company
    if (!existingJob) {
      // Fetch all jobs for this user and do fuzzy comparison
      const allUserJobs = await prisma.job.findMany({
        where: { userId: user.id },
        select: { id: true, title: true, company: true },
      });

      // Normalize incoming data
      const normalizedTitle = normalizeText(title);
      const normalizedCompany = normalizeText(company);

      // Find matching job with normalized comparison
      existingJob = allUserJobs.find(job => {
        const existingTitle = normalizeText(job.title);
        const existingCompany = normalizeText(job.company);
        
        return existingTitle === normalizedTitle && existingCompany === normalizedCompany;
      });
    }

    if (existingJob) {
      return NextResponse.json(
        { 
          error: "Duplicate job detected",
          message: `You've already saved "${title}" at ${company}. Check your dashboard!`,
          existingJobId: existingJob.id,
        },
        { status: 409, headers: corsHeaders() }
      );
    }

    // Normalizes work setting to enum WorkType (REMOTE | HYBRID | IN_OFFICE)
    const rawWorkType = workSetting || setting || workType;
    const validatedWorkSetting = parseWorkType(rawWorkType);

    const newJob = await prisma.job.create({
      data: {
        user: {
          connect: { id: user.id },
        },
        title,
        company,
        location: location || "Remote",
        workSetting: validatedWorkSetting,
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
        techStack: Array.isArray(techStack) ? techStack : [],
        companyOverview: companyOverview || "",
        roleSummary: roleSummary || "",
        benefits: Array.isArray(benefits) ? benefits : [],
        matchScore: matchScore ? Number(matchScore) : 85,
        matchReasoning:
          matchReasoning || "Saved directly via StackApply Extension.",
        sources: Array.isArray(sources) ? sources : ["Extension"],
        originalUrls: Array.isArray(originalUrls) ? originalUrls : [],
        status: (status as JobStatus) || JobStatus.TO_REVIEW,
      },
    });

    return NextResponse.json(
      { success: true, job: newJob },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error("POST /api/jobs failed:", error);
    return NextResponse.json(
      {
        error: "Failed to create job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}