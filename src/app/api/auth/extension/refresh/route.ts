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
 * POST /api/auth/extension/refresh
 * 
 * Refresh an extension JWT token before expiration to extend the session.
 * 
 * Requirements:
 * - Token must be valid and not expired
 * - Token must expire within 3 days to be eligible for refresh
 * - Returns new JWT token with fresh 30-day expiration
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   token: string,      // New JWT token
 *   expiresAt: string   // ISO 8601 timestamp
 * }
 * 
 * Error Responses:
 * - 401: Invalid token, expired token, or missing authorization header
 * - 403: Token not eligible for refresh (expires more than 3 days from now)
 * - 500: Server error
 */
export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.substring(7);

    // Validate existing token
    const decoded = await ExtensionAuthService.validateToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Check if token expires within 3 days
    const now = Date.now();
    const expiresAt = decoded.exp * 1000; // Convert to milliseconds
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry > 3) {
      return NextResponse.json(
        { error: "Token not eligible for refresh. Token must expire within 3 days." },
        { status: 403, headers: corsHeaders() }
      );
    }

    if (daysUntilExpiry <= 0) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Get user data for new token
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Delete old session
    await prisma.extensionSession.delete({
      where: { token: decoded.jti }
    });

    // Generate new JWT token with fresh 30-day expiration
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const newToken = await ExtensionAuthService.generateToken(
      {
        userId: user.id,
        email: user.email
      },
      decoded.type,
      ipAddress,
      userAgent
    );

    // Calculate new expiration timestamp
    const newExpiresAt = new Date(now + (30 * 24 * 60 * 60 * 1000));

    return NextResponse.json(
      {
        success: true,
        token: newToken,
        expiresAt: newExpiresAt.toISOString()
      },
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
