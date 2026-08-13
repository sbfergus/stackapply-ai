import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export interface ParsedJobData {
  title: string;
  company: string;
  location: string;
  workSetting: "REMOTE" | "HYBRID" | "IN_OFFICE";
  salaryMin?: number;
  salaryMax?: number;
  companyOverview: string;
  roleSummary: string;
  techStack: string[];
  benefits: string[];
  matchScore: number;
  matchReasoning: string;
}

export async function parseJobPosting(
  rawText: string,
  userResumeText?: string
): Promise<ParsedJobData> {
  const prompt = `
You are an expert technical recruiter and resume analyst.
Analyze the following job posting raw text (and optional candidate resume).

Job Posting Text:
"""
${rawText}
"""

${userResumeText ? `Candidate Resume:\n"""\n${userResumeText}\n"""` : ""}

Extract and analyze the job posting into structured JSON adhering to this EXACT schema:
{
  "title": "Job Title (string)",
  "company": "Company Name (string)",
  "location": "Location city/state/country (string)",
  "workSetting": "REMOTE" | "HYBRID" | "IN_OFFICE",
  "salaryMin": number or null,
  "salaryMax": number or null,
  "companyOverview": "Concise 2-3 sentence overview of the company",
  "roleSummary": "Concise 2-3 sentence summary of core responsibilities",
  "techStack": ["Next.js", "TypeScript", "Tailwind", etc.],
  "benefits": ["Health Insurance", "401k", etc.],
  "matchScore": integer between 0 and 100 representing candidate qualification fit (default 75 if no resume provided),
  "matchReasoning": "One concise sentence explaining the match score reasoning."
}

Return ONLY valid JSON. Do not wrap in backticks or markdown codeblocks.
`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 1500,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const contentBlock = response.content[0];
  if (contentBlock.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  return JSON.parse(contentBlock.text.trim()) as ParsedJobData;
}