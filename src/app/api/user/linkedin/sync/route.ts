import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ExtensionAuthService } from '@/lib/extensionAuth';

/**
 * POST /api/user/linkedin/sync
 * Save or update user's LinkedIn profile data
 */
export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await ExtensionAuthService.validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json();
    const { linkedinData, linkedinUrl } = body;

    if (!linkedinData) {
      return NextResponse.json(
        { error: 'LinkedIn data is required' },
        { status: 400 }
      );
    }

    // Update user with LinkedIn profile data
    const user = await prisma.user.update({
      where: { id: decoded.sub },
      data: {
        linkedinData,
        linkedinUrl,
        linkedinSyncedAt: new Date(),
      },
      select: {
        id: true,
        linkedinSyncedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'LinkedIn profile synced successfully',
      data: {
        syncedAt: user.linkedinSyncedAt,
      },
    });
  } catch (error) {
    console.error('POST /api/user/linkedin/sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to sync LinkedIn profile' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/linkedin/sync
 * Get LinkedIn profile sync status
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await ExtensionAuthService.validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        linkedinData: true,
        linkedinSyncedAt: true,
        linkedinUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        hasSynced: !!user.linkedinData,
        syncedAt: user.linkedinSyncedAt,
        linkedinUrl: user.linkedinUrl,
      },
    });
  } catch (error) {
    console.error('GET /api/user/linkedin/sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
