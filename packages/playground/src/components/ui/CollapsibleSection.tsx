import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export default function CollapsibleSection({ 
  title, 
  children, 
  defaultExpanded = false 
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-section">
      <div 
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3>{title}</h3>
        <span className={`collapsible-arrow ${isExpanded ? 'expanded' : ''}`}>
          ▶
        </span>
      </div>
      {isExpanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}