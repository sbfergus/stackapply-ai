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
1. Professional summary: 2-3 sentences, 50-60 words total, focused on job requirements
2. INCLUDE ALL EXPERIENCE from the original resume - prioritize and expand relevant positions
3. Most relevant position: 4-6 bullet points (each 1 line max)
4. Second position: 3-4 bullet points
5. Additional positions: 2-3 bullets each (condense less relevant ones)
6. Each bullet should be close to one full line (12-18 words for good fill)
7. Skills: Single line, comma-separated, include all relevant skills (12-15 skills)
8. Education: Include ALL education entries from original resume
9. Certifications: Include ALL certifications from original resume
10. PRIORITY ORDER: Summary > Experience (all positions) > Education (all entries) > Skills > Certifications (all)
11. The goal is to FILL THE PAGE by including all content, prioritizing and expanding the most relevant items

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
2. Include ALL experiences, education, skills, and certifications from the original resume
3. PRIORITIZE by RELEVANCE - reorder to put most job-relevant content first and expand it
4. Reword bullet points using the job posting's EXACT terminology and language
5. If the user lacks a required skill, DO NOT add it - focus on highlighting related strengths
6. Keep all dates, company names, job titles, and factual information exactly as provided
7. Maintain the user's authentic writing voice while aligning with job language
8. Professional summary: 2-3 sentences, 50-60 words, focused on matching job requirements
9. EXPAND relevant positions with more detailed bullets; CONDENSE less relevant ones
10. Eliminate weak passive verbs; use strong action verbs that show ownership and impact
11. Each bullet point should be close to one full line (12-18 words for optimal page fill)
12. Prioritize bullets with measurable results (%, $, numbers, time, scale)
13. CERTIFICATIONS: Include ALL certifications - if dates exist in original, include them; if not, omit dates
14. EDUCATION: Include ALL education entries from original resume

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

[Include ALL positions from original resume]
[Most relevant positions get 4-6 bullets with detail, less relevant get 2-3 condensed bullets]

EDUCATION
[Degree] - [School] [Dates]

[Include ALL education entries from original resume]
[List all degrees, bootcamps, certifications programs, etc.]

SKILLS
[Single comma-separated line with 12-15 relevant skills, prioritizing exact terminology from job posting]

${resume.certifications && resume.certifications.length > 0 ? `CERTIFICATIONS
[Certification Name] - [Issuing Organization] [Date if available]

MANDATORY INSTRUCTIONS FOR CERTIFICATIONS:
1. Include ALL certifications from the original resume
2. If the original certification has a date in parentheses: extract and place at END of line without parentheses
3. If the original certification has NO date: omit the date (do not invent one)
4. Format WITH date: [Name] - [Issuer] [Date]
5. Format WITHOUT date: [Name] - [Issuer]

EXAMPLES:
- If original has date: "React: Testing and Debugging - LinkedIn Learning (March 2024)" → "React: Testing and Debugging - LinkedIn Learning March 2024"
- If original has NO date: "JavaScript: Under the Hood" → "JavaScript: Under the Hood - LinkedIn Learning"` : ''}

**CERTIFICATION FORMAT EXAMPLE:**
React: Testing and Debugging - LinkedIn Learning March 2024
AWS Certified Solutions Architect - Amazon Web Services June 2023
Google Analytics Individual Qualification - Google
CSS Layouts: From Float to Flexbox and Grid - Udemy

(Note: Some certifications have dates, some don't - include dates only when present in original resume)

**CRITICAL CERTIFICATION FORMATTING RULE:**
- If original certification includes date in parentheses: Move date to end, remove parentheses
- If original certification has NO date: List without date
- DO NOT invent dates that don't exist
Example transformations:
- With date: "React: Testing and Debugging - LinkedIn Learning (March 2024)" → "React: Testing and Debugging - LinkedIn Learning March 2024"
- Without date: "CSS Layouts - Udemy" → "CSS Layouts: From Float to Flexbox and Grid - Udemy"

**EDUCATION FORMAT EXAMPLE:**
Bachelor's Degree, Computer Science - State University of New York at Buffalo 2018 - 2022
Web Development Bootcamp - General Assembly 2023

**EXPERIENCE FORMAT EXAMPLE:**
Senior Software Engineer - Tech Company November 2022 - Present
Lead Developer - Startup Inc January 2021 - November 2022

[NOTE: Dates appear at the END of the line for right-alignment in PDF for Experience, Education, and Certifications]
[IMPORTANT: ALL certifications MUST include dates - if original resume lacks certification dates, use the date from the original resume or mark as "Completed" with no specific date]

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
- Target filling 90-100% of the page with content
- Use the job posting's EXACT language and terminology throughout
- Include ALL positions, education, and certifications from original resume
- PRIORITIZE by relevance - most relevant content gets expanded, less relevant gets condensed
- Every bullet should start with a strong action verb
- NO fabrication - only include genuine experiences from the original resume
- ATS-FRIENDLY OUTPUT: Plain text only, no columns, no tables, no special symbols, single-column layout
- Certification dates: include ONLY if present in original resume data
- DO NOT invent or add dates that don't exist in original resume
- Fill the page by including all content with strategic prioritization

**REMEMBER:** Write like a human, not an AI. Be direct, authentic, and strategic. Mirror the job posting's language naturally. No buzzwords, no em dashes, no overused AI verbs. Output must be ATS-parseable plain text. Use ALL available content from the original resume to create a complete, impressive one-page resume that fills the entire page.`;
}
