import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJobPosting, parseResumePDF } from "@/lib/ai/parser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: jobId } = await params;

    // Fetch the job
    const job = await prisma.job.findUnique({
      where: { id: jobId, userId: session.user.id },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Fetch user's resume data and hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        resumeUrl: true,
        resumeHash: true,
        resumeUpdatedAt: true,
        parsedResume: true,
        resumeLastParsedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Safety check: Ensure the schema has been migrated
    if (!('resumeHash' in user)) {
      console.error('Database schema mismatch: resumeHash field missing. Please run database migration.');
      return NextResponse.json(
        { success: false, error: "Database schema not up to date. Please contact support." },
        { status: 500 }
      );
    }

    if (!user.resumeUrl) {
      return NextResponse.json(
        { success: false, error: "No resume uploaded. Please upload your resume in Account Settings." },
        { status: 400 }
      );
    }

    // Step 1: Check if resume needs re-parsing
    const needsReparsing = 
      !user.parsedResume || 
      !user.resumeLastParsedAt || 
      (user.resumeUpdatedAt && user.resumeLastParsedAt && user.resumeUpdatedAt > user.resumeLastParsedAt);

    if (needsReparsing) {
      // Parse the resume PDF
      const parsedResume = await parseResumePDF(user.resumeUrl, session.user.id);

      // Save parsed resume to database (cache it)
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          parsedResume: parsedResume as any, // Prisma JsonValue
          resumeLastParsedAt: new Date(),
        },
      });
    }

    // Build a text representation of the job for AI analysis
    const jobText = `
Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Work Setting: ${job.workSetting}
${job.salaryMin && job.salaryMax ? `Salary Range: $${job.salaryMin} - $${job.salaryMax}` : ''}

Company Overview:
${job.companyOverview || 'N/A'}

Role Summary:
${job.roleSummary || 'N/A'}

Required Technologies: ${job.techStack.join(', ')}

Benefits: ${Array.isArray(job.benefits) ? (job.benefits as string[]).join(', ') : 'N/A'}
`.trim();

    // Use the parser to analyze the job with user's profile
    // Note: parseJobPosting will use the cached parsedResume from the database
    const result = await parseJobPosting(jobText, session.user.id);

    // Update the job with the match score, reasoning, and resume hash tracking
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        matchScore: result.matchScore,
        matchReasoning: result.matchReasoning,
        matchCalculatedWithResumeHash: user.resumeHash, // Track which resume version was used
      },
    });

    return NextResponse.json({
      success: true,
      matchScore: result.matchScore,
      matchReasoning: result.matchReasoning,
      job: updatedJob,
    });
  } catch (error: unknown) {
    console.error("Calculate match error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    // Handle free tier limit error
    if (error instanceof Error && error.message.includes('FREE_TIER_LIMIT_EXCEEDED')) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message.replace('FREE_TIER_LIMIT_EXCEEDED: ', ''),
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate match",
      },
      { status: 500 }
    );
  }
}
