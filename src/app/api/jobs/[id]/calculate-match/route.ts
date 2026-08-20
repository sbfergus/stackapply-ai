import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJobPosting } from "@/lib/ai/parser";

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
    const result = await parseJobPosting(jobText, session.user.id);

    // Update the job with the match score and reasoning
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        matchScore: result.matchScore,
        matchReasoning: result.matchReasoning,
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
