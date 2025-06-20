import { ParticleSystem, SystemOptions } from "./system.js";
import { Canvas2DRenderer, ParticleRenderOptions } from "./render.js";
import { Spawner, SpawnerOptions } from "./spawner.js";
import { BoundingBox } from "./bounds.js";
import { Vector2D } from "./vector.js";

export interface ParticleSystemState {
  system: ParticleSystem;
  renderer: Canvas2DRenderer | null;
  spawner: Spawner;
  bounds: BoundingBox | null;
  isPlaying: boolean;
  particleCount: number;
}

export interface ParticleSystemControls {
  state: ParticleSystemState;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  clear: () => void;
  setCanvas: (canvas: HTMLCanvasElement) => void;
  setBounds: (bounds: BoundingBox) => void;
  addParticleAt: (position: Vector2D) => void;
  spawnBurst: (position: Vector2D, count: number, speed?: number) => void;
  updateRenderOptions: (options: ParticleRenderOptions) => void;
}

export interface ParticleSystemHook {
  state: ParticleSystemState;
  controls: ParticleSystemControls;
}

export interface UseParticleSystemOptions {
  systemOptions?: SystemOptions;
  spawnerOptions?: SpawnerOptions;
  renderOptions?: ParticleRenderOptions;
  autoRender?: boolean;
}

export function createParticleSystemHook(
  options: UseParticleSystemOptions = {}
): {
  getState: () => ParticleSystemState;
  getControls: () => ParticleSystemControls;
  subscribe: (callback: () => void) => () => void;
  destroy: () => void;
} {
  const system = new ParticleSystem(options.systemOptions);
  const spawner = new Spawner(options.spawnerOptions);
  let renderer: Canvas2DRenderer | null = null;
  let bounds: BoundingBox | null = null;
  let renderOptions: ParticleRenderOptions = options.renderOptions || {};
  let animationId: number | null = null;

  const subscribers = new Set<() => void>();

  const notifySubscribers = () => {
    subscribers.forEach((callback) => callback());
  };

  const startRenderLoop = () => {
    if (!renderer || animationId !== null) return;

    const render = () => {
      if (renderer && system.isPlaying) {
        renderer.render(system, renderOptions);
      }
      if (system.isPlaying) {
        animationId = requestAnimationFrame(render);
      }
    };

    animationId = requestAnimationFrame(render);
  };

  const stopRenderLoop = () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  const state: ParticleSystemState = {
    get system() {
      return system;
    },
    get renderer() {
      return renderer;
    },
    get spawner() {
      return spawner;
    },
    get bounds() {
      return bounds;
    },
    get isPlaying() {
      return system.isPlaying;
    },
    get particleCount() {
      return system.getParticleCount();
    },
  };

  const controls: ParticleSystemControls = {
    get state() {
      return state;
    },
    play: () => {
      system.play();
      if (options.autoRender !== false) {
        startRenderLoop();
      }
      notifySubscribers();
    },

    pause: () => {
      system.pause();
      stopRenderLoop();
      notifySubscribers();
    },

    toggle: () => {
      if (system.isPlaying) {
        controls.pause();
      } else {
        controls.play();
      }
    },

    reset: () => {
      system.reset();
      stopRenderLoop();
      notifySubscribers();
    },

    clear: () => {
      system.clear();
      notifySubscribers();
    },

    setCanvas: (canvas: HTMLCanvasElement) => {
      renderer = new Canvas2DRenderer({ canvas });
      notifySubscribers();
    },

    setBounds: (newBounds: BoundingBox) => {
      if (bounds) {
        system.removeForce(bounds.getConstraintForce());
      }
      bounds = newBounds;
      system.addForce(bounds.getConstraintForce());
      notifySubscribers();
    },

    addParticleAt: (position: Vector2D) => {
      const particle = spawner.spawnAt(position);
      system.addParticle(particle);
      notifySubscribers();
    },

    spawnBurst: (position: Vector2D, count: number, speed?: number) => {
      const particles = spawner.spawnBurst(position, count, speed);
      system.addParticles(particles);
      notifySubscribers();
    },

    updateRenderOptions: (newOptions: ParticleRenderOptions) => {
      renderOptions = { ...renderOptions, ...newOptions };
    },
  };

  return {
    getState: () => state,
    getControls: () => controls,
    subscribe: (callback: () => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    destroy: () => {
      system.pause();
      stopRenderLoop();
      subscribers.clear();
    },
  };
}
