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
  isInitialized = true,
  isInitializing = false,
  children,
}: ModuleWrapperProps) {
  const [internalEnabled, setInternalEnabled] = useState(enabled);

  // Sync UI state with actual module values when module is initialized
  useEffect(() => {
    if (module && isInitialized && !isInitializing) {
      if (module.isEnabled) {
        setInternalEnabled(module.isEnabled());
      }
    }
  }, [module, isInitialized, isInitializing]);

  // Update internal state when enabled prop changes
  useEffect(() => {
    setInternalEnabled(enabled);
  }, [enabled]);

  const handleEnabledChange = (checked: boolean) => {
    setInternalEnabled(checked);
    module?.setEnabled?.(checked);
    setEnabled?.(checked);
  };

  const isDisabled = !isSupported || isInitializing;

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      tooltip={tooltip}
    >
      <div style={{ marginBottom: "12px", opacity: isDisabled ? 0.5 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              margin: 0,
            }}
          >
            <input
              type="checkbox"
              checked={internalEnabled}
              onChange={(e) => handleEnabledChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              disabled={isDisabled}
            />
            <span
              style={{
                fontSize: "14px",
                fontWeight: "normal",
                cursor: "pointer",
              }}
            >
              Enabled
            </span>
          </label>
          {!isSupported && isInitialized && !isInitializing && (
            <span
              style={{
                fontSize: "12px",
                color: "#999",
                fontStyle: "italic",
                marginLeft: "8px",
              }}
            >
              (Not supported)
            </span>
          )}
        </div>
      </div>
      <div
        className="control-section"
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
        {React.cloneElement(children as React.ReactElement, {
          enabled: internalEnabled && !isDisabled,
          hideEnabled: true,
        })}
      </div>
    </CollapsibleSection>
  );
}
