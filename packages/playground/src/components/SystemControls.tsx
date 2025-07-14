import { Canvas2DRenderer, SpatialGrid, Interaction } from "@party/core";
import { SpawnControls } from "./control-sections/SpawnControls";
import { ParticleSpawnControls, SpawnConfig } from "./control-sections/ParticleSpawnControls";
import { InteractionControls } from "./control-sections/InteractionControls";
import { RenderControls } from "./control-sections/RenderControls";
import { PerformanceControls } from "./control-sections/PerformanceControls";
import { CollapsibleSection } from "./CollapsibleSection";
import { useState } from "react";

interface InitColorConfig {
  colorMode: "random" | "custom";
  customColor: string;
}

interface SystemControlsProps {
  renderer: Canvas2DRenderer | null;
  spatialGrid: SpatialGrid | null;
  interaction: Interaction | null;
  onSpawnParticles?: (
    numParticles: number,
    shape: "grid" | "random" | "circle",
    spacing: number,
    particleSize: number,
    dragThreshold: number,
    radius?: number,
    colorConfig?: InitColorConfig
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
    radius?: number;
    colorConfig?: InitColorConfig;
  };
  onSpawnConfigChange?: (config: SpawnConfig) => void;
}

export function SystemControls({
  renderer,
  spatialGrid,
  interaction,
  onSpawnParticles,
  onGetSpawnConfig,
  onSpawnConfigChange,
}: SystemControlsProps) {
  const [particleSize, setParticleSize] = useState(10);
  const [initColorConfig, setInitColorConfig] = useState<InitColorConfig>({
    colorMode: "random",
    customColor: "#F8F8F8",
  });

  const handleParticleSizeChange = (size: number) => {
    setParticleSize(size);
  };

  const handleColorConfigChange = (colorConfig: InitColorConfig) => {
    setInitColorConfig(colorConfig);
  };
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>System</h3>
      </div>

      <CollapsibleSection title="Init">
        <SpawnControls
          onSpawnParticles={onSpawnParticles}
          onGetSpawnConfig={onGetSpawnConfig}
          onParticleSizeChange={handleParticleSizeChange}
          onColorConfigChange={handleColorConfigChange}
        />
      </CollapsibleSection>

      <CollapsibleSection 
        title="Spawn"
        tooltip="Click to spawn particles"
      >
        <ParticleSpawnControls
          onSpawnConfigChange={onSpawnConfigChange}
          initialSize={particleSize}
          initialColorConfig={initColorConfig}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Interaction"
        tooltip="Right click to interact with particles"
      >
        <InteractionControls interaction={interaction} />
      </CollapsibleSection>

      <CollapsibleSection title="Render">
        <RenderControls renderer={renderer} fluid={null} />
      </CollapsibleSection>

      <CollapsibleSection title="Performance">
        <PerformanceControls spatialGrid={spatialGrid} renderer={renderer} />
      </CollapsibleSection>
    </div>
  );
}
