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
   - Evaluate EACH position from the original resume against the job requirements
   - INCLUDE only the 2-4 positions that are MOST RELEVANT to this specific job
   - EXCLUDE positions that are:
     * More than 10 years old (unless exceptionally relevant)
     * In a completely different field/industry
     * Don't strengthen the application for this target role
   - Within included positions, rank and prioritize bullets by relevance
   - Expand top-ranking bullets with more detail and impact
   - Each bullet must show how the experience maps to a specific job requirement

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
This resume MUST fit completely on one page with all sections visible. Critical requirements:
1. Professional summary: 2-3 sentences, 50-60 words total, focused on job requirements
2. SELECTIVE INCLUSION: Include only the 2-3 positions MOST RELEVANT to the target job
3. DO NOT include positions older than 10 years or in completely different fields
4. Most relevant position: 5-6 bullet points tailored to job posting language
5. Second relevant position: 4-5 bullet points tailored to job posting
6. Third position (if highly relevant and space allows): 3-4 bullet points
7. Each bullet should be close to a full line (14-20 words for better page fill)
8. Education: Include all relevant education entries (1-2 lines each with dates right-aligned)
9. Skills: MUST appear - single line with all relevant skills (aim for 12-15 skills)
10. Certifications: MUST appear - include all relevant certifications (aim for 3-6 entries)
11. SPACING: Use bullet points generously to fill white space and create complete-looking resume
12. MANDATORY: All sections (Summary, Experience, Education, Skills, Certifications) must fit on one page
13. Target: Fill 85-95% of page - should look complete but not cramped

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
2. SELECTIVELY include only the 2-3 most job-relevant positions
3. DO NOT include positions more than 10 years old unless exceptionally relevant
4. DO NOT include positions in completely different fields (e.g., mechanical engineering for software role)
5. Reword EVERY bullet point to use the job posting's EXACT terminology and requirements
6. Each bullet must demonstrate how the experience matches a specific job requirement
7. If the user lacks a required skill, DO NOT add it - emphasize transferable skills instead
8. Keep all dates, company names, job titles, and factual information exactly as provided
9. Professional summary: 2-3 sentences mirroring the job title and core requirements
10. TAILOR everything - summary, bullets, skills - to match the job posting's language
11. Use strong action verbs that align with job posting's tone
12. Each bullet point should be close to full line width (14-20 words for better page fill)
13. Include measurable results where possible (%, $, numbers, time, scale)
14. Education: Include all relevant education entries
15. Skills: Include comprehensive list of relevant skills (12-15 skills)
16. Certifications: Include all relevant certifications to fill out the page (3-6 entries)

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
- [Bullet tailored to job requirement #1 using exact job posting terminology, 14-20 words for full line]
- [Bullet tailored to job requirement #2 with measurable impact, 14-20 words]
- [Bullet tailored to job requirement #3 showing relevant technical skills, 14-20 words]
- [Additional bullets each mapping to specific job requirements, 14-20 words each]

[Include ONLY 2-3 MOST RELEVANT positions from last 10 years]
[DO NOT include positions older than 10 years]
[DO NOT include positions in unrelated fields (e.g., mechanical engineering internship for software role)]
[Most relevant position: 5-6 bullets, Second: 4-5 bullets, Third (if needed): 3-4 bullets]
[CRITICAL: Every bullet must be rewritten to match job posting's language and fill the line width]

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
- Professional summary mentions the target job title and mirrors core requirements
- ONLY 2-3 most job-relevant positions from last 10 years are included
- Positions older than 10 years are excluded
- Positions in unrelated fields are excluded (e.g., mechanical engineering for software roles)
- Every bullet is rewritten using terminology from the job posting (not generic)
- Each bullet demonstrates how experience matches a specific job requirement
- Bullets are full-width (14-20 words) to properly fill the page
- More bullets per position (5-6 for top, 4-5 for second) to fill page better
- Strong action verbs replace weak passive language throughout
- Measurable results are highlighted where available (%, $, numbers, time)
- Skills section includes comprehensive list of relevant technologies (12-15 skills)
- Certifications section includes multiple relevant entries (3-6 certifications)
- All sections (Summary, Experience, Education, Skills, Certifications) fit on one page
- Page is 85-95% filled with well-spaced, relevant content

**CRITICAL:** 
- ALL sections must fit on one page: Summary, Experience, Education, Skills, Certifications
- Include only 2-3 MOST RELEVANT experience positions from last 10 years
- DO NOT include positions older than 10 years or in unrelated fields
- Use the job posting's EXACT language and terminology in every bullet
- Every bullet must be tailored to demonstrate a match with job requirements
- Each bullet should be close to full line width (14-20 words) to fill page better
- Every bullet should start with a strong action verb
- NO fabrication - only include genuine experiences from the original resume
- ATS-FRIENDLY OUTPUT: Plain text only, no columns, no tables, no special symbols, single-column layout
- Skills section: Include comprehensive list (12-15 skills) - MANDATORY
- Certifications section: Include all relevant (3-6 entries) - MANDATORY
- Certification dates: include ONLY if present in original resume data
- Target filling 85-95% of page with well-spaced content

**REMEMBER:** Write like a human, not an AI. Be direct, authentic, and strategic. Mirror the job posting's language naturally in EVERY bullet. No buzzwords, no em dashes, no overused AI verbs. Output must be ATS-parseable plain text. Think like an expert resume builder: exclude old/irrelevant positions (10+ years or different fields), but use more bullets per relevant position to fill the page. Quality positions with comprehensive bullets.`;
}
