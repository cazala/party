### `worker` (Cloudflare Worker)

This package deploys a **route-scoped Cloudflare Worker** that serves the Party playground at:

- **`https://caza.la/party`**

It does this by **reverse-proxying** to the upstream origin:

- **`https://party.caza.la`**

The browser URL stays on **`caza.la/party...`** (no redirects to `*.pages.dev`, `party.caza.la`, or the upstream domain).

### Configuration

Configured in `wrangler.toml`:

- **Worker name**: `cazala-edge-party`
- **Route**: `caza.la/party*`
- **Upstream**: `vars.UPSTREAM_ORIGIN` (default: `https://party.caza.la`)
- **Response header**: `x-edge-proxy: cazala-party-worker`

### Scripts

- **Typecheck**:

```bash
pnpm --filter worker typecheck
```

- **Deploy**:

```bash
pnpm --filter worker deploy
```

