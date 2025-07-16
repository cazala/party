import { useState, useCallback, useMemo } from "react";
import { ParticleSystem, Particle, Vector2D, setIdCounter } from "@party/core";

export interface SerializedParticle {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  mass: number;
  size: number;
  color: string;
}

export interface UndoAction {
  type: 'SPAWN_SINGLE' | 'SPAWN_BATCH' | 'REMOVE_SINGLE' | 'REMOVE_BATCH' | 'SYSTEM_CLEAR';
  timestamp: number;
  particles: SerializedParticle[]; // For remove/clear: particles to restore. For spawn: particles that were spawned
  systemStateBefore?: SerializedParticle[]; // Complete system state before the action (for spawn operations)
  idCounter?: number;
}

export interface UseUndoRedoReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  recordSpawnSingle: (particle: Particle, idCounter: number) => void;
  recordSpawnBatch: (particles: Particle[], idCounter: number) => void;
  recordRemoveSingle: (particle: Particle, idCounter: number) => void;
  recordRemoveBatch: (particles: Particle[], idCounter: number) => void;
  recordSystemClear: (particles: Particle[], idCounter: number) => void;
  clearHistory: () => void;
}

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo(getSystem: () => ParticleSystem | null): UseUndoRedoReturn {
  const [actionHistory, setActionHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);

  const serializeParticle = useCallback((particle: Particle): SerializedParticle => {
    return {
      id: particle.id,
      position: { x: particle.position.x, y: particle.position.y },
      velocity: { x: particle.velocity.x, y: particle.velocity.y },
      acceleration: { x: particle.acceleration.x, y: particle.acceleration.y },
      mass: particle.mass,
      size: particle.size,
      color: particle.color,
    };
  }, []);

  const deserializeParticle = useCallback((serialized: SerializedParticle): Particle => {
    const particle = new Particle({
      id: serialized.id, // Use the original ID
      position: new Vector2D(serialized.position.x, serialized.position.y),
      velocity: new Vector2D(serialized.velocity.x, serialized.velocity.y),
      acceleration: new Vector2D(serialized.acceleration.x, serialized.acceleration.y),
      mass: serialized.mass,
      size: serialized.size,
      color: serialized.color,
    });
    
    return particle;
  }, []);

  const addToHistory = useCallback((action: UndoAction) => {
    console.log("Adding action to history:", action.type, "particles:", action.particles.length);
    setActionHistory(prev => {
      const newHistory = [...prev, action];
      
      // Maintain history size limit
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      
      console.log("History now has", newHistory.length, "actions");
      return newHistory;
    });
    
    // Clear redo history when new action is added
    setRedoHistory([]);
  }, []);

  const recordSpawnSingle = useCallback((particle: Particle, idCounter: number) => {
    console.log("Recording spawn single in undo system:", particle.id);
    const system = getSystem();
    if (!system) return;
    
    // Capture system state before the spawn (exclude the particle that was just added)
    const systemStateBefore = system.particles
      .filter(p => p.id !== particle.id)
      .map(serializeParticle);
    
    const action: UndoAction = {
      type: 'SPAWN_SINGLE',
      timestamp: Date.now(),
      particles: [serializeParticle(particle)],
      systemStateBefore,
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory, getSystem]);

  const recordSpawnBatch = useCallback((particles: Particle[], idCounter: number) => {
    if (particles.length === 0) return;
    
    const system = getSystem();
    if (!system) return;
    
    // Capture system state before the spawn (exclude the particles that were just added)
    const spawnedIds = new Set(particles.map(p => p.id));
    const systemStateBefore = system.particles
      .filter(p => !spawnedIds.has(p.id))
      .map(serializeParticle);
    
    const action: UndoAction = {
      type: 'SPAWN_BATCH',
      timestamp: Date.now(),
      particles: particles.map(serializeParticle),
      systemStateBefore,
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory, getSystem]);

  const recordRemoveSingle = useCallback((particle: Particle, idCounter: number) => {
    const action: UndoAction = {
      type: 'REMOVE_SINGLE',
      timestamp: Date.now(),
      particles: [serializeParticle(particle)],
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory]);

  const recordRemoveBatch = useCallback((particles: Particle[], idCounter: number) => {
    if (particles.length === 0) return;
    
    const action: UndoAction = {
      type: 'REMOVE_BATCH',
      timestamp: Date.now(),
      particles: particles.map(serializeParticle),
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory]);

  const recordSystemClear = useCallback((particles: Particle[], idCounter: number) => {
    if (particles.length === 0) return;
    
    const action: UndoAction = {
      type: 'SYSTEM_CLEAR',
      timestamp: Date.now(),
      particles: particles.map(serializeParticle),
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory]);

  const undo = useCallback(() => {
    setActionHistory(currentHistory => {
      console.log("Undo called, history length:", currentHistory.length);
      if (currentHistory.length === 0) return currentHistory;
      
      const system = getSystem();
      if (!system) {
        console.log("No system available");
        return currentHistory;
      }

      const lastAction = currentHistory[currentHistory.length - 1];
      console.log("Undoing action:", lastAction.type, "particles:", lastAction.particles.length);
      
      // Add the action to redo history before undoing
      setRedoHistory(prev => [...prev, lastAction]);
      
      // Restore ID counter if provided
      if (lastAction.idCounter !== undefined) {
        setIdCounter(lastAction.idCounter);
      }

      switch (lastAction.type) {
        case 'SPAWN_SINGLE':
        case 'SPAWN_BATCH':
          // Restore the complete system state from before the spawn
          if (lastAction.systemStateBefore) {
            console.log(`Restoring system state to before spawn (${lastAction.systemStateBefore.length} particles)`);
            system.particles = lastAction.systemStateBefore.map(deserializeParticle);
          } else {
            // Fallback: try to remove the spawned particles individually
            lastAction.particles.forEach(serializedParticle => {
              const particle = system.getParticle(serializedParticle.id);
              console.log(`Trying to remove particle ${serializedParticle.id}:`, particle ? 'found' : 'not found');
              if (particle) {
                console.log(`Removing particle ${serializedParticle.id} with mass ${particle.mass}`);
                system.removeParticle(particle);
              } else {
                console.log(`Particle ${serializedParticle.id} not found in system (may have been auto-removed due to mass=0)`);
              }
            });
          }
          break;

        case 'REMOVE_SINGLE':
        case 'REMOVE_BATCH':
        case 'SYSTEM_CLEAR':
          // Restore the removed particles
          lastAction.particles.forEach(serializedParticle => {
            const particle = deserializeParticle(serializedParticle);
            console.log(`Restoring particle ${serializedParticle.id} with mass ${particle.mass}`);
            system.addParticle(particle);
          });
          break;
      }

      // Return the history without the last action
      return currentHistory.slice(0, -1);
    });
  }, [getSystem, deserializeParticle]);

  const redo = useCallback(() => {
    setRedoHistory(currentRedoHistory => {
      console.log("Redo called, redo history length:", currentRedoHistory.length);
      if (currentRedoHistory.length === 0) return currentRedoHistory;
      
      const system = getSystem();
      if (!system) {
        console.log("No system available");
        return currentRedoHistory;
      }

      const actionToRedo = currentRedoHistory[currentRedoHistory.length - 1];
      console.log("Redoing action:", actionToRedo.type, "particles:", actionToRedo.particles.length);
      
      // Add the action back to history
      setActionHistory(prev => [...prev, actionToRedo]);
      
      // Restore ID counter if provided
      if (actionToRedo.idCounter !== undefined) {
        setIdCounter(actionToRedo.idCounter);
      }

      switch (actionToRedo.type) {
        case 'SPAWN_SINGLE':
        case 'SPAWN_BATCH':
          // Re-add the spawned particles
          actionToRedo.particles.forEach(serializedParticle => {
            const particle = deserializeParticle(serializedParticle);
            console.log(`Re-adding spawned particle ${serializedParticle.id} with mass ${particle.mass}`);
            system.addParticle(particle);
          });
          break;

        case 'REMOVE_SINGLE':
        case 'REMOVE_BATCH':
          // Re-remove the particles by marking them with mass = 0 (same as original removal)
          actionToRedo.particles.forEach(serializedParticle => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              console.log(`Re-removing particle ${serializedParticle.id} by setting mass = 0`);
              particle.mass = 0;
              particle.size = 0; // Immediate visual feedback
            } else {
              console.log(`Cannot re-remove particle ${serializedParticle.id} - not found in system`);
            }
          });
          break;
          
        case 'SYSTEM_CLEAR':
          // Re-remove the particles
          actionToRedo.particles.forEach(serializedParticle => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              console.log(`Re-removing particle ${serializedParticle.id}`);
              system.removeParticle(particle);
            }
          });
          break;
      }

      // Return the redo history without the last action
      return currentRedoHistory.slice(0, -1);
    });
  }, [getSystem, deserializeParticle]);

  const clearHistory = useCallback(() => {
    setActionHistory([]);
    setRedoHistory([]);
  }, []);

  return useMemo(() => ({
    canUndo: actionHistory.length > 0,
    canRedo: redoHistory.length > 0,
    undo,
    redo,
    recordSpawnSingle,
    recordSpawnBatch,
    recordRemoveSingle,
    recordRemoveBatch,
    recordSystemClear,
    clearHistory,
  }), [actionHistory.length, redoHistory.length, undo, redo, recordSpawnSingle, recordSpawnBatch, recordRemoveSingle, recordRemoveBatch, recordSystemClear, clearHistory]);
}