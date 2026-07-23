import {
  Behavior,
  Boundary,
  Collisions,
  Environment,
  Fluids,
  FluidsMethod,
  Interaction,
  type IParticle,
  type Module,
  Particles,
  ParticlesColorType,
  Sensors,
  Spawner,
  Trails,
  type EngineOptions,
} from "@cazala/party";

export type SceneName = "vortex" | "slime" | "ink" | "liquid" | "text";

export type OscillatorSpec = {
  moduleName: string;
  inputName: string;
  min: number;
  max: number;
  speedHz: number;
};

export type Scene = {
  title: string;
  forces: Array<Module<string, any, any>>;
  render: Array<Module<string, any, any>>;
  particles: IParticle[];
  interaction?: Interaction;
  oscillators?: OscillatorSpec[];
  engine?: Partial<
    Pick<
      EngineOptions,
      | "cellSize"
      | "clearColor"
      | "constrainIterations"
      | "maxNeighbors"
      | "maxParticles"
    >
  >;
};

type Viewport = { width: number; height: number };
type SceneFactory = (viewport: Viewport) => Scene;

const spawner = new Spawner();

function safeExtent({ width, height }: Viewport): number {
  return Math.max(320, Math.min(width, height));
}

function createVortex(viewport: Viewport): Scene {
  const extent = safeExtent(viewport);
  const interaction = new Interaction({
    mode: "attract",
    strength: 6_000,
    radius: extent * 0.25,
  });

  return {
    title: "Neon vortex",
    forces: [
      new Environment({
        gravityStrength: 750,
        gravityDirection: "inwards",
      }),
      new Boundary({ mode: "warp" }),
      new Behavior({
        wander: 12,
        cohesion: 1.5,
        alignment: 4.8,
        repulsion: 3,
        separation: 42,
        viewRadius: 90,
        viewAngle: Math.PI * 2,
      }),
      interaction,
    ],
    render: [
      new Trails({ trailDecay: 8, trailDiffuse: 1 }),
      new Particles({ colorType: ParticlesColorType.Hue, hue: 0.62 }),
    ],
    particles: spawner.initParticles({
      count: 5_000,
      shape: "donut",
      center: { x: 0, y: 0 },
      radius: extent * 0.42,
      innerRadius: extent * 0.12,
      size: 2.5,
      mass: 1,
      velocity: { speed: 150, direction: "clockwise" },
      colors: ["#ffffff"],
    }),
    interaction,
    oscillators: [
      {
        moduleName: "particles",
        inputName: "hue",
        min: 0,
        max: 1,
        speedHz: 0.01,
      },
    ],
    engine: { cellSize: 48, maxNeighbors: 128 },
  };
}

function createSlime(viewport: Viewport): Scene {
  const extent = safeExtent(viewport);
  const sensors = new Sensors({
    sensorDistance: 20,
    sensorAngle: Math.PI / 4.5,
    sensorRadius: 3,
    sensorThreshold: 0.02,
    sensorStrength: 2_200,
    followBehavior: "any",
    fleeBehavior: "none",
  });
  const interaction = new Interaction({
    mode: "repel",
    strength: 5_000,
    radius: extent * 0.2,
  });

  return {
    title: "Slime filaments",
    forces: [new Boundary({ mode: "warp" }), sensors, interaction],
    render: [
      new Trails({ trailDecay: 9, trailDiffuse: 0 }),
      new Particles({ colorType: ParticlesColorType.Hue, hue: 0.08 }),
    ],
    particles: spawner.initParticles({
      count: 6_000,
      shape: "random",
      center: { x: 0, y: 0 },
      bounds: {
        width: Math.max(480, viewport.width * 0.9),
        height: Math.max(320, viewport.height * 0.9),
      },
      size: 2.25,
      mass: 1,
      velocity: { speed: 135, direction: "random" },
      colors: ["#ffffff"],
    }),
    interaction,
    oscillators: [
      {
        moduleName: "particles",
        inputName: "hue",
        min: 0,
        max: 1,
        speedHz: 0.008,
      },
      {
        moduleName: "sensors",
        inputName: "sensorDistance",
        min: 18,
        max: 70,
        speedHz: 0.012,
      },
      {
        moduleName: "sensors",
        inputName: "sensorAngle",
        min: 0.3,
        max: 0.8,
        speedHz: 0.009,
      },
    ],
    engine: { cellSize: 40, maxNeighbors: 96 },
  };
}

