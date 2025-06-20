import { useState, useEffect, useRef } from "react";
import CollapsibleSection from "../ui/CollapsibleSection";
import NumberInput from "../ui/NumberInput";
import {
  ParticleSystemControls,
  Gravity,
  createScreenBounds,
} from "../../../../core/src/index";

interface EnvironmentPanelProps {
  controls: ParticleSystemControls;
}

export default function EnvironmentPanel({ controls }: EnvironmentPanelProps) {
  const [gravity, setGravity] = useState(9.8);
  const [bounceEnabled, setBounceEnabled] = useState(true);
  const [bounce, setBounce] = useState(0.8);

  const gravityRef = useRef<Gravity | null>(null);

  useEffect(() => {
    const system = controls.state.system;

    if (gravityRef.current) {
      return;
    }

    // Create and add new gravity force
    const gravityInstance = new Gravity({ strength: gravity });

    gravityRef.current = gravityInstance;
    system.addForce(gravityInstance.getForce());
  }, [controls, gravityRef]);

  useEffect(() => {
    if (bounceEnabled) {
      const bounds = createScreenBounds(800, 600, { bounce });
      controls.setBounds(bounds);
    } else {
      // Remove bounds by setting a bounds that doesn't constrain
      const bounds = createScreenBounds(10000, 10000, { bounce: 0 });
      controls.setBounds(bounds);
    }
  }, [bounceEnabled, bounce, controls]);

  const handleReset = () => {
    controls.reset();
  };

  const handleClear = () => {
    controls.clear();
  };

  return (
    <CollapsibleSection title="Environment" defaultExpanded={true}>
      <NumberInput
        label="Gravity"
        value={gravity}
        onChange={setGravity}
        min={0}
        step={0.1}
        placeholder="9.8"
      />

      <div className="form-group">
        <label className="form-label">
          <input
            type="checkbox"
            checked={bounceEnabled}
            onChange={(e) => setBounceEnabled(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          Enable Boundaries
        </label>
      </div>

      {bounceEnabled && (
        <NumberInput
          label="Bounce Factor"
          value={bounce}
          onChange={setBounce}
          min={0}
          max={1}
          step={0.1}
          placeholder="0.8"
        />
      )}

      <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
        <button className="button secondary" onClick={handleClear}>
          Clear
        </button>
        <button className="button secondary" onClick={handleReset}>
          Reset
        </button>
      </div>
    </CollapsibleSection>
  );
}
