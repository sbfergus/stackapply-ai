# BYOK (Bring Your Own Key) - Design Document

## System Architecture

### High-Level Flow

```
┌─────────────────┐
│  User Account   │
│  Settings Page  │
└────────┬────────┘
         │ (Add/Update Key)
         ▼
┌─────────────────────────┐
│  API Key Management     │
│  POST /api/user/api-key │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────┐      ┌──────────────────┐
│  Key Validation     │─────▶│  Test API Call   │
│  (Format + Live)    │      │  (Provider)      │
└────────┬────────────┘      └──────────────────┘
         │
         ▼
┌─────────────────────┐
│  Encrypt & Store    │
│  in Database        │
└─────────────────────┘

When User Creates Job:
┌──────────────────┐
│  Job Parser      │
│  /api/jobs POST  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│  Key Resolution Logic    │
│  1. Check user's custom  │
│     key (if exists)      │
│  2. Check free tier      │
│     limit (< 5)          │
│  3. Block if exceeded    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  AI Provider Adapter     │
│  - AnthropicAdapter      │
│  - OpenAIAdapter         │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  External AI API         │
│  (Claude or GPT)         │
└──────────────────────────┘
```

---

## Database Design

### Updated Prisma Schema

```prisma
model User {
  id                 String              @id @default(uuid())
  email              String              @unique
  fullName           String?
  avatarUrl          String?
  resumeUrl          String?
  linkedinUrl        String?
  linkedinData       Json?
  baseResumeText     String?
  baseCoverLetter    String?
  writingStyle       Json?
  preferredWorkTypes WorkType[]          @default([REMOTE, HYBRID])
  preferredTechStack String[]
  targetSalaryMin    Int?
  preferredLocations String[]
  
  // NEW: BYOK Fields
  apiKeyProvider     ApiKeyProvider?     // Which provider (Anthropic/OpenAI)
  apiKeyEncrypted    String?             // AES-256 encrypted key
  aiAnalysisCount    Int                 @default(0) // Free tier usage
  lastAiAnalysisReset DateTime?          // Future: monthly reset
  
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  password           String?
  jobs               Job[]
  extensionSessions  ExtensionSession[]
}

enum ApiKeyProvider {
  ANTHROPIC
  OPENAI
}
```

**Migration Strategy:**
- Add new fields with nullable/default values
- Existing users will have `apiKeyProvider = null`, `aiAnalysisCount = 0`
- No data migration needed

---

## API Layer Design

### 1. API Key Management Endpoints

#### `POST /api/user/api-key`
**Request Body:**
```typescript
{
  provider: 'ANTHROPIC' | 'OPENAI',
  apiKey: string // Plain text key from user
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  data?: {
    provider: 'ANTHROPIC' | 'OPENAI',
    keyMasked: string, // e.g., "sk-ant-...xyz789"
    validatedAt: string
  }
}
```

**Logic:**
1. Validate request (auth, format)
2. Detect provider from key prefix if not specified:
   - `sk-ant-` → Anthropic
   - `sk-proj-` or `sk-` → OpenAI
3. Test key with small API call (e.g., list models or simple completion)
4. If valid → Encrypt key using `encryptApiKey()`
5. Save to database: `apiKeyProvider`, `apiKeyEncrypted`
6. Return masked key

---

#### `GET /api/user/api-key`
**Response:**
```typescript
{
  success: boolean,
  data: {
    hasKey: boolean,
    provider?: 'ANTHROPIC' | 'OPENAI',
    keyMasked?: string,
    aiAnalysisCount: number,
    freeAnalysesRemaining: number // Max 5
  }
}
```

---

#### `DELETE /api/user/api-key`
**Response:**
```typescript
{
  success: boolean,
  message: string
}
```

**Logic:**
- Set `apiKeyProvider = null`, `apiKeyEncrypted = null`
- Keep `aiAnalysisCount` (historical data)

---

### 2. Usage Tracking Endpoint

