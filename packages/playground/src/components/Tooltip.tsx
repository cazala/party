import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import './Tooltip.css';

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<SVGSVGElement>(null);

  const updatePosition = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8, // Position above the icon with some margin
        left: rect.left + rect.width / 2, // Center horizontally
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible]);

  return (
    <div 
      className="tooltip-container"
      onClick={handleClick}
    >
      <HelpCircle
        ref={iconRef}
        size={14}
        className="tooltip-icon"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {isVisible && (
        <div 
          className="tooltip-popup"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}