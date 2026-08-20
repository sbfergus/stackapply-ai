# BYOK (Bring Your Own Key) - Requirements

## Overview
Implement a Bring Your Own Key (BYOK) system that allows users to provide their own Anthropic or OpenAI API keys for unlimited AI job analysis, while maintaining a free tier with usage limits for users without custom keys.

## Business Goals
- **Eliminate financial risk** during launch phase by letting users pay for their own AI usage
- **Provide free tier** with system-funded AI analysis (5 uses per user)
- **Support multiple providers** (Anthropic Claude & OpenAI GPT) to maximize user flexibility
- **Enable seamless upgrade path** to future paid tiers

## User Stories

### US-1: User API Key Management
**As a** registered user  
**I want to** add my own API key (Anthropic or OpenAI) to my account settings  
**So that** I can use unlimited AI job analysis without hitting free tier limits

**Acceptance Criteria:**
- User can navigate to Account Settings and see a new "API Keys" section
- User can select provider type (Anthropic or OpenAI)
- User can paste and save their API key securely
- User receives confirmation when key is saved
- User can view masked version of saved key (e.g., `sk-ant-...abc123`)
- User can update or delete their saved key
- System validates key format before saving
- System tests key with a small API call to verify it works

### US-2: Free Tier Usage Tracking
**As a** user without a custom API key  
**I want to** see how many free AI analyses I have remaining  
**So that** I know when I need to add my own key or upgrade

**Acceptance Criteria:**
- User sees "X of 5 free AI analyses remaining" in Account Settings
- Counter updates after each AI job analysis
- Counter is displayed prominently before user hits limit
- When limit is reached, user sees clear message: "Free limit reached. Add your API key or upgrade to continue."

### US-3: Dynamic AI Provider Selection
**As the** system  
**I want to** automatically use the correct AI provider based on user's key  
**So that** job parsing works regardless of which provider the user chooses

**Acceptance Criteria:**
- If user has custom API key → Use their key with their chosen provider
- If user has NO key AND under limit (< 5 uses) → Use system key with ultra-low-cost model (Claude 3.5 Haiku)
- If user has NO key AND at/over limit (≥ 5 uses) → Block AI analysis, show upgrade prompt
- System correctly formats requests for both Anthropic and OpenAI APIs
- System handles provider-specific responses and maps to unified format

### US-4: Key Security & Encryption
**As the** system administrator  
**I want to** store user API keys encrypted at rest  
**So that** keys are protected from unauthorized access

**Acceptance Criteria:**
- API keys are encrypted before storing in database using AES-256 or equivalent
- Encryption key is stored in environment variables, not in code
- Keys are never exposed in API responses (always masked)
- Keys are decrypted only when needed for API calls
- Audit log tracks when keys are used (optional future enhancement)

### US-5: Usage Limit Enforcement
**As the** system  
**I want to** prevent users without custom keys from exceeding 5 free analyses  
**So that** platform costs remain controlled

**Acceptance Criteria:**
- System tracks `aiAnalysisCount` per user in database
- Before each AI analysis, system checks: user has custom key OR count < 5
- If neither condition met → Return error, show upgrade/BYOK prompt
- Count increments only when system key is used (not when user key is used)
- Count persists across sessions

### US-6: Cost-Optimized Model Selection
**As the** system administrator  
**I want to** use ultra-low-cost AI models for free tier users  
**So that** platform costs are minimized while still providing value

**Acceptance Criteria:**
- System defaults to Claude 3.5 Haiku (~$0.80/1M tokens) for free tier
- System can fallback to GPT-4o-mini (~$0.15/1M tokens) if configured
- Users with custom keys can use any model supported by their provider
- Model selection is configurable via environment variables

## Functional Requirements

### FR-1: Database Schema
- Add `apiKeyProvider` field (enum: ANTHROPIC | OPENAI | null)
- Add `apiKeyEncrypted` field (String, nullable, stores encrypted key)
- Add `aiAnalysisCount` field (Int, default: 0)
- Add `lastAiAnalysisReset` field (DateTime, nullable) for future monthly reset feature

### FR-2: Account Settings UI
- New "API Keys" section in `/account` page
- Provider selector dropdown (Anthropic / OpenAI)
- Secure text input for pasting API key
- "Test & Save" button that validates key before saving
- Display current key status: "Connected to Anthropic" or "No API key configured"
- Show masked key if saved: `sk-ant-...xyz789`
- "Remove Key" button to delete saved key
- Usage counter display: "3 of 5 free analyses used"

### FR-3: AI Service Abstraction Layer
- Create unified interface for both Anthropic and OpenAI clients
- Implement provider-specific adapters:
  - `AnthropicAdapter` - handles Claude API calls
  - `OpenAIAdapter` - handles GPT API calls
- Unified `parseJobPosting()` function that routes to correct adapter
- Consistent response format regardless of provider

### FR-4: Key Encryption/Decryption Service
- Create `encryptApiKey(plaintext: string): string` utility
- Create `decryptApiKey(encrypted: string): string` utility
- Use crypto library (Node.js `crypto` module)
- Encryption key from `API_KEY_ENCRYPTION_SECRET` env variable

### FR-5: API Endpoints
- `POST /api/user/api-key` - Save/update user API key (validates & encrypts)
- `GET /api/user/api-key` - Get masked key info & provider
- `DELETE /api/user/api-key` - Remove user's API key
- `GET /api/user/usage` - Get current AI analysis usage count

### FR-6: Usage Tracking
- Before each AI call in job parser, check user's key status
- If no custom key, check `aiAnalysisCount < 5`
- Increment `aiAnalysisCount` after successful analysis (system key only)
- Return clear error if limit exceeded

## Non-Functional Requirements

### NFR-1: Security
- All API keys encrypted at rest using AES-256
- Keys never logged or exposed in error messages
- HTTPS required for all API key transmission
- Rate limiting on key validation endpoint to prevent abuse

### NFR-2: Performance
- Key decryption adds < 10ms overhead to AI requests
- Provider selection logic adds < 5ms overhead

### NFR-3: Reliability
- Graceful fallback if encryption service fails (don't break entire app)
- Clear error messages if user's custom key is invalid/expired
- System continues working if custom key fails (show error, don't crash)

### NFR-4: Usability
- Key setup takes < 2 minutes
- Clear instructions for finding API keys (link to provider docs)
- Inline validation shows key format errors immediately

## Out of Scope (Future Phases)
- Monthly usage reset (keeping simple count for now)
- Paid subscription tiers (Stripe integration)
- Multiple keys per user
- Key sharing between team members
- Detailed usage analytics per key
- Support for additional providers (Groq, Mistral, etc.)

## Dependencies
- Existing Prisma User model
- Existing `/account` page
- Existing `parser.ts` AI service
- OpenAI SDK (`openai` npm package) - needs to be installed
- Node.js `crypto` module (built-in)

## Success Metrics
- % of users who add custom API keys
- Average AI analyses per user (with vs without custom key)
- Cost per free-tier user (should be < $0.50)
- Key validation success rate (should be > 95%)

## Risk Mitigation
- **Risk:** User provides invalid key → **Mitigation:** Test key with small API call before saving
- **Risk:** Encryption key leaked → **Mitigation:** Store in env var, rotate periodically, use secrets manager in production
- **Risk:** Provider API changes → **Mitigation:** Abstract API calls behind adapters, version lock SDKs
- **Risk:** Users abuse free tier with multiple accounts → **Mitigation:** Future: Add email verification, rate limiting by IP
