import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./HelpModal.css";

export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="help-modal-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h2>Help & Shortcuts</h2>
          <button className="help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="help-modal-body">
          <section>
            <h3>Tools</h3>
            <ul>
              <li>
                <b>Cmd/Ctrl + A</b>: Interact
              </li>
              <li>
                <b>Cmd/Ctrl + S</b>: Spawn
              </li>
              <li>
                <b>Cmd/Ctrl + D</b>: Remove
              </li>
              <li>
                <b>Cmd/Ctrl + F</b>: Pin
              </li>
              <li>
                <b>Cmd/Ctrl + G</b>: Grab
              </li>
              <li>
                <b>Cmd/Ctrl + H</b>: Joint
              </li>
              <li>
                <b>Cmd/Ctrl + J</b>: Draw
              </li>
              <li>
                <b>Cmd/Ctrl + K</b>: Shape
              </li>
            </ul>
          </section>

          <section>
            <h3>Interact</h3>
            <ul>
              <li>
                <b>Left Click</b>: Attract
              </li>
              <li>
                <b>Right Click</b>: Repel
              </li>
              <li>
                <b>Ctrl/Cmd + Drag</b>: Adjust interaction radius
              </li>
              <li>
                <b>Shift + Drag</b>: Adjust strength
              </li>
            </ul>
          </section>

          <section>
            <h3>Spawn</h3>
            <ul>
              <li>
                <b>Click</b>: Spawn particle (persisted size)
              </li>
              <li>
                <b>Drag</b>: Set initial velocity (arrow)
              </li>
              <li>
                <b>Ctrl/Cmd + Drag</b>: Adjust size (persists, does not spawn)
              </li>
              <li>
                <b>Shift</b>: Stream while dragging
              </li>
            </ul>
          </section>

          <section>
            <h3>Remove</h3>
            <ul>
              <li>
                <b>Click/Drag</b>: Remove inside circle
              </li>
              <li>
                <b>Ctrl/Cmd + Drag</b>: Adjust removal radius
              </li>
            </ul>
          </section>

          <section>
            <h3>Pin</h3>
            <ul>
              <li>
                <b>Click/Drag</b>: Pin inside circle
              </li>
              <li>
                <b>Shift + Click/Drag</b>: Unpin inside circle
              </li>
              <li>
                <b>Ctrl/Cmd + Drag</b>: Adjust pin radius
              </li>
            </ul>
          </section>

          <section>
            <h3>Grab</h3>
            <ul>
              <li>
                <b>Click & Drag</b>: Grab and move particles
              </li>
            </ul>
          </section>

          <section>
            <h3>Joint</h3>
            <ul>
              <li>
                <b>Click</b>: Create joints between selected particles
              </li>
            </ul>
          </section>

          <section>
            <h3>Draw</h3>
            <ul>
              <li>
                <b>Click & Drag</b>: Draw particles and auto-connect joints
              </li>
              <li>
                <b>Shift</b>: Pin while drawing
              </li>
              <li>
                <b>Ctrl/Cmd + Drag</b>: Adjust particle size
              </li>
            </ul>
          </section>

          <section>
            <h3>Shape</h3>
            <ul>
              <li>
                <b>Click</b>: Spawn full-mesh polygon
              </li>
              <li>
                <b>Ctrl/Cmd + Drag</b>: Adjust radius
              </li>
              <li>
                <b>Shift + Drag</b>: Adjust sides (3-6)
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
