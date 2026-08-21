# Resume Parsing Documentation

## Overview

The resume parsing system extracts structured data from PDF resumes using AI (Anthropic Claude Sonnet) and caches the results for efficient reuse across multiple job match calculations.

## Key Concepts

### Smart Caching Strategy

Resume parsing is **expensive** (requires Anthropic Sonnet for PDF support), so we implement aggressive caching:

- **Parse once**: Resume is parsed only when first needed
- **Reuse many times**: Cached data is used for all subsequent match calculations
- **Invalidate on change**: Cache is cleared when a new resume is uploaded

### Hash-Based Version Tracking

We use SHA-256 content hashing to track resume versions:

```typescript
// Same file content = Same hash (deterministic)
Resume v1 uploaded → hash: "abc123..."
Resume v2 uploaded → hash: "xyz789..."
Resume v1 re-uploaded → hash: "abc123..." (same!)
```

This enables:
- Detecting when resume content actually changes
- Restoring old match scores when user re-uploads previous resume
- Avoiding unnecessary recalculations

## When Resume Parsing Occurs

### Upload Phase (Storage Only)
```
POST /api/user/resume
  ↓
1. Validate PDF (type, size)
2. Generate SHA-256 hash from content
3. Upload to Vercel Blob storage
4. Save to database:
   - resumeUrl (blob URL)
   - resumeHash (SHA-256 hex string)
   - resumeUpdatedAt (current timestamp)
   - parsedResume = NULL (cleared)
   - resumeLastParsedAt = NULL (cleared)
5. NO AI PARSING (keeps upload fast and free)
```

### Match Calculation Phase (Parse on Demand)
```
POST /api/jobs/{id}/calculate-match
  ↓
1. Fetch user resume data
2. Check if parsing needed:
   
   needsReparsing = 
     !parsedResume ||                      // No cache exists
     !resumeLastParsedAt ||                // Never parsed
     resumeUpdatedAt > resumeLastParsedAt  // Resume changed after last parse
   
3. If needsReparsing:
   → Download PDF from blob storage
   → Convert to base64
   → Send to Anthropic Sonnet API
   → Extract structured data
   → Save to parsedResume field
   → Update resumeLastParsedAt
   
4. If cache exists and valid:
   → Use cached parsedResume (instant, free!)
   
5. Calculate match score using parsed data
6. Save matchCalculatedWithResumeHash = resumeHash
```

## Technical Implementation

### 1. Resume Upload (`/api/user/resume`)

**Hash Generation:**
```typescript
import { createHash } from "crypto";

const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const hash = createHash('sha256');
hash.update(buffer);
const resumeHash = hash.digest('hex');
```

**Database Update:**
```typescript
await prisma.user.update({
  where: { id: user.id },
  data: { 
    resumeUrl: blob.url,
    resumeHash: resumeHash,
    resumeUpdatedAt: new Date(),
    parsedResume: null,           // Clear cache
    resumeLastParsedAt: null,     // Force re-parse
  },
});
```

### 2. Resume Parsing (`parseResumePDF()`)

**PDF Download:**
```typescript
const response = await fetch(resumeUrl);
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
const base64 = buffer.toString('base64');
```

**AI Extraction (Anthropic):**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-latest',  // Must use Sonnet (Haiku doesn't support PDFs)
  max_tokens: 4096,
  temperature: 0,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      },
      {
        type: 'text',
        text: `Extract structured profile data from this resume PDF...`,
      },
    ],
  }],
});
```

**Structured Output:**
```typescript
interface ParsedResume {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    dates: string;
  }>;
  skills: string[];
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
}
```

### 3. Match Calculation (`/api/jobs/[id]/calculate-match`)

**Cache Check:**
```typescript
const needsReparsing = 
  !user.parsedResume || 
  !user.resumeLastParsedAt || 
  (user.resumeUpdatedAt && user.resumeLastParsedAt && 
   user.resumeUpdatedAt > user.resumeLastParsedAt);
