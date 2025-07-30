import {
  Canvas2DRenderer,
  SpatialGrid,
  Interaction,
  System,
  Fluid,
  Particle,
} from "@cazala/party";
import { InitControls } from "./control-sections/InitControls";
import { SpawnControls, SpawnConfig } from "./control-sections/SpawnControls";
import { InteractionControls } from "./control-sections/InteractionControls";
import { RenderControls } from "./control-sections/RenderControls";
import { PerformanceControls } from "./control-sections/PerformanceControls";
import { CollapsibleSection } from "./CollapsibleSection";
import { useState } from "react";

interface InitVelocityConfig {
  speed: number;
  direction:
    | "random"
    | "in"
    | "out"
    | "custom"
    | "clockwise"
    | "counter-clockwise";
  angle: number;
}

interface SystemControlsProps {
  system: System | null;
  renderer: Canvas2DRenderer | null;
  spatialGrid: SpatialGrid | null;
  interaction: Interaction | null;
  onInitParticles?: (
    numParticles: number,
    shape: "grid" | "random" | "circle" | "donut" | "square",
    spacing: number,
    particleSize: number,
    radius?: number,
    colors?: string[],
    velocityConfig?: InitVelocityConfig,
    innerRadius?: number,
    squareSize?: number,
    cornerRadius?: number
  ) => void;
  onGetInitConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle" | "donut" | "square";
    spacing: number;
    particleSize: number;
    radius?: number;
    colors?: string[];
    velocityConfig?: InitVelocityConfig;
    camera?: { x: number; y: number; zoom: number };
    innerRadius?: number;
    squareSize?: number;
    cornerRadius?: number;
  };
  onSpawnConfigChange?: (config: SpawnConfig) => void;
  getCurrentCamera?: () => { x: number; y: number; zoom: number };
  currentlyGrabbedParticle: Particle | null;
}

export function SystemControls({
  system,
  renderer,
  spatialGrid,
  interaction,
  onInitParticles,
  onGetInitConfig,
  onSpawnConfigChange,
  getCurrentCamera,
  currentlyGrabbedParticle,
}: SystemControlsProps) {
  const [particleSize, setParticleSize] = useState(10);
  const [initColors, setInitColors] = useState<string[]>([]);

  const handleParticleSizeChange = (size: number) => {
    setParticleSize(size);
  };

  const handleColorsChange = (colors: string[]) => {
    setInitColors(colors);
  };
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>System</h3>
      </div>

      <CollapsibleSection title="Init">
        <InitControls
          onInitParticles={onInitParticles}
          onGetInitConfig={onGetInitConfig}
          onParticleSizeChange={handleParticleSizeChange}
          onColorsChange={handleColorsChange}
          getCurrentCamera={getCurrentCamera}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Spawn" tooltip="Click to spawn particles">
        <SpawnControls
          onSpawnConfigChange={onSpawnConfigChange}
          initialSize={particleSize}
          initialColors={initColors}
          currentlyGrabbedParticle={currentlyGrabbedParticle}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Interaction"
        tooltip="Right click to interact with particles"
      >
        <InteractionControls interaction={interaction} />
      </CollapsibleSection>

      <CollapsibleSection title="Render">
        <RenderControls
          renderer={renderer}
          fluid={
            (system?.forces.find((force) => force instanceof Fluid) as Fluid) ||
            null
          }
        />
      </CollapsibleSection>

      <CollapsibleSection title="Performance">
        <PerformanceControls
          system={system}
          spatialGrid={spatialGrid}
          renderer={renderer}
        />
      </CollapsibleSection>
    </div>
  );
}
