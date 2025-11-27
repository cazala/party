import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { isMobileDeviceSync } from "../utils/deviceCapabilities";
import "./Homepage.css";

interface HomepageProps {
  onPlay: () => void;
  isVisible: boolean;
}

export function Homepage({ onPlay, isVisible }: HomepageProps) {
  const [showWarning, setShowWarning] = useState(false);
  const isMobile = isMobileDeviceSync();

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

