import { InitControls } from "./InitControls";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PerformanceControls } from "./PerformanceControls";
import { RenderControls } from "./RenderControls";
import { useEngine } from "../hooks/useEngine";

export function SystemSidebar() {
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
        <InitControls />
      </CollapsibleSection>

      <CollapsibleSection title="RENDER" defaultOpen={true}>
        <RenderControls disabled={!isInitialized || isInitializing} />
      </CollapsibleSection>

      <CollapsibleSection title="PERFORMANCE" defaultOpen={true}>
        <PerformanceControls />
      </CollapsibleSection>
    </div>
  );
}
