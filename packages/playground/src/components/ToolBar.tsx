import { useEffect } from "react";
import {
  Circle,
  Link,
  Hand,
  Pin,
  Eraser,
  Zap,
} from "lucide-react";
import { ToolMode } from "../hooks/useToolMode";

interface ToolBarProps {
  toolMode?: ToolMode;
  onToolModeChange?: (mode: ToolMode) => void;
  style?: React.CSSProperties;
  currentlyGrabbedParticle?: any;
  onGrabToJoint?: () => boolean;
  isCreatingJoint?: boolean;
  onJointToSpawn?: () => boolean;
}

export function ToolBar({
  toolMode = "spawn",
  onToolModeChange,
  style,
  currentlyGrabbedParticle,
  onGrabToJoint,
  isCreatingJoint,
  onJointToSpawn,
}: ToolBarProps) {
  // Add keyboard shortcuts for tool mode changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onToolModeChange) return;

      // Check for Cmd (Mac) or Ctrl (PC)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "a":
            e.preventDefault();
            // Special handling for CMD+A during joint creation: switch to spawn mode with pending joint
            if (isCreatingJoint && onJointToSpawn) {
              const success = onJointToSpawn();
              if (success) {
                onToolModeChange("spawn");
              }
            } else {
              onToolModeChange("spawn");
            }
            break;
          case "s":
            e.preventDefault();
            // Special handling for CMD+S during grab: switch to joint mode with grabbed particle
            if (currentlyGrabbedParticle && onGrabToJoint) {
              const success = onGrabToJoint();
              if (success) {
                onToolModeChange("joint");
              }
            } else {
              onToolModeChange("joint");
            }
            break;
          case "d":
            e.preventDefault();
            onToolModeChange("grab");
            break;
          case "f":
            onToolModeChange("pin");
            break;
          case "g":
            e.preventDefault();
            onToolModeChange("remove");
            break;
          case "h":
            e.preventDefault();
            onToolModeChange("emitter");
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToolModeChange, currentlyGrabbedParticle, onGrabToJoint, isCreatingJoint, onJointToSpawn]);

  if (!onToolModeChange) {
    return null;
  }

  return (
    <div className="toolbar" style={style}>
      <div className="toolbar-content">
        <div className="tool-mode-selector">
          <button
            onClick={() => onToolModeChange("spawn")}
            className={`tool-mode-button tool-mode-first ${
              toolMode === "spawn" ? "tool-mode-active" : ""
            }`}
            title="Spawn particles (Cmd+A)"
          >
            <Circle width="16" height="16" />
            <span>Spawn</span>
          </button>
          <button
            onClick={() => onToolModeChange("joint")}
            className={`tool-mode-button tool-mode-second ${
              toolMode === "joint" ? "tool-mode-active" : ""
            }`}
            title="Create joints (Cmd+S)"
          >
            <Link width="16" height="16" />
            <span>Joint</span>
          </button>
          <button
            onClick={() => onToolModeChange("grab")}
            className={`tool-mode-button tool-mode-third ${
              toolMode === "grab" ? "tool-mode-active" : ""
            }`}
            title="Grab particles (Cmd+D)"
          >
            <Hand width="16" height="16" />
            <span>Grab</span>
          </button>
          <button
            onClick={() => onToolModeChange("pin")}
            className={`tool-mode-button tool-mode-fourth ${
              toolMode === "pin" ? "tool-mode-active" : ""
            }`}
            title="Pin particles (Cmd+F)"
          >
            <Pin width="16" height="16" />
            <span>Pin</span>
          </button>
          <button
            onClick={() => onToolModeChange("emitter")}
            className={`tool-mode-button tool-mode-fifth ${
              toolMode === "emitter" ? "tool-mode-active" : ""
            }`}
            title="Place emitters (Cmd+H)"
          >
            <Zap width="16" height="16" />
            <span>Emitter</span>
          </button>
          <button
            onClick={() => onToolModeChange("remove")}
            className={`tool-mode-button tool-mode-sixth ${
              toolMode === "remove" ? "tool-mode-active" : ""
            }`}
            title="Remove particles (Cmd+G)"
          >
            <Eraser width="16" height="16" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}