# BYOK (Bring Your Own Key) - Implementation Tasks

## Phase 1: Foundation & Database

### Task 1.1: Install Dependencies
- [ ] Install OpenAI SDK: `npm install openai`
- [ ] Verify `@anthropic-ai/sdk` is up to date
- [ ] Test both SDKs import correctly

**Acceptance:**
- `package.json` includes `openai` package
- No import errors in development

---

### Task 1.2: Update Prisma Schema
- [ ] Add `apiKeyProvider ApiKeyProvider?` to User model
- [ ] Add `apiKeyEncrypted String?` to User model
- [ ] Add `aiAnalysisCount Int @default(0)` to User model
- [ ] Add `lastAiAnalysisReset DateTime?` to User model
- [ ] Create `ApiKeyProvider` enum with ANTHROPIC and OPENAI
- [ ] Generate migration: `npx prisma migrate dev --name add_byok_fields`
- [ ] Run migration
- [ ] Regenerate Prisma Client: `npx prisma generate`

**Acceptance:**
- Schema updated without errors
- Migration applied to database
- TypeScript types available for new fields

**Files:**
- `/prisma/schema.prisma`

---

### Task 1.3: Add Encryption Environment Variable
- [ ] Add `API_KEY_ENCRYPTION_SECRET` to `.env`
- [ ] Generate strong 32-byte secret (use crypto or password generator)
- [ ] Add to `.env.example` with placeholder
- [ ] Document in README for deployment

**Acceptance:**
- `.env` contains `API_KEY_ENCRYPTION_SECRET`
- Secret is at least 32 characters
- `.env.example` updated

**Files:**
- `/.env`
- `/.env.example` (if exists)

---

## Phase 2: Backend Services

### Task 2.1: Create Encryption Utility
- [ ] Create `src/lib/encryption.ts`
- [ ] Implement `encryptApiKey(plaintext: string): string`
  - Use `crypto.scryptSync()` for key derivation
  - Use AES-256-GCM algorithm
  - Generate random IV for each encryption
  - Return format: `iv:authTag:encrypted`
- [ ] Implement `decryptApiKey(encrypted: string): string`
  - Parse `iv:authTag:encrypted` format
  - Decrypt with same key derivation
  - Return plaintext
- [ ] Implement `maskApiKey(key: string): string`
  - Show first 8 and last 6 chars
  - Replace middle with `...`
- [ ] Add error handling for invalid format
- [ ] Write unit tests

**Acceptance:**
- Encryption/decryption round-trip works
- Masked keys display correctly
- Tests pass

**Files:**
- `/src/lib/encryption.ts` (new)
- `/src/lib/__tests__/encryption.test.ts` (new, optional)

---

### Task 2.2: Create AI Provider Abstraction
- [ ] Create `src/lib/ai/providers.ts`
- [ ] Define `AIProvider` interface with:
  - `parseJobPosting(rawText, userResumeText?): Promise<ParsedJobData>`
  - `testConnection(): Promise<boolean>`
- [ ] Implement `AnthropicProvider` class
  - Constructor accepts API key
  - `testConnection()` makes minimal API call
  - `parseJobPosting()` uses Claude 3.5 Haiku
  - Parse response to `ParsedJobData`
- [ ] Implement `OpenAIProvider` class
  - Constructor accepts API key
  - `testConnection()` makes minimal API call
  - `parseJobPosting()` uses GPT-4o-mini
  - Use `response_format: { type: 'json_object' }`
  - Parse response to `ParsedJobData`
- [ ] Create `buildPrompt()` helper (shared by both providers)
- [ ] Create `createAIProvider()` factory function
- [ ] Handle provider-specific errors

**Acceptance:**
- Both providers implement same interface
- Test connections work with valid keys
- Parsing returns consistent format
- Factory creates correct provider

**Files:**
- `/src/lib/ai/providers.ts` (new)

---

### Task 2.3: Update Parser Service
- [ ] Update `src/lib/ai/parser.ts`
- [ ] Add `userId: string` parameter to `parseJobPosting()`
- [ ] Implement key resolution logic:
  1. Fetch user from database
  2. If `apiKeyEncrypted` exists → decrypt and use custom key
  3. If no custom key → check `aiAnalysisCount < 5`
  4. If limit exceeded → throw specific error
  5. If under limit → use system key, set flag to increment
- [ ] Call appropriate provider adapter
- [ ] Increment `aiAnalysisCount` if system key used
- [ ] Handle errors with clear messages

**Acceptance:**
- Parser routes to correct provider
- Usage counter increments only for system key
- Free tier limit enforced
- Error messages are user-friendly

**Files:**
- `/src/lib/ai/parser.ts` (update)

---

## Phase 3: API Endpoints

