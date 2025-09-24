import React, { useState, useEffect } from "react";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { Checkbox } from "./ui/Checkbox";
import { Section } from "./ui/Section";

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

  const isNotSupported = !isSupported && isInitialized && !isInitializing;

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      tooltip={tooltip}
    >
      <Checkbox
        checked={internalEnabled}
        onChange={(checked) => handleEnabledChange(checked)}
        disabled={isNotSupported}
        label={isNotSupported ? `${title} (Not supported)` : title}
      />
      <Section title={title} style={{ opacity: isNotSupported ? 0.5 : 1 }}>
        {React.cloneElement(children as React.ReactElement, {
          enabled: internalEnabled && !isNotSupported,
          hideEnabled: true,
        })}
      </Section>
    </CollapsibleSection>
  );
}
