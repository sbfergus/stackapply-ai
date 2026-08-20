import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ExtensionAuthService } from '@/lib/extensionAuth';

/**
 * GET /api/user/usage/extension
 * Get user's API key usage data for browser extension
 * Uses JWT token authentication instead of NextAuth session
 */
export async function GET(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode JWT using ExtensionAuthService
    const decoded = await ExtensionAuthService.validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        apiKeyProvider: true,
        apiKeyEncrypted: true,
        aiAnalysisCount: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasKey = !!(user.apiKeyProvider && user.apiKeyEncrypted);
    const freeTierLimit = parseInt(process.env.FREE_TIER_LIMIT || '5', 10);
    const freeAnalysesRemaining = Math.max(0, freeTierLimit - user.aiAnalysisCount);

    return NextResponse.json({
      success: true,
      data: {
        hasKey,
        provider: user.apiKeyProvider,
        aiAnalysisCount: user.aiAnalysisCount,
        freeAnalysesRemaining,
        freeTierLimit,
      },
    });
  } catch (error) {
    console.error('GET /api/user/usage/extension failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
