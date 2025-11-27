# GitHub Actions Workflows

## Deploy to Cloudflare Pages

This workflow automatically deploys the playground to Cloudflare Pages:

- **Production**: Deploys to production on every push to `main` or `master` branch
- **Preview**: Creates preview deployments for every pull request to `main` or `master`

### Setup Instructions

1. **Create Cloudflare API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template or create custom token with:
     - Account > Cloudflare Pages > Edit permissions
   - Copy the token

2. **Get Cloudflare Account ID**:
   - Go to https://dash.cloudflare.com/
   - Click on any domain in your account (or go to Workers & Pages)
   - Look at the URL - it will contain `/accounts/` followed by a long string of characters/numbers - that's your Account ID
   - Alternatively, go to Workers & Pages → Overview, and the Account ID is shown in the right sidebar
   - Or go to https://dash.cloudflare.com/profile/api-tokens and look at the URL - it contains your Account ID
   - The Account ID is a long alphanumeric string (usually 32 characters)

3. **Add GitHub Secrets**:
   - Go to your GitHub repository > Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `CLOUDFLARE_API_TOKEN`: Your API token from step 1
     - `CLOUDFLARE_ACCOUNT_ID`: Your account ID from step 2

4. **Create Cloudflare Pages Project** (if not already created):
   - Go to Cloudflare Dashboard > Pages
   - Create a new project named `party-playground` (or update the workflow with your project name)
   - You can skip the build settings since we're using GitHub Actions

### Workflow Details

- **Build command**: Builds both `@cazala/party` (core) and `@cazala/playground`
- **Output directory**: `packages/playground/dist`
- **Node version**: 20
- **Package manager**: pnpm 9.15.0

The workflow will automatically:
- Install dependencies using pnpm
- Build the core package and playground
- Deploy to Cloudflare Pages
- Create preview deployments for PRs
- Deploy to production for master branch commits

