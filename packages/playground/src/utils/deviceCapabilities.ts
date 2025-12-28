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

/**
 * Quick synchronous check for mobile device (for initial estimates)
 */
export function isMobileDeviceSync(): boolean {
  return isMobileDevice();
}

