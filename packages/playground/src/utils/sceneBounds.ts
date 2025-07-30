import { System, Canvas2DRenderer } from "@cazala/party";

export interface SceneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ViewportWorldBounds {
  // World coordinates of what's currently visible in the viewport
  worldMinX: number;
  worldMaxX: number;
  worldMinY: number;
  worldMaxY: number;
  worldWidth: number;
  worldHeight: number;
  worldCenterX: number;
  worldCenterY: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  worldCenterX: number;
  worldCenterY: number;
  zoom: number;
}

/**
 * Calculate the bounds of all particles in the system
 */
export function calculateParticleBounds(system: System): SceneBounds | null {
  if (!system.particles || system.particles.length === 0) {
    return null;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const particle of system.particles) {
    // Skip particles that might be removed (mass <= 0 could indicate removed particles)
    if (particle.mass <= 0) continue;
    
    // Account for particle size in bounds calculation
    const left = particle.position.x - particle.size / 2;
    const right = particle.position.x + particle.size / 2;
    const top = particle.position.y - particle.size / 2;
    const bottom = particle.position.y + particle.size / 2;
    
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
  }

  // If no valid particles found
  if (minX === Infinity) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/**
 * Calculate what world coordinates are currently visible in the viewport
 */
export function getViewportWorldBounds(system: System, renderer: Canvas2DRenderer): ViewportWorldBounds {
  const camera = renderer.getCamera();
  const zoom = renderer.getZoom();
  
  // Calculate world coordinates of viewport corners
  const worldMinX = (-camera.x) / zoom;
  const worldMinY = (-camera.y) / zoom;
  const worldMaxX = (-camera.x + system.width) / zoom;
  const worldMaxY = (-camera.y + system.height) / zoom;
  
  return {
    worldMinX,
    worldMaxX,
    worldMinY,
    worldMaxY,
    worldWidth: worldMaxX - worldMinX,
    worldHeight: worldMaxY - worldMinY,
    worldCenterX: (worldMinX + worldMaxX) / 2,
    worldCenterY: (worldMinY + worldMaxY) / 2,
  };
}

/**
 * Get information about what's currently visible in the viewport
 */
export function getViewportInfo(system: System, renderer: Canvas2DRenderer): ViewportInfo {
  const camera = renderer.getCamera();
  const zoom = renderer.getZoom();
  
  // Calculate the world center of the current viewport
  const worldCenterX = (-camera.x + system.width / 2) / zoom;
  const worldCenterY = (-camera.y + system.height / 2) / zoom;
  
  return {
    width: system.width,
    height: system.height,
    worldCenterX,
    worldCenterY,
    zoom
  };
}

/**
 * Calculate camera position and zoom to show the same world area in the current viewport
 */
export function calculateCameraToShowWorldBounds(
  savedWorldBounds: ViewportWorldBounds,
  currentViewportWidth: number,
  currentViewportHeight: number
): { cameraX: number; cameraY: number; zoom: number } {
  // Handle edge cases where world bounds are zero or very small
  const minWorldSize = 1;
  const effectiveWorldWidth = Math.max(savedWorldBounds.worldWidth, minWorldSize);
  const effectiveWorldHeight = Math.max(savedWorldBounds.worldHeight, minWorldSize);
  
  // Calculate zoom needed to fit the saved world area in current viewport
  const zoomX = currentViewportWidth / effectiveWorldWidth;
  const zoomY = currentViewportHeight / effectiveWorldHeight;
  
  // Use the smaller zoom to ensure entire area fits, with reasonable limits
  const zoom = Math.min(zoomX, zoomY, 10); // Cap max zoom at 10x
  const minZoom = 0.001; // Prevent extreme zoom out
  const finalZoom = Math.max(zoom, minZoom);
  
  // Calculate camera position to center the saved world area in the current viewport
  // First, position the world area at the top-left (as before)
  const baseX = -savedWorldBounds.worldMinX * finalZoom;
  const baseY = -savedWorldBounds.worldMinY * finalZoom;
  
  // Then add offsets to center the content within the current viewport
  // The scaled world area dimensions in screen coordinates
  const scaledWorldWidth = effectiveWorldWidth * finalZoom;
  const scaledWorldHeight = effectiveWorldHeight * finalZoom;
  
  // Calculate centering offsets
  const centerOffsetX = (currentViewportWidth - scaledWorldWidth) / 2;
  const centerOffsetY = (currentViewportHeight - scaledWorldHeight) / 2;
  
  const cameraX = baseX + centerOffsetX;
  const cameraY = baseY + centerOffsetY;
  
  return { cameraX, cameraY, zoom: finalZoom };
}

/**
 * Calculate camera position and zoom to fit scene bounds in the viewport
 */
export function calculateCameraToFitScene(
  sceneBounds: SceneBounds,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 50
): { cameraX: number; cameraY: number; zoom: number } {
  // Add some minimum size to avoid extreme zoom for very small scenes
  const minSceneSize = 100;
  const effectiveWidth = Math.max(sceneBounds.width, minSceneSize);
  const effectiveHeight = Math.max(sceneBounds.height, minSceneSize);
  
  // Calculate zoom to fit all particles with padding
  const scaleX = (viewportWidth - padding * 2) / effectiveWidth;
  const scaleY = (viewportHeight - padding * 2) / effectiveHeight;
  const zoom = Math.min(scaleX, scaleY, 3); // Cap at 3x zoom to avoid extreme close-ups
  
  // Center camera on scene center
  const cameraX = -sceneBounds.centerX * zoom + viewportWidth / 2;
  const cameraY = -sceneBounds.centerY * zoom + viewportHeight / 2;
  
  return { cameraX, cameraY, zoom };
}

/**
 * Apply camera settings to renderer and related systems
 */
export function applyCameraSettings(
  renderer: Canvas2DRenderer,
  cameraX: number,
  cameraY: number,
  zoom: number,
  bounds?: any,
  spatialGrid?: any,
  zoomStateRef?: any
) {
  renderer.setCamera(cameraX, cameraY);
  renderer.setZoom(zoom);

  // Update bounds and spatial grid if provided
  if (bounds) {
    bounds.setCamera(cameraX, cameraY, zoom);
  }
  if (spatialGrid) {
    spatialGrid.setCamera(cameraX, cameraY, zoom);
  }

  // Update zoom state to match loaded camera position
  if (zoomStateRef && zoomStateRef.current) {
    zoomStateRef.current.targetZoom = zoom;
    zoomStateRef.current.targetCameraX = cameraX;
    zoomStateRef.current.targetCameraY = cameraY;
    zoomStateRef.current.isAnimating = false;
    if (zoomStateRef.current.animationId) {
      cancelAnimationFrame(zoomStateRef.current.animationId);
      zoomStateRef.current.animationId = null;
    }
  }
}