# LLM Instructions: Create an “edge” repo with a Cloudflare Worker reverse-proxy for `caza.la/party`

You are implementing a **new GitHub repository** (an “edge” repo) that deploys a **Cloudflare Worker** to the `caza.la` Cloudflare zone.

The Worker must **serve the Party playground at `https://caza.la/party`** by **reverse-proxying** to an upstream origin that already serves the playground:

- **Upstream origin (MUST)**: `https://party-assets.caza.la`
  - This is a **second Cloudflare Pages deployment** of the Party playground that is built with Vite `base="/party/"`.
  - `party.caza.la` remains the “normal” root build and is **not** the Worker upstream for `caza.la/party`.

## Non‑negotiable requirements

- **No redirect to `*.pages.dev`** at any point.
  - The browser URL must remain **`caza.la/party...`** while using the playground.
- Root website must remain at **`https://caza.la/`** (served by the separate `caza.la` repo / its own Cloudflare Pages project).
- The Worker must only handle the `/party` subtree (route-scoped), and must not affect other paths.

## What you are building

### Behavior summary

- Requests to `https://caza.la/party` should 308 to `https://caza.la/party/` (same-host, same-scheme).  
  This is only a trailing-slash normalization and still satisfies “no redirect to pages.dev”.
- Requests to `https://caza.la/party/*` should be proxied to the upstream by **stripping** the `/party` prefix:
  - `GET /party/` → upstream `GET /`
  - `GET /party/assets/x.js` → upstream `GET /assets/x.js`
  - `GET /party/some/spa/route` → upstream `GET /some/spa/route`
- The Worker must preserve:
  - method (GET/POST/etc)
  - query string
  - request body
  - most headers (with a few safe adjustments described below)
- The Worker must return upstream responses mostly as-is (status, headers, body).

### Important dependency (already decided)

This Worker is **route-scoped to `caza.la/party*`**, so the app must request its assets/chunks under `/party/...` on `caza.la`.

That is why the upstream is **`party-assets.caza.la`**, which is built with:

- Vite `base: "/party/"`
- Cloudflare Pages SPA fallback (`/* /index.html 200`)

## Repo deliverables

Create a repo with:

- `src/index.ts` (or `src/worker.ts`): Worker implementation (TypeScript)
- `wrangler.toml`: Wrangler config
- `package.json`: scripts for typecheck + deploy
- `tsconfig.json`
- `README.md`: setup + deploy instructions
- `.github/workflows/deploy.yml`: CI deploy on push to `main`

Prefer minimal dependencies (no frameworks needed).

## Cloudflare + Wrangler configuration

### Worker name

Use a clear name, e.g.:

- `cazala-edge-party`

### Route

The Worker must be attached to the `caza.la` zone with **route**:

- `caza.la/party*`

### Configuration style (recommended)

Use environment variables so upstream can be changed without code changes:

- `UPSTREAM_ORIGIN = "https://party-assets.caza.la"`

In `wrangler.toml`:

- define `vars.UPSTREAM_ORIGIN`
- set a pinned `compatibility_date`

## Worker implementation details (must follow)

### 1) Routing rules

- If path is exactly `/party`, redirect to `/party/` (308).
- If path does not start with `/party/`, return 404 (defensive; route should already constrain it).
- Otherwise proxy:
  - Strip the `/party` prefix from `pathname`
  - Use upstream host from `UPSTREAM_ORIGIN`
  - Keep query string

### 2) Headers handling

- Forward most request headers, but:
  - Remove `Host` (it must match the upstream host)
  - Consider removing `Accept-Encoding` (Cloudflare will manage compression; leaving it is usually okay, but removing avoids rare edge-cases)
  - Add a helpful header for debugging:
    - `x-edge-proxy: cazala-edge-party`

### 3) Caching (keep it simple)

Default: do not implement custom caching at first.

Optionally:

- For requests that look like hashed assets (e.g. `/assets/*.js`, `/assets/*.css`), you may set `Cache-Control: public, max-age=31536000, immutable` **only if** upstream doesn’t already do this correctly.
- For `index.html` and SPA routes, keep caching conservative (or unchanged).

### 4) Content rewriting (do NOT do unless necessary)

Do not attempt HTML rewriting unless tests show it’s needed.
The primary mechanism should be path stripping + upstream build base configuration.

### 5) Error handling

- If upstream fetch fails, return a 502 with a short message.
- Never leak secrets.

## Acceptance tests (must pass)

Assume the Worker is deployed and route is active.

- Visiting `https://caza.la/party` loads the playground and ends at `https://caza.la/party/` (same host).
- Hard refresh on a nested route works (SPA):
  - Open `https://caza.la/party/some/deep/route`
  - Refresh page → it still loads (no 404).
- Static assets load from `/party/assets/...` (verify in DevTools network).
- `https://caza.la/` and other non-`/party` routes continue to work and are not served by this Worker.
- There is **no** redirect to `party-assets.caza.la`, `party.caza.la`, or any `*.pages.dev` URL.

## GitHub Actions deploy

Implement `.github/workflows/deploy.yml` that:

- runs on push to `main`
- installs deps
- typechecks (or `tsc --noEmit`)
- deploys with `wrangler deploy`

Use secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do NOT require interactive login.

## Suggested file contents (outline)

### `package.json`

- scripts:
  - `typecheck`: `tsc --noEmit`
  - `deploy`: `wrangler deploy`

### `wrangler.toml`

- `name = "cazala-edge-party"`
- `main = "src/index.ts"`
- `compatibility_date = "YYYY-MM-DD"`
- `routes = [{ pattern = "caza.la/party*", zone_name = "caza.la" }]`
- `vars = { UPSTREAM_ORIGIN = "https://party-assets.caza.la" }`

### `src/index.ts`

- implement the routing + proxy described above

## Notes / pitfalls

- The Worker route must be **path-scoped**. Do not bind it to all of `caza.la/*`.
- Be careful when stripping paths:
  - `/party/` must become `/` (not empty)
- Don’t accidentally proxy `/party` without normalizing slash; relative URLs can behave differently.
- Don’t rely on `*.pages.dev` anywhere (it may change).

## Definition of done

- Repo can be cloned and deployed by CI with only the two Cloudflare secrets.
- Worker is deployed and mounted on `caza.la/party*`.
- All acceptance tests above pass.


