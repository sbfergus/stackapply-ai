import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExtensionAuthService } from "@/lib/extensionAuth";
import bcrypt from "bcryptjs";

/**
 * CORS headers for extension requests
 */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/auth/extension/guest
 * 
 * Authenticates user as guest for testing/demo purposes
 * Finds or creates the demo user account (demo@stackapply.ai)
 * 
 * Request body: None required
 * 
 * Success response (200):
 * - success: true
 * - token: string (JWT token with "guest" type)
 * - user: { id, email: "demo@stackapply.ai", fullName: "Demo User" }
 * 
 * Error responses:
 * - 500: Server error
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
export async function POST(req: NextRequest) {
  try {
    const DEMO_EMAIL = "demo@stackapply.ai";
    const DEMO_NAME = "Demo User";

    // Find or create demo user
    let demoUser = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
    });

    if (!demoUser) {
      // Create demo user with a secure random password (not meant to be used for login)
      const randomPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-16),
        10
      );

      demoUser = await prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          fullName: DEMO_NAME,
          password: randomPassword,
        },
      });
    }

    // Extract IP address and user agent for audit logging
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    // Generate JWT token with "guest" type claim
    const token = await ExtensionAuthService.generateToken(
      {
        userId: demoUser.id,
        email: demoUser.email,
      },
      "guest", // Marks this as a guest token
      ipAddress,
      userAgent
    );

    // Return token and guest user data
    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: demoUser.id,
          email: demoUser.email,
          fullName: demoUser.fullName,
        },
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Guest mode error:", error);
    return NextResponse.json(
      { error: "Failed to activate guest mode" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