```

**Conditional Parsing:**
```typescript
if (needsReparsing) {
  const parsedResume = await parseResumePDF(user.resumeUrl, userId);
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      parsedResume: parsedResume,
      resumeLastParsedAt: new Date(),
    },
  });
}
```

**Hash Tracking:**
```typescript
await prisma.job.update({
  where: { id: jobId },
  data: {
    matchScore: result.matchScore,
    matchReasoning: result.matchReasoning,
    matchCalculatedWithResumeHash: user.resumeHash,  // Track version!
  },
});
```

### 4. UI Detection (`dashboard/page.tsx`)

**Stale Match Detection:**
```typescript
const isStaleMatch = 
  job.matchScore && 
  job.matchCalculatedWithResumeHash && 
  userData?.resumeHash &&
  job.matchCalculatedWithResumeHash !== userData.resumeHash;
```

**Three UI States:**
```typescript
// State 1: No match score yet
if (!job.matchScore) {
  return <button>Calculate Match</button>;
}

// State 2: Valid score (hash matches)
if (!isStaleMatch) {
  return <span>85% Match</span>;
}

// State 3: Stale score (hash mismatch)
return <button>Recalculate Match</button>;
```

## Database Schema

```prisma
model User {
  resumeUrl           String?    // Blob storage URL
  resumeHash          String?    // SHA-256 content hash
  resumeUpdatedAt     DateTime?  // Upload timestamp
  parsedResume        Json?      // Cached structured data
  resumeLastParsedAt  DateTime?  // Parse timestamp
}

model Job {
  matchScore                     Int?     // 0-100
  matchReasoning                 String?  // AI explanation
  matchCalculatedWithResumeHash  String?  // Resume version tracking
}
```

## User Scenarios

### Scenario 1: First Resume Upload
```
1. User uploads Resume v1
   → resumeHash: "abc123"
   → parsedResume: null

2. User clicks "Calculate Match" on Job A
   → needsReparsing: true (no cache)
   → Parse Resume v1 with AI
   → Save parsedResume
   → Calculate match: 85%
   → Save matchCalculatedWithResumeHash: "abc123"
   → UI shows: "85% Match"

3. User clicks "Calculate Match" on Job B
   → needsReparsing: false (cache exists!)
   → Use cached parsedResume
   → Calculate match: 92%
   → Save matchCalculatedWithResumeHash: "abc123"
   → UI shows: "92% Match"
```

### Scenario 2: Resume Update
```
1. User has 5 jobs with calculated matches
   → All show: "85%", "92%", "78%", "88%", "95%"

2. User uploads Resume v2
   → resumeHash: "xyz789" (different!)
   → parsedResume: null (cleared)
   
3. Dashboard updates automatically
   → All 5 jobs show: "Recalculate Match" (amber)
   → Tooltip: "Your resume was updated..."

4. User clicks "Recalculate Match" on Job A
   → needsReparsing: true (cache cleared)
   → Parse Resume v2 with AI
   → Save parsedResume
   → Calculate match: 90%
   → Save matchCalculatedWithResumeHash: "xyz789"
   → UI shows: "90% Match"

5. Other jobs still show "Recalculate Match"
   → They're still using old hash "abc123"
   → User can recalculate as needed
```

### Scenario 3: Panic Recovery (Re-upload Old Resume)
```
1. User uploaded Resume v2, all matches show "Recalculate"
2. User realizes mistake, re-uploads Resume v1
   → resumeHash: "abc123" (SAME as before!)
   → parsedResume: null (cleared by upload)

3. Dashboard updates automatically
   → All jobs: "85%", "92%", "78%", "88%", "95%" (restored!)
   → Hash matches stored matchCalculatedWithResumeHash
   → Old scores are valid again!

4. If user clicks any match button
   → needsReparsing: true (cache was cleared)
   → Parse Resume v1 with AI
   → Get same structured data as before
   → Match score: 85% (same result)
   → No wasted credits, but parsing occurred
