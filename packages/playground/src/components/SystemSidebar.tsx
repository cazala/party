import { InitControls, InitControlsRef } from "./InitControls";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PerformanceControls } from "./PerformanceControls";
import { RenderControls } from "./RenderControls";

interface SystemSidebarProps {
  content: React.ReactNode;
  initControlsRef: React.RefObject<InitControlsRef>;
  isInitialized: boolean;
  spawnParticles?: (...args: any[]) => void;
  useWebGPU: boolean;
  onToggleEngineType: () => void;
  constrainIterations: number;
  onConstrainIterationsChange: (value: number) => void;
  cellSize: number;
  onCellSizeChange: (value: number) => void;
  particleCount: number;
  fps: number;
  clearColor: string;
  onClearColorChange: (hex: string) => void;
  isInitializing: boolean;
}

export function SystemSidebar({
  content,
  initControlsRef,
  isInitialized,
  spawnParticles,
  useWebGPU,
  onToggleEngineType,
  constrainIterations,
  onConstrainIterationsChange,
  cellSize,
  onCellSizeChange,
  particleCount,
  fps,
  clearColor,
  onClearColorChange,
  isInitializing,
}: SystemSidebarProps) {
  return (
    <div
      className="left-sidebar controls-panel"
      style={{
        display: "block",
      }}
    >
      {content}

      <div className="controls-header">
        <h3>System</h3>
      </div>

      <CollapsibleSection title="INIT" defaultOpen={true}>
        <InitControls
          ref={initControlsRef}
          onInitParticles={isInitialized ? spawnParticles : undefined}
        />
      </CollapsibleSection>

      <CollapsibleSection title="PERFORMANCE" defaultOpen={true}>
        <PerformanceControls
          useWebGPU={useWebGPU}
          onToggleEngineType={onToggleEngineType}
          constrainIterations={constrainIterations}
          onConstrainIterationsChange={onConstrainIterationsChange}
          cellSize={cellSize}
          onCellSizeChange={onCellSizeChange}
          particleCount={particleCount}
          fps={fps}
        />
      </CollapsibleSection>

      <CollapsibleSection title="RENDER" defaultOpen={true}>
        <RenderControls
          clearColor={clearColor}
          onClearColorChange={onClearColorChange}
          disabled={!isInitialized || isInitializing}
        />
      </CollapsibleSection>
    </div>
  );
}