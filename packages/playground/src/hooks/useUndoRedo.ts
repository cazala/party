import { useState, useCallback, useMemo } from "react";
import { System, Particle, Vector2D, setIdCounter, Joints, Joint } from "@party/core";

/**
 * Undo/Redo System for Particle Operations
 *
 * This hook provides comprehensive undo/redo functionality for all particle operations
 * in the playground. It tracks operations at a surgical level - only affecting the
 * specific particles that were added or removed, preserving physics simulation state
 * for all other particles.
 *
 * Supported Operations:
 * - SPAWN_SINGLE: Single particle spawn (click)
 * - SPAWN_BATCH: Multiple particle spawn (streaming/shift+click)
 * - REMOVE_SINGLE: Single particle removal (click in remove mode)
 * - REMOVE_BATCH: Multiple particle removal (drag in remove mode)
 * - SYSTEM_CLEAR: Clear all particles
 *
 * Key Features:
 * - Surgical operations: Only affects specific particles, preserves physics state
 * - Dual-stack architecture: Separate undo and redo histories
 * - History limit: Maintains up to 50 operations
 * - ID preservation: Maintains particle IDs across operations
 * - Automatic redo clearing: New actions clear redo history
 */

/**
 * Serialized representation of a particle for undo/redo operations
 * Contains all necessary data to recreate a particle with identical state
 */
export interface SerializedParticle {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  mass: number;
  size: number;
  color: string;
  pinned?: boolean;
  grabbed?: boolean;
}

/**
 * Serialized representation of a joint for undo/redo operations
 * Contains all necessary data to recreate a joint with identical state
 */
export interface SerializedJoint {
  id: string;
  particleAId: number;
  particleBId: number;
  restLength: number;
}

/**
 * Pin state change tracking for undo/redo
 */
export interface PinStateChange {
  particleId: number;
  wasStaticBefore: boolean;
  wasGrabbedBefore: boolean;
}

/**
 * Represents a single undoable/redoable action in the particle system
 */
export interface UndoAction {
  type:
    | "SPAWN_SINGLE"
    | "SPAWN_BATCH"
    | "REMOVE_SINGLE"
    | "REMOVE_BATCH"
    | "SYSTEM_CLEAR"
    | "DRAW_BATCH"
    | "SHAPE_SPAWN"
    | "JOINT_CREATE"
    | "JOINT_REMOVE"
    | "PIN_TOGGLE";
  timestamp: number;
  particles?: SerializedParticle[]; // For remove/clear: particles to restore. For spawn: particles that were spawned
  joints?: SerializedJoint[]; // For joint operations: joints to create/remove
  pinChanges?: PinStateChange[]; // For pin operations: pin state changes
  systemStateBefore?: SerializedParticle[]; // Legacy field, no longer used but kept for compatibility
  idCounter?: number; // ID counter state at the time of the action
}

/**
 * Return interface for the useUndoRedo hook
 */
export interface UseUndoRedoReturn {
  canUndo: boolean; // Whether there are actions available to undo
  canRedo: boolean; // Whether there are actions available to redo
  undo: () => void; // Undo the last action
  redo: () => void; // Redo the last undone action
  recordSpawnSingle: (particle: Particle, idCounter: number) => void; // Record a single particle spawn
  recordSpawnBatch: (particles: Particle[], idCounter: number) => void; // Record multiple particle spawns
  recordDrawBatch: (particles: Particle[], joints: Joint[], idCounter: number) => void; // Record draw mode batch with joints
  recordShapeSpawn: (particles: Particle[], joints: Joint[], idCounter: number) => void; // Record shape spawn with particles and joints
  recordRemoveSingle: (particle: Particle, idCounter: number) => void; // Record a single particle removal
  recordRemoveBatch: (particles: Particle[], idCounter: number) => void; // Record multiple particle removals
  recordSystemClear: (particles: Particle[], idCounter: number) => void; // Record a system clear operation
  recordJointCreate: (joint: Joint, idCounter: number) => void; // Record joint creation
  recordJointRemove: (joint: Joint, idCounter: number) => void; // Record joint removal
  recordPinToggle: (particleId: number, wasStaticBefore: boolean, wasGrabbedBefore: boolean, idCounter: number) => void; // Record pin state toggle
  clearHistory: () => void; // Clear all undo/redo history
}

