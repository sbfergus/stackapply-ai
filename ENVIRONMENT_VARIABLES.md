# Environment Variables Configuration

## 🚨 Issue Fixed: Hardcoded Model Names

**Problem**: The code was using hardcoded model names (`claude-3-5-sonnet-latest`) which caused 404 errors because:
1. The `-latest` alias doesn't exist for Sonnet
2. Different use cases need different models
3. No flexibility for configuration

**Solution**: All model names are now controlled via environment variables.

---

## Required Environment Variables

### Database
```bash
DATABASE_URL=postgresql://...  # Your Neon/Postgres connection string
```

### AI Models (Anthropic)

```bash
# System API key for free tier users
ANTHROPIC_API_KEY=sk-ant-api03-...

# Free tier configuration
FREE_TIER_LIMIT=5
FREE_TIER_MODEL=claude-3-5-haiku-20241022

# BYOK (Bring Your Own Key) model
# Used when users provide their own API key
BYOK_MODEL=claude-3-5-haiku-20241022

# PDF parsing model
# MUST be Sonnet (Haiku doesn't support PDFs)
PDF_PARSING_MODEL=claude-3-5-sonnet-20241022
```

### Security
```bash
API_KEY_ENCRYPTION_SECRET=...  # 32+ chars for encrypting user API keys
NEXTAUTH_SECRET=...            # 32+ chars for NextAuth sessions
EXTENSION_JWT_SECRET=...       # 32+ chars for browser extension auth
```

### Storage & Email
```bash
BLOB_READ_WRITE_TOKEN=...      # Vercel Blob for file uploads
RESEND_API_KEY=...             # Optional: for emails
RESEND_FROM_EMAIL=...          # Optional: sender email
```

### App Config
```bash
NEXTAUTH_URL=http://localhost:3000  # Your app URL
```

---

## Model Configuration Strategy

### 1. Free Tier Users (No BYOK)
- **Job Matching**: Uses `FREE_TIER_MODEL` (Haiku - cheap, fast)
- **Resume PDF Parsing**: Uses `PDF_PARSING_MODEL` (Sonnet - required for PDF support)

### 2. BYOK Users (Custom API Key)
- **Job Matching**: Uses `BYOK_MODEL` (configurable, defaults to Haiku)
- **Resume PDF Parsing**: Uses `PDF_PARSING_MODEL` (Sonnet - required for PDF support)

### Why Different Models?

| Task | Model | Reason |
|------|-------|--------|
| Job Matching | Haiku | Cheap, fast, text-only |
| Resume PDF Parsing | Sonnet | PDF support (Haiku doesn't have it) |

---

## Valid Claude Model Names

### ✅ Correct Model Names (Date-Based)
```
claude-3-5-haiku-20241022    ← Use this for Haiku
claude-3-5-sonnet-20241022   ← Use this for Sonnet
claude-3-opus-20240229       ← Available if needed
```

### ❌ Incorrect Model Names (Aliases Don't Work)
```
claude-3-5-haiku-latest      ← ❌ Haiku has -latest alias
claude-3-5-sonnet-latest     ← ❌ Sonnet does NOT have -latest alias
```

**Important**: Always use date-based model identifiers, not `-latest` aliases!

---

## Setting Environment Variables

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your values:
   ```bash
   # Edit .env with your actual values
   nano .env
   ```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable with its value
4. Click **Save**

**Required for Production:**
```
DATABASE_URL
ANTHROPIC_API_KEY
API_KEY_ENCRYPTION_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
EXTENSION_JWT_SECRET
BLOB_READ_WRITE_TOKEN
FREE_TIER_MODEL=claude-3-5-haiku-20241022
PDF_PARSING_MODEL=claude-3-5-sonnet-20241022
BYOK_MODEL=claude-3-5-haiku-20241022
FREE_TIER_LIMIT=5
```

---

## Testing Your Configuration

### 1. Verify Environment Variables Are Set

```bash
# In development
node -e "console.log('FREE_TIER_MODEL:', process.env.FREE_TIER_MODEL)"
node -e "console.log('PDF_PARSING_MODEL:', process.env.PDF_PARSING_MODEL)"
node -e "console.log('BYOK_MODEL:', process.env.BYOK_MODEL)"
```

### 2. Test Job Matching (Uses FREE_TIER_MODEL or BYOK_MODEL)

1. Upload a resume in Account Settings
2. Add a job to your dashboard
3. Click "Calculate Match"
4. Should use Haiku (cheap, fast)

### 3. Test Resume Parsing (Uses PDF_PARSING_MODEL)

1. Upload a new resume PDF
2. Click "Calculate Match" on any job
3. First time will parse the PDF using Sonnet
4. Subsequent matches use cached parsed resume (no extra cost)

---

## Cost Optimization

### Smart Caching Strategy

✅ **Resume parsing is cached!** 
- PDF is parsed **once** when resume is uploaded
- Result is saved in `parsedResume` field
- Subsequent match calculations use cached data
- Only re-parses if resume is updated

### Cost Breakdown (per match)

| Scenario | PDF Parsing | Job Matching | Total Model Calls |
|----------|-------------|--------------|-------------------|
| First match after upload | 1x Sonnet | 1x Haiku | 2 calls |
| Subsequent matches | 0 (cached) | 1x Haiku | 1 call |
| After resume update | 1x Sonnet | 1x Haiku | 2 calls |

**Translation**: Most matches only use cheap Haiku! Expensive Sonnet is only used when:
- User uploads a new resume
- User updates their resume

---

## Troubleshooting

### Error: "model: claude-3-5-sonnet-latest" not found

**Cause**: Using `-latest` alias which doesn't exist for Sonnet

**Fix**: Set `PDF_PARSING_MODEL=claude-3-5-sonnet-20241022` in Vercel environment variables

### Error: Model mismatch or unsupported model

**Cause**: Environment variable not set or incorrect model name

**Fix**: 
1. Check Vercel environment variables
2. Ensure all required variables are set
3. Use date-based model names, not `-latest` aliases
4. Redeploy after updating environment variables

### Error: "FREE_TIER_MODEL is not defined"

**Cause**: Missing environment variable

**Fix**: Add `FREE_TIER_MODEL=claude-3-5-haiku-20241022` to environment variables

---

## Migration Checklist for Production

- [ ] Set `FREE_TIER_MODEL=claude-3-5-haiku-20241022` in Vercel
- [ ] Set `PDF_PARSING_MODEL=claude-3-5-sonnet-20241022` in Vercel
- [ ] Set `BYOK_MODEL=claude-3-5-haiku-20241022` in Vercel (optional, defaults to FREE_TIER_MODEL)
- [ ] Set `FREE_TIER_LIMIT=5` in Vercel
- [ ] Verify `ANTHROPIC_API_KEY` is set in Vercel
- [ ] Deploy the updated code
- [ ] Test "Calculate Match" functionality
- [ ] Verify no 404 model errors in logs

---

## Related Files

- `.env` - Local environment variables (not in Git)
- `.env.example` - Template for environment variables
- `src/lib/ai/parser.ts` - Uses these environment variables
- `src/lib/ai/providers.ts` - AI provider implementations
- `PRODUCTION_DEPLOYMENT.md` - Deployment guide
- `DATABASE_MIGRATIONS.md` - Migration guide

---

**Last Updated**: 2026-08-21  
**Status**: ✅ All model names now use environment variables