#### `GET /api/user/usage`
**Response:**
```typescript
{
  success: boolean,
  data: {
    aiAnalysisCount: number,
    freeAnalysesRemaining: number,
    hasCustomKey: boolean
  }
}
```

---

## Service Layer Design

### 1. Encryption Service (`src/lib/encryption.ts`)

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET!; // 32 bytes

/**
 * Encrypts an API key for secure storage
 */
export function encryptApiKey(plaintext: string): string {
  // Derive 32-byte key from secret
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an API key for use
 */
export function decryptApiKey(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Masks an API key for display
 */
export function maskApiKey(key: string): string {
  if (key.length <= 10) return '***';
  return `${key.slice(0, 8)}...${key.slice(-6)}`;
}
```

**Environment Variable:**
```bash
# .env
API_KEY_ENCRYPTION_SECRET=your-32-byte-secret-key-here-change-in-production
```

---

### 2. AI Provider Abstraction (`src/lib/ai/providers.ts`)

```typescript
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
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async parseJobPosting(rawText: string, userResumeText?: string): Promise<ParsedJobData> {
    const prompt = buildPrompt(rawText, userResumeText);
    
    const response = await this.client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
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
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
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
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
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
```

---

### 3. Updated Parser Service (`src/lib/ai/parser.ts`)

```typescript
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
      aiAnalysisCount: true
    }
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
      data: { aiAnalysisCount: { increment: 1 } }
    });
  }
  
  return result;
}
```

---

## Frontend Design

### Account Settings UI (`src/app/(app)/account/page.tsx`)

**New Section: API Keys**

```typescript
// Add to existing account page

const [apiKeyData, setApiKeyData] = useState({
  hasKey: false,
  provider: null as 'ANTHROPIC' | 'OPENAI' | null,
  keyMasked: '',
  aiAnalysisCount: 0,
  freeAnalysesRemaining: 5
});

const [showApiKeyModal, setShowApiKeyModal] = useState(false);

// Fetch API key status
useEffect(() => {
  const fetchApiKeyStatus = async () => {
    try {
      const res = await fetch('/api/user/api-key');
      const data = await res.json();
      if (data.success) {
        setApiKeyData(data.data);
      }
    } catch (error) {
      console.error('Error fetching API key status:', error);
    }
  };
  
  if (status === 'authenticated') {
    fetchApiKeyStatus();
  }
}, [status]);

// Render API Keys Section
<section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
  <h2 className="text-lg font-semibold text-white mb-6">API Keys</h2>
  
  {/* Usage Counter */}
  {!apiKeyData.hasKey && (
    <div className="mb-4 p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg">
      <p className="text-sm text-indigo-300">
        <strong>{apiKeyData.freeAnalysesRemaining}</strong> of 5 free AI analyses remaining
      </p>
      {apiKeyData.freeAnalysesRemaining === 0 && (
        <p className="text-xs text-red-400 mt-1">
          Add your own API key to continue using AI features
        </p>
      )}
    </div>
  )}
  
  {/* Key Status */}
  {apiKeyData.hasKey ? (
    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">
            Connected to {apiKeyData.provider === 'ANTHROPIC' ? 'Anthropic' : 'OpenAI'}
          </p>
          <p className="text-xs text-slate-400 font-mono">
            {apiKeyData.keyMasked}
          </p>
        </div>
      </div>
      <button
        onClick={() => handleRemoveApiKey()}
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
      >
        Remove
      </button>
    </div>
  ) : (
    <button
      onClick={() => setShowApiKeyModal(true)}
      className="w-full p-4 bg-slate-900/50 hover:bg-slate-900/70 rounded-lg border-2 border-dashed border-slate-700 hover:border-indigo-500/50 transition text-center"
    >
      <Key className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
      <p className="text-sm font-medium text-slate-200">Add API Key</p>
      <p className="text-xs text-slate-400 mt-1">
        Use your own Anthropic or OpenAI key for unlimited analyses
      </p>
    </button>
  )}
