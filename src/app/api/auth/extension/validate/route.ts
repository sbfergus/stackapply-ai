import { NextRequest, NextResponse } from "next/server";
import { ExtensionAuthService } from "@/lib/extensionAuth";
import { prisma } from "@/lib/prisma";

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
 * POST /api/auth/extension/validate
 * Validate an existing JWT token on extension startup or during active use
 * 
 * Requirements: 5.3, 5.4, 5.5, 11.2, 11.3
 * 
 * This endpoint:
 * 1. Extracts token from Authorization header (Bearer format)
 * 2. Verifies JWT signature and expiration with ExtensionAuthService
 * 3. Checks ExtensionSession exists and is not expired
 * 4. Updates lastUsedAt timestamp
 * 5. Returns user data and expiration info
 */
export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header (Bearer format)
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Extract token after "Bearer " prefix
    const token = authHeader.substring(7);

    if (!token) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Verify JWT signature and expiration, check session exists
    // This also updates lastUsedAt timestamp
    const decoded = await ExtensionAuthService.validateToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Fetch user data from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Session revoked" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Fetch session to get expiration info
    const session = await prisma.extensionSession.findUnique({
      where: { token: decoded.jti },
      select: {
        expiresAt: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session revoked" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Return success with user data and expiration info
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        expiresAt: session.expiresAt.toISOString(),
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error("POST /api/auth/extension/validate failed:", error);
    return NextResponse.json(
      {
        error: "Failed to validate token",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
