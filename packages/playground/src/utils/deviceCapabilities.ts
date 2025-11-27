/**
 * Device Capabilities Detection
 * 
 * Detects device capabilities to determine appropriate particle limits.
 * Uses GPU adapter limits when available, falls back to mobile detection.
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

/**
 * Estimates device performance tier based on GPU adapter limits
 * Returns a score from 0-1 representing relative performance
 */
async function estimateGPUCapability(): Promise<number> {
  if (!navigator.gpu) {
    return 0; // No WebGPU, will use CPU fallback
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return 0;
    }

    const limits = adapter.limits;
    
    // Normalize key metrics to a 0-1 score
    // Higher buffer sizes and compute units indicate better performance
    const maxBufferSize = limits.maxBufferSize || limits.maxStorageBufferBindingSize || 0;
    const maxComputeWorkgroupStorageSize = limits.maxComputeWorkgroupStorageSize || 0;
    const maxComputeInvocationsPerWorkgroup = limits.maxComputeInvocationsPerWorkgroup || 0;
    
    // Normalize values (using more conservative ranges to better distinguish mobile from desktop)
    // maxBufferSize: mobile ~256MB-512MB, desktop ~2GB-4GB+
    // Use 2GB as normalization point to make mobile scores lower
    const bufferScore = Math.min(1, maxBufferSize / (2 * 1024 * 1024 * 1024)); // Normalize to 2GB
    
    // maxComputeWorkgroupStorageSize: mobile ~16KB, desktop ~32KB
    // Use 32KB as normalization (most devices max this out, so less discriminative)
    const workgroupStorageScore = Math.min(1, maxComputeWorkgroupStorageSize / 32768);
    
    // maxComputeInvocationsPerWorkgroup: mobile ~256-512, desktop ~1024
    // Use 1024 as normalization
    const invocationsScore = Math.min(1, maxComputeInvocationsPerWorkgroup / 1024);
    
    // Weighted average - heavily favor buffer size (most discriminative)
    // Reduced weight on other metrics since they're less variable
    const score = (bufferScore * 0.8) + (workgroupStorageScore * 0.1) + (invocationsScore * 0.1);
    
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    // If adapter request fails, return 0
    return 0;
  }
}

/**
 * Calculates appropriate maxParticles based on device capabilities
 * 
 * @param preferredMaxParticles - Preferred maximum (default: 40000 for desktop, 10000 for mobile)
 * @returns Recommended maxParticles value
 */
export async function calculateMaxParticles(preferredMaxParticles?: number): Promise<number> {
  const isMobile = isMobileDevice();
  
  // Base limits: mobile devices typically handle fewer particles
  const mobileBaseLimit = 8000;
  const desktopBaseLimit = 50000;
  
  // If WebGPU is available, try to get a more accurate estimate
  if (navigator.gpu) {
    try {
      const gpuScore = await estimateGPUCapability();
      
      if (isMobile) {
        // For mobile devices, use a more conservative approach
        // Cap the GPU score influence to keep mobile devices closer to mobileBaseLimit
        // Apply a curve that keeps mobile scores lower
        const mobileAdjustedScore = Math.pow(gpuScore, 2); // Stronger curve to reduce high scores
        const mobileMaxLimit = 10000; // Cap mobile devices at 10k even with high GPU score
        
        // Interpolate between mobileBaseLimit and mobileMaxLimit
        const calculatedLimit = mobileBaseLimit + (mobileMaxLimit - mobileBaseLimit) * mobileAdjustedScore;
        
        // Round to nearest 1000 for cleaner numbers
        const roundedLimit = Math.round(calculatedLimit / 1000) * 1000;
        
        // Clamp between reasonable min/max for mobile (8k-10k range)
        const clampedLimit = Math.max(8000, Math.min(10000, roundedLimit));
        
        return preferredMaxParticles ? Math.min(preferredMaxParticles, clampedLimit) : clampedLimit;
      } else {
        // For desktop, use full range
        const calculatedLimit = mobileBaseLimit + (desktopBaseLimit - mobileBaseLimit) * gpuScore;
        
        // Round to nearest 1000 for cleaner numbers
        const roundedLimit = Math.round(calculatedLimit / 1000) * 1000;
        
        // Clamp between reasonable min/max
        const clampedLimit = Math.max(8000, Math.min(100000, roundedLimit));
        
        return preferredMaxParticles ? Math.min(preferredMaxParticles, clampedLimit) : clampedLimit;
      }
    } catch (error) {
      // Fall through to mobile/desktop detection
    }
  }
  
  // Fallback: use mobile/desktop detection
  const baseLimit = isMobile ? mobileBaseLimit : desktopBaseLimit;
  return preferredMaxParticles ? Math.min(preferredMaxParticles, baseLimit) : baseLimit;
}

/**
 * Quick synchronous check for mobile device (for initial estimates)
 */
export function isMobileDeviceSync(): boolean {
  return isMobileDevice();
}

