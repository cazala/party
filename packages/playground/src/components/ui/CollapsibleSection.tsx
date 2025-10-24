import React, { useState } from "react";
import { Tooltip } from "../Tooltip";
import "./CollapsibleSection.css";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  tooltip?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  tooltip,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="collapsible-section">
      <div className="collapsible-header" onClick={toggleOpen}>
        <div className="collapsible-title">
          <h4>{title}</h4>
          {tooltip && <Tooltip content={tooltip} />}
        </div>
        <span className={`collapsible-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </div>
      <div
        className="collapsible-content"
        style={{ display: isOpen ? "block" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}
