import { createAIProvider } from './providers';
import { decryptApiKey } from '../encryption';
import { prisma } from '../prisma';

export interface ParsedResume {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    dates: string;
  }>;
  skills: string[];
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
}

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
 * Parse resume PDF and extract structured data using AI
 */
export async function parseResumePDF(
  resumeUrl: string,
  userId: string
): Promise<ParsedResume> {
  // Use the same model as job matching (Haiku supports PDFs)
  const FREE_TIER_MODEL = process.env.FREE_TIER_MODEL!;

  // Fetch user's API key config
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      apiKeyProvider: true,
      apiKeyEncrypted: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Determine which AI provider to use
  let provider: ReturnType<typeof createAIProvider>;

  if (user.apiKeyProvider && user.apiKeyEncrypted) {
    // BYOK: User has custom key - use THEIR key for PDF parsing
    const decryptedKey = decryptApiKey(user.apiKeyEncrypted);
    
    if (user.apiKeyProvider === 'ANTHROPIC') {
      provider = createAIProvider('ANTHROPIC', decryptedKey, FREE_TIER_MODEL);
    } else {
      throw new Error('OpenAI does not support PDF parsing. Please use Anthropic API key or upload a different format.');
    }
  } else {
    // Non-BYOK: Use system key for PDF parsing
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (!systemKey) {
      throw new Error('System AI key not configured');
    }
    provider = createAIProvider('ANTHROPIC', systemKey, FREE_TIER_MODEL);
  }

  // Download PDF from blob storage
  const response = await fetch(resumeUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch resume PDF: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');

  // Parse resume with AI
  const parsedResume = await provider.parseResume(base64);

  return parsedResume;
}

/**
 * Format parsed resume as readable text for AI analysis
 */
export function formatResumeForAI(resume: ParsedResume): string {
  const sections: string[] = [];

  // Header
  sections.push(`=== CANDIDATE PROFILE ===\n`);
  sections.push(`Name: ${resume.name}`);
  if (resume.email) sections.push(`Email: ${resume.email}`);
  if (resume.phone) sections.push(`Phone: ${resume.phone}`);
  if (resume.location) sections.push(`Location: ${resume.location}`);
  sections.push('');

  // Professional Summary
  if (resume.summary) {
    sections.push(`=== PROFESSIONAL SUMMARY ===`);
    sections.push(resume.summary);
    sections.push('');
  }

  // Experience
  if (resume.experience.length > 0) {
    sections.push(`=== WORK EXPERIENCE ===`);
    resume.experience.forEach((exp, i) => {
      sections.push(`\n${i + 1}. ${exp.title} at ${exp.company}`);
      if (exp.dates) sections.push(`   ${exp.dates}`);
      if (exp.description) sections.push(`   ${exp.description}`);
    });
    sections.push('');
  }

  // Education
  if (resume.education.length > 0) {
    sections.push(`=== EDUCATION ===`);
    resume.education.forEach((edu, i) => {
      sections.push(`${i + 1}. ${edu.school}`);
      if (edu.degree) sections.push(`   ${edu.degree}`);
      if (edu.dates) sections.push(`   ${edu.dates}`);
    });
    sections.push('');
  }

  // Skills
  if (resume.skills.length > 0) {
    sections.push(`=== SKILLS ===`);
    sections.push(resume.skills.join(', '));
    sections.push('');
  }

  // Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    sections.push(`=== CERTIFICATIONS ===`);
    resume.certifications.forEach((cert, i) => {
      sections.push(`${i + 1}. ${cert.name}`);
      if (cert.issuer) sections.push(`   Issuer: ${cert.issuer}`);
      if (cert.date) sections.push(`   Date: ${cert.date}`);
    });
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Parse job posting with dynamic key resolution and resume-based matching
 */
export async function parseJobPosting(
  rawText: string,
  userId: string
): Promise<ParsedJobData> {
  // Get free tier configuration from environment variables
  const FREE_TIER_LIMIT = parseInt(process.env.FREE_TIER_LIMIT || '5', 10);
  const FREE_TIER_MODEL = process.env.FREE_TIER_MODEL!;

  // 1. Fetch user's API key config and resume data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      apiKeyProvider: true,
      apiKeyEncrypted: true,
      aiAnalysisCount: true,
      resumeUrl: true,
      parsedResume: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.resumeUrl) {
    throw new Error('No resume uploaded. Please upload your resume in Account Settings.');
  }

  let provider: ReturnType<typeof createAIProvider>;
  let shouldIncrementCount = false;

  // 2. Key Resolution Logic
  if (user.apiKeyProvider && user.apiKeyEncrypted) {
    // BYOK: User has custom key - use THEIR key with FREE_TIER_MODEL
    const decryptedKey = decryptApiKey(user.apiKeyEncrypted);
    provider = createAIProvider(user.apiKeyProvider, decryptedKey, FREE_TIER_MODEL);
  } else {
    // Non-BYOK: Check free tier limit
    if (user.aiAnalysisCount >= FREE_TIER_LIMIT) {
      throw new Error(
        `FREE_TIER_LIMIT_EXCEEDED: You have used all ${FREE_TIER_LIMIT} free AI analyses. Please add your own API key in Account Settings to continue.`
      );
    }

    // Use system key with FREE_TIER_MODEL
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (!systemKey) {
      throw new Error('System AI key not configured');
    }

    provider = createAIProvider('ANTHROPIC', systemKey, FREE_TIER_MODEL);
    shouldIncrementCount = true;
  }

  // 3. Get or use cached parsed resume
  let parsedResume: ParsedResume;
  
  if (user.parsedResume && typeof user.parsedResume === 'object' && user.parsedResume !== null) {
    // Use cached parsed resume
    parsedResume = user.parsedResume as unknown as ParsedResume;
  } else {
    // This shouldn't happen as parsing should occur in calculate-match endpoint
    // But as a fallback, we'll parse here
    console.log('No cached parsedResume found, parsing now...');
    parsedResume = await parseResumePDF(user.resumeUrl, userId);
  }

  const formattedProfile = formatResumeForAI(parsedResume);

  // 4. Execute AI parsing with resume profile
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