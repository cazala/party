import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../useEngine";
import { useAppDispatch } from "../useAppDispatch";
import { ToolMode } from "../../slices/tools";
import { ToolHandlers } from "./types";
import { setZoom as setZoomAction, setCamera as setCameraAction } from "../../slices/engine";

interface MouseHandlerProps {
  toolMode: ToolMode;
  isInitialized: boolean;
  toolHandlers: Record<ToolMode, ToolHandlers>;
}

export function useMouseHandler({
  toolMode,
  isInitialized,
  toolHandlers,
}: MouseHandlerProps) {
  const dispatch = useAppDispatch();
  const { canvasRef, handleWheel, zoom, camera, engine } =
    useEngine();
  const handlerId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Keep the latest camera/zoom without reattaching listeners during pinch.
  const zoomRef = useRef(zoom);
  const cameraRef = useRef(camera);
  const engineRef = useRef(engine);
  const dispatchRef = useRef(dispatch);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  const toMouseLikeEvent = useCallback((e: PointerEvent): MouseEvent => {
    // PointerEvent is a superset for our usage (clientX/clientY/buttons/modifiers).
    // For touch, browsers report button=0/buttons=1 on active contact.
    return e as unknown as MouseEvent;
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized || !canvasRef.current) return;

      const handlers = toolHandlers[toolMode];
      if (handlers?.onMouseDown) {
        handlers.onMouseDown(e);
      }
    },
    [toolMode, isInitialized, canvasRef, toolHandlers]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized || !canvasRef.current) return;

      const handlers = toolHandlers[toolMode];
      if (handlers?.onMouseMove) {
        handlers.onMouseMove(e);
      }
    },
    [toolMode, isInitialized, canvasRef, toolHandlers]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized) return;

      const handlers = toolHandlers[toolMode];
      if (handlers?.onMouseUp) {
        handlers.onMouseUp(e);
      }
    },
    [toolMode, isInitialized, toolHandlers]
  );

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  // Wire mouse input to tools (interaction module is handled by cursor tool)
  useEffect(() => {
    const canvas = canvasRef.current as
      | (HTMLCanvasElement & { dataset?: DOMStringMap })
      | null;
    if (!canvas || !isInitialized) return;

    // Deduplicate: only one instance attaches listeners to the canvas at a time
    const ownerKey = "partyMouseHandlerOwner";
    const ds = canvas.dataset ?? (canvas.dataset = {} as any);
    if (ds[ownerKey]) {
      // Another instance already attached; skip attaching listeners
      return;
    }
    ds[ownerKey] = handlerId;

    const onMouseMove = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      handleMouseDown(e);
    };

    const onMouseUp = (e: MouseEvent) => {
      handleMouseUp(e);
    };

    const onContextMenu = (e: MouseEvent) => {
      handleContextMenu(e);
    };

    // Pinch-to-zoom (mobile/tablet)
    // Use Touch Events for robustness (some mobile browsers are flaky with multi-touch PointerEvents).
    let isTouchPinching = false;
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let pinchWorldAnchor: { x: number; y: number } | null = null;
    let rafPending = false;
    let desiredZoom = 1;
    let desiredCamera: { x: number; y: number } | null = null;

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));

    const onPointerDown = (e: PointerEvent) => {
      // Let tools use the same logic across mouse+touch+pen.
      // Prevent native gestures (handled by CSS touch-action too).
      e.preventDefault();
      if (isTouchPinching) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore (some browsers may throw)
      }
      handleMouseDown(toMouseLikeEvent(e));
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      if (isTouchPinching) return;
      handleMouseMove(toMouseLikeEvent(e));
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      handleMouseUp(toMouseLikeEvent(e));
    };

    const onPointerCancel = (e: PointerEvent) => {
      e.preventDefault();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      handleMouseUp(toMouseLikeEvent(e));
    };

    // Fallback pinch zoom for browsers where multi-touch pointer events are unreliable.
    // NOTE: Some mobile browsers still deliver single-touch pointer events fine (for tapping),
    // but don't reliably deliver two distinct pointerIds for pinch gestures.
    const touchDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const touchCentroid = (t1: Touch, t2: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      isTouchPinching = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDistance = touchDistance(t1, t2);
      pinchStartZoom = zoomRef.current || 1;
      const c = touchCentroid(t1, t2);

      // Compute a stable world anchor under the pinch center.
      const rect = canvas.getBoundingClientRect();
      const z = pinchStartZoom;
      const cam = cameraRef.current;
      pinchWorldAnchor = {
        x: (cam?.x ?? 0) + (c.x - rect.width / 2) / Math.max(z, 1e-6),
        y: (cam?.y ?? 0) + (c.y - rect.height / 2) / Math.max(z, 1e-6),
      };

      // Cancel any active tool interaction when pinch begins.
      handleMouseUp(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true })
      );
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchPinching) return;
      if (e.touches.length < 2) return;
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const d = touchDistance(t1, t2);
      if (!pinchStartDistance || !pinchWorldAnchor) return;

      const rawScale = d / Math.max(1e-6, pinchStartDistance);
      // Increase sensitivity so a single pinch can traverse zoom range more easily.
      const PINCH_GAIN = 5;
      const scale =
        rawScale >= 1
          ? 1 + (rawScale - 1) * PINCH_GAIN
          : 1 / (1 + (1 / Math.max(rawScale, 1e-6) - 1) * PINCH_GAIN);
      const newZoom = clamp(pinchStartZoom * scale, 0.1, 10);
      const c = touchCentroid(t1, t2);
      const rect = canvas.getBoundingClientRect();

      // Keep the world anchor under the pinch center fixed.
      const newCamera = {
        x: pinchWorldAnchor.x - (c.x - rect.width / 2) / Math.max(newZoom, 1e-6),
        y: pinchWorldAnchor.y - (c.y - rect.height / 2) / Math.max(newZoom, 1e-6),
      };

      desiredZoom = newZoom;
      desiredCamera = newCamera;

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          const eng = engineRef.current;
          const cam = desiredCamera;
          if (!eng || !cam) return;
          try {
            eng.setZoom(desiredZoom);
            eng.setCamera(cam.x, cam.y);
            dispatchRef.current(setZoomAction(desiredZoom));
            dispatchRef.current(setCameraAction({ x: cam.x, y: cam.y }));
          } catch {
            // ignore
          }
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isTouchPinching = false;
        pinchStartDistance = 0;
        pinchStartZoom = 1;
        pinchWorldAnchor = null;
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", onPointerCancel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      // Only the owner should remove listeners
      if (canvas.dataset && canvas.dataset[ownerKey] === handlerId) {
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mouseleave", onMouseUp);
        canvas.removeEventListener("contextmenu", onContextMenu);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerCancel);
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
        canvas.removeEventListener("touchcancel", onTouchEnd);
        delete canvas.dataset[ownerKey];
      }
    };
  }, [
    canvasRef.current,
    isInitialized,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    toMouseLikeEvent,
    handleWheel,
    // Pinch reads zoom/camera/engine via refs.
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}
