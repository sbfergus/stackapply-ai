import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ParsedJobData } from './parser';

export interface AIProvider {
  parseJobPosting(rawText: string, userProfileText?: string): Promise<ParsedJobData>;
  testConnection(): Promise<boolean>;
}

/**
 * Anthropic (Claude) Provider
 */
export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || process.env.FREE_TIER_MODEL!;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      console.error('Anthropic connection test failed:', error);
      return false;
    }
  }

  async parseJobPosting(rawText: string, userProfileText?: string): Promise<ParsedJobData> {
    const prompt = buildPrompt(rawText, userProfileText);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });

    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    return JSON.parse(contentBlock.text.trim()) as ParsedJobData;
  }
}

/**
 * OpenAI (GPT) Provider
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || 'gpt-4o-mini';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async parseJobPosting(rawText: string, userProfileText?: string): Promise<ParsedJobData> {
    const prompt = buildPrompt(rawText, userProfileText);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are an expert technical recruiter. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    return JSON.parse(content) as ParsedJobData;
  }
}

/**
 * Shared prompt builder with comprehensive profile matching
 */
function buildPrompt(rawText: string, userProfileText?: string): string {
  return `
You are an expert technical recruiter and resume analyst with deep knowledge of software engineering roles.
Analyze the following job posting and candidate profile to provide accurate matching and extraction.

JOB POSTING:
"""
${rawText}
"""

${userProfileText ? `CANDIDATE PROFILE:\n"""\n${userProfileText}\n"""` : 'No candidate profile provided.'}

TASK:
Extract job details and calculate a precise match score based on the candidate's profile.

MATCHING CRITERIA (when profile is provided):
1. **Technical Skills Match** (40%): How well do the candidate's skills align with required/preferred technologies?
2. **Experience Level** (30%): Does the candidate's years and type of experience match the seniority level?
3. **Domain Experience** (15%): Has the candidate worked in similar industries or problem domains?
4. **Education & Certifications** (10%): Does education/certs meet requirements?
5. **Location & Work Setting** (5%): Does location/remote preference align?

SCORING GUIDELINES:
- 90-100: Exceptional match, candidate exceeds requirements
- 80-89: Strong match, candidate meets all key requirements
- 70-79: Good match, candidate meets most requirements with minor gaps
- 60-69: Moderate match, candidate has potential but missing some key skills
- 50-59: Weak match, significant gaps in experience or skills
- Below 50: Poor match, not qualified for this role

If NO profile is provided, default to matchScore: 50 and note that in reasoning.

Return ONLY valid JSON adhering to this EXACT schema:
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
  "matchScore": integer between 0 and 100,
  "matchReasoning": "2-3 sentences explaining match score, highlighting strongest alignments and any significant gaps"
}

Return ONLY valid JSON. Do not wrap in backticks or markdown codeblocks.
`;
}

/**
 * Factory function to create provider
 */
export function createAIProvider(
  provider: 'ANTHROPIC' | 'OPENAI',
  apiKey: string,
  model?: string
): AIProvider {
  switch (provider) {
    case 'ANTHROPIC':
      return new AnthropicProvider(apiKey, model);
    case 'OPENAI':
      return new OpenAIProvider(apiKey, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