const MAX_HISTORY_SIZE = 50;

/**
 * Hook that provides undo/redo functionality for particle operations
 *
 * @param getSystem Function that returns the current particle system instance
 * @param getJoints Function that returns the current joints system instance
 * @returns Object containing undo/redo state and control functions
 */
export function useUndoRedo(getSystem: () => System | null, getJoints?: () => Joints | null): UseUndoRedoReturn {
  const [actionHistory, setActionHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);

  /**
   * Converts a Particle instance to a serializable format for storage
   */
  const serializeParticle = useCallback(
    (particle: Particle): SerializedParticle => {
      return {
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
        grabbed: particle.grabbed,
      };
    },
    []
  );

  /**
   * Converts a serialized particle back to a Particle instance
   * Preserves the original ID to maintain consistency across undo/redo operations
   */
  const deserializeParticle = useCallback(
    (serialized: SerializedParticle): Particle => {
      const particle = new Particle({
        id: serialized.id, // Use the original ID
        position: new Vector2D(serialized.position.x, serialized.position.y),
        velocity: new Vector2D(serialized.velocity.x, serialized.velocity.y),
        acceleration: new Vector2D(
          serialized.acceleration.x,
          serialized.acceleration.y
        ),
        mass: serialized.mass,
        size: serialized.size,
        color: serialized.color,
        pinned: serialized.pinned || false,
        grabbed: serialized.grabbed || false,
      });

      return particle;
    },
    []
  );

  /**
   * Converts a Joint instance to a serializable format for storage
   */
  const serializeJoint = useCallback((joint: Joint): SerializedJoint => {
    return {
      id: joint.id,
      particleAId: joint.particleA.id,
      particleBId: joint.particleB.id,
      restLength: joint.restLength,
    };
  }, []);

  /**
   * Converts a serialized joint back to a Joint instance
   * Requires access to the particle system to find the referenced particles
   */
  const deserializeJoint = useCallback(
    (serialized: SerializedJoint): Joint | null => {
      const system = getSystem();
      if (!system) return null;

      const particleA = system.getParticle(serialized.particleAId);
      const particleB = system.getParticle(serialized.particleBId);

      if (!particleA || !particleB) return null;

      return new Joint({
        id: serialized.id,
        particleA,
        particleB,
        restLength: serialized.restLength,
      });
    },
    [getSystem]
  );

  /**
   * Adds an action to the undo history and clears redo history
   * Maintains the maximum history size by removing oldest actions
   */
  const addToHistory = useCallback((action: UndoAction) => {
    setActionHistory((prev) => {
      const newHistory = [...prev, action];

      // Maintain history size limit
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      return newHistory;
    });

    // Clear redo history when new action is added
    setRedoHistory([]);
  }, []);

  /**
   * Records a single particle spawn operation
   */
  const recordSpawnSingle = useCallback(
    (particle: Particle, idCounter: number) => {
      const action: UndoAction = {
        type: "SPAWN_SINGLE",
        timestamp: Date.now(),
        particles: [serializeParticle(particle)],
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, addToHistory]
  );

  /**
   * Records a batch particle spawn operation (streaming mode)
   */
  const recordSpawnBatch = useCallback(
    (particles: Particle[], idCounter: number) => {
      if (particles.length === 0) return;

      const action: UndoAction = {
        type: "SPAWN_BATCH",
        timestamp: Date.now(),
        particles: particles.map(serializeParticle),
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, addToHistory]
  );

  /**
   * Records a single particle removal operation
   */
  const recordRemoveSingle = useCallback(
    (particle: Particle, idCounter: number) => {
      const action: UndoAction = {
        type: "REMOVE_SINGLE",
        timestamp: Date.now(),
        particles: [serializeParticle(particle)],
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, addToHistory]
  );

  /**
   * Records a batch particle removal operation (drag removal)
   */
  const recordRemoveBatch = useCallback(
    (particles: Particle[], idCounter: number) => {
      if (particles.length === 0) return;

      const action: UndoAction = {
        type: "REMOVE_BATCH",
        timestamp: Date.now(),
        particles: particles.map(serializeParticle),
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, addToHistory]
  );

  /**
   * Records a system clear operation (all particles removed)
   */
  const recordSystemClear = useCallback(
    (particles: Particle[], idCounter: number) => {
      if (particles.length === 0) return;

      const action: UndoAction = {
        type: "SYSTEM_CLEAR",
        timestamp: Date.now(),
        particles: particles.map(serializeParticle),
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, addToHistory]
  );

  /**
   * Records a draw batch operation (particles with joints)
   */
  const recordDrawBatch = useCallback(
    (particles: Particle[], joints: Joint[], idCounter: number) => {
      if (particles.length === 0) return;

      const action: UndoAction = {
        type: "DRAW_BATCH",
        timestamp: Date.now(),
        particles: particles.map(serializeParticle),
        joints: joints.map(serializeJoint),
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, serializeJoint, addToHistory]
  );

  /**
   * Records a shape spawn operation (particles with all-to-all joints)
   */
  const recordShapeSpawn = useCallback(
    (particles: Particle[], joints: Joint[], idCounter: number) => {
      if (particles.length === 0) return;

      const action: UndoAction = {
        type: "SHAPE_SPAWN",
        timestamp: Date.now(),
        particles: particles.map(serializeParticle),
        joints: joints.map(serializeJoint),
        idCounter,
      };
      addToHistory(action);
    },
    [serializeParticle, serializeJoint, addToHistory]
  );

  /**
   * Records a joint creation operation
   */
  const recordJointCreate = useCallback(
    (joint: Joint, idCounter: number) => {
      const action: UndoAction = {
        type: "JOINT_CREATE",
        timestamp: Date.now(),
        joints: [serializeJoint(joint)],
        idCounter,
      };
      addToHistory(action);
    },
    [serializeJoint, addToHistory]
  );

  /**
   * Records a joint removal operation
   */
  const recordJointRemove = useCallback(
    (joint: Joint, idCounter: number) => {
      const action: UndoAction = {
        type: "JOINT_REMOVE",
        timestamp: Date.now(),
        joints: [serializeJoint(joint)],
        idCounter,
      };
      addToHistory(action);
    },
    [serializeJoint, addToHistory]
  );

  /**
   * Records a pin state toggle operation
   */
  const recordPinToggle = useCallback(
    (particleId: number, wasStaticBefore: boolean, wasGrabbedBefore: boolean, idCounter: number) => {
      const action: UndoAction = {
        type: "PIN_TOGGLE",
        timestamp: Date.now(),
        pinChanges: [{ particleId, wasStaticBefore, wasGrabbedBefore }],
        idCounter,
      };
      addToHistory(action);
    },
    [addToHistory]
  );

  /**
   * Undoes the last action in the history
   * For spawn operations: Removes the spawned particles
   * For remove/clear operations: Restores the removed particles
   * Preserves physics state for non-affected particles
   */
  const undo = useCallback(() => {
    setActionHistory((currentHistory) => {
      if (currentHistory.length === 0) return currentHistory;

      const system = getSystem();
      if (!system) return currentHistory;

      const lastAction = currentHistory[currentHistory.length - 1];

      // Add the action to redo history before undoing
      setRedoHistory((prev) => [...prev, lastAction]);

      // Restore ID counter if provided
      if (lastAction.idCounter !== undefined) {
        setIdCounter(lastAction.idCounter);
      }

      switch (lastAction.type) {
        case "SPAWN_SINGLE":
        case "SPAWN_BATCH":
          // Remove only the specific particles that were spawned
          lastAction.particles?.forEach((serializedParticle) => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              system.removeParticle(particle);
            }
          });
          break;

        case "DRAW_BATCH":
          // Remove the drawn particles and joints
          const joints = getJoints?.();
          if (joints && lastAction.joints) {
            lastAction.joints.forEach((serializedJoint) => {
              joints.removeJoint(serializedJoint.id);
            });
          }
          lastAction.particles?.forEach((serializedParticle) => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              system.removeParticle(particle);
            }
          });
          break;

        case "SHAPE_SPAWN":
          // Remove the shape particles and joints
          const shapeJoints = getJoints?.();
          if (shapeJoints && lastAction.joints) {
            lastAction.joints.forEach((serializedJoint) => {
              shapeJoints.removeJoint(serializedJoint.id);
            });
          }
          lastAction.particles?.forEach((serializedParticle) => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              system.removeParticle(particle);
            }
          });
          break;

        case "REMOVE_SINGLE":
        case "REMOVE_BATCH":
        case "SYSTEM_CLEAR":
          // Restore the removed particles
          lastAction.particles?.forEach((serializedParticle) => {
            const particle = deserializeParticle(serializedParticle);
            system.addParticle(particle);
          });
          break;

        case "JOINT_CREATE":
          // Remove the created joint
          const jointsSystem1 = getJoints?.();
          if (jointsSystem1 && lastAction.joints) {
            lastAction.joints.forEach((serializedJoint) => {
              jointsSystem1.removeJoint(serializedJoint.id);
            });
          }
          break;

        case "JOINT_REMOVE":
          // Restore the removed joint
          const jointsSystem2 = getJoints?.();
          if (jointsSystem2 && lastAction.joints) {
            lastAction.joints.forEach((serializedJoint) => {
              const joint = deserializeJoint(serializedJoint);
              if (joint) {
                jointsSystem2.createJoint({
                  id: joint.id,
                  particleA: joint.particleA,
                  particleB: joint.particleB,
                  restLength: joint.restLength,
                });
              }
            });
          }
          break;

        case "PIN_TOGGLE":
          // Restore the previous pin state
          if (lastAction.pinChanges) {
            lastAction.pinChanges.forEach((pinChange) => {
              const particle = system.getParticle(pinChange.particleId);
              if (particle) {
                particle.pinned = pinChange.wasStaticBefore;
                particle.grabbed = pinChange.wasGrabbedBefore;
              }
            });
          }
          break;
      }

      // Return the history without the last action
      return currentHistory.slice(0, -1);
    });
  }, [getSystem, deserializeParticle]);

  /**
   * Redoes the last undone action
   * For spawn operations: Re-adds the spawned particles
   * For remove/clear operations: Re-removes the particles
   */
  const redo = useCallback(() => {
    setRedoHistory((currentRedoHistory) => {
      if (currentRedoHistory.length === 0) return currentRedoHistory;

      const system = getSystem();
      if (!system) return currentRedoHistory;

      const actionToRedo = currentRedoHistory[currentRedoHistory.length - 1];

      // Add the action back to history
      setActionHistory((prev) => [...prev, actionToRedo]);

      // Restore ID counter if provided
      if (actionToRedo.idCounter !== undefined) {
        setIdCounter(actionToRedo.idCounter);
      }

      switch (actionToRedo.type) {
        case "SPAWN_SINGLE":
        case "SPAWN_BATCH":
          // Re-add the spawned particles
          actionToRedo.particles?.forEach((serializedParticle) => {
            const particle = deserializeParticle(serializedParticle);
            console.log(
              `Re-adding spawned particle ${serializedParticle.id} with mass ${particle.mass}`
            );
            system.addParticle(particle);
          });
          break;

        case "DRAW_BATCH":
          // Re-add the drawn particles and joints
          actionToRedo.particles?.forEach((serializedParticle) => {
            const particle = deserializeParticle(serializedParticle);
            system.addParticle(particle);
          });
          const joints = getJoints?.();
          if (joints && actionToRedo.joints) {
            actionToRedo.joints.forEach((serializedJoint) => {
              const joint = deserializeJoint(serializedJoint);
              if (joint) {
                joints.createJoint({
                  id: joint.id,
                  particleA: joint.particleA,
                  particleB: joint.particleB,
                  restLength: joint.restLength,
                });
              }
            });
          }
          break;

        case "SHAPE_SPAWN":
          // Re-add the shape particles and joints
          actionToRedo.particles?.forEach((serializedParticle) => {
            const particle = deserializeParticle(serializedParticle);
            system.addParticle(particle);
          });
          const shapeJoints = getJoints?.();
          if (shapeJoints && actionToRedo.joints) {
            actionToRedo.joints.forEach((serializedJoint) => {
              const joint = deserializeJoint(serializedJoint);
              if (joint) {
                shapeJoints.createJoint({
                  id: joint.id,
                  particleA: joint.particleA,
                  particleB: joint.particleB,
                  restLength: joint.restLength,
                });
              }
            });
          }
          break;

        case "REMOVE_SINGLE":
        case "REMOVE_BATCH":
          // Re-remove the particles by marking them with mass = 0 (same as original removal)
          actionToRedo.particles?.forEach((serializedParticle) => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              console.log(
                `Re-removing particle ${serializedParticle.id} by setting mass = 0`
              );
              particle.mass = 0;
              particle.size = 0; // Immediate visual feedback
            } else {
              console.log(
                `Cannot re-remove particle ${serializedParticle.id} - not found in system`
              );
            }
          });
          break;

        case "SYSTEM_CLEAR":
          // Re-remove the particles
          actionToRedo.particles?.forEach((serializedParticle) => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              system.removeParticle(particle);
            }
          });
          break;

        case "JOINT_CREATE":
          // Re-create the joint
          const jointsSystem1 = getJoints?.();
          if (jointsSystem1 && actionToRedo.joints) {
            actionToRedo.joints.forEach((serializedJoint) => {
              const joint = deserializeJoint(serializedJoint);
              if (joint) {
                jointsSystem1.createJoint({
                  id: joint.id,
                  particleA: joint.particleA,
                  particleB: joint.particleB,
                  restLength: joint.restLength,
                });
              }
            });
          }
          break;

        case "JOINT_REMOVE":
          // Re-remove the joint
          const jointsSystem2 = getJoints?.();
          if (jointsSystem2 && actionToRedo.joints) {
            actionToRedo.joints.forEach((serializedJoint) => {
              jointsSystem2.removeJoint(serializedJoint.id);
            });
          }
          break;

        case "PIN_TOGGLE":
          // Re-apply the pin state toggle
          if (actionToRedo.pinChanges) {
            actionToRedo.pinChanges.forEach((pinChange) => {
              const particle = system.getParticle(pinChange.particleId);
              if (particle) {
                // Toggle the pin state (opposite of what it was before)
                particle.pinned = !pinChange.wasStaticBefore;
                particle.grabbed = !pinChange.wasGrabbedBefore;
              }
            });
          }
          break;
      }

      // Return the redo history without the last action
      return currentRedoHistory.slice(0, -1);
    });
  }, [getSystem, deserializeParticle]);

  /**
   * Clears all undo and redo history
   */
  const clearHistory = useCallback(() => {
    setActionHistory([]);
    setRedoHistory([]);
  }, []);

  // Return memoized object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      canUndo: actionHistory.length > 0,
      canRedo: redoHistory.length > 0,
      undo,
      redo,
      recordSpawnSingle,
      recordSpawnBatch,
      recordDrawBatch,
      recordShapeSpawn,
      recordRemoveSingle,
      recordRemoveBatch,
      recordSystemClear,
      recordJointCreate,
      recordJointRemove,
      recordPinToggle,
      clearHistory,
    }),
    [
      actionHistory.length,
      redoHistory.length,
      undo,
      redo,
      recordSpawnSingle,
      recordSpawnBatch,
      recordDrawBatch,
      recordShapeSpawn,
      recordRemoveSingle,
      recordRemoveBatch,
      recordSystemClear,
      recordJointCreate,
      recordJointRemove,
      recordPinToggle,
      clearHistory,
    ]
  );
}
