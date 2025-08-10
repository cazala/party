import { Config } from "@cazala/party";

export interface SerializedParticle {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  mass: number;
  size: number;
  color: string;
  pinned?: boolean;
  zIndex?: number;
}

export interface SerializedJoint {
  id: string;
  particleAId: number;
  particleBId: number;
  restLength: number;
  stiffness: number;
  tolerance: number;
  isBroken: boolean;
}

export interface SavedSession {
  name: string;
  timestamp: number;
  config: Config;
  particles: SerializedParticle[];
  joints: SerializedJoint[];
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  // Viewport-independent camera information for consistent loading across different screen sizes
  scene?: {
    // World coordinates that were visible in the viewport when saved
    viewportWorldBounds: {
      worldMinX: number;
      worldMaxX: number;
      worldMinY: number;
      worldMaxY: number;
      worldWidth: number;
      worldHeight: number;
      worldCenterX: number;
      worldCenterY: number;
    };
    // Original viewport dimensions when saved
    originalViewport: {
      width: number;
      height: number;
    };
  };
  metadata: {
    particleCount: number;
    jointCount: number;
    version: string;
  };
  // Left sidebar control states
  systemControls?: {
    init?: {
      numParticles: number;
      shape: "grid" | "random" | "circle" | "donut" | "square";
      spacing: number;
      particleSize: number;
      radius?: number;
      colors?: string[];
      velocityConfig?: {
        speed: number;
        direction: "random" | "in" | "out" | "custom" | "clockwise" | "counter-clockwise";
        angle: number;
      };
      innerRadius?: number;
      squareSize?: number;
      cornerRadius?: number;
    };
    spawn?: {
      defaultSize: number;
      defaultMass: number;
      colors: string[];
      spawnMode: "single" | "stream" | "draw" | "shape";
      streamRate: number;
      drawStepSize: number;
      pinned: boolean;
      shapeSides: number;
      shapeLength: number;
    };
    interaction?: {
      strength: number;
      radius: number;
    };
    render?: {
      colorMode: "particle" | "custom" | "velocity" | "rotate";
      customColor: string;
      rotationSpeed: number;
      showDensity: boolean;
      showVelocity: boolean;
      densityFieldColor: string;
    };
    performance?: {
      cellSize: number;
      showSpatialGrid: boolean;
    };
    emitter?: {
      particleSize: number;
      particleMass: number;
      rate: number;
      direction: number;
      speed: number;
      amplitude: number;
      colors: string[];
      zIndex: number;
      // Lifetime properties
      infinite: boolean;
      duration?: number;
      endSizeMultiplier?: number;
      endAlpha?: number;
      endColors?: string[];
      endSpeedMultiplier?: number;
    };
  };
}

export interface SessionMetadata {
  name: string;
  timestamp: number;
  particleCount: number;
  jointCount: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  // Optional scene info for better preview (available in newer sessions)
  hasSceneBounds?: boolean;
}
