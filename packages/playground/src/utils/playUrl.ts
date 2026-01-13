const PLAY_SEGMENT = "play";

function base64EncodeUtf8(input: string): string {
  // btoa expects binary string; encode UTF-8 first.
  return btoa(unescape(encodeURIComponent(input)));
}

function base64DecodeUtf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

function base64ToBase64Url(b64: string): string {
  // URL-safe base64 for path segments.
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBase64(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return `${b64}${pad}`;
}

function getBaseNoTrailingSlash(): string {
  // Vite guarantees BASE_URL ends with "/" (see vite config normalizeBase()).
  const base = (import.meta as any).env?.BASE_URL as string | undefined;
  const normalized = typeof base === "string" ? base : "/";
  if (normalized === "/") return "";
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function stripBase(pathname: string): string {
  const baseNoSlash = getBaseNoTrailingSlash();
  if (!baseNoSlash) return pathname || "/";
  if (pathname.startsWith(baseNoSlash)) {
    const rest = pathname.slice(baseNoSlash.length);
    return rest || "/";
  }
  return pathname || "/";
}

function withBase(relativePath: string): string {
  const baseNoSlash = getBaseNoTrailingSlash();
  const rel = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${baseNoSlash}${rel}`;
}

export type PlayRoute =
  | { kind: "play"; hasSession: false }
  | { kind: "play"; hasSession: true; sessionParam: string }
  | { kind: "other" };

export function parseCurrentPlayRoute(): PlayRoute {
  const relPath = stripBase(window.location.pathname);

  if (relPath === `/${PLAY_SEGMENT}` || relPath === `/${PLAY_SEGMENT}/`) {
    return { kind: "play", hasSession: false };
  }

  const prefix = `/${PLAY_SEGMENT}/`;
  if (relPath.startsWith(prefix) && relPath.length > prefix.length) {
    const sessionParam = relPath.slice(prefix.length);
    return { kind: "play", hasSession: true, sessionParam };
  }

  return { kind: "other" };
}

export function buildPlayPath(): string {
  return withBase(`/${PLAY_SEGMENT}`);
}

export function encodePlaySessionParam(sessionJson: string): string {
  return base64ToBase64Url(base64EncodeUtf8(sessionJson));
}

export function decodePlaySessionParam(param: string): string {
  return base64DecodeUtf8(base64UrlToBase64(param));
}

export function buildPlaySessionPath(sessionJson: string): string {
  const encoded = encodePlaySessionParam(sessionJson);
  return withBase(`/${PLAY_SEGMENT}/${encoded}`);
}

