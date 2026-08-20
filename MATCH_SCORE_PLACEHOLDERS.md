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

## Testing
- [ ] User with no profile sees "Upload Profile" pill
- [ ] Clicking pill navigates to /account
- [ ] User with profile sees match scores normally
