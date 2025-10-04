import { useCallback, useRef } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";
import { useInit } from "../../useInit";
import { calculateMassFromSize } from "../../../utils/particle";
import { parseColor, useRandomColorSelector } from "../utils";

// Configurable constants
const DRAW_STEP_SIZE = 20; // pixels - distance between particles when drawing

export function useDrawTool(isActive: boolean) {
  const { engine, screenToWorld, addParticle } = useEngine();
  const joints = useJoints();
  const lines = useLines();
  const { particleSize, colors } = useInit();
  
  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false); // Prevent concurrent operations
  const lastParticleIndexRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectedColorRef = useRef<string>("#ffffff");
  
  const selectRandomColor = useRandomColorSelector(colors);

  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // No overlay needed for draw tool
  }, []);

  // Helper function to spawn a particle at given position
  const spawnParticle = useCallback(async (worldX: number, worldY: number, isPinned: boolean) => {
    if (!addParticle || !engine) return null;

    const color = parseColor(selectedColorRef.current);
    const size = particleSize;
    const mass = isPinned ? -1 : calculateMassFromSize(size);

    addParticle({
      position: { x: worldX, y: worldY },
      velocity: { x: 0, y: 0 },
      size,
      mass,
      color,
    });

    // Get the index of the newly added particle (should be the last one)
    const particles = await engine.getParticles();
    return particles.length - 1;
  }, [addParticle, engine, particleSize]);

  // Helper function to create joint between two particles
  const createJoint = useCallback((indexA: number, indexB: number, restLength: number) => {
    // Enable joints module if not already enabled
    if (!joints.enabled) {
      joints.setEnabled(true);
    }

    // Enable joint lines module if not already enabled
    if (!lines.enabled) {
      lines.setEnabled(true);
    }

    joints.addJoint({ aIndex: indexA, bIndex: indexB, restLength });
    lines.addLine({ aIndex: indexA, bIndex: indexB });
  }, [joints, lines]);

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      // Stop event propagation to prevent other handlers
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      
      if (!engine || !isActive) return;

      // Prevent concurrent mouse down events
      if (isProcessingRef.current || isDrawingRef.current) return;
      
      isProcessingRef.current = true;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      mousePosRef.current = { x: sx, y: sy };

      const worldPos = screenToWorld(sx, sy);
      const isPinned = ev.ctrlKey || ev.metaKey;
      
      // Select new color for this drawing session
      selectedColorRef.current = selectRandomColor();
      
      // Start drawing - spawn first particle
      isDrawingRef.current = true;
      const particleIndex = await spawnParticle(worldPos.x, worldPos.y, isPinned);
      
      if (particleIndex !== null) {
        lastParticleIndexRef.current = particleIndex;
        lastPositionRef.current = { x: sx, y: sy };
      }
      
      isProcessingRef.current = false;
    },

    onMouseMove: async (ev) => {
      if (!engine || !isActive || !isDrawingRef.current || isProcessingRef.current) return;
      
      // Stop event propagation
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      mousePosRef.current = { x: sx, y: sy };

      const lastPos = lastPositionRef.current;
      if (!lastPos || lastParticleIndexRef.current === null) return;

      // Calculate distance from last particle position
      const dx = sx - lastPos.x;
      const dy = sy - lastPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if we've moved far enough to spawn a new particle
      if (distance >= DRAW_STEP_SIZE) {
        // Prevent concurrent spawning
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        
        const worldPos = screenToWorld(sx, sy);
        const isPinned = ev.ctrlKey || ev.metaKey;
        
        // Spawn new particle
        const newParticleIndex = await spawnParticle(worldPos.x, worldPos.y, isPinned);
        
        if (newParticleIndex !== null && lastParticleIndexRef.current !== null) {
          // Create joint between last particle and new particle
          const lastWorldPos = screenToWorld(lastPos.x, lastPos.y);
          const restLength = Math.sqrt(
            Math.pow(worldPos.x - lastWorldPos.x, 2) + 
            Math.pow(worldPos.y - lastWorldPos.y, 2)
          );
          
          createJoint(lastParticleIndexRef.current, newParticleIndex, restLength);
          
          // Update tracking for next particle
          lastParticleIndexRef.current = newParticleIndex;
          lastPositionRef.current = { x: sx, y: sy };
        }
        
        isProcessingRef.current = false;
      }
    },

    onMouseUp: (ev) => {
      // Stop event propagation
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      }
      
      if (!isActive) return;
      
      // Prevent concurrent mouse up events
      if (!isDrawingRef.current) return;
      
      // End drawing session
      isDrawingRef.current = false;
      isProcessingRef.current = false;
      lastParticleIndexRef.current = null;
      lastPositionRef.current = null;
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}