import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ParsedJobData } from './parser';

export interface AIProvider {
  parseJobPosting(rawText: string, userResumeText?: string): Promise<ParsedJobData>;
  testConnection(): Promise<boolean>;
}

/**
 * Anthropic (Claude) Provider
 */
export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      console.error('Anthropic connection test failed:', error);
      return false;
    }
  }

  async parseJobPosting(rawText: string, userResumeText?: string): Promise<ParsedJobData> {
    const prompt = buildPrompt(rawText, userResumeText);

    const response = await this.client.messages.create({
      model: 'claude-3-5-haiku-20241022',
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

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async parseJobPosting(rawText: string, userResumeText?: string): Promise<ParsedJobData> {
    const prompt = buildPrompt(rawText, userResumeText);

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
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
 * Shared prompt builder
 */
function buildPrompt(rawText: string, userResumeText?: string): string {
  return `
You are an expert technical recruiter and resume analyst.
Analyze the following job posting raw text (and optional candidate resume).

Job Posting Text:
"""
${rawText}
"""

${userResumeText ? `Candidate Resume:\n"""\n${userResumeText}\n"""` : ''}

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
}

/**
 * Factory function to create provider
 */
export function createAIProvider(
  provider: 'ANTHROPIC' | 'OPENAI',
  apiKey: string
): AIProvider {
  switch (provider) {
    case 'ANTHROPIC':
      return new AnthropicProvider(apiKey);
    case 'OPENAI':
      return new OpenAIProvider(apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
