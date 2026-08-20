import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/encryption';
import { createAIProvider } from '@/lib/ai/providers';
import { ApiKeyProvider } from '@prisma/client';

// GET /api/user/api-key - Get user's API key status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    let keyMasked = '';
    if (hasKey && user.apiKeyEncrypted) {
      try {
        const decrypted = decryptApiKey(user.apiKeyEncrypted);
        keyMasked = maskApiKey(decrypted);
      } catch (error) {
        console.error('Failed to decrypt key for masking:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        hasKey,
        provider: user.apiKeyProvider,
        keyMasked,
        aiAnalysisCount: user.aiAnalysisCount,
        freeAnalysesRemaining,
        freeTierLimit,
      },
    });
  } catch (error) {
    console.error('GET /api/user/api-key failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key status' },
      { status: 500 }
    );
  }
}

// POST /api/user/api-key - Save/update user's API key
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Validate provider
    if (provider !== 'ANTHROPIC' && provider !== 'OPENAI') {
      return NextResponse.json(
        { error: 'Invalid provider. Must be ANTHROPIC or OPENAI' },
        { status: 400 }
      );
    }

    // Auto-detect provider from key format if needed
    let detectedProvider: ApiKeyProvider = provider;
    if (apiKey.startsWith('sk-ant-')) {
      detectedProvider = ApiKeyProvider.ANTHROPIC;
    } else if (apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-')) {
      detectedProvider = ApiKeyProvider.OPENAI;
    }

    // Skip validation for test keys (development only)
    const isTestKey = apiKey.startsWith('sk-test-') || 
                      apiKey === 'sk-test-anthropic-fake-key' || 
                      apiKey === 'sk-test-openai-fake-key';

    // Test the API key (skip for test keys)
    if (!isTestKey) {
      try {
        const testProvider = createAIProvider(detectedProvider, apiKey);
        const isValid = await testProvider.testConnection();

        if (!isValid) {
          return NextResponse.json(
            { error: 'API key validation failed. Please check your key and try again.' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('API key test failed:', error);
        return NextResponse.json(
          {
            error: 'Could not validate API key. Please verify it is correct and has sufficient credits.',
          },
          { status: 400 }
        );
      }
    } else {
      console.log('⚠️  Development mode: Skipping API key validation for test key');
    }

    // Encrypt and save
    const encrypted = encryptApiKey(apiKey);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiKeyProvider: detectedProvider,
        apiKeyEncrypted: encrypted,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'API key saved successfully',
      data: {
        provider: detectedProvider,
        keyMasked: maskApiKey(apiKey),
        validatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /api/user/api-key failed:', error);
    return NextResponse.json(
      { error: 'Failed to save API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/user/api-key - Remove user's API key
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiKeyProvider: null,
        apiKeyEncrypted: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'API key removed successfully',
    });
  } catch (error) {
    console.error('DELETE /api/user/api-key failed:', error);
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 }
    );
  }
}
