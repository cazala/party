import { useEffect } from "react";
import { useTools } from "../hooks/useTools";
import { useEngine } from "../hooks/useEngine";
import { useHistory } from "../hooks/useHistory";
import { useSession } from "../hooks/useSession";

export function GlobalHotkeys() {
  const { setToolMode, toolMode } = useTools();
  const { canvasRef, play, pause, isPlaying } = useEngine();
  const { undo, redo, canUndo, canRedo } = useHistory();
  const { orderedSessions, quickLoadSession } = useSession();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Check if this is one of our hotkeys FIRST, before checking inputs
      const isOurHotkey = 
        e.code === "Space" ||
        (isModifier && (
          (key >= "1" && key <= "9") ||
          key === "z" ||
          key === "y" ||
          key === "a" ||
          key === "s" ||
          key === "d" ||
          key === "f" ||
          key === "g" ||
          key === "h" ||
          key === "j" ||
          key === "k"
        ));

      // If it's our hotkey, prevent default and stop propagation immediately
      if (isOurHotkey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      // Only block hotkeys when actually typing in text fields
      const target = e.target as HTMLElement | null;
      if (target && target === document.activeElement) {
        const tag = target.tagName;
        // Only block when actively typing in text inputs or content editable elements
        const isTextInput = 
          (tag === "INPUT" && (target as HTMLInputElement).type === "text") ||
          (tag === "INPUT" && (target as HTMLInputElement).type === "search") ||
          (tag === "INPUT" && (target as HTMLInputElement).type === "password") ||
          (tag === "INPUT" && (target as HTMLInputElement).type === "email") ||
          (tag === "INPUT" && (target as HTMLInputElement).type === "url") ||
          (tag === "TEXTAREA") ||
          (target as HTMLElement).isContentEditable;
        
        // Only return (block hotkeys) if we're in a text input
        if (isTextInput) {
          return;
        }
        // For all other elements (sliders, buttons, selects, etc.) let hotkeys work
      }

      // Handle spacebar for play/pause (no modifier required)
      if (e.code === "Space") {
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      if (!isModifier) return;
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

      // Quick load sessions (Cmd/Ctrl + 1-9)
      if (key >= "1" && key <= "9") {
        const sessionIndex = parseInt(key) - 1;
        if (sessionIndex < orderedSessions.length) {
          const sessionId = orderedSessions[sessionIndex].id;
          quickLoadSession(sessionId);
        }
        return;
      }

      // Undo/Redo
      if (key === "z") {
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
        return;
      }

      if (key === "y") {
        if (canRedo) redo();
        return;
      }

      switch (key) {
        case "a":
          setToolMode("interaction");
          updateOverlayMouseToCurrent();
          break;
        case "s":
          setToolMode("spawn");
          updateOverlayMouseToCurrent();
          break;
        case "d":
          setToolMode("remove");
          updateOverlayMouseToCurrent();
          break;
        case "f":
          setToolMode("pin");
          updateOverlayMouseToCurrent();
          break;
        case "g":
          setToolMode("grab");
          updateOverlayMouseToCurrent();
          break;
        case "h":
          setToolMode("joint");
          updateOverlayMouseToCurrent();
          break;
        case "j":
          setToolMode("draw");
          updateOverlayMouseToCurrent();
          break;
        case "k":
          setToolMode("shape");
          updateOverlayMouseToCurrent();
          break;
        default:
          break;
      }
    };

    // Use window with capture and also stop propagation for our hotkeys
    window.addEventListener("keydown", onKeyDown, { capture: true });
    
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
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [setToolMode, canvasRef, toolMode, undo, redo, canUndo, canRedo, orderedSessions, quickLoadSession, play, pause, isPlaying]);

  return null;
}
