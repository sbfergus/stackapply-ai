import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTailoredResume } from '@/lib/ai/resume-generator';
import { generateResumePDF, generateResumeFilename } from '@/lib/pdf-generator';
import { ParsedResume } from '@/lib/ai/parser';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
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
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Fetch user's parsed resume
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        parsedResume: true,
        resumeUrl: true,
      },
    });

    if (!user?.resumeUrl) {
      return NextResponse.json(
        { success: false, error: 'No resume uploaded. Please upload your resume in Account Settings.' },
        { status: 400 }
      );
    }

    if (!user.parsedResume) {
      return NextResponse.json(
        { success: false, error: 'Resume not yet parsed. Please wait a moment and try again.' },
        { status: 400 }
      );
    }

    const parsedResume = user.parsedResume as unknown as ParsedResume;

    // Build job description from job data
    const jobDescription = `
${job.roleSummary}

${job.companyOverview}

Required Technologies: ${job.techStack.join(', ')}

Benefits: ${Array.isArray(job.benefits) ? (job.benefits as string[]).join(', ') : ''}
`.trim();

    // Generate tailored resume
    const tailoredResumeText = await generateTailoredResume({
      userId: session.user.id,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      jobDescription,
      techStack: job.techStack,
      parsedResume,
    });

    // Save to database
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        tailoredResumeText,
        tailoredResumeGeneratedAt: new Date(),
      },
    });

    // Generate PDF
    const pdfBuffer = generateResumePDF(tailoredResumeText, job.company);
    const filename = generateResumeFilename(job.company);

    // Return PDF as downloadable file
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Generate resume error:', error);

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
        error: error instanceof Error ? error.message : 'Failed to generate resume',
      },
      { status: 500 }
    );
  }
}
