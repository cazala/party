import { System, Particle, Vector2D, Canvas2DRenderer, setIdCounter } from "@cazala/party";
import {
  SavedSession,
  SerializedParticle,
  SerializedJoint,
  SessionMetadata,
} from "../types/session";
import { Boundary } from "@cazala/party";
import { SpatialGrid } from "@cazala/party";
import { UseUndoRedoReturn } from "../hooks/useUndoRedo";
import { getViewportWorldBounds, calculateCameraToShowWorldBounds, applyCameraSettings } from "./sceneBounds";

const STORAGE_KEY = "playground-sessions";
const VERSION = "1.0.0";

export class SessionManager {
  static saveSession(
    system: System,
    name: string,
    overwrite: boolean = false,
    renderer?: any,
    systemControlsState?: any
  ): { success: boolean; error?: string } {
    try {
      // Get system config
      const config = system.export();

      // Serialize particles
      const particles: SerializedParticle[] = system.particles.map(
        (particle) => ({
          id: particle.id,
          position: { x: particle.position.x, y: particle.position.y },
          velocity: { x: particle.velocity.x, y: particle.velocity.y },
          acceleration: {
            x: particle.acceleration.x,
            y: particle.acceleration.y,
          },
          mass: particle.mass,
          size: particle.size,
          color: particle.color,
          pinned: particle.pinned,
        })
      );

      // Serialize joints
      const joints: SerializedJoint[] = [];
      const jointsForce = system.forces.find(force => force.constructor.name === 'Joints') as any;
      if (jointsForce && jointsForce.serializeJoints) {
        joints.push(...jointsForce.serializeJoints());
      }

      // Get camera and zoom data from renderer (kept for backward compatibility)
      const camera = renderer
        ? {
            x: renderer.getCamera().x,
            y: renderer.getCamera().y,
            zoom: renderer.getZoom(),
          }
        : {
            x: 0,
            y: 0,
            zoom: 1,
          };

      // Calculate viewport world bounds for viewport-independent loading
      const viewportWorldBounds = renderer ? getViewportWorldBounds(system, renderer) : null;
      
      const scene = viewportWorldBounds ? {
        viewportWorldBounds,
        originalViewport: {
          width: system.width,
          height: system.height
        }
      } : undefined;

      // Create session object
      const session: SavedSession = {
        name,
        timestamp: Date.now(),
        config,
        particles,
        joints,
        camera,
        scene,
        metadata: {
          particleCount: particles.length,
          jointCount: joints.length,
          version: VERSION,
        },
        systemControls: systemControlsState,
      };

      // Get existing sessions
      const existingSessions = this.getAllSessions();
      const existingIndex = existingSessions.findIndex((s) => s.name === name);

      let updatedSessions: SavedSession[];

      if (existingIndex !== -1) {
        if (!overwrite) {
          return { success: false, error: "Session name already exists" };
        }
        // Replace existing session
        updatedSessions = [...existingSessions];
        updatedSessions[existingIndex] = session;
      } else {
        // Add new session
        updatedSessions = [...existingSessions, session];
      }

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));