function createInk(viewport: Viewport): Scene {
  const extent = safeExtent(viewport);
  const interaction = new Interaction({
    mode: "attract",
    strength: 4_000,
    radius: extent * 0.22,
  });

  return {
    title: "Viscous ink",
    forces: [
      new Boundary({ mode: "bounce", restitution: 0, friction: 1 }),
      new Collisions({ restitution: 0.25 }),
      new Fluids({
        method: FluidsMethod.Sph,
        influenceRadius: 58,
        targetDensity: 0.8,
        pressureMultiplier: 70,
        viscosity: 7.5,
        nearPressureMultiplier: 20,
        nearThreshold: 30,
        enableNearPressure: true,
        maxAcceleration: 45,
      }),
      interaction,
    ],
    render: [
      new Particles({
        colorType: ParticlesColorType.Custom,
        customColor: { r: 0.035, g: 0.04, b: 0.065, a: 1 },
      }),
    ],
    particles: spawner.initParticles({
      count: 4_500,
      shape: "random",
      center: { x: 0, y: -extent * 0.08 },
      bounds: { width: extent * 0.55, height: extent * 0.48 },
      size: 3,
      mass: 0.3,
      velocity: { speed: 35, direction: "out" },
      colors: ["#11131f"],
    }),
    interaction,
    engine: {
      cellSize: 58,
      maxNeighbors: 192,
      clearColor: { r: 0.95, g: 0.945, b: 0.91, a: 1 },
    },
  };
}

function createLiquid(viewport: Viewport): Scene {
  const extent = safeExtent(viewport);
  const interaction = new Interaction({
    mode: "repel",
    strength: 7_000,
    radius: extent * 0.2,
  });

  return {
    title: "PIC/FLIP liquid",
    forces: [
      new Environment({
        gravityStrength: 420,
        gravityDirection: "down",
        damping: 0.01,
      }),
      new Boundary({ mode: "bounce", restitution: 0.25, friction: 0.08 }),
      new Fluids({
        method: FluidsMethod.Picflip,
        influenceRadius: 44,
        targetDensity: 2,
        pressureMultiplier: 420,
        flipRatio: 0.2,
      }),
      interaction,
    ],
    render: [
      new Trails({ trailDecay: 18, trailDiffuse: 1 }),
      new Particles({ colorType: ParticlesColorType.Hue, hue: 0.54 }),
    ],
    particles: spawner.initParticles({
      count: 5_000,
      shape: "grid",
      center: { x: 0, y: -extent * 0.16 },
      spacing: 7,
      size: 3,
      mass: 1,
      velocity: { speed: 0, direction: "random" },
      colors: ["#ffffff"],
    }),
    interaction,
    oscillators: [
      {
        moduleName: "particles",
        inputName: "hue",
        min: 0.48,
        max: 0.72,
        speedHz: 0.015,
      },
    ],
    engine: {
      cellSize: 44,
      maxNeighbors: 256,
      constrainIterations: 8,
    },
  };
}

function createText(viewport: Viewport): Scene {
  const extent = safeExtent(viewport);
  const interaction = new Interaction({
    mode: "repel",
    strength: 8_000,
    radius: extent * 0.22,
  });

  return {
    title: "Living word",
    forces: [
      new Boundary({ mode: "warp" }),
      interaction,
    ],
    render: [
      new Trails({ trailDecay: 12, trailDiffuse: 1 }),
      new Particles({ colorType: ParticlesColorType.Default }),
    ],
    particles: spawner.initParticles({
      count: 12_000,
      shape: "text",
      text: "PARTY",
      font: "sans-serif",
      textSize: Math.min(viewport.width * 0.18, 180),
      center: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
      align: { horizontal: "center", vertical: "center" },
      size: 3,
      mass: 1,
      velocity: { speed: 0, direction: "out" },
      colors: ["#f7f7ff", "#8be9fd", "#bd93f9"],
    }),
    interaction,
    engine: { cellSize: 40, maxNeighbors: 64 },
  };
}

export const sceneFactories: Record<SceneName, SceneFactory> = {
  vortex: createVortex,
  slime: createSlime,
  ink: createInk,
  liquid: createLiquid,
  text: createText,
};

export const sceneNames = Object.keys(sceneFactories) as SceneName[];
