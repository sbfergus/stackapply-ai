import { createAIProvider } from './providers';
import { decryptApiKey } from '../encryption';
import { prisma } from '../prisma';
import { buildComprehensiveProfile, formatProfileForAI } from './profile-builder';

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
 * Parse job posting with dynamic key resolution and comprehensive profile matching
 */
export async function parseJobPosting(
  rawText: string,
  userId: string
): Promise<ParsedJobData> {
  // Get free tier configuration from environment variables
  const FREE_TIER_LIMIT = parseInt(process.env.FREE_TIER_LIMIT || '5', 10);
  const FREE_TIER_MODEL = process.env.FREE_TIER_MODEL!;

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
    // User has custom key - use it (unlimited) with better model
    const decryptedKey = decryptApiKey(user.apiKeyEncrypted);
    const model = user.apiKeyProvider === 'ANTHROPIC' 
      ? 'claude-3-5-sonnet-latest'  // Better model for paying customers
      : undefined;                   // OpenAI uses default gpt-4o-mini
    provider = createAIProvider(user.apiKeyProvider, decryptedKey, model);
  } else {
    // No custom key - check free tier limit
    if (user.aiAnalysisCount >= FREE_TIER_LIMIT) {
      throw new Error(
        `FREE_TIER_LIMIT_EXCEEDED: You have used all ${FREE_TIER_LIMIT} free AI analyses. Please add your own API key in Account Settings to continue.`
      );
    }

    // Use system key with configured model
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (!systemKey) {
      throw new Error('System AI key not configured');
    }

    provider = createAIProvider('ANTHROPIC', systemKey, FREE_TIER_MODEL);
    shouldIncrementCount = true;
  }

  // 3. Build comprehensive user profile (combines resume + LinkedIn)
  const userProfile = await buildComprehensiveProfile(userId);
  const formattedProfile = formatProfileForAI(userProfile);

  // 4. Execute AI parsing with comprehensive profile
  const result = await provider.parseJobPosting(rawText, formattedProfile);

  // 5. Increment usage counter if system key was used
  if (shouldIncrementCount) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiAnalysisCount: { increment: 1 } },
    });
  }

  return result;
}