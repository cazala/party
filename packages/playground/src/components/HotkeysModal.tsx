import { useEffect } from "react";
import "./HotkeysModal.css";

interface HotkeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HotkeysModal({ isOpen, onClose }: HotkeysModalProps) {
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
    <div className="hotkeys-modal-backdrop" onClick={handleBackdropClick}>
      <div className="hotkeys-modal">
        <div className="hotkeys-modal-header">
          <h2>Keyboard & Mouse Controls</h2>
          <button className="hotkeys-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="hotkeys-modal-content">
          <section className="hotkeys-section">
            <h3>Mouse Controls</h3>
            <div className="hotkeys-list">
              <div className="hotkey-item">
                <div className="hotkey-action">Click</div>
                <div className="hotkey-description">Spawn a particle</div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">Click & Drag</div>
                <div className="hotkey-description">
                  Set particle size by drag distance
                </div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">Right Click</div>
                <div className="hotkey-description">
                  Attract particles to cursor
                </div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">Ctrl/⌘ + Right Click</div>
                <div className="hotkey-description">
                  Repel particles from cursor
                </div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">
                  Mouse Wheel / Trackpad Scroll
                </div>
                <div className="hotkey-description">Zoom in / out</div>
              </div>
            </div>
          </section>

          <section className="hotkeys-section">
            <h3>Keyboard Modifiers</h3>
            <div className="hotkeys-list">
              <div className="hotkey-item">
                <div className="hotkey-action">Hold Shift + Click</div>
                <div className="hotkey-description">
                  Stream particles continuously
                </div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">Hold Ctrl/⌘ + Click & Drag</div>
                <div className="hotkey-description">
                  Set particle direction and speed
                </div>
              </div>
            </div>
          </section>

          <section className="hotkeys-section">
            <h3>Keyboard Shortcuts</h3>
            <div className="hotkeys-list">
              <div className="hotkey-item">
                <div className="hotkey-action">Delete / Backspace</div>
                <div className="hotkey-description">
                  Remove the last spawned particle
                </div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">?</div>
                <div className="hotkey-description">Open this help modal</div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">Escape</div>
                <div className="hotkey-description">Close this help modal</div>
              </div>
            </div>
          </section>

          <section className="hotkeys-section">
            <h3>Advanced Features</h3>
            <div className="hotkeys-list">
              <div className="hotkey-item">
                <div className="hotkey-action">Mode Switching</div>
                <div className="hotkey-description">
                  Press Ctrl/⌘ while dragging to switch from size mode to
                  velocity mode
                </div>
              </div>
              <div className="hotkey-item">
                <div className="hotkey-action">Particle History</div>
                <div className="hotkey-description">
                  Up to 50 most recent particles can be deleted with
                  Delete/Backspace
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
