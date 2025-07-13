import { useRef, useState } from "react";
import { RotateCcw, Download, Upload } from "lucide-react";
import {
  Gravity,
  Flock,
  Bounds,
  Collisions,
  Fluid,
  ParticleSystem,
  Config,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_FLOCK_MAX_SPEED,
  DEFAULT_FLOCK_WANDER_WEIGHT,
  DEFAULT_FLOCK_COHESION_WEIGHT,
  DEFAULT_FLOCK_ALIGNMENT_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_RANGE,
  DEFAULT_FLOCK_NEIGHBOR_RADIUS,
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_FRICTION,
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_WOBBLE_FACTOR,
  DEFAULT_FLUID_ENABLED,
} from "@party/core";
import { PhysicsControls } from "./control-sections/PhysicsControls";
import { BehaviorControls } from "./control-sections/BehaviorControls";
import { FluidControls } from "./control-sections/FluidControls";
import { CollapsibleSection } from "./CollapsibleSection";
import "./ForcesControls.css";

interface ForcesControlsProps {
  system: ParticleSystem | null;
  gravity: Gravity | null;
  flock: Flock | null;
  bounds: Bounds | null;
  collisions: Collisions | null;
  fluid: Fluid | null;
}

export function ForcesControls({
  system,
  gravity,
  flock,
  bounds,
  collisions,
  fluid,
}: ForcesControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const resetToDefaults = () => {
    // Reset gravity
    if (gravity) {
      gravity.setStrength(DEFAULT_GRAVITY_STRENGTH);
      gravity.setDirectionFromAngle(DEFAULT_GRAVITY_ANGLE * (Math.PI / 180));
    }

    // Reset bounds
    if (bounds) {
      bounds.bounce = DEFAULT_BOUNDS_BOUNCE;
      bounds.setFriction(DEFAULT_BOUNDS_FRICTION);
    }

    // Reset collisions
    if (collisions) {
      collisions.setEnabled(DEFAULT_COLLISIONS_ENABLED);
    }

    // Reset flock
    if (flock) {
      flock.wanderWeight = DEFAULT_FLOCK_WANDER_WEIGHT;
      flock.cohesionWeight = DEFAULT_FLOCK_COHESION_WEIGHT;
      flock.alignmentWeight = DEFAULT_FLOCK_ALIGNMENT_WEIGHT;
      flock.separationWeight = DEFAULT_FLOCK_SEPARATION_WEIGHT;
      flock.maxSpeed = DEFAULT_FLOCK_MAX_SPEED;
      flock.separationRange = DEFAULT_FLOCK_SEPARATION_RANGE;
      flock.neighborRadius = DEFAULT_FLOCK_NEIGHBOR_RADIUS;
    }

    // Reset fluid
    if (fluid) {
      fluid.setEnabled(DEFAULT_FLUID_ENABLED);
      fluid.influenceRadius = DEFAULT_INFLUENCE_RADIUS;
      fluid.targetDensity = DEFAULT_TARGET_DENSITY;
      fluid.pressureMultiplier = DEFAULT_PRESSURE_MULTIPLIER;
      fluid.wobbleFactor = DEFAULT_WOBBLE_FACTOR;
    }

    // Force UI re-render
    setRefreshKey((prev) => prev + 1);
  };

  const handleSave = () => {
    if (!system) return;

    try {
      const config = system.export();
      const dataStr = JSON.stringify(config, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "config.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to save configuration:", error);
      alert("Failed to save configuration. Please try again.");
    }
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !system) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const configText = e.target?.result as string;
        const config: Config = JSON.parse(configText);
        system.import(config);

        // Force UI re-render to show updated values
        setRefreshKey((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to load configuration:", error);
        alert(
          "Failed to load configuration. Please check that the file is a valid JSON configuration."
        );
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    event.target.value = "";
  };

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Forces</h3>
        <div className="forces-controls-buttons">
          <button
            onClick={resetToDefaults}
            className="forces-button reset-button"
            title="Reset to defaults"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={handleSave}
            className="forces-button save-button"
            title="Save configuration"
          >
            <Download size={12} />
          </button>
          <button
            onClick={handleLoad}
            className="forces-button load-button"
            title="Load configuration"
          >
            <Upload size={12} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <CollapsibleSection title="Physics" defaultOpen={true}>
        <PhysicsControls
          key={`physics-${refreshKey}`}
          gravity={gravity}
          bounds={bounds}
          collisions={collisions}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Behavior">
        <BehaviorControls key={`behavior-${refreshKey}`} flock={flock} />
      </CollapsibleSection>

      <CollapsibleSection title="Fluids">
        <FluidControls key={`fluids-${refreshKey}`} fluid={fluid} />
      </CollapsibleSection>
    </div>
  );
}