```

## Cost Implications

### Free Tier
- **Upload**: Free (no AI, just storage)
- **Parse**: Expensive (uses Sonnet, counts toward limit)
- **Match Calculation**: Included with parse (1 credit total)

### Custom API Key
- **Upload**: Free
- **Parse**: Uses user's Anthropic key (Sonnet pricing applies)
- **Match Calculation**: Included (uses same key)

### Optimization
- **First job**: 1 parse + 1 match = 1 credit
- **Additional jobs**: 0 parses + 1 match each = cheap!
- **Resume unchanged**: Cache hits = free
- **Resume changed**: 1 parse + N matches = still efficient

## Error Handling

### OpenAI Users
```typescript
if (user.apiKeyProvider === 'OPENAI') {
  throw new Error(
    'OpenAI does not support PDF parsing. ' +
    'Please use Anthropic API key or upload a different format.'
  );
}
```

### Missing Resume
```typescript
if (!user.resumeUrl) {
  return { 
    error: "No resume uploaded. Please upload your resume in Account Settings." 
  };
}
```

### PDF Fetch Failure
```typescript
const response = await fetch(resumeUrl);
if (!response.ok) {
  throw new Error(`Failed to fetch resume PDF: ${response.statusText}`);
}
```

### JSON Parse Failure
```typescript
try {
  linkedinData = JSON.parse(cleanedResponse);
} catch (parseError) {
  console.error('Failed to parse AI response:', cleanedResponse);
  throw new Error('AI returned invalid JSON');
}
```

## Best Practices

### For Developers

1. **Always use hash for comparison**, never timestamps alone
2. **Clear cache on upload** to force fresh parse
3. **Track hash with match scores** for version correlation
4. **Use Sonnet for PDFs** (Haiku doesn't support document type)
5. **Cache aggressively** to minimize API costs

### For Users

1. **Upload once** - resume is reused for all jobs
2. **Calculate matches** - parsing happens automatically
3. **Update resume carefully** - triggers recalculation across all jobs
4. **Re-upload old resume** - restores previous scores without recalculation

## Monitoring

### Key Metrics to Track

- **Parse rate**: How often `parseResumePDF()` is called
- **Cache hit rate**: `!needsReparsing` / total calculations
- **Hash collisions**: Same hash for different content (should be zero)
- **Parse failures**: AI errors, invalid JSON, timeouts

### Expected Behavior

- **Cache hit rate**: >90% after initial parse
- **Parse time**: 3-8 seconds (Anthropic API latency)
- **Hash generation**: <100ms (local, deterministic)
- **Match calculation**: 1-3 seconds (AI inference)

## Future Enhancements

### Potential Improvements

1. **Incremental updates**: Only re-parse changed sections
2. **Multiple resume versions**: Support different resumes for different job types
3. **Resume templates**: Pre-parse common formats
4. **Batch processing**: Parse multiple resumes in parallel
5. **Caching strategies**: Redis for faster cache access
6. **Resume validation**: Check for completeness before parsing

### Considerations

- **Storage costs**: Parsed data in JSON (typically 2-10KB per resume)
- **API costs**: Sonnet is expensive (~$15/1M tokens)
- **Latency**: First match calculation slower (includes parse)
- **Accuracy**: AI extraction may miss nuanced formatting

## Troubleshooting

### "Resume needs re-parsing" on every match
- Check `resumeLastParsedAt` is being saved correctly
- Verify timestamp comparison logic

### Match scores not restoring after re-upload
- Check hash generation is deterministic
- Verify same file produces same hash
- Ensure `matchCalculatedWithResumeHash` is saved

### Parse failures
- Check Anthropic API key is valid
- Verify PDF is not corrupted
- Ensure PDF size is under limits (5MB)
- Check model is `claude-3-5-sonnet-latest`

### Stale matches not detected
- Verify `resumeHash` is updated on upload
- Check UI is fetching `matchCalculatedWithResumeHash`
- Ensure hash comparison logic is correct

## Summary

The resume parsing system balances **performance** (aggressive caching), **cost** (parse once, reuse many times), and **user experience** (smart invalidation, panic recovery) to provide efficient AI-powered job matching.

Key innovations:
- ✅ Content-based version tracking (hash)
- ✅ Lazy parsing (on-demand, not on upload)
- ✅ Smart caching (timestamp-based invalidation)
- ✅ Panic-proof (re-upload old resume restores scores)
- ✅ Visual feedback (three distinct UI states)
