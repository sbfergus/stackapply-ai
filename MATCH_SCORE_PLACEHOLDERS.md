# Match Score Placeholders

## What Changed
Added smart placeholders for the match score pill when users haven't uploaded their resume or LinkedIn profile.

## Implementation

### Job Cards (Dashboard)
- Shows amber "Upload Profile" pill when user has no resume AND no LinkedIn profile
- Clicking navigates to `/account` page
- Shows green match score pill when available

### Job Details Drawer
- Shows amber banner explaining feature when user has no profile
- Shows green banner with match score and reasoning when available

## Files Modified
1. `src/app/(app)/dashboard/page.tsx` - Added userData state and fetch, updated pill rendering
2. `src/components/JobDetailsDrawer.tsx` - Added userHasProfile prop, updated banner rendering
3. `src/app/api/jobs/route.ts` - **Fixed**: Changed default matchScore from 85 to null
4. `src/components/AddJobModal.tsx` - **Fixed**: Removed fake random match scores (88-97%)

## Bug Fixes
### Issue: All jobs showed fake match scores
- **Problem**: Jobs were getting default match scores even without AI analysis
- **Root Cause 1**: `POST /api/jobs` defaulted `matchScore` to 85 when none provided
- **Root Cause 2**: `AddJobModal` set random scores between 88-97%
- **Fix**: Changed both to `null` - match scores now only exist when AI actually calculates them

## Testing
- [ ] User with no profile sees "Upload Profile" pill on NEW jobs
- [ ] Clicking pill navigates to /account
- [ ] User with profile sees match scores normally
- [ ] **Old jobs may still have fake scores - delete and re-add to test properly**
