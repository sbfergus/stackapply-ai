import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/check-linkedin?email=user@example.com
 * Check LinkedIn profile data for a user (admin/debug endpoint)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        fullName: true,
        linkedinData: true,
        linkedinSyncedAt: true,
        linkedinUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: `User not found: ${email}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        linkedinUrl: user.linkedinUrl,
        linkedinSyncedAt: user.linkedinSyncedAt,
        hasSynced: !!user.linkedinData,
        linkedinData: user.linkedinData,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/check-linkedin failed:', error);
    return NextResponse.json(
      { error: 'Failed to check LinkedIn data' },
      { status: 500 }
    );
  }
}
