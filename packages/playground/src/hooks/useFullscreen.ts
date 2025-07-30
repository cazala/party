import { useState, useEffect } from "react";
import { System, Canvas2DRenderer, Bounds, SpatialGrid } from "@cazala/party";
import {
  getViewportWorldBounds,
  calculateCameraToShowWorldBounds,
  applyCameraSettings,
} from "../utils/sceneBounds";

interface UseFullscreenOptions {
  system?: System;
  renderer?: Canvas2DRenderer;
  bounds?: Bounds;
  spatialGrid?: SpatialGrid;
  zoomStateRef?: any;
  onToggle?: (value: boolean) => void;
}

export const useFullscreen = (options: UseFullscreenOptions = {}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { system, renderer, bounds, spatialGrid, zoomStateRef, onToggle } =
    options;

  const toggleFullscreen = async () => {
    const newFullscreenState = !isFullscreen;

    // Capture current viewport world bounds before changing fullscreen state
    let capturedViewportBounds = null;
    let originalViewport = null;
    if (system && renderer) {
      capturedViewportBounds = getViewportWorldBounds(system, renderer);
      originalViewport = {
        width: system.width,
        height: system.height,
      };
    }

    // Handle browser fullscreen API
    if (newFullscreenState) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.warn("Failed to enter browser fullscreen:", error);
      }
    } else {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.warn("Failed to exit browser fullscreen:", error);
      }
    }

    setIsFullscreen(newFullscreenState);

    // Apply viewport preservation after a short delay to allow for canvas resize
    setTimeout(() => {
      if (capturedViewportBounds && originalViewport && system && renderer) {
        // Calculate camera position to show the same world area in the new viewport
        const { cameraX, cameraY, zoom } = calculateCameraToShowWorldBounds(
          capturedViewportBounds,
          system.width,
          system.height
        );

        console.log(`Preserving viewport on fullscreen toggle:
          Original viewport: ${originalViewport.width}x${
          originalViewport.height
        }
          New viewport: ${system.width}x${system.height}
          Captured world area: ${capturedViewportBounds.worldWidth.toFixed(
            1
          )}x${capturedViewportBounds.worldHeight.toFixed(1)}
          World bounds: (${capturedViewportBounds.worldMinX.toFixed(
            1
          )}, ${capturedViewportBounds.worldMinY.toFixed(
          1
        )}) to (${capturedViewportBounds.worldMaxX.toFixed(
          1
        )}, ${capturedViewportBounds.worldMaxY.toFixed(1)})
          Calculated camera: (${cameraX.toFixed(1)}, ${cameraY.toFixed(
          1
        )}) zoom: ${zoom.toFixed(2)}`);

        applyCameraSettings(
          renderer,
          cameraX,
          cameraY,
          zoom,
          bounds,
          spatialGrid,
          zoomStateRef
        );
      }

      // Call the optional callback
      if (onToggle) {
        onToggle(newFullscreenState);
      }
    }, 100);
  };

  // Handle browser fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isInBrowserFullscreen = !!document.fullscreenElement;
      if (!isInBrowserFullscreen && isFullscreen) {
        // Capture current viewport world bounds before changing state
        let capturedViewportBounds = null;
        let originalViewport = null;
        if (system && renderer) {
          capturedViewportBounds = getViewportWorldBounds(system, renderer);
          originalViewport = {
            width: system.width,
            height: system.height,
          };
        }

        setIsFullscreen(false);

        // Apply viewport preservation after a short delay to allow for canvas resize
        setTimeout(() => {
          if (
            capturedViewportBounds &&
            originalViewport &&
            system &&
            renderer
          ) {
            // Calculate camera position to show the same world area in the new viewport
            const { cameraX, cameraY, zoom } = calculateCameraToShowWorldBounds(
              capturedViewportBounds,
              system.width,
              system.height
            );

            console.log(`Preserving viewport on fullscreen exit via Escape:
              Original viewport: ${originalViewport.width}x${
              originalViewport.height
            }
              New viewport: ${system.width}x${system.height}
              Captured world area: ${capturedViewportBounds.worldWidth.toFixed(
                1
              )}x${capturedViewportBounds.worldHeight.toFixed(1)}
              World bounds: (${capturedViewportBounds.worldMinX.toFixed(
                1
              )}, ${capturedViewportBounds.worldMinY.toFixed(
              1
            )}) to (${capturedViewportBounds.worldMaxX.toFixed(
              1
            )}, ${capturedViewportBounds.worldMaxY.toFixed(1)})
              Calculated camera: (${cameraX.toFixed(1)}, ${cameraY.toFixed(
              1
            )}) zoom: ${zoom.toFixed(2)}`);

            applyCameraSettings(
              renderer,
              cameraX,
              cameraY,
              zoom,
              bounds,
              spatialGrid,
              zoomStateRef
            );
          }

          // Call the optional callback
          if (onToggle) {
            onToggle(false);
          }
        }, 100);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [
    isFullscreen,
    onToggle,
    system,
    renderer,
    bounds,
    spatialGrid,
    zoomStateRef,
  ]);

  return {
    isFullscreen,
    toggleFullscreen,
  };
};