### Task 3.1: Create API Key Management Endpoints
- [ ] Create `src/app/api/user/api-key/route.ts`
- [ ] Implement `POST` handler:
  - Validate authentication
  - Parse `provider` and `apiKey` from body
  - Auto-detect provider from key prefix if not specified
  - Create provider instance and call `testConnection()`
  - If valid → encrypt key
  - Save `apiKeyProvider` and `apiKeyEncrypted` to database
  - Return success with masked key
  - Handle errors (invalid key, connection failed, etc.)
- [ ] Implement `GET` handler:
  - Fetch user's `apiKeyProvider`, `apiKeyEncrypted`, `aiAnalysisCount`
  - Return masked key if exists
  - Calculate `freeAnalysesRemaining` (5 - count)
  - Return status object
- [ ] Implement `DELETE` handler:
  - Set `apiKeyProvider = null`, `apiKeyEncrypted = null`
  - Return success
- [ ] Add rate limiting (optional but recommended)

**Acceptance:**
- POST validates and saves keys
- GET returns correct status
- DELETE removes keys
- All handlers check authentication

**Files:**
- `/src/app/api/user/api-key/route.ts` (new)

---

### Task 3.2: Create Usage Endpoint
- [ ] Create `src/app/api/user/usage/route.ts`
- [ ] Implement `GET` handler:
  - Fetch user's `aiAnalysisCount`
  - Calculate `freeAnalysesRemaining`
  - Check if `apiKeyEncrypted` exists
  - Return usage object
- [ ] Add authentication check

**Acceptance:**
- Returns correct usage counts
- Authenticated users only

**Files:**
- `/src/app/api/user/usage/route.ts` (new)

---

### Task 3.3: Update Job Creation Endpoint
- [ ] Update `src/app/api/jobs/route.ts`
- [ ] Pass `userId` to `parseJobPosting()` function
- [ ] Handle `FREE_TIER_LIMIT_EXCEEDED` error:
  - Return 403 status
  - Return clear error message
  - Include link to account settings
- [ ] Handle other AI errors gracefully

**Acceptance:**
- Job creation uses new parser signature
- Free tier limits enforced
- Errors returned to client correctly

**Files:**
- `/src/app/api/jobs/route.ts` (update)

---

## Phase 4: Frontend UI

### Task 4.1: Create API Key Modal Component
- [ ] Create `src/components/AddApiKeyModal.tsx`
- [ ] Implement modal UI:
  - Provider dropdown (Anthropic / OpenAI)
  - Password input for API key
  - Help text with links to get keys
  - "Test & Save" button
  - Error display
  - Loading state during validation
- [ ] Implement form submission:
  - POST to `/api/user/api-key`
  - Show loading spinner
  - Display errors inline
  - Close modal on success
  - Trigger parent refresh
- [ ] Add accessibility (keyboard nav, focus management)

**Acceptance:**
- Modal displays correctly
- Form validation works
- Success/error states handled
- Accessible to keyboard users

**Files:**
- `/src/components/AddApiKeyModal.tsx` (new)

---

### Task 4.2: Update Account Settings Page
- [ ] Update `src/app/(app)/account/page.tsx`
- [ ] Add state for API key data
- [ ] Fetch API key status on mount (`GET /api/user/api-key`)
- [ ] Add "API Keys" section to page:
  - Show usage counter if no custom key
  - Show warning if limit reached
  - Show connected provider if key exists
  - Show masked key
  - "Remove" button if key exists
  - "Add API Key" button if no key
- [ ] Implement `handleAddApiKey()` - opens modal
- [ ] Implement `handleRemoveApiKey()`:
  - Confirm with user
  - DELETE to `/api/user/api-key`
  - Refresh status
  - Show toast notification
- [ ] Handle modal success → refresh data

**Acceptance:**
- API Keys section visible on account page
- Usage counter accurate
- Add/remove flow works
- UI updates after changes

**Files:**
- `/src/app/(app)/account/page.tsx` (update)

---

### Task 4.3: Add Usage Warning to Job Creation
- [ ] Update `src/components/AddJobModal.tsx` (or wherever job creation UI is)
- [ ] Fetch user usage status
- [ ] Show warning if close to limit: "2 free analyses remaining"
- [ ] Show error if limit exceeded: "Free limit reached. Add API key to continue."
- [ ] Add link to account settings
- [ ] Disable job creation if limit exceeded

**Acceptance:**
- Warning appears when < 2 remaining
- Error blocks creation at limit
- Link to settings works

**Files:**
- `/src/components/AddJobModal.tsx` (update, if applicable)
- Or add to job creation flow where AI is triggered

---

## Phase 5: Testing & Polish

### Task 5.1: End-to-End Testing
- [ ] Test flow: Add Anthropic key → Create job → Verify parsing works
- [ ] Test flow: Add OpenAI key → Create job → Verify parsing works
- [ ] Test flow: No key → Create 5 jobs → Verify 6th blocked
- [ ] Test flow: Remove key → Verify falls back to free tier
- [ ] Test invalid key → Verify error message
- [ ] Test expired/revoked key → Verify handling
- [ ] Verify encrypted keys in database (use DB client)
- [ ] Test key masking displays correctly

**Acceptance:**
- All flows work as expected
- Errors are user-friendly
- Keys are encrypted in database
- No API keys visible in network logs

---

### Task 5.2: Error Messages & UX Polish
- [ ] Review all error messages for clarity
- [ ] Add helpful links (e.g., "How to get an API key")
- [ ] Ensure loading states on all async actions
- [ ] Test on mobile/responsive layout
- [ ] Add tooltips for API key benefits
- [ ] Consider success animations/feedback

**Acceptance:**
- Error messages are actionable
- UI feels polished
- Mobile layout works

---

### Task 5.3: Documentation
- [ ] Update README with BYOK feature explanation
- [ ] Document environment variables needed
- [ ] Add deployment notes for `API_KEY_ENCRYPTION_SECRET`
- [ ] Create user guide: "How to add your API key"
- [ ] Document supported providers

**Acceptance:**
- README updated
- Deployment guide includes encryption key setup
- User documentation clear

**Files:**
- `/README.md` (update)
- `/docs/byok-guide.md` (new, optional)

---

## Phase 6: Deployment

### Task 6.1: Pre-Deployment Checklist
- [ ] Generate production `API_KEY_ENCRYPTION_SECRET` (strong random string)
- [ ] Add secret to production environment (Vercel/Railway/etc.)
- [ ] Run migration in production: `npx prisma migrate deploy`
- [ ] Verify OpenAI SDK installed in production build
- [ ] Test production build locally
- [ ] Create rollback plan

**Acceptance:**
- Production env vars set
- Migration applied
- Build succeeds

---

### Task 6.2: Deploy to Production
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Verify deployment successful
- [ ] Test basic flow in production
- [ ] Monitor error logs for 1 hour
- [ ] Check database for encrypted keys

**Acceptance:**
- Production deployment successful
- No critical errors in logs
- Basic smoke test passes

---

### Task 6.3: Post-Launch Monitoring
- [ ] Monitor error rates (first 24 hours)
- [ ] Track adoption: % users adding keys
- [ ] Track free tier usage patterns
- [ ] Check for any encryption/decryption errors
- [ ] Gather user feedback
- [ ] Create bug fix tickets if needed

**Acceptance:**
- No critical bugs reported
- Error rates normal
- Adoption metrics tracked

---

## Optional Enhancements (Future)

### Task 7.1: Monthly Usage Reset
- [ ] Create cron job or scheduled task
- [ ] Reset `aiAnalysisCount` every 30 days
- [ ] Update `lastAiAnalysisReset` timestamp
- [ ] Notify users when reset occurs

---

### Task 7.2: Key Health Monitoring
- [ ] Add background job to test user keys periodically
- [ ] Notify users if key becomes invalid
- [ ] Mark keys as "unhealthy" in database
- [ ] Add UI indicator for key health

---

### Task 7.3: Additional Providers
- [ ] Add Groq support
- [ ] Add Cohere support
- [ ] Add Mistral support
- [ ] Update provider enum and factory

---

## Progress Tracking

**Total Tasks:** 22 core tasks + 4 optional
**Estimated Time:** 
- Phase 1: 2 hours
- Phase 2: 4 hours
- Phase 3: 3 hours
- Phase 4: 4 hours
- Phase 5: 3 hours
- Phase 6: 2 hours

**Total: ~18 hours** (core functionality)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Encryption key leak | Store in env vars, use secrets manager in production |
| User provides invalid key | Validate with test API call before saving |
| AI provider API changes | Use stable SDK versions, monitor for breaking changes |
| Free tier abuse (multiple accounts) | Future: Add email verification, IP-based rate limiting |
| Performance degradation from encryption | Encryption adds <10ms overhead, acceptable |

---

## Dependencies Between Tasks

```
1.1 (Install deps) → 2.2 (Providers)
1.2 (Schema) → 2.3 (Parser), 3.1 (API endpoints)
1.3 (Env var) → 2.1 (Encryption)
2.1 (Encryption) → 3.1 (API endpoints)
2.2 (Providers) → 2.3 (Parser)
2.3 (Parser) → 3.3 (Update jobs API)
3.1 (API endpoints) → 4.1, 4.2 (Frontend)
4.1 (Modal) → 4.2 (Account page)
All phases 1-4 → Phase 5 (Testing)
Phase 5 → Phase 6 (Deployment)
```

**Recommended Order:** Sequential by phase, tasks within phase can be parallelized where dependencies allow.
