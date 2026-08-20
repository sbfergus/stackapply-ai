import { createAIProvider } from './providers';
import { decryptApiKey } from '../encryption';
import prisma from '../prisma';

export interface ParsedJobData {
  title: string;
  company: string;
  location: string;
  workSetting: 'REMOTE' | 'HYBRID' | 'IN_OFFICE';
  salaryMin?: number;
  salaryMax?: number;
  companyOverview: string;
  roleSummary: string;
  techStack: string[];
  benefits: string[];
  matchScore: number;
  matchReasoning: string;
}

/**
 * Parse job posting with dynamic key resolution
 */
export async function parseJobPosting(
  rawText: string,
  userId: string,
  userResumeText?: string
): Promise<ParsedJobData> {
  // 1. Fetch user's API key config
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      apiKeyProvider: true,
      apiKeyEncrypted: true,
      aiAnalysisCount: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let provider: ReturnType<typeof createAIProvider>;
  let shouldIncrementCount = false;

  // 2. Key Resolution Logic
  if (user.apiKeyProvider && user.apiKeyEncrypted) {
    // User has custom key - use it (unlimited)
    const decryptedKey = decryptApiKey(user.apiKeyEncrypted);
    provider = createAIProvider(user.apiKeyProvider, decryptedKey);
  } else {
    // No custom key - check free tier limit
    if (user.aiAnalysisCount >= 5) {
      throw new Error(
        'FREE_TIER_LIMIT_EXCEEDED: You have used all 5 free AI analyses. Please add your own API key in Account Settings to continue.'
      );
    }

    // Use system key with ultra-low-cost model
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (!systemKey) {
      throw new Error('System AI key not configured');
    }

    provider = createAIProvider('ANTHROPIC', systemKey);
    shouldIncrementCount = true;
  }

  // 3. Execute AI parsing
  const result = await provider.parseJobPosting(rawText, userResumeText);

  // 4. Increment usage counter if system key was used
  if (shouldIncrementCount) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiAnalysisCount: { increment: 1 } },
    });
  }

  return result;
}