import { useState, useEffect } from "react";
import { Interaction } from "@cazala/party";

interface InteractionControlsProps {
  interaction: Interaction | null;
}

export function InteractionControls({ interaction }: InteractionControlsProps) {
  const [strength, setStrength] = useState(5000);
  const [radius, setRadius] = useState(200);

  // Update local state when interaction changes
  useEffect(() => {
    if (interaction) {
      setStrength(interaction.strength);
      setRadius(interaction.radius);
    }
  }, [interaction]);

  const handleStrengthChange = (value: number) => {
    setStrength(value);
    if (interaction) {
      interaction.setStrength(value);
    }
  };

  const handleRadiusChange = (value: number) => {
    setRadius(value);
    if (interaction) {
      interaction.setRadius(value);
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Strength: {strength.toLocaleString()}
          <input
            type="range"
            min="100"
            max="20000"
            step="100"
            value={strength}
            onChange={(e) => handleStrengthChange(Number(e.target.value))}
            className="slider"
          />
        </label>
      </div>
      <div className="control-group">
        <label>
          Radius: {radius}px
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={radius}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
