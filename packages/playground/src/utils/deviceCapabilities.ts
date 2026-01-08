/**
 * Device Capabilities Detection
 * 
 * Detects device capabilities to determine appropriate particle limits.
 * Uses simple mobile/desktop detection to avoid exhausting GPU adapters.
 * No longer requests GPU adapters to prevent adapter exhaustion issues.
 */

/**
 * Detects if the device is mobile based on user agent and screen size
 */
export function isMobileDevice(): boolean {
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  
  // Also check screen size as a secondary indicator
  const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
  
  return mobileRegex.test(userAgent) || (isSmallScreen && 'ontouchstart' in window);
}

function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || (navigator as any).vendor || "";
}

function hasTelegramWebViewSignals(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;

  // Telegram Web Apps commonly inject one of these.
  if (w.Telegram?.WebApp) return true;
  if (w.TelegramWebviewProxy) return true;
  if (w.TelegramGameProxy) return true;

  // Telegram Web Apps also append tgWebApp* params to the URL.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("tgWebAppPlatform")) return true;
    if (params.has("tgWebAppVersion")) return true;
    if (params.has("tgWebAppStartParam")) return true;
  } catch {
    // ignore
  }

  return false;
}

function hasGenericWebViewBridgeSignals(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;

  // iOS WKWebView bridge (not present in Safari).
  if (w.webkit?.messageHandlers) return true;

  // React Native WebView
  if (w.ReactNativeWebView) return true;

  return false;
}

/**
 * Best-effort WebView / in-app browser detection.
 * There is no perfect, standards-based way to detect "in-app browser" vs Safari/Chrome,
 * so we rely on conservative UA heuristics.
 */
export function isProbablyWebView(): boolean {
  const ua = getUserAgent();

  // Prefer high-signal runtime checks over UA guessing.
  if (hasTelegramWebViewSignals()) return true;
  if (hasGenericWebViewBridgeSignals()) return true;

  // Known in-app browser tokens (not exhaustive, but high-signal).
  // Telegram: "Telegram"
  // Instagram: "Instagram"
  // Facebook: "FBAN", "FBAV"
  // X/Twitter: "Twitter", "XApp", "X/<version>"
  if (/\bTelegram\b/i.test(ua)) return true;
  if (/\bInstagram\b/i.test(ua)) return true;
  if (/\bFBAN\b|\bFBAV\b/i.test(ua)) return true;
  if (/\bTwitter\b/i.test(ua)) return true;
  if (/\bXApp\b/i.test(ua)) return true;
  if (/\bX\/\d+/i.test(ua)) return true;

  // Android WebView often includes "; wv" or "Version/x.y".
  const isAndroid = /Android/i.test(ua);
  if (isAndroid && /\bwv\b/i.test(ua)) return true;
  if (isAndroid && /Version\/\d+/i.test(ua) && /Chrome\/\d+/i.test(ua)) return true;

  // iOS WebView often omits "Version/" even though it contains "Safari/".
  // Exclude major iOS browsers that also use WebKit but aren't "in-app webviews".
  const isiOS = /iPhone|iPad|iPod/i.test(ua);
  const isOtheriOSBrowser = /\b(CriOS|FxiOS|EdgiOS|OPiOS)\b/i.test(ua);
  if (isiOS && !isOtheriOSBrowser && /Safari\/\d+/i.test(ua) && !/Version\/\d+/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * WebGPU feature presence check (no adapter request).
 * In some in-app browsers (e.g. X), `navigator.gpu` is missing/disabled.
 */
export function isWebGPUAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as any).gpu;
}

export function shouldBlockInAppBrowserForWebGPU(): boolean {
  // Only block on mobile + likely webview/in-app browser + missing WebGPU.
  return isMobileDevice() && isProbablyWebView() && !isWebGPUAvailable();
}

// Backwards-compatible name (kept in case anything else imports it).
export function shouldBlockTwitterInAppBrowserForWebGPU(): boolean {
  return shouldBlockInAppBrowserForWebGPU();
}

// Removed estimateGPUCapability - no longer requesting GPU adapter for capability detection
// This prevents adapter exhaustion. We now only use mobile/desktop detection.

/**
 * Calculates appropriate maxParticles based on device capabilities
 * 
 * @param preferredMaxParticles - Preferred maximum (default: 40000 for desktop, 10000 for mobile)
 * @returns Recommended maxParticles value
 */
export async function calculateMaxParticles(preferredMaxParticles?: number): Promise<number> {
  const isMobile = isMobileDevice();
  
  // Base limits: mobile devices typically handle fewer particles
  // No longer requesting GPU adapter to avoid adapter exhaustion
  const mobileBaseLimit = 24000;
  const desktopBaseLimit = 80000;
  
  // Simple mobile/desktop detection - no GPU adapter requests
  const baseLimit = isMobile ? mobileBaseLimit : desktopBaseLimit;
  return preferredMaxParticles ? Math.min(preferredMaxParticles, baseLimit) : baseLimit;
}


