import { NextRequest, NextResponse } from "next/server";
import { ExtensionAuthService } from "@/lib/extensionAuth";

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
 * POST /api/auth/extension/signout
 * 
 * Revokes extension session and invalidates token
 * 
 * Request headers:
 * - Authorization: Bearer <token> (required)
 * 
 * Success response (200):
 * - success: true
 * - message: "Signed out successfully"
 * 
 * Error responses:
 * - 401: Invalid or missing token
 * - 500: Server error
 * 
 * Requirements: 9.1, 9.2, 9.6
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

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate and revoke token - this deletes the ExtensionSession record
    const revoked = await ExtensionAuthService.revokeToken(token);

    if (!revoked) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Return success confirmation
    return NextResponse.json(
      {
        success: true,
        message: "Signed out successfully",
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Sign-out error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
