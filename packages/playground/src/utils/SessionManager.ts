import { ParticleSystem, Particle, Vector2D } from "@party/core";
import { SavedSession, SerializedParticle, SessionMetadata } from "../types/session";

const STORAGE_KEY = "playground-sessions";
const VERSION = "1.0.0";

export class SessionManager {
  static saveSession(
    system: ParticleSystem,
    name: string,
    overwrite: boolean = false
  ): { success: boolean; error?: string } {
    try {
      // Get system config
      const config = system.export();

      // Serialize particles
      const particles: SerializedParticle[] = system.particles.map((particle) => ({
        id: particle.id,
        position: { x: particle.position.x, y: particle.position.y },
        velocity: { x: particle.velocity.x, y: particle.velocity.y },
        acceleration: { x: particle.acceleration.x, y: particle.acceleration.y },
        mass: particle.mass,
        size: particle.size,
        color: particle.color,
      }));

      // Create session object
      const session: SavedSession = {
        name,
        timestamp: Date.now(),
        config,
        particles,
        metadata: {
          particleCount: particles.length,
          version: VERSION,
        },
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
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  static loadSession(
    system: ParticleSystem,
    name: string
  ): { success: boolean; error?: string } {
    try {
      const sessions = this.getAllSessions();
      const session = sessions.find((s) => s.name === name);

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      // Clear current particles
      system.clear();

      // Load particles
      const loadedParticles = session.particles.map((serialized) => {
        const particle = new Particle({
          position: new Vector2D(serialized.position.x, serialized.position.y),
          velocity: new Vector2D(serialized.velocity.x, serialized.velocity.y),
          acceleration: new Vector2D(serialized.acceleration.x, serialized.acceleration.y),
          mass: serialized.mass,
          size: serialized.size,
          color: serialized.color,
        });
        
        // Preserve original ID if needed for consistency
        return particle;
      });

      // Add particles to system
      system.addParticles(loadedParticles);

      // Import system config
      system.import(session.config);

      return { success: true };
    } catch (error) {
      console.error("Failed to load session:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
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
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  static renameSession(oldName: string, newName: string): { success: boolean; error?: string } {
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
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  static sessionExists(name: string): boolean {
    return this.getAllSessions().some((s) => s.name === name);
  }

  static getStorageInfo(): { 
    sessionCount: number; 
    estimatedSize: string; 
    isNearLimit: boolean 
  } {
    const sessions = this.getAllSessions();
    const data = localStorage.getItem(STORAGE_KEY) || "";
    const sizeInBytes = new Blob([data]).size;
    const sizeInKB = Math.round(sizeInBytes / 1024);
    
    // Estimate if we're approaching localStorage limits (usually ~5-10MB)
    const isNearLimit = sizeInBytes > 2 * 1024 * 1024; // 2MB threshold

    return {
      sessionCount: sessions.length,
      estimatedSize: sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`,
      isNearLimit,
    };
  }
}