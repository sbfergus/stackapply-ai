import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { createElement } from "react";
import { PasswordChangedEmail } from "@/emails/PasswordChangedEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * PUT /api/user/password
 * Update user password with current password verification
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, password: true },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Send password changed confirmation email (don't block response if email fails)
    const timestamp = new Date().toLocaleString('en-US', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
    });

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "StackApply <security@resend.dev>",
        to: session.user.email,
        subject: "Password Changed - StackApply",
        react: createElement(PasswordChangedEmail, { 
          userEmail: session.user.email,
          timestamp 
        }),
      });
    } catch (emailError) {
      console.error("Failed to send password changed email:", emailError);
      // Don't fail password update if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
