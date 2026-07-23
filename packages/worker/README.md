### `worker` (Cloudflare Worker)

This package deploys a **route-scoped Cloudflare Worker** that serves Party at its canonical URL:

- **`https://caza.la/party/`**

It reverse-proxies canonical requests to the Cloudflare Pages origin:

- **`https://party-playground.pages.dev`**

The browser URL stays on **`caza.la/party...`**. Requests to the old public origin, **`https://party.caza.la/*`**, receive a permanent redirect to the equivalent canonical path. Existing `/party/...` paths are preserved, so shared playground sessions are not broken.

The Pages build sends `X-Robots-Tag: noindex` to prevent the raw origin from competing in search results. The Worker removes that header from responses served through the canonical URL.

### Configuration

Configured in `wrangler.toml`:

- **Worker name**: `cazala-party-worker`
- **Canonical route**: `caza.la/party*`
- **Redirect route**: `party.caza.la/*`
- **Upstream**: `vars.UPSTREAM_ORIGIN` (default: `https://party-playground.pages.dev`)
- **Response header**: `x-edge-proxy: cazala-party-worker`

### Scripts

- **Typecheck**:

```bash
pnpm --filter worker run typecheck
```

- **Deploy**:

```bash
pnpm --filter worker run deploy
```
