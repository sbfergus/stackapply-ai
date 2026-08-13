import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJobPosting } from "@/lib/ai/parser";

// Helper to set CORS headers so your Chrome Extension can post directly to your API
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// Handle browser pre-flight OPTIONS check
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

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

    // 1. Get or create a default user if no userId provided
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

    // 2. Fetch user to check for resume text to pass to Claude
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    // 3. Parse job posting with Claude 3.5 Haiku
    const parsedData = await parseJobPosting(
      rawText,
      user?.baseResumeText || undefined
    );

    // 4. Save job record to Neon DB
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