# Deploy Extension Authentication to Production

## Step 1: Add Environment Variable to Vercel

Run this command to add the JWT secret:

```bash
vercel env add EXTENSION_JWT_SECRET
```

When prompted:
- **Value**: `your-extension-jwt-secret-change-this-in-production`
- **Environment**: Select "Production" (and optionally Preview/Development)

Or add it manually in Vercel dashboard:
1. Go to https://vercel.com/sbfergus-projects/stackapply-ai/settings/environment-variables
2. Add new variable:
   - Name: `EXTENSION_JWT_SECRET`
   - Value: `your-extension-jwt-secret-change-this-in-production`
   - Environment: Production

## Step 2: Deploy Database Migration

The migration already exists locally. To deploy to production:

```bash
npx prisma migrate deploy
```

This will:
- Create the `ExtensionSession` table
- Add the relation to the `User` table
- Create necessary indexes

## Step 3: Redeploy

After adding the environment variable, Vercel will automatically redeploy.
You can also manually trigger a redeploy:

```bash
vercel --prod
```

Or push a commit (already done).

## Step 4: Test

Once deployed, test the extension:
1. Click "Continue as Guest" - should work now
2. Try signing up with a new email
3. Try signing in
4. Save a job - should appear in your dashboard

## Troubleshooting

If still getting 500 errors:
1. Check Vercel logs: `vercel logs`
2. Verify env var is set: Go to Vercel dashboard > Settings > Environment Variables
3. Verify migration ran: Check database has `ExtensionSession` table
