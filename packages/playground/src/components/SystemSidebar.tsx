import { InitControls, InitControlsRef } from "./InitControls";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PerformanceControls } from "./PerformanceControls";
import { RenderControls } from "./RenderControls";
import { useEngine } from "../contexts/EngineContext";

interface SystemSidebarProps {
  initControlsRef: React.RefObject<InitControlsRef>;
}

export function SystemSidebar({ initControlsRef }: SystemSidebarProps) {
  const { isInitialized, isInitializing } = useEngine();
  return (
    <div
      className="left-sidebar controls-panel"
      style={{
        display: "block",
      }}
    >
      <div className="controls-header">
        <h3>System</h3>
      </div>

      <CollapsibleSection title="INIT" defaultOpen={true}>
        <InitControls ref={initControlsRef} />
      </CollapsibleSection>

      <CollapsibleSection title="PERFORMANCE" defaultOpen={true}>
        <PerformanceControls />
      </CollapsibleSection>

      <CollapsibleSection title="RENDER" defaultOpen={true}>
        <RenderControls disabled={!isInitialized || isInitializing} />
      </CollapsibleSection>
    </div>
  );
}
