import { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { isMobileDevice } from "../utils/deviceCapabilities";
import { useEngine } from "../hooks/useEngine";
import { useInteraction } from "../hooks/modules/useInteraction";
import { WebGPUFallbackBanner } from "./WebGPUFallbackBanner";
import "./Homepage.css";

interface HomepageProps {
  onPlay: () => void;
  isVisible: boolean;
  demoCount: number;
  currentDemoIndex: number;
  onSelectDemo: (index: number) => void;
  onSwipeNextDemo: () => void;
  onSwipePrevDemo: () => void;
  isWebGPUWarningDismissed: boolean;
  onDismissWebGPUWarning: () => void;
}

export function Homepage({
  onPlay,
  isVisible,
  demoCount,
  currentDemoIndex,
  onSelectDemo,
  onSwipeNextDemo,
  onSwipePrevDemo,
  isWebGPUWarningDismissed,
  onDismissWebGPUWarning,
}: HomepageProps) {
  const [showWarning, setShowWarning] = useState(false);
  const isMobile = isMobileDevice();
  const { canvasRef, screenToWorld, isWebGPU, isInitialized, isInitializing } = useEngine();
  const { setPosition, setActive, setMode, setStrength, setRadius } = useInteraction();
  const isMouseDownRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Mouse and touch interaction for homepage demo
  useEffect(() => {
    if (!isVisible || showWarning) {
      // Deactivate interaction when homepage is hidden or warning is shown
      setActive(false);
      isMouseDownRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      isMouseDownRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      setPosition(x, y);
      setActive(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Only interact when mouse button is held down
      if (!isMouseDownRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      setPosition(x, y);
      setActive(true);
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
      setActive(false);
    };

    const handleMouseLeave = () => {
      isMouseDownRef.current = false;
      setActive(false);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      setPosition(x, y);
      setActive(true);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (touch && start && demoCount > 0) {
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        const elapsed = Date.now() - start.time;
        const horizontalSwipe = Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3;
        const withinTime = elapsed < 600;

        if (horizontalSwipe && withinTime) {
          if (deltaX < 0) {
            onSwipeNextDemo();
          } else {
            onSwipePrevDemo();
          }
        }
      }

      setActive(false);
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
      setActive(false);
      isMouseDownRef.current = false;
      touchStartRef.current = null;
    };
  }, [
    isVisible,
    showWarning,
    canvasRef,
    screenToWorld,
    setPosition,
    setActive,
    setMode,
    setStrength,
    setRadius,
    isWebGPU,
    isMobile,
    demoCount,
    onSwipeNextDemo,
    onSwipePrevDemo,
  ]);

  if (!isVisible) return null;

  const handlePlayClick = () => {
    if (isMobile) {
      setShowWarning(true);
    } else {
      onPlay();
    }
  };

  const handleBack = () => {
    setShowWarning(false);
  };

  if (showWarning) {
    const iconSize = isMobile ? 64 : 64;
    return (
      <>
        {!isWebGPU && isInitialized && !isInitializing && !isWebGPUWarningDismissed && (
          <WebGPUFallbackBanner
            dismissed={isWebGPUWarningDismissed}
            onDismiss={onDismissWebGPUWarning}
          />
        )}
        <div className="homepage">
          <div className="homepage-warning-icon">
            <AlertTriangle size={iconSize} color="#000000" strokeWidth={2} />
          </div>
          <p className="homepage-subtitle">playground not available on mobile</p>
          <div className="homepage-buttons">
            <button className="homepage-button homepage-button-back" onClick={handleBack}>
              Back
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {!isWebGPU && isInitialized && !isInitializing && !isWebGPUWarningDismissed && (
        <WebGPUFallbackBanner
          dismissed={isWebGPUWarningDismissed}
          onDismiss={onDismissWebGPUWarning}
        />
      )}
      <div className="homepage">
        <h1 className="homepage-title">Party</h1>
        <p className="homepage-subtitle">particle system and physics engine</p>
        <div className="homepage-buttons">
          <button className="homepage-button homepage-button-play" onClick={handlePlayClick}>
            Play
          </button>
          <a
            href="https://github.com/cazala/party"
            target="_self"
            rel="noopener noreferrer"
            className="homepage-button homepage-button-learn"
          >
            Learn
          </a>
        </div>
      </div>
      {demoCount > 0 && (
        <div className="homepage-demo-dots" aria-label="Demo selector">
          {Array.from({ length: demoCount }).map((_, index) => (
            <button
              key={`demo-dot-${index}`}
              className={`homepage-demo-dot-button ${index === currentDemoIndex ? "active" : ""}`}
              onClick={() => onSelectDemo(index)}
              aria-pressed={index === currentDemoIndex}
              aria-label={`Show demo ${index + 1}`}
            >
              <span className="homepage-demo-dot" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

