import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/usage - Get user's AI usage stats
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiAnalysisCount: true,
        apiKeyEncrypted: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const freeAnalysesRemaining = Math.max(0, 5 - user.aiAnalysisCount);
    const hasCustomKey = !!user.apiKeyEncrypted;

    return NextResponse.json({
      success: true,
      data: {
        aiAnalysisCount: user.aiAnalysisCount,
        freeAnalysesRemaining,
        hasCustomKey,
      },
    });
  } catch (error) {
    console.error('GET /api/user/usage failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
