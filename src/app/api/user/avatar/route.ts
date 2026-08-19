import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Get current user to check for existing avatar
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Delete old avatar if exists (and it's a Blob URL, not a default)
    if (user.avatarUrl && user.avatarUrl.includes("blob.vercel-storage.com")) {
      try {
        await del(user.avatarUrl);
      } catch (error) {
        console.error("Error deleting old avatar:", error);
      }
    }

    // Upload new avatar to Vercel Blob (using private access since store is private)
    const blob = await put(`avatars/${user.id}-${Date.now()}.${file.name.split(".").pop()}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: blob.url },
      select: { avatarUrl: true },
    });

    return NextResponse.json({
      success: true,
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload avatar";
    return NextResponse.json(
      { success: false, error: errorMessage, details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Delete avatar from Vercel Blob if URL exists
    if (user.avatarUrl && user.avatarUrl.includes("blob.vercel-storage.com")) {
      try {
        await del(user.avatarUrl);
      } catch (error) {
        console.error("Error deleting avatar:", error);
      }
    }

    // Remove avatar URL from database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Avatar deletion error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
