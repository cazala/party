import { Emitter, SerializedEmitter } from "./emitter";
import { System } from "./system";
import { Vector2D } from "./vector";

/**
 * Emitters manager that handles multiple emitter instances
 * 
 * This class manages a collection of emitters, updating them each frame
 * and providing methods to add, remove, and query emitters. It integrates
 * with the particle system without being a Force.
 */
export class Emitters {
  private emitters: Map<string, Emitter> = new Map();
  private enabled: boolean = true;

  /**
   * Creates a new Emitters manager
   */
  constructor() {
    // Initialize empty emitters collection
  }

  /**
   * Updates all emitters, potentially spawning new particles
   * 
   * @param deltaTime Time elapsed since last update in seconds
   * @param system The particle system to spawn particles into
   */
  update(deltaTime: number, system: System): void {
    if (!this.enabled) return;

    for (const emitter of this.emitters.values()) {
      emitter.update(deltaTime, system);
    }
  }

  /**
   * Adds an emitter to the collection
   * 
   * @param emitter The emitter to add
   * @returns The ID of the added emitter
   */
  addEmitter(emitter: Emitter): string {
    this.emitters.set(emitter.id, emitter);
    return emitter.id;
  }

  /**
   * Removes an emitter from the collection
   * 
   * @param id The ID of the emitter to remove
   * @returns The removed emitter, or null if not found
   */
  removeEmitter(id: string): Emitter | null {
    const emitter = this.emitters.get(id);
    if (emitter) {
      this.emitters.delete(id);
      return emitter;
    }
    return null;
  }

  /**
   * Gets an emitter by ID
   * 
   * @param id The ID of the emitter to retrieve
   * @returns The emitter, or null if not found
   */
  getEmitter(id: string): Emitter | null {
    return this.emitters.get(id) || null;
  }

  /**
   * Gets all emitters
   * 
   * @returns Array of all emitters
   */
  getAllEmitters(): Emitter[] {
    return Array.from(this.emitters.values());
  }

  /**
   * Finds the closest emitter to a given position within a specified radius
   * 
   * @param position The position to search from
   * @param radius The search radius
   * @returns The closest emitter within radius, or null if none found
   */
  findEmitterAt(position: Vector2D, radius: number = 20): Emitter | null {
    let closestEmitter: Emitter | null = null;
    let closestDistance = radius;

    for (const emitter of this.emitters.values()) {
      const distance = Math.sqrt(
        Math.pow(emitter.position.x - position.x, 2) +
        Math.pow(emitter.position.y - position.y, 2)
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEmitter = emitter;
      }
    }

    return closestEmitter;
  }

  /**
   * Gets the number of emitters
   * 
   * @returns The count of emitters
   */
  getCount(): number {
    return this.emitters.size;
  }

  /**
   * Enables or disables all emitters
   * 
   * @param enabled Whether emitters should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Gets the enabled state of the emitters system
   * 
   * @returns Whether emitters are enabled
   */
  getEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clears all emitters
   */
  clear(): void {
    this.emitters.clear();
  }

  /**
   * Serializes all emitters for session saving
   * 
   * @returns Array of serialized emitter data
   */
  serialize(): SerializedEmitter[] {
    return Array.from(this.emitters.values()).map(emitter => emitter.serialize());
  }

  /**
   * Deserializes and adds emitters from saved data
   * 
   * @param emittersData Array of serialized emitter data
   */
  deserialize(emittersData: SerializedEmitter[]): void {
    // Clear existing emitters
    this.clear();

    // Add emitters from serialized data
    for (const emitterData of emittersData) {
      const emitter = Emitter.deserialize(emitterData);
      this.addEmitter(emitter);
    }
  }

  /**
   * Creates a clone of all emitters (useful for undo/redo operations)
   * 
   * @returns Array of cloned emitters
   */
  cloneAll(): Emitter[] {
    return Array.from(this.emitters.values()).map(emitter => emitter.clone());
  }

  /**
   * Enables or disables a specific emitter
   * 
   * @param id The ID of the emitter to modify
   * @param enabled Whether the emitter should be enabled
   * @returns True if the emitter was found and modified, false otherwise
   */
  setEmitterEnabled(id: string, enabled: boolean): boolean {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.setEnabled(enabled);
      return true;
    }
    return false;
  }

  /**
   * Updates the position of a specific emitter
   * 
   * @param id The ID of the emitter to modify
   * @param x The new x position
   * @param y The new y position
   * @returns True if the emitter was found and modified, false otherwise
   */
  setEmitterPosition(id: string, x: number, y: number): boolean {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.setPosition(x, y);
      return true;
    }
    return false;
  }
}