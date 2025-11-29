import { Modal } from "./Modal";
import "./HelpModal.css";

export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const content = (
    <>
      <section>
        <h3>General</h3>
        <ul>
          <li>
            <b>Space</b>: Play/Pause simulation
          </li>
          <li>
            <b>Cmd/Ctrl + B</b>: Toggle bars (fullscreen canvas)
          </li>
          <li>
            <b>Fullscreen Button</b>: Enter browser fullscreen mode
          </li>
          <li>
            <b>Cmd/Ctrl + Z</b>: Undo
          </li>
          <li>
            <b>Cmd/Ctrl + Shift + Z</b> or <b>Cmd/Ctrl + Y</b>: Redo
          </li>
        </ul>
      </section>

      <section>
        <h3>Sessions</h3>
        <ul>
          <li>
            <b>Cmd/Ctrl + 1-9</b>: Quick load session (settings only)
          </li>
        </ul>
      </section>

      <section>
        <h3>Oscillators</h3>
        <ul>
          <li>
            <b>Cmd/Ctrl + Click</b> on slider: Add oscillator
          </li>
          <li>
            <b>Cmd/Ctrl + Click</b> on oscillator: Cycle speed
          </li>
          <li>
            <b>Click</b> on oscillator: Remove oscillator
          </li>
        </ul>
      </section>

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
    </>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Help & Shortcuts"
      className="help-modal-content"
    >
      {content}
    </Modal>
  );
}
