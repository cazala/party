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
  children,
}: ModuleWrapperProps) {
  const [internalEnabled, setInternalEnabled] = useState(enabled);

  useEffect(() => {
    setInternalEnabled(enabled);
  }, [enabled]);

  const handleEnabledChange = (checked: boolean) => {
    setInternalEnabled(checked);
    module?.setEnabled?.(checked);
    setEnabled?.(checked);
  };

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      tooltip={tooltip}
    >
      <Checkbox
        checked={internalEnabled}
        onChange={(checked) => handleEnabledChange(checked)}
        disabled={!isSupported}
        label={!isSupported ? `${title} (Not supported)` : `Enable`}
      />
      <Section style={{ opacity: !isSupported ? 0.5 : 1 }}>
        {React.cloneElement(children as React.ReactElement, {
          enabled: internalEnabled && isSupported,
          hideEnabled: true,
        })}
      </Section>
    </CollapsibleSection>
  );
}
