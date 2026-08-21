# Production Deployment Guide - Resume-Only Feature

## ✅ Automatic Migrations Now Enabled!

As of this update, database migrations run **automatically** on every Vercel deployment via the `vercel-build` script. You no longer need to manually run migrations!

### How It Works

When you push code to Vercel:
1. Vercel runs `npm run vercel-build` (instead of `npm run build`)
2. This script runs `prisma migrate deploy` first
3. Then builds the Next.js app
4. Your database is always in sync! 🎉

## ⚠️ ONE-TIME MIGRATION REQUIRED (First Time Only)

Since this automation was just added, you need to run the migration **once** for the current production database. After this, all future migrations will be automatic.

## Migration Steps (One-Time Setup)

### Option 1: Using Vercel CLI (Recommended)

```bash
# 1. Install Vercel CLI if not already installed
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Link to your project (if not already linked)
vercel link

# 4. Pull production environment variables
vercel env pull .env.production

# 5. Run the migration against production database
# IMPORTANT: Use the production DATABASE_URL from .env.production
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

### Option 2: Direct Database Migration

If you have direct access to your production database:

```bash
# Set the production database URL
export DATABASE_URL="your-production-database-url"

# Run the migration
npx prisma migrate deploy

# Verify the migration was applied
npx prisma migrate status
```

### Option 3: Using Prisma Data Platform (if using Neon/PlanetScale/etc.)

Some database platforms provide migration tools in their dashboard. Check your database provider's documentation.

## What This Migration Does

The migration `20260821155231_simplify_to_resume_only_clean` performs the following:

### Adds to `User` table:
- `parsedResume` (JSONB) - Cached AI-parsed resume data
- `resumeHash` (TEXT) - SHA-256 hash of resume PDF for change detection
- `resumeLastParsedAt` (TIMESTAMP) - When resume was last parsed
- `resumeUpdatedAt` (TIMESTAMP) - When resume was last uploaded

### Adds to `Job` table:
- `matchCalculatedWithResumeHash` (TEXT) - Tracks which resume version was used for match calculation

### Removes from `User` table (old LinkedIn approach):
- `linkedinData` (JSONB)
- `linkedinSyncedAt` (TIMESTAMP)
- `linkedinUrl` (TEXT)

## Verification

After running the migration, verify it was applied:

```bash
# Check migration status
DATABASE_URL="your-production-database-url" npx prisma migrate status

# Should show:
# ✓ 20260818143935_init
# ✓ 20260818144114_add_extension_session
# ✓ 20260820152204_add_byok_fields
# ✓ 20260820194604_add_linkedin_synced_at
# ✓ 20260821155231_simplify_to_resume_only_clean  <-- This should be applied
```

## Deployment Checklist

- [ ] Run one-time database migration (see Option 1 or 2 above)
- [ ] Verify migration status shows all 5 migrations applied
- [ ] Push code to trigger Vercel deployment (migrations will auto-run from now on)
- [ ] Test "Calculate Match" button in production
- [ ] Verify no 500 errors in Vercel logs
- [ ] Test resume upload functionality
- [ ] Test stale match detection (upload new resume, verify "Recalculate Match" appears)

## Future Deployments (Fully Automated)

After the one-time migration above, all future deployments will:
1. ✅ Automatically run `prisma migrate deploy` during build
2. ✅ Apply any new migrations before deploying code
3. ✅ Keep your database schema in sync with your code

**No manual intervention needed!** Just push your code and Vercel handles the rest.

## Rollback Plan

If you need to rollback this migration:

⚠️ **WARNING**: Rollback will delete the new resume fields (`parsedResume`, `resumeHash`, etc.). User resume URLs will be preserved, but cached parsed data will be lost.

```bash
# NOT RECOMMENDED - only if absolutely necessary
DATABASE_URL="your-production-database-url" npx prisma migrate resolve --rolled-back 20260821155231_simplify_to_resume_only_clean
```

## Environment Variables Required

Ensure these are set in your Vercel production environment:

```bash
DATABASE_URL=postgresql://...           # Your Neon/Postgres production DB
BLOB_READ_WRITE_TOKEN=...              # Vercel Blob storage token
ANTHROPIC_API_KEY=sk-ant-...           # For free tier AI parsing
FREE_TIER_LIMIT=5                      # Number of free AI analyses
FREE_TIER_MODEL=claude-3-5-haiku-20241022  # Free tier model
API_KEY_ENCRYPTION_SECRET=...          # 32-byte secret for BYOK encryption
```

## Common Issues

### Issue: "Database schema not up to date"
**Solution**: Run the migration using Option 1 or 2 above

### Issue: "User not found" or "Job not found"
**Solution**: Check that the user is properly authenticated and the job belongs to them

### Issue: "No resume uploaded"
**Solution**: User needs to upload a resume in Account Settings first

### Issue: "Free tier limit exceeded"
**Solution**: User needs to add their own API key (BYOK feature) or contact support

## Need Help?

Check Vercel deployment logs:
```bash
vercel logs --production
```

Check database connection:
```bash
DATABASE_URL="your-production-database-url" npx prisma db execute --stdin <<< "SELECT current_database();"
```

## Safety Features

The code includes safety checks:
- ✅ Detects schema mismatch and returns helpful error message
- ✅ Validates user has resume uploaded before attempting match calculation
- ✅ Caches parsed resumes to avoid redundant AI API calls
- ✅ Tracks resume versions with SHA-256 hash for smart re-parsing
- ✅ Graceful error handling with user-friendly messages

---

**Last Updated**: 2026-08-21  
**Migration Version**: `20260821155231_simplify_to_resume_only_clean`
