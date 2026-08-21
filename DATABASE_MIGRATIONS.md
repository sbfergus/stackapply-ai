# Database Migrations Guide

## 🎯 Quick Answer

**Migrations are now automated!** When you push code to Vercel, migrations run automatically during deployment.

---

## How Automated Migrations Work

### The Setup

In `package.json`, we have:
```json
{
  "scripts": {
    "vercel-build": "prisma migrate deploy && npm run build"
  }
}
```

Vercel automatically runs `npm run vercel-build` (if it exists) instead of `npm run build`.

### The Flow

```
1. You push code to GitHub
   ↓
2. Vercel detects the push
   ↓
3. Vercel runs: npm install
   ↓
4. Vercel runs: npm run vercel-build
   ↓
5. This runs: prisma migrate deploy
   ↓
6. Migrations are applied to production DB
   ↓
7. Then runs: npm run build
   ↓
8. Next.js app is built
   ↓
9. Deployment completes
   ↓
10. Your DB and code are in sync! ✅
```

---

## One-Time Setup (If You Haven't Migrated Yet)

If your production database isn't migrated yet, run this **once**:

```bash
# Option 1: Using Vercel CLI (recommended)
vercel env pull .env.production
npx prisma migrate deploy

# Option 2: Using DATABASE_URL directly
DATABASE_URL="your-neon-url" npx prisma migrate deploy
```

After this one-time migration, all future migrations will be automatic.

---

## Creating New Migrations (Development)

When you make schema changes in development:

```bash
# 1. Edit prisma/schema.prisma with your changes

# 2. Create a migration (this creates a new migration file)
npx prisma migrate dev --name your_migration_name

# 3. Test locally to ensure it works

# 4. Commit and push
git add .
git commit -m "Add migration for X feature"
git push

# 5. Vercel automatically applies the migration in production! 🎉
```

---

## Migration Files

Migrations are stored in `prisma/migrations/`:

```
prisma/migrations/
├── 20260818143935_init/
├── 20260818144114_add_extension_session/
├── 20260820152204_add_byok_fields/
├── 20260820194604_add_linkedin_synced_at/
└── 20260821155231_simplify_to_resume_only_clean/  ← Latest
```

Each folder contains:
- `migration.sql` - The actual SQL to run
- Prisma tracks which migrations have been applied

---

## Checking Migration Status

### In Development
```bash
npx prisma migrate status
```

### In Production
```bash
# Pull production env vars first
vercel env pull .env.production

# Then check status (uses DATABASE_URL from .env.production)
npx prisma migrate status
```

### Using the Schema Checker Script
```bash
DATABASE_URL="your-production-url" npx tsx scripts/check-db-schema.ts
```

---

## Common Scenarios

### Scenario 1: I pushed code but forgot the migration file
**What happens**: Vercel build succeeds, but app may have errors if code uses new fields.

**Solution**: 
```bash
# Create the migration locally
npx prisma migrate dev --name missing_migration

# Commit and push
git add prisma/migrations/
git commit -m "Add missing migration"
git push
# Vercel will run it automatically
```

### Scenario 2: Migration fails during Vercel build
**What happens**: Vercel deployment fails with Prisma error in build logs.

**Solution**:
1. Check Vercel build logs for the exact error
2. Fix the migration locally
3. Test with `npx prisma migrate dev`
4. Push the fixed migration
5. Vercel will retry automatically

### Scenario 3: I need to rollback a migration
**What happens**: A migration broke something in production.

**Solution**:
```bash
# This is complex - contact support or:
# 1. Create a new "undo" migration that reverses the changes
# 2. Test locally
# 3. Deploy the undo migration
```

⚠️ **Never manually edit applied migrations!** Always create a new migration.

---

## Environment Variables

The automation requires:
- ✅ `DATABASE_URL` - Set in Vercel environment variables (automatically available during build)

Vercel injects this during the build process, so migrations have access to your production database.

---

## Best Practices

### ✅ DO:
- Always test migrations locally first (`npx prisma migrate dev`)
- Use descriptive migration names (`add_user_resume_fields`)
- Commit migration files to Git
- Let Vercel run migrations automatically

### ❌ DON'T:
- Edit migration files after they've been applied
- Delete migration files
- Run migrations manually in production (unless emergency)
- Skip testing migrations locally

---

## Troubleshooting

### Build fails with "Migration X has already been applied"
This is normal if the migration was manually applied. Prisma will skip it.

### Build fails with "Migration X is missing"
The migration file isn't in Git. Create it locally and push it.

### Build succeeds but app has 500 errors
Migration may have failed silently. Check:
```bash
DATABASE_URL="your-prod-url" npx prisma migrate status
```

### "Database schema not up to date" error
Run the schema checker:
```bash
DATABASE_URL="your-prod-url" npx tsx scripts/check-db-schema.ts
```

---

## Safety Features

### Built into the App:
- ✅ Schema mismatch detection (returns helpful error if DB not migrated)
- ✅ Graceful error handling
- ✅ Detailed error logging in production

### Built into Prisma:
- ✅ Idempotent migrations (safe to run multiple times)
- ✅ Transaction support (migrations run in transactions)
- ✅ Migration history tracking

---

## Related Files

- `package.json` - Contains `vercel-build` script
- `prisma/schema.prisma` - Your database schema
- `prisma/migrations/` - All migration files
- `scripts/check-db-schema.ts` - Schema validation tool
- `PRODUCTION_DEPLOYMENT.md` - Full deployment guide

---

## Need Help?

Check Vercel build logs:
```bash
vercel logs --production
```

Check database status:
```bash
DATABASE_URL="your-url" npx prisma migrate status
```

Test schema:
```bash
DATABASE_URL="your-url" npx tsx scripts/check-db-schema.ts
```

---

**Last Updated**: 2026-08-21  
**Automation Status**: ✅ Enabled via `vercel-build` script
