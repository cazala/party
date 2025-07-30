import { useState, useEffect } from "react";

interface UseFullscreenOptions {
  onToggle?: () => void;
}

export const useFullscreen = (options: UseFullscreenOptions = {}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { onToggle } = options;

  const toggleFullscreen = async () => {
    const newFullscreenState = !isFullscreen;

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

    // Call the callback after a short delay to allow for canvas resize
    if (onToggle) {
      setTimeout(() => {
        onToggle();
      }, 100);
    }
  };

  // Handle browser fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isInBrowserFullscreen = !!document.fullscreenElement;
      if (!isInBrowserFullscreen && isFullscreen) {
        setIsFullscreen(false);
        if (onToggle) {
          setTimeout(() => {
            onToggle();
          }, 100);
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isFullscreen, onToggle]);

  return {
    isFullscreen,
    toggleFullscreen,
  };
};
