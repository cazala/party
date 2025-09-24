import React, { useState, useEffect } from "react";
import { CollapsibleSection } from "./CollapsibleSection";

interface ModuleWrapperProps {
  title: string;
  module: any;
  isSupported?: boolean;
  defaultOpen?: boolean;
  tooltip?: string;
  enabled?: boolean;
  setEnabled?: (enabled: boolean) => void;
  syncValues?: () => void;
  isInitialized?: boolean;
  isInitializing?: boolean;
  children: React.ReactNode;
}

export function ModuleWrapper({
  title,
  module,
  isSupported = true,
  defaultOpen = true,
  tooltip,
  enabled = true,
  setEnabled,
  syncValues,
  isInitialized = true,
  isInitializing = false,
  children,
}: ModuleWrapperProps) {
  const [internalEnabled, setInternalEnabled] = useState(enabled);

  // Sync UI state with actual module values when module is initialized
  useEffect(() => {
    if (module && isInitialized && !isInitializing && syncValues) {
      syncValues();
      if (module.isEnabled) {
        setInternalEnabled(module.isEnabled());
      }
    }
  }, [module, isInitialized, isInitializing, syncValues]);

  // Update internal state when enabled prop changes
  useEffect(() => {
    setInternalEnabled(enabled);
  }, [enabled]);

  const handleEnabledChange = (checked: boolean) => {
    setInternalEnabled(checked);
    module?.setEnabled?.(checked);
    setEnabled?.(checked);
  };

  const renderHeader = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <label
        style={{ display: "flex", alignItems: "center", gap: "4px", margin: 0 }}
      >
        <input
          type="checkbox"
          checked={internalEnabled}
          onChange={(e) => handleEnabledChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          style={{ fontSize: "14px", fontWeight: "normal", cursor: "pointer" }}
        >
          Enabled
        </span>
      </label>
    </div>
  );

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      tooltip={tooltip}
    >
      {!isSupported ? (
        <div style={{ padding: "8px 0", opacity: 0.7 }}>
          <span
            style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}
          >
            Not supported in current runtime
          </span>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "12px" }}>{renderHeader()}</div>
          <div className="control-section">
            {React.cloneElement(children as React.ReactElement, {
              enabled: internalEnabled,
              hideEnabled: true,
            })}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
