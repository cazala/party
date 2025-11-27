# Cloudflare Pages Configuration

This document describes the Cloudflare Pages setup for the Party playground.

## Required Secrets

Add these secrets to your GitHub repository settings (Settings > Secrets and variables > Actions):

1. **CLOUDFLARE_API_TOKEN**: Your Cloudflare API token with Pages permissions
   - Create at: https://dash.cloudflare.com/profile/api-tokens
   - Permissions needed: Account > Cloudflare Pages > Edit

2. **CLOUDFLARE_ACCOUNT_ID**: Your Cloudflare account ID
   - **Method 1**: Go to https://dash.cloudflare.com/ and click on any domain. Look at the URL - it will be like `https://dash.cloudflare.com/ACCOUNT_ID/...` - the ACCOUNT_ID part is what you need
   - **Method 2**: Go to Workers & Pages → Overview, and check the right sidebar
   - **Method 3**: Go to https://dash.cloudflare.com/profile/api-tokens - the Account ID is in the URL
   - The Account ID is a long alphanumeric string (usually 32 characters like `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
   - **Note**: This is NOT the same as Member ID or Zone ID

## Build Settings (if using Cloudflare Pages dashboard)

If you prefer to configure via Cloudflare Pages dashboard instead of GitHub Actions:

- **Build command**: `npm install && npm run build`
- **Build output directory**: `packages/playground/dist`
- **Root directory**: `/` (repository root)
- **Node version**: 20

## Manual Setup Steps

1. Go to Cloudflare Dashboard > Pages
2. Create a new project
3. Connect your GitHub repository
4. Configure build settings (or use the GitHub Actions workflow)
5. Add the required secrets to GitHub

## Project Name

The workflow uses `party-playground` as the project name. If you use a different name in Cloudflare Pages, update the `projectName` in `.github/workflows/deploy-cloudflare-pages.yml`.