      return { success: true };
    } catch (error) {
      console.error("Failed to save session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static loadSession(
    system: System,
    name: string,
    renderer?: Canvas2DRenderer,
    boundary?: Boundary,
    spatialGrid?: SpatialGrid,
    zoomStateRef?: any,
    undoRedo?: UseUndoRedoReturn,
    onSystemControlsRestore?: (systemControls: any) => void
  ): { success: boolean; error?: string; systemControls?: any } {
    try {
      const sessions = this.getAllSessions();
      const session = sessions.find((s) => s.name === name);

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      // Clear current particles
      system.clear();

      // Clear the canvas completely (full background repaint with 100% alpha)
      if (renderer) {
        renderer.clearCanvas();
      }

      // Clear undo/redo history to prevent memory leaks
      if (undoRedo) {
        undoRedo.clearHistory();
      }

      // Clear force-specific caches to free up old particle references
      for (const force of system.forces) {
        force.clear?.();
      }

      // Load particles with preserved IDs
      const loadedParticles = session.particles.map((serialized) => {
        const particle = new Particle({
          id: serialized.id, // Preserve original ID for joint references
          position: new Vector2D(serialized.position.x, serialized.position.y),
          velocity: new Vector2D(serialized.velocity.x, serialized.velocity.y),
          acceleration: new Vector2D(
            serialized.acceleration.x,
            serialized.acceleration.y
          ),
          mass: serialized.mass,
          size: serialized.size,
          color: serialized.color,
          pinned: serialized.pinned,
        });

        return particle;
      });

      // Update ID counter to prevent conflicts with future particles
      if (session.particles.length > 0) {
        const maxId = Math.max(...session.particles.map(p => p.id));
        setIdCounter(maxId + 1);
      }

      // Add particles to system
      system.addParticles(loadedParticles);

      // Load joints if they exist in the session (backward compatibility)
      if (session.joints) {
        const jointsForce = system.forces.find(force => force.constructor.name === 'Joints') as any;
        if (jointsForce && jointsForce.deserializeJoints) {
          jointsForce.deserializeJoints(session.joints, loadedParticles);
        }
      }

      // Import system config
      system.import(session.config);

      // Restore camera and zoom data if renderer is provided
      if (renderer) {
        // Use new viewport-relative positioning if available, otherwise fall back to old camera data
        if (session.scene && session.scene.viewportWorldBounds) {
          // Calculate camera position to show the same world area that was visible when saved
          const { cameraX, cameraY, zoom } = calculateCameraToShowWorldBounds(
            session.scene.viewportWorldBounds,
            system.width,
            system.height
          );
          
          console.log(`Loading session with viewport-independent positioning:
            Original viewport: ${session.scene.originalViewport.width}x${session.scene.originalViewport.height}
            Current viewport: ${system.width}x${system.height}
            Saved world area: ${session.scene.viewportWorldBounds.worldWidth.toFixed(1)}x${session.scene.viewportWorldBounds.worldHeight.toFixed(1)}
            World bounds: (${session.scene.viewportWorldBounds.worldMinX.toFixed(1)}, ${session.scene.viewportWorldBounds.worldMinY.toFixed(1)}) to (${session.scene.viewportWorldBounds.worldMaxX.toFixed(1)}, ${session.scene.viewportWorldBounds.worldMaxY.toFixed(1)})
            Calculated camera: (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)}) zoom: ${zoom.toFixed(2)}`);
          
          applyCameraSettings(renderer, cameraX, cameraY, zoom, boundary, spatialGrid, zoomStateRef);
        } else {
          // Backward compatibility: use old absolute camera positioning
          const camera = session.camera || { x: 0, y: 0, zoom: 1 };
          console.log(`Loading session with backward compatibility camera positioning: (${camera.x.toFixed(1)}, ${camera.y.toFixed(1)}) zoom: ${camera.zoom.toFixed(2)}`);
          applyCameraSettings(renderer, camera.x, camera.y, camera.zoom, boundary, spatialGrid, zoomStateRef);
        }
      }

      // Restore system controls state if available and callback provided
      if (session.systemControls && onSystemControlsRestore) {
        onSystemControlsRestore(session.systemControls);
      }

      return { success: true, systemControls: session.systemControls };
    } catch (error) {
      console.error("Failed to load session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static getAllSessions(): SavedSession[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to get sessions:", error);
      return [];
    }
  }

  static getSessionMetadata(): SessionMetadata[] {
    return this.getAllSessions().map((session) => ({
      name: session.name,
      timestamp: session.timestamp,
      particleCount: session.metadata.particleCount,
      jointCount: session.metadata.jointCount || 0, // Backward compatibility
      camera: session.camera || { x: 0, y: 0, zoom: 1 }, // Backward compatibility
      hasSceneBounds: !!session.scene?.viewportWorldBounds, // Indicate if this session has viewport world bounds info
    }));
  }

  static deleteSession(name: string): { success: boolean; error?: string } {
    try {
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter((s) => s.name !== name);

      if (sessions.length === filteredSessions.length) {
        return { success: false, error: "Session not found" };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSessions));
      return { success: true };
    } catch (error) {
      console.error("Failed to delete session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static renameSession(
    oldName: string,
    newName: string
  ): { success: boolean; error?: string } {
    try {
      const sessions = this.getAllSessions();
      const sessionIndex = sessions.findIndex((s) => s.name === oldName);

      if (sessionIndex === -1) {
        return { success: false, error: "Session not found" };
      }

      // Check if new name already exists (unless it's the same as old name)
      if (oldName !== newName && sessions.some((s) => s.name === newName)) {
        return { success: false, error: "Session name already exists" };
      }

      // Update the session name
      sessions[sessionIndex].name = newName;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      return { success: true };
    } catch (error) {
      console.error("Failed to rename session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static sessionExists(name: string): boolean {
    return this.getAllSessions().some((s) => s.name === name);
  }

  static getStorageInfo(): {
    sessionCount: number;
    estimatedSize: string;
    isNearLimit: boolean;
  } {
    const sessions = this.getAllSessions();
    const data = localStorage.getItem(STORAGE_KEY) || "";
    const sizeInBytes = new Blob([data]).size;
    const sizeInKB = Math.round(sizeInBytes / 1024);

    // Estimate if we're approaching localStorage limits (usually ~5-10MB)
    const isNearLimit = sizeInBytes > 2 * 1024 * 1024; // 2MB threshold

    return {
      sessionCount: sessions.length,
      estimatedSize:
        sizeInKB > 1024
          ? `${(sizeInKB / 1024).toFixed(1)} MB`
          : `${sizeInKB} KB`,
      isNearLimit,
    };
  }
}
