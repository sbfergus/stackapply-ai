import { createAIProvider } from './providers';
import { decryptApiKey } from '../encryption';
import { prisma } from '../prisma';
import { ParsedResume } from './parser';

interface GenerateResumeParams {
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  techStack: string[];
  parsedResume: ParsedResume;
}

/**
 * Generate a tailored resume based on the user's original resume and job requirements
 * Uses strict constraints to avoid AI detection patterns
 */
export async function generateTailoredResume(params: GenerateResumeParams): Promise<string> {
  const { userId, jobTitle, company, jobDescription, techStack, parsedResume } = params;

  // Get free tier configuration
  const FREE_TIER_LIMIT = parseInt(process.env.FREE_TIER_LIMIT || '5', 10);
  const FREE_TIER_MODEL = process.env.FREE_TIER_MODEL!;

  // Fetch user's API key config
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

  // Key Resolution Logic (same as job matching)
  if (user.apiKeyProvider && user.apiKeyEncrypted) {
    // BYOK: User has custom key
    const decryptedKey = decryptApiKey(user.apiKeyEncrypted);
    provider = createAIProvider(user.apiKeyProvider, decryptedKey, FREE_TIER_MODEL);
  } else {
    // Non-BYOK: Check free tier limit
    if (user.aiAnalysisCount >= FREE_TIER_LIMIT) {
      throw new Error(
        `FREE_TIER_LIMIT_EXCEEDED: You have used all ${FREE_TIER_LIMIT} free AI analyses. Please add your own API key in Account Settings to continue.`
      );
    }

    // Use system key
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (!systemKey) {
      throw new Error('System AI key not configured');
    }

    provider = createAIProvider('ANTHROPIC', systemKey, FREE_TIER_MODEL);
    shouldIncrementCount = true;
  }

  // Build the prompt with anti-AI-detection constraints
  const prompt = buildResumePrompt(parsedResume, jobTitle, company, jobDescription, techStack);

  // Generate tailored resume
  const tailoredResume = await provider.generateResume(prompt);

  // Increment usage counter if system key was used
  if (shouldIncrementCount) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiAnalysisCount: { increment: 1 } },
    });
  }

  return tailoredResume;
}

/**
 * Build the AI prompt with strict anti-detection constraints
 */
function buildResumePrompt(
  resume: ParsedResume,
  jobTitle: string,
  company: string,
  jobDescription: string,
  techStack: string[]
): string {
  return `You are a professional resume writer helping a job seeker tailor their resume for a specific position.

**ORIGINAL RESUME:**
Name: ${resume.name}
Email: ${resume.email || 'Not provided'}
Phone: ${resume.phone || 'Not provided'}
Location: ${resume.location || 'Not provided'}

Summary:
${resume.summary}

Experience:
${resume.experience.map((exp, i) => `
${i + 1}. ${exp.title} at ${exp.company}
   ${exp.dates}
   ${exp.description}
`).join('\n')}

Education:
${resume.education.map((edu, i) => `
${i + 1}. ${edu.degree} - ${edu.school}
   ${edu.dates}
`).join('\n')}

Skills:
${resume.skills.join(', ')}

${resume.certifications && resume.certifications.length > 0 ? `
Certifications:
${resume.certifications.map((cert, i) => `${i + 1}. ${cert.name} - ${cert.issuer} (${cert.date})`).join('\n')}
` : ''}

**TARGET JOB:**
Position: ${jobTitle}
Company: ${company}
Required Tech Stack: ${techStack.join(', ')}

Job Description:
${jobDescription}

**YOUR TASK:**
Rewrite this resume to be optimally tailored for the target job. Follow these STRICT RULES:

**CRITICAL ANTI-AI-DETECTION CONSTRAINTS:**
1. NO em dashes (—). Use hyphens (-) or commas instead.
2. NO corporate buzzwords: "synergy," "leverage," "paradigm," "disrupt," "innovative solutions," "best-in-class," "world-class," "cutting-edge"
3. NO AI giveaways: "robust," "streamline," "optimize," "spearheaded," "orchestrated," "facilitated," "utilized," "impactful," "collaborative," "dynamic"
4. Use simple, direct language. Prefer "led" over "spearheaded," "built" over "architected," "improved" over "optimized"
5. Vary sentence structure naturally. Humans don't write in perfect parallel structure.
6. Use contractions occasionally where appropriate
7. Include minor imperfections that make it human (e.g., slight inconsistencies in formatting, natural phrasing)

**CONTENT RULES:**
1. DO NOT fabricate, lie, or invent any information
2. Only include experiences, skills, and achievements from the original resume
3. Reorder and emphasize experiences that are most relevant to the target job
4. Reword bullet points to highlight skills matching the job requirements
5. If the user lacks a required skill, DO NOT add it - omit or downplay unrelated skills instead
6. Keep all dates, company names, job titles, and factual information exactly as provided
7. Maintain the user's authentic writing voice and style
8. Professional summary should be 2-3 sentences, natural and conversational

**FORMAT:**
Return the complete resume as plain text with clear sections. Use this structure:

[Name]
[Email] | [Phone] | [Location]

PROFESSIONAL SUMMARY
[2-3 sentences in natural, human tone]

EXPERIENCE
[Job Title] - [Company]
[Dates]
- [Bullet point highlighting relevant achievement]
- [Bullet point showing impact with numbers when possible]
- [Additional bullets as needed]

[Repeat for each relevant position]

EDUCATION
[Degree] - [School]
[Dates]

SKILLS
[Relevant skills, prioritized for this job]

${resume.certifications && resume.certifications.length > 0 ? 'CERTIFICATIONS\n[List relevant certifications]' : ''}

**REMEMBER:** Write like a human, not an AI. Be direct, authentic, and natural. No buzzwords, no em dashes, no "AI voice."`;
}
