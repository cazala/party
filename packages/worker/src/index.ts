/// <reference lib="webworker" />

export interface Env {
  UPSTREAM_ORIGIN: string;
}

const EDGE_PROXY_HEADER_VALUE = "cazala-party-worker";
const PARTY_PREFIX = "/party";
const CANONICAL_ORIGIN = "https://caza.la";
const ALTERNATE_HOST = "party.caza.la";

function canonicalPartyPath(pathname: string): string {
  if (pathname === PARTY_PREFIX || pathname === "/") {
    return `${PARTY_PREFIX}/`;
  }

  if (pathname.startsWith(`${PARTY_PREFIX}/`)) {
    return pathname;
  }

  return `${PARTY_PREFIX}${pathname}`;
}

function canonicalPartyUrl(url: URL): URL {
  const canonicalUrl = new URL(canonicalPartyPath(url.pathname), CANONICAL_ORIGIN);
  canonicalUrl.search = url.search;
  return canonicalUrl;
}

function isBodyAllowed(method: string): boolean {
  // Cloudflare's fetch follows standard semantics: GET/HEAD should not include a body.
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD";
}

function looksLikeAssetPath(pathname: string): boolean {
  // The upstream Vite build typically serves hashed assets under /assets/.
  // We keep it intentionally conservative.
  if (!pathname.startsWith("/assets/")) return false;
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".map") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".ttf")
  );
}

function withEdgeHeader(headers: Headers): Headers {
  const out = new Headers(headers);
  out.set("x-edge-proxy", EDGE_PROXY_HEADER_VALUE);
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1) Routing rules
    if (url.hostname === ALTERNATE_HOST) {
      return new Response(null, {
        status: 301,
        headers: withEdgeHeader(
          new Headers({
            Location: canonicalPartyUrl(url).toString(),
          }),
        ),
      });
    }

    if (url.pathname === PARTY_PREFIX) {
      // Trailing slash normalization (same-host, same-scheme).
      return new Response(null, {
        status: 308,
        headers: withEdgeHeader(
          new Headers({
            Location: `${PARTY_PREFIX}/`,
          }),
        ),
      });
    }

    if (!url.pathname.startsWith(`${PARTY_PREFIX}/`)) {
      // Defensive; route should already constrain it.
      return new Response("Not Found", {
        status: 404,
        headers: withEdgeHeader(new Headers()),
      });
    }

    // Strip the /party prefix, preserving the leading slash.
    let upstreamPath = url.pathname.slice(PARTY_PREFIX.length);
    if (upstreamPath === "") upstreamPath = "/"; // should not happen for /party/..., but keep safe

    let upstreamOrigin: URL;
    try {
      upstreamOrigin = new URL(env.UPSTREAM_ORIGIN);
    } catch {
      return new Response("Upstream origin misconfigured", {
        status: 500,
        headers: withEdgeHeader(new Headers()),
      });
    }

    const upstreamUrl = new URL(upstreamOrigin.toString());
    upstreamUrl.pathname = upstreamPath;
    upstreamUrl.search = url.search;

    // 2) Headers handling
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete("host");
    upstreamHeaders.delete("accept-encoding");
    upstreamHeaders.set("x-edge-proxy", EDGE_PROXY_HEADER_VALUE);

    const init: RequestInit = {
      method: request.method,
      headers: upstreamHeaders,
      body: isBodyAllowed(request.method) ? request.body : undefined,
      redirect: "manual",
    };

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, init);
    } catch {
      return new Response("Bad Gateway", {
        status: 502,
        headers: withEdgeHeader(new Headers()),
      });
    }

    // 3) Caching (keep it simple)
    // Only add long-lived caching if upstream didn't provide it.
    const responseHeaders = withEdgeHeader(upstreamResponse.headers);
    // The Pages origin is deliberately noindex. Only the canonical proxy is indexable.
    responseHeaders.delete("x-robots-tag");
    if (looksLikeAssetPath(upstreamPath) && !responseHeaders.has("cache-control")) {
      responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
