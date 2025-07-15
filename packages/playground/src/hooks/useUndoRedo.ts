import { useState, useCallback } from "react";
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
  particles: SerializedParticle[];
  idCounter?: number;
}

export interface UseUndoRedoReturn {
  canUndo: boolean;
  undo: () => void;
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
  }, []);

  const recordSpawnSingle = useCallback((particle: Particle, idCounter: number) => {
    console.log("Recording spawn single in undo system:", particle.id);
    const action: UndoAction = {
      type: 'SPAWN_SINGLE',
      timestamp: Date.now(),
      particles: [serializeParticle(particle)],
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory]);

  const recordSpawnBatch = useCallback((particles: Particle[], idCounter: number) => {
    if (particles.length === 0) return;
    
    const action: UndoAction = {
      type: 'SPAWN_BATCH',
      timestamp: Date.now(),
      particles: particles.map(serializeParticle),
      idCounter,
    };
    addToHistory(action);
  }, [serializeParticle, addToHistory]);

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
      
      // Restore ID counter if provided
      if (lastAction.idCounter !== undefined) {
        setIdCounter(lastAction.idCounter);
      }

      switch (lastAction.type) {
        case 'SPAWN_SINGLE':
        case 'SPAWN_BATCH':
          // Remove the spawned particles
          lastAction.particles.forEach(serializedParticle => {
            const particle = system.getParticle(serializedParticle.id);
            if (particle) {
              system.removeParticle(particle);
            }
          });
          break;

        case 'REMOVE_SINGLE':
        case 'REMOVE_BATCH':
        case 'SYSTEM_CLEAR':
          // Restore the removed particles
          lastAction.particles.forEach(serializedParticle => {
            const particle = deserializeParticle(serializedParticle);
            system.addParticle(particle);
          });
          break;
      }

      // Return the history without the last action
      return currentHistory.slice(0, -1);
    });
  }, [getSystem, deserializeParticle]);

  const clearHistory = useCallback(() => {
    setActionHistory([]);
  }, []);

  return {
    canUndo: actionHistory.length > 0,
    undo,
    recordSpawnSingle,
    recordSpawnBatch,
    recordRemoveSingle,
    recordRemoveBatch,
    recordSystemClear,
    clearHistory,
  };
}