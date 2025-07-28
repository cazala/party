import { useEffect } from "react";
import "./HelpModal.css";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Close modal when clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="help-modal-backdrop" onClick={handleBackdropClick}>
      <div className="help-modal">
        <div className="help-modal-header">
          <h2>Help & Controls</h2>
          <button className="help-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="help-modal-content">
          <section className="help-section">
            <h3>Mouse Controls</h3>
            <div className="help-list">
              <div className="help-item">
                <div className="help-action">Click</div>
                <div className="help-description">Spawn a particle</div>
              </div>
              <div className="help-item">
                <div className="help-action">Click + Drag</div>
                <div className="help-description">
                  Drag to set particle size by distance
                </div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + Click + Drag</div>
                <div className="help-description">
                  Drag to set particle direction and speed
                </div>
              </div>
              <div className="help-item">
                <div className="help-action">Right Click</div>
                <div className="help-description">
                  Attract particles to cursor
                </div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + Right Click</div>
                <div className="help-description">
                  Repel particles from cursor
                </div>
              </div>
              <div className="help-item">
                <div className="help-action">Mouse Wheel / Trackpad Scroll</div>
                <div className="help-description">Zoom in / out</div>
              </div>
            </div>
          </section>

          <section className="help-section">
            <h3>Keyboard Modifiers</h3>
            <div className="help-list">
              <div className="help-item">
                <div className="help-action">Hold Shift + Click</div>
                <div className="help-description">
                  Stream particles continuously
                </div>
              </div>
            </div>
          </section>

          <section className="help-section">
            <h3>Keyboard Shortcuts</h3>
            <div className="help-list">
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + Z</div>
                <div className="help-description">
                  Undo last action (spawn/remove particles, clear)
                </div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + Shift + Z</div>
                <div className="help-description">Redo last undone action</div>
              </div>
              <div className="help-item">
                <div className="help-action">Shift + Space</div>
                <div className="help-description">Toggle play/pause</div>
              </div>
              <div className="help-item">
                <div className="help-action">Escape</div>
                <div className="help-description">Cancel a drag operation</div>
              </div>
              <div className="help-item">
                <div className="help-action">?</div>
                <div className="help-description">Open this help modal</div>
              </div>
            </div>
          </section>

          <section className="help-section">
            <h3>Tool Mode Shortcuts</h3>
            <div className="help-list">
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + A</div>
                <div className="help-description">Switch to Spawn tool</div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + S</div>
                <div className="help-description">Switch to Joint tool</div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + D</div>
                <div className="help-description">Switch to Grab tool</div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + F</div>
                <div className="help-description">Switch to Pin tool</div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + G</div>
                <div className="help-description">Switch to Remove tool</div>
              </div>
              <div className="help-item">
                <div className="help-action">Ctrl/⌘ + SHIFT + F</div>
                <div className="help-description">
                  Toggle Pin checkbox in spawn controls
                </div>
              </div>
            </div>
          </section>

          <section className="help-section">
            <h3>Advanced Features</h3>
            <div className="help-list">
              <div className="help-item">
                <div className="help-action">Mode Switching</div>
                <div className="help-description">
                  Press Ctrl/⌘ while dragging to switch from size mode to
                  velocity mode
                </div>
              </div>
              <div className="help-item">
                <div className="help-action">Undo History</div>
                <div className="help-description">
                  Up to 50 operations can be undone with Ctrl+Z/⌘+Z
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
