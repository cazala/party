import { useEffect } from "react";
import { useTools } from "../hooks/useTools";
import { useEngine } from "../hooks/useEngine";
import { useHistory } from "../hooks/useHistory";

export function GlobalHotkeys() {
  const { setToolMode, toolMode } = useTools();
  const { canvasRef } = useEngine();
  const { undo, redo, canUndo, canRedo } = useHistory();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      if (!isModifier) return;

      // Avoid triggering inside editable inputs
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable =
          (target as HTMLElement).isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT";
        if (isEditable) return;
      }

      const key = e.key.toLowerCase();
      const updateOverlayMouseToCurrent = () => {
        const canvas = canvasRef?.current as HTMLCanvasElement | null;
        if (!canvas) return;
        // Use current mouse position relative to canvas if possible
        const rect = canvas.getBoundingClientRect();
        const mouseX = Math.max(
          0,
          Math.min(rect.width, (window as any)._lastMouseX ?? rect.width / 2)
        );
        const mouseY = Math.max(
          0,
          Math.min(rect.height, (window as any)._lastMouseY ?? rect.height / 2)
        );
        // Notify overlay system if available via custom event
        const evt = new CustomEvent("party-overlay-update-mouse", {
          detail: { x: mouseX, y: mouseY },
        });
        window.dispatchEvent(evt);
      };

      // Undo/Redo
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
        return;
      }

      if (key === "y") {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      switch (key) {
        case "a":
          e.preventDefault();
          setToolMode("interaction");
          updateOverlayMouseToCurrent();
          break;
        case "s":
          e.preventDefault();
          setToolMode("spawn");
          updateOverlayMouseToCurrent();
          break;
        case "d":
          e.preventDefault();
          setToolMode("remove");
          updateOverlayMouseToCurrent();
          break;
        case "f":
          e.preventDefault();
          setToolMode("pin");
          updateOverlayMouseToCurrent();
          break;
        case "g":
          e.preventDefault();
          setToolMode("grab");
          updateOverlayMouseToCurrent();
          break;
        case "h":
          e.preventDefault();
          setToolMode("joint");
          updateOverlayMouseToCurrent();
          break;
        case "j":
          e.preventDefault();
          setToolMode("draw");
          updateOverlayMouseToCurrent();
          break;
        case "k":
          e.preventDefault();
          setToolMode("shape");
          updateOverlayMouseToCurrent();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Track last mouse position to seed overlay position on tool switch
    const onMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef?.current as HTMLCanvasElement | null;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        (window as any)._lastMouseX = e.clientX - rect.left;
        (window as any)._lastMouseY = e.clientY - rect.top;
      } else {
        (window as any)._lastMouseClientX = e.clientX;
        (window as any)._lastMouseClientY = e.clientY;
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [setToolMode, canvasRef, toolMode, undo, redo, canUndo, canRedo]);

  return null;
}
