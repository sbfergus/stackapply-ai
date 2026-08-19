import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

/**
 * POST /api/user/resume
 * Upload user resume PDF
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("resume") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (PDF only)
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, resumeUrl: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete old resume if exists
    if (user.resumeUrl) {
      try {
        await del(user.resumeUrl);
      } catch (error) {
        console.error("Failed to delete old resume:", error);
        // Continue even if delete fails
      }
    }

    // Upload new resume to Vercel Blob
    const blob = await put(`resumes/${user.id}-${Date.now()}.pdf`, file, {
      access: "public",
    });

    // Update user record with new resume URL
    await prisma.user.update({
      where: { id: user.id },
      data: { resumeUrl: blob.url },
    });

    return NextResponse.json({
      success: true,
      resumeUrl: blob.url,
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload resume" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/resume
 * Delete user resume
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, resumeUrl: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.resumeUrl) {
      return NextResponse.json(
        { error: "No resume to delete" },
        { status: 404 }
      );
    }

    // Delete from Vercel Blob
    try {
      await del(user.resumeUrl);
    } catch (error) {
      console.error("Failed to delete resume from storage:", error);
    }

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: { resumeUrl: null },
    });

    return NextResponse.json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (error) {
    console.error("Resume deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete resume" },
      { status: 500 }
    );
  }
}
