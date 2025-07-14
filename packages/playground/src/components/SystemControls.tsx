import { Canvas2DRenderer, SpatialGrid, Interaction } from "@party/core";
import { SpawnControls } from "./control-sections/SpawnControls";
import { InteractionControls } from "./control-sections/InteractionControls";
import { RenderControls } from "./control-sections/RenderControls";
import { PerformanceControls } from "./control-sections/PerformanceControls";
import { CollapsibleSection } from "./CollapsibleSection";

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
    radius?: number
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
    radius?: number;
  };
}

export function SystemControls({
  renderer,
  spatialGrid,
  interaction,
  onSpawnParticles,
  onGetSpawnConfig,
}: SystemControlsProps) {
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>System</h3>
      </div>

      <CollapsibleSection title="Spawn">
        <SpawnControls
          onSpawnParticles={onSpawnParticles}
          onGetSpawnConfig={onGetSpawnConfig}
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