</section>
```

---

### API Key Modal Component (`src/components/AddApiKeyModal.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { X, Key, AlertCircle } from 'lucide-react';

interface AddApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddApiKeyModal({ isOpen, onClose, onSuccess }: AddApiKeyModalProps) {
  const [provider, setProvider] = useState<'ANTHROPIC' | 'OPENAI'>('ANTHROPIC');
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    try {
      const res = await fetch('/api/user/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to save API key');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Add API Key</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'ANTHROPIC' | 'OPENAI')}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ANTHROPIC">Anthropic (Claude)</option>
              <option value="OPENAI">OpenAI (GPT)</option>
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'ANTHROPIC' ? 'sk-ant-...' : 'sk-proj-...'}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none font-mono text-sm"
              required
            />
            <p className="text-xs text-slate-400 mt-1">
              {provider === 'ANTHROPIC' ? (
                <>Get yours at <a href="https://console.anthropic.com" target="_blank" className="text-indigo-400 hover:underline">console.anthropic.com</a></>
              ) : (
                <>Get yours at <a href="https://platform.openai.com/api-keys" target="_blank" className="text-indigo-400 hover:underline">platform.openai.com</a></>
              )}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isValidating || !apiKey}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Test & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Error Handling Strategy

### User-Facing Errors

| Scenario | Error Message |
|----------|---------------|
| Free tier limit exceeded | "You've used all 5 free AI analyses. Add your own API key in Account Settings to continue." |
| Invalid API key format | "Invalid API key format. Please check and try again." |
| API key test failed | "Could not validate your API key. Please verify it's correct and has sufficient credits." |
| Provider API down | "AI service temporarily unavailable. Please try again in a few moments." |
| Encryption failure | "Security error. Please contact support." |

### Developer Errors (Logged Only)

- Encryption key not set in environment
- Database connection failure
- Unexpected AI response format

---

## Security Considerations

1. **Encryption at Rest:** All keys encrypted with AES-256-GCM before storage
2. **Encryption Key Management:** `API_KEY_ENCRYPTION_SECRET` stored in env vars, never in code
3. **HTTPS Only:** All API key transmission over TLS
4. **Rate Limiting:** Limit key validation attempts (5 per minute per user)
5. **Key Masking:** Never return full keys in API responses
6. **Audit Logging:** (Future) Log key usage events for security monitoring
7. **Token Rotation:** (Future) Support for key rotation without service interruption

---

## Testing Strategy

### Unit Tests
- Encryption/decryption functions
- Key masking utility
- Provider adapter response parsing

### Integration Tests
- Key validation flow (mock external APIs)
- Usage counter increment logic
- Free tier limit enforcement

### E2E Tests
- Add Anthropic key → Create job → Verify parsing works
- Add OpenAI key → Create job → Verify parsing works
- Exceed free tier → Verify blocked with correct error
- Remove key → Verify falls back to free tier

### Manual Testing
- Test with real API keys (Anthropic & OpenAI)
- Verify encrypted keys in database
- Test edge case: expired/revoked keys
- Test concurrent requests with same user

---

## Deployment Checklist

1. Add `API_KEY_ENCRYPTION_SECRET` to production env vars (use strong random 32-byte string)
2. Run database migration (`prisma migrate deploy`)
3. Install OpenAI SDK: `npm install openai`
4. Deploy backend changes
5. Deploy frontend changes
6. Monitor error logs for first 24 hours
7. Track adoption metrics (% users adding keys)

---

## Future Enhancements

- **Monthly Reset:** Reset `aiAnalysisCount` every 30 days for free tier users
- **Multiple Keys:** Support multiple keys per provider for redundancy
- **Key Health Monitoring:** Proactive alerts when user's key is invalid/expired
- **Additional Providers:** Groq, Cohere, Mistral support
- **Team Key Sharing:** Allow key sharing within organizations
- **Detailed Analytics:** Per-key usage dashboard with cost estimates
