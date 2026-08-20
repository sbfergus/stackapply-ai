# Browser Extension Build Process

## Overview
The browser extension is automatically packaged into a zip file that users can download from the dashboard.

## Automatic Build

The extension is **automatically** built:

1. **During Production Deployment**: When you deploy to Vercel with `npm run build`, the extension is rebuilt automatically
2. **Manual Build**: Run `npm run build:extension` anytime you update extension files

## File Location

- **Source**: `extension/` directory (all extension files)
- **Output**: `public/stackapply-extension.zip` (served to users)

## How It Works

1. The build script (`scripts/build-extension.js`) runs before Next.js build
2. It zips all files in the `extension/` directory
3. The zip is placed in `public/` where Next.js serves it as a static file
4. Users click "Download Extension" button and get the latest version

## Manual Commands

```bash
# Build extension only
npm run build:extension

# Build everything (extension + Next.js app)
npm run build

# Development (no extension rebuild needed)
npm run dev
```

## Important Notes

- ✅ Extension is rebuilt on every production deployment
- ✅ Zip file is version-controlled in `public/` directory
- ✅ Changes to extension files are automatically included
- ❌ Don't manually create/update the zip file
- ❌ Extension changes require redeployment to take effect in production

## Verifying Latest Version

Check the manifest version in `extension/manifest.json` and compare with the downloaded zip to ensure you have the latest version.

Current version: See `extension/manifest.json`
