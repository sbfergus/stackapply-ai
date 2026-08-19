import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { resend } from "@/lib/resend";
import { WelcomeEmail } from "@/emails/WelcomeEmail";

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: fullName || null,
      },
    });

    // Send welcome email (don't block signup if email fails)
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "StackApply <onboarding@resend.dev>",
        to: email,
        subject: "Welcome to StackApply! 🎉",
        react: WelcomeEmail({ userEmail: email }),
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail signup if email fails
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
