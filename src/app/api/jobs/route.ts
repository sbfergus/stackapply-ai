import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJobPosting } from "@/lib/ai/parser";

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

// GET /api/jobs - Fetch all jobs for the dashboard
export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, jobs }, { headers: corsHeaders() });
  } catch (error: unknown) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST /api/jobs - Save and parse new job posting
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, sourceUrl, userId } = body;

    if (!rawText) {
      return NextResponse.json(
        { error: "Missing required rawText field" },
        { status: 400, headers: corsHeaders() }
      );
    }

    let targetUserId = userId;
    if (!targetUserId) {
      const defaultUser = await prisma.user.upsert({
        where: { email: "demo@stackapply.ai" },
        update: {},
        create: {
          email: "demo@stackapply.ai",
          fullName: "Demo User",
        },
      });
      targetUserId = defaultUser.id;
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    const parsedData = await parseJobPosting(
      rawText,
      user?.baseResumeText || undefined
    );

    const newJob = await prisma.job.create({
      data: {
        userId: targetUserId,
        title: parsedData.title,
        company: parsedData.company,
        location: parsedData.location,
        workSetting: parsedData.workSetting,
        salaryMin: parsedData.salaryMin,
        salaryMax: parsedData.salaryMax,
        companyOverview: parsedData.companyOverview,
        roleSummary: parsedData.roleSummary,
        techStack: parsedData.techStack,
        benefits: parsedData.benefits,
        matchScore: parsedData.matchScore,
        matchReasoning: parsedData.matchReasoning,
        sources: sourceUrl ? ["Extension"] : ["Manual"],
        originalUrls: sourceUrl ? [sourceUrl] : [],
        status: "TO_REVIEW",
      },
    });

    return NextResponse.json(
      { success: true, job: newJob },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error("Error ingesting job:", error);
    return NextResponse.json(
      { error: "Failed to parse and save job posting" },
      { status: 500, headers: corsHeaders() }
    );
  }
}