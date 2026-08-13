import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, note } = body;

    const existingJob = await prisma.job.findUnique({
      where: { id },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const updateData: { status?: JobStatus; notes?: string } = {};

    if (status) {
      // Map directly through the Prisma JobStatus enum object
      const enumValue = JobStatus[status as keyof typeof JobStatus];
      if (enumValue) {
        updateData.status = enumValue;
      } else {
        return NextResponse.json(
          { error: `Invalid status enum: ${status}` },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    if (note !== undefined) {
      updateData.notes = note;
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { success: true, job: updatedJob },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error("PATCH /api/jobs/[id] failed:", error);
    return NextResponse.json(
      {
        error: "Failed to update job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}