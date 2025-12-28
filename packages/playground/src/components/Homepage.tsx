import { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { isMobileDeviceSync } from "../utils/deviceCapabilities";
import { useEngine } from "../hooks/useEngine";
import { useInteraction } from "../hooks/modules/useInteraction";
import "./Homepage.css";

interface HomepageProps {
  onPlay: () => void;
  isVisible: boolean;
}

export function Homepage({ onPlay, isVisible }: HomepageProps) {
  const [showWarning, setShowWarning] = useState(false);
  const isMobile = isMobileDeviceSync();
  const { canvasRef, screenToWorld, isWebGPU } = useEngine();
  const { setPosition, setActive, setMode, setStrength, setRadius } = useInteraction();
  const isMouseDownRef = useRef(false);

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

    // Configure interaction for homepage demo
    setMode("attract");
    if (isWebGPU) {
      setStrength(50000);
      setRadius(400);
    } else {
      setStrength(isMobile ? 5000 : 5000);
      setRadius(isMobile ? 400 : 400);
    }

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

    const handleTouchEnd = () => {
      setActive(false);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
      setActive(false);
      isMouseDownRef.current = false;
    };
  }, [isVisible, showWarning, canvasRef, screenToWorld, setPosition, setActive, setMode, setStrength, setRadius, isWebGPU, isMobile]);

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
    );
  }

  return (
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
  );
}

