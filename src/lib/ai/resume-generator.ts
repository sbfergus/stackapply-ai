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
  matchReasoning?: string | null;
  matchScore?: number | null;
}

/**
 * Generate a tailored resume based on the user's original resume and job requirements
 * Uses strict constraints to avoid AI detection patterns
 */
export async function generateTailoredResume(params: GenerateResumeParams): Promise<string> {
  const { userId, jobTitle, company, jobDescription, techStack, parsedResume, matchReasoning, matchScore } = params;

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
  const prompt = buildResumePrompt(parsedResume, jobTitle, company, jobDescription, techStack, matchReasoning, matchScore);

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
  techStack: string[],
  matchReasoning?: string | null,
  matchScore?: number | null
): string {
  const matchAnalysisSection = matchReasoning ? `

**MATCH ANALYSIS (Use this to guide your tailoring):**
Match Score: ${matchScore}%
Analysis: ${matchReasoning}

CRITICAL: Use this analysis to:
- Emphasize the skills and experiences that contributed to the high match score
- Reorder bullet points to highlight relevant achievements FIRST
- Use similar language and keywords from the job description
- Focus on compensating strengths for any gaps identified
- DO NOT add skills or experiences not in the original resume
` : `

**NOTE:** No match analysis available. Tailor the resume based on the job description and required tech stack.
`;

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
${matchAnalysisSection}

**YOUR TASK:**
Rewrite this resume to be optimally tailored for the target job. Follow these STRICT RULES:

**PROFESSIONAL RESUME TAILORING METHODOLOGY:**

1. RELEVANCE SCORING & PRIORITIZATION:
   - Rank every bullet point from the original resume against the job description requirements
   - Retain and EXPAND top-ranking bullets with more detail and impact
   - Condense or DROP bottom-ranking bullets that don't align with the job
   - Prioritize bullets containing hard metrics (%, $, numbers, time saved)

2. TERMINOLOGY ALIGNMENT:
   - Use the EXACT terminology from the job posting
   - Replace synonyms with the job posting's language (e.g., if posting says "account management", use that instead of "client management")
   - Mirror key phrases and technical terms from the job description
   - Match the job posting's vocabulary and industry jargon

3. SUMMARY & HEADLINE REWRITE:
   - Rewrite the professional summary to reflect 2-3 CORE requirements from the job posting
   - Use the job posting's title as the primary focus
   - Position the candidate as a perfect fit for THIS specific role

4. STRONG ACTION VERBS:
   - Eliminate weak verbs: "Responsible for", "Helped with", "Assisted in", "Worked on", "Involved in"
   - Replace with strong, directional action verbs that show ownership and impact
   - Examples: "Built", "Led", "Engineered", "Designed", "Delivered", "Drove", "Increased", "Reduced"
   - Vary verb choice - don't repeat the same verb across bullets

5. NO FABRICATION - GAP HANDLING:
   - If a required skill is COMPLETELY MISSING from the user's resume, DO NOT invent it
   - DO NOT add skills, experiences, or achievements that don't exist
   - Focus on highlighting transferable skills and relevant experiences that DO exist
   - If major gaps exist, emphasize compensating strengths

**ONE-PAGE CONSTRAINT:**
This resume MUST fill the entire page while staying within one page. Balance is key:
1. Professional summary: EXACTLY 2-3 sentences, 50-60 words total, focused on job requirements
2. Most recent/relevant position: 4-5 bullet points (each 1 line max)
3. Second position: 3-4 bullet points
4. Third position (if relevant): 2-3 bullet points
5. Older positions (5+ years ago): Include ONLY if there's space after certifications (1-2 bullets)
6. Each bullet should be close to one full line (12-18 words for good fill)
7. Skills: Single line, comma-separated, include all relevant skills (12-15 skills)
8. Certifications: ALWAYS include - this section is REQUIRED if certifications exist
9. PRIORITY ORDER: Summary > Recent Experience > Education > Certifications > Skills > Older Experience
10. The goal is to FILL the page with the MOST RELEVANT content while ensuring certifications appear

**CRITICAL ANTI-AI-DETECTION CONSTRAINTS:**
1. NO em dashes (—). Use hyphens (-) or commas instead.
2. NO corporate buzzwords: "synergy," "leverage," "paradigm," "disrupt," "innovative solutions," "best-in-class," "world-class," "cutting-edge"
3. NO overused AI verbs: "spearheaded," "orchestrated," "facilitated," "utilized"
4. PREFER direct, powerful verbs: "built," "led," "designed," "delivered," "engineered," "created," "drove," "increased," "reduced," "launched," "shipped"
5. Use simple, direct language that sounds human and authentic
6. Vary sentence structure naturally - humans don't write in perfect parallel structure
7. Use contractions occasionally where appropriate
8. Include minor stylistic variations that make it human

**CONTENT RULES:**
1. DO NOT fabricate, lie, or invent any information
2. Only include experiences, skills, and achievements from the original resume
3. RANK and PRIORITIZE experiences based on relevance to the job posting
4. Reword bullet points using the job posting's EXACT terminology and language
5. If the user lacks a required skill, DO NOT add it - focus on highlighting related strengths
6. Keep all dates, company names, job titles, and factual information exactly as provided
7. Maintain the user's authentic writing voice while aligning with job language
8. Professional summary: 2-3 sentences, 50-60 words, focused on matching job requirements
9. FILL THE PAGE - include more positions and bullets to utilize space effectively
10. Eliminate weak passive verbs; use strong action verbs that show ownership and impact
11. Each bullet point should be close to one full line (12-18 words for optimal page fill)
12. Prioritize bullets with measurable results (%, $, numbers, time, scale)

**FORMAT:**
Return the complete resume as plain text with clear sections. Use this EXACT structure:

**ATS-FRIENDLY FORMATTING RULES:**
- Use ONLY plain text with simple line breaks
- NO columns, tables, or complex layouts
- NO special characters or non-standard symbols (only use: - | , . @ # + ( ))
- NO boxes, borders, or graphic elements
- Single-column layout only
- Standard bullet points using hyphens (-)
- Simple section headers in ALL CAPS

[Name]
[Email] | [Phone] | [Location]

PROFESSIONAL SUMMARY
[2-3 sentences tailored to match the job title and core requirements, 50-60 words]

EXPERIENCE
[Job Title] - [Company] [Dates]
- [Bullet with measurable impact using job posting terminology, 12-18 words]
- [Bullet with technical skills matching job requirements, 12-18 words]
- [Bullet with quantifiable result (%, $, numbers), 12-18 words]
- [Additional bullets ranked by relevance to job posting]

[Include 2-3 positions to fill the page - prioritize those most relevant to the job]

EDUCATION
[Degree] - [School] [Dates]

[If applicable: Second degree or bootcamp/certificate program]
[Program] - [Institution] [Dates]

SKILLS
[Single comma-separated line with 12-15 relevant skills, prioritizing exact terminology from job posting]

${resume.certifications && resume.certifications.length > 0 ? `CERTIFICATIONS
[Certification Name] - [Issuing Organization] [Date]
[Include all relevant certifications with complete information: name, issuer, date right-aligned]` : ''}

**CERTIFICATION FORMAT EXAMPLE:**
AWS Certified Solutions Architect - Amazon Web Services June 2023
React Testing and Debugging - LinkedIn Learning March 2024

**EDUCATION FORMAT EXAMPLE:**
Bachelor's Degree, Computer Science - State University of New York at Buffalo 2018 - 2022
Web Development Bootcamp - General Assembly 2023

**EXPERIENCE FORMAT EXAMPLE:**
Senior Software Engineer - Tech Company November 2022 - Present
Lead Developer - Startup Inc January 2021 - November 2022

[NOTE: Dates appear at the END of the line for right-alignment in PDF for Experience, Education, and Certifications]

**ACTION VERB EXAMPLES:**
✓ STRONG: Built, Led, Engineered, Designed, Delivered, Drove, Increased, Reduced, Launched, Shipped, Created, Developed
✗ WEAK: Responsible for, Helped with, Assisted in, Worked on, Involved in, Participated in
✗ OVERUSED AI: Spearheaded, Orchestrated, Facilitated, Utilized, Leveraged

**BULLET POINT EXAMPLES:**
✓ GOOD (with metrics + job terminology): "Engineered React components for checkout flow using TypeScript, reducing cart abandonment by 12%"
✓ GOOD (relevance + impact): "Led migration from legacy backend to GraphQL API, improving page load times by 40%"
✗ WEAK (no action): "Responsible for building React components and managing the frontend codebase"
✗ TOO SHORT: "Built checkout flow"

**TAILORING CHECKLIST:**
- Professional summary mentions the target job title and core requirements
- Bullet points use terminology from the job posting (not generic synonyms)
- Top-ranked relevant bullets are expanded with more detail
- Less relevant bullets are condensed or removed
- Strong action verbs replace weak passive language
- Measurable results are prioritized and highlighted
- Skills section mirrors job posting's required technologies

**CRITICAL:** 
- Target filling 85-95% of the page with content
- Use the job posting's EXACT language and terminology throughout
- Rank bullets by relevance; expand top ones, cut bottom ones
- Every bullet should start with a strong action verb
- NO fabrication - only include genuine experiences from the original resume
- ATS-FRIENDLY OUTPUT: Plain text only, no columns, no tables, no special symbols, single-column layout
- ALWAYS include certifications section if certifications exist - adjust experience bullets to make room
- Education dates should appear at the END of each education line for right-alignment

**REMEMBER:** Write like a human, not an AI. Be direct, authentic, and strategic. Mirror the job posting's language naturally. No buzzwords, no em dashes, no overused AI verbs. Output must be ATS-parseable plain text. Prioritize showing certifications over including 4+ work positions.`;
}
