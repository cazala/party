import { InitControls, InitControlsRef } from "./InitControls";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PerformanceControls } from "./PerformanceControls";
import { RenderControls } from "./RenderControls";
import { useAppSelector } from "../modules/hooks";
import { selectEngineState } from "../modules/engine/slice";

interface SystemSidebarProps {
  content: React.ReactNode;
  initControlsRef: React.RefObject<InitControlsRef>;
  spawnParticles?: (...args: any[]) => void;
  onConstrainIterationsChange?: (value: number) => void;
  onCellSizeChange?: (value: number) => void;
  onClearColorChange?: (hex: string) => void;
  onToggleEngineType?: () => void;
}

export function SystemSidebar({
  content,
  initControlsRef,
  spawnParticles,
  onConstrainIterationsChange,
  onCellSizeChange,
  onClearColorChange,
  onToggleEngineType,
}: SystemSidebarProps) {
  const engineState = useAppSelector(selectEngineState);
  const { isInitialized, isInitializing } = engineState;
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
          onInitParticles={spawnParticles}
        />
      </CollapsibleSection>

      <CollapsibleSection title="PERFORMANCE" defaultOpen={true}>
        <PerformanceControls
          onConstrainIterationsChange={onConstrainIterationsChange}
          onCellSizeChange={onCellSizeChange}
          onToggleEngineType={onToggleEngineType}
        />
      </CollapsibleSection>

      <CollapsibleSection title="RENDER" defaultOpen={true}>
        <RenderControls
          onClearColorChange={onClearColorChange}
          disabled={!isInitialized || isInitializing}
        />
      </CollapsibleSection>
    </div>
  );
}