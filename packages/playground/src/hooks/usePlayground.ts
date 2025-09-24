import { useEffect } from "react";
import { useParty } from "./useParty";
import { useTools, ToolMode } from "./useTools";

export interface UsePlaygroundProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  initialToolMode?: ToolMode;
}

export function usePlayground({
  canvasRef,
  initialToolMode = "cursor",
}: UsePlaygroundProps) {
  // Initialize core engine functionality
  const party = useParty(canvasRef);

  // Initialize tools with dependencies from party
  const tools = useTools({
    canvasRef,
    addParticle: party.addParticle,
    screenToWorld: party.screenToWorld,
    isInitialized: party.isInitialized,
    initialMode: initialToolMode,
  });

  // Wire mouse input to Interaction module and Tools
  useEffect(() => {
    const canvas = canvasRef.current;
    const interaction = party.interaction;
    if (!canvas || !interaction || !party.isInitialized) return;

    const updateMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = party.screenToWorld(sx, sy);
      interaction.setPosition(x, y);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePos(e);
      tools.handleMouseMove(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePos(e);
      
      // Handle tools first - if a tool handles the event, don't activate interaction
      tools.handleMouseDown(e);
      
      // Only activate interaction for cursor mode (when no tool is active)
      if (tools.toolMode === "cursor") {
        interaction.setActive(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      tools.handleMouseUp(e);
      interaction.setActive(false);
    };

    const onContextMenu = (e: MouseEvent) => {
      tools.handleContextMenu(e);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [
    canvasRef.current,
    party.interaction,
    party.isInitialized,
    party.useWebGPU,
    party.isInitializing,
    tools.toolMode,
    tools,
    party.screenToWorld,
  ]);

  // Return combined interface
  return {
    // Core engine functionality from useParty
    ...party,
    // Tools functionality from useTools
    ...tools,
  };
}