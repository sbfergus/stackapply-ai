# Comprehensive Profile Matching System

## Overview

The job matching system now combines **Resume + LinkedIn Profile** data to create a comprehensive candidate profile for accurate AI-powered job matching.

## Architecture

```
User Profile Data Sources
├── Resume PDF (uploaded)
│   └── baseResumeText (stored in DB)
└── LinkedIn PDF (uploaded)
    └── linkedinData (parsed JSON in DB)
         ├── name, headline, location
         ├── experience[]
         ├── education[]
         ├── skills[]
         └── certifications[]
                 ↓
        Profile Builder
        (profile-builder.ts)
                 ↓
    Comprehensive User Profile
    (deduplicated & formatted)
                 ↓
         AI Matching
         (parser.ts + providers.ts)
                 ↓
    Match Score (0-100) + Reasoning
                 ↓
        Job Card Display
```

## Key Components

### 1. Profile Builder (`src/lib/ai/profile-builder.ts`)

**Purpose:** Combines resume and LinkedIn data into a single comprehensive profile.

**Functions:**
- `buildComprehensiveProfile(userId)` - Fetches and merges all user data
- `formatProfileForAI(profile)` - Formats profile as readable text for AI
- `getProfileStats(profile)` - Returns profile completeness metrics

**Profile Structure:**
```typescript
{
  // Basic Info
  name: string,
  headline: string,
  location: string,
  
  // Experience (from LinkedIn)
  experience: Array<{
    title: string,
    company: string,
    dates: string,
    description: string,
    source: 'linkedin' | 'resume' | 'both'
  }>,
  
  // Skills (deduplicated)
  skills: string[],
  
  // Education, Certifications
  education: [...],
  certifications: [...],
  
  // Professional Summary
  summary: string,
  
  // Raw resume text
  resumeText?: string,
  
  // Metadata
  hasResume: boolean,
  hasLinkedInProfile: boolean,
  completeness: 0-100
}
```

### 2. Enhanced AI Matching (`src/lib/ai/providers.ts`)

**Matching Criteria (when profile is provided):**

| Criteria | Weight | Description |
|----------|--------|-------------|
| Technical Skills | 40% | Alignment with required/preferred technologies |
| Experience Level | 30% | Years and type of experience vs seniority level |
| Domain Experience | 15% | Similar industries or problem domains |
| Education & Certs | 10% | Meets educational/certification requirements |
| Location & Setting | 5% | Location and remote/hybrid/office preference |

**Scoring Guidelines:**
- **90-100**: Exceptional match, exceeds requirements
- **80-89**: Strong match, meets all key requirements
- **70-79**: Good match, minor gaps
- **60-69**: Moderate match, missing some skills
- **50-59**: Weak match, significant gaps
- **Below 50**: Poor match, not qualified

### 3. Updated Parser (`src/lib/ai/parser.ts`)

**Changes:**
- Now calls `buildComprehensiveProfile(userId)` automatically
- Passes formatted profile to AI provider
- No longer requires manual `userResumeText` parameter

**Before:**
```typescript
parseJobPosting(rawText, userId, userResumeText?)
```

**After:**
```typescript
parseJobPosting(rawText, userId)
// Automatically builds comprehensive profile internally
```

## Data Flow

### Job Analysis with Matching

```typescript
// 1. User saves job
POST /api/jobs { rawJobText, useAI: true }

// 2. Parser builds comprehensive profile
const profile = await buildComprehensiveProfile(userId);
const formatted = formatProfileForAI(profile);

// 3. AI analyzes job + profile
const result = await provider.parseJobPosting(jobText, formatted);

// 4. Returns structured data
{
  title, company, location,
  techStack, benefits,
  matchScore: 85,  // ← Calculated based on full profile
  matchReasoning: "Strong match. Your React and TypeScript..."
}

// 5. Stored in database
Job.create({ ...result, userId });
```

## Completeness Score

Profile completeness is calculated to help users understand gaps:

```typescript
// Scoring breakdown
Basic Info (name, headline, location): 30 points
Experience (1+ positions): 15 points
Experience (3+ positions): +10 points
Education: 10 points
Skills (any): 10 points
Skills (5+): +10 points
Professional Summary (50+ chars): 10 points
Certifications (bonus): +5 points

Total: 0-100
```

**UI Display:**
- Low (0-40%): Red indicator, prompt to upload resume/LinkedIn
- Medium (41-70%): Yellow indicator, suggest adding more info
- High (71-100%): Green indicator, ready for accurate matching

## Benefits

### For Users
✅ More accurate job matches  
✅ Better recommendations  
✅ Transparent matching reasoning  
✅ See profile completeness  
✅ Understand where they fit  

### For System
✅ Single source of truth for user data  
✅ Deduplicated skills/experience  
✅ Extensible (easy to add new sources)  
✅ Testable components  
✅ Clear data lineage  

## Future Enhancements

### Phase 2: Resume Parsing
- [ ] Parse resume PDF with AI
- [ ] Extract experience, skills, education
- [ ] Merge with LinkedIn data (mark duplicates)
- [ ] Allow users to edit/verify extracted data

### Phase 3: Smart Deduplication
- [ ] Fuzzy match company names ("Google" vs "Google LLC")
- [ ] Merge similar skills ("React" vs "React.js")
- [ ] Detect overlapping job experiences
- [ ] Highlight conflicts for user review

### Phase 4: Profile Management
- [ ] User profile page showing merged data
- [ ] Edit/verify extracted information
- [ ] Add manual experience/skills
- [ ] Profile versioning/history

### Phase 5: Advanced Matching
- [ ] Industry-specific matching weights
- [ ] Salary expectation alignment
- [ ] Company culture fit (if data available)
- [ ] Growth trajectory analysis
- [ ] Skill gap identification with learning resources

## Testing Checklist

Profile Building:
- [ ] LinkedIn-only profile builds correctly
- [ ] Resume-only profile builds correctly
- [ ] Combined profile merges without duplicates
- [ ] Completeness score calculates accurately
- [ ] Empty/null fields handled gracefully

Matching:
- [ ] Match score reflects combined profile data
- [ ] Reasoning explains score clearly
- [ ] Skills from LinkedIn considered in matching
- [ ] Experience history impacts score
- [ ] Location/remote preference factored in

Edge Cases:
- [ ] User with no resume or LinkedIn
- [ ] User with incomplete LinkedIn data
- [ ] Very long experience lists (10+ positions)
- [ ] Special characters in profile data
- [ ] Missing required job details

## Migration Notes

### Breaking Changes
❌ **None** - The API signature change is backward compatible since `userResumeText` was optional

### Database Changes
✅ No database migrations needed - uses existing fields:
- `User.baseResumeText`
- `User.linkedinData`
- `User.resumeUrl`

### Code Updates Required
Any code calling `parseJobPosting()` with explicit `userResumeText`:
```typescript
// Old (still works, but parameter ignored)
await parseJobPosting(rawText, userId, resumeText);

// New (recommended)
await parseJobPosting(rawText, userId);
```

The profile is now built automatically from database.

## Performance Considerations

**Profile Building:**
- Single database query per analysis
- Profile formatting is synchronous (fast)
- Results could be cached if needed

**Token Usage:**
- Comprehensive profile adds ~500-1000 tokens per request
- Within acceptable limits for Claude Haiku
- More accurate matching justifies slight cost increase

**Optimization Ideas:**
- Cache formatted profiles (TTL: 1 hour)
- Only rebuild if resume/LinkedIn data changed
- Compress very long experience descriptions
