import { Canvas2DRenderer, SpatialGrid } from "@party/core";
import { SpawnControls } from "./control-sections/SpawnControls";
import { RenderControls } from "./control-sections/RenderControls";
import { PerformanceControls } from "./control-sections/PerformanceControls";
import { CollapsibleSection } from "./CollapsibleSection";

interface SystemControlsProps {
  renderer: Canvas2DRenderer | null;
  spatialGrid: SpatialGrid | null;
  onSpawnParticles?: (
    numParticles: number,
    shape: "grid" | "random",
    spacing: number,
    particleSize: number,
    dragThreshold: number
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
  };
}

export function SystemControls({
  renderer,
  spatialGrid,
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

      <CollapsibleSection title="Render">
        <RenderControls renderer={renderer} flock={null} fluid={null} />
      </CollapsibleSection>

      <CollapsibleSection title="Performance">
        <PerformanceControls spatialGrid={spatialGrid} renderer={renderer} />
      </CollapsibleSection>
    </div>
  );
}
