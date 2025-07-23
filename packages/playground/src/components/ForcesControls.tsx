import { useRef, useState, useEffect } from "react";
import { RotateCcw, Download, Upload } from "lucide-react";
import {
  Gravity,
  Behavior,
  Bounds,
  Collisions,
  Fluid,
  Sensors,
  System,
  Config,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_BEHAVIOR_WANDER_WEIGHT,
  DEFAULT_BEHAVIOR_COHESION_WEIGHT,
  DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_WEIGHT,
  DEFAULT_BEHAVIOR_CHASE_WEIGHT,
  DEFAULT_BEHAVIOR_AVOID_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_RANGE,
  DEFAULT_BEHAVIOR_VIEW_RADIUS,
  DEFAULT_BEHAVIOR_VIEW_ANGLE,
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_FRICTION,
  DEFAULT_BOUNDS_REPEL_DISTANCE,
  DEFAULT_BOUNDS_REPEL_STRENGTH,
  DEFAULT_BOUNDS_MODE,
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_COLLISIONS_EAT,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_WOBBLE_FACTOR,
  DEFAULT_TRAIL_ENABLED,
  DEFAULT_TRAIL_DECAY,
  DEFAULT_TRAIL_DIFFUSE,
  DEFAULT_SENSORS_ENABLED,
  DEFAULT_SENSOR_DISTANCE,
  DEFAULT_SENSOR_ANGLE,
  DEFAULT_SENSOR_RADIUS,
  DEFAULT_SENSOR_THRESHOLD,
  DEFAULT_SENSOR_STRENGTH,
} from "@party/core";
import { PhysicsControls } from "./control-sections/PhysicsControls";
import { BehaviorControls } from "./control-sections/BehaviorControls";
import { BoundsControls } from "./control-sections/BoundsControls";
import { SensorsControls } from "./control-sections/SensorsControls";
import { CollapsibleSection } from "./CollapsibleSection";
import "./ForcesControls.css";

interface ForcesControlsProps {
  system: System | null;
  gravity: Gravity | null;
  behavior: Behavior | null;
  bounds: Bounds | null;
  collisions: Collisions | null;
  fluid: Fluid | null;
  sensors: Sensors | null;
  sessionLoadTrigger?: number;
}

export function ForcesControls({
  system,
  gravity,
  behavior,
  bounds,
  collisions,
  fluid,
  sensors,
  sessionLoadTrigger = 0,
}: ForcesControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Trigger UI refresh when a session is loaded
  useEffect(() => {
    if (sessionLoadTrigger > 0) {
      setRefreshKey((prev) => prev + 1);
    }
  }, [sessionLoadTrigger]);

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
      bounds.setRepelDistance(DEFAULT_BOUNDS_REPEL_DISTANCE);
      bounds.setRepelStrength(DEFAULT_BOUNDS_REPEL_STRENGTH);
      bounds.setMode(DEFAULT_BOUNDS_MODE);
    }

    // Reset collisions
    if (collisions) {
      collisions.setEnabled(DEFAULT_COLLISIONS_ENABLED);
      collisions.setEat(DEFAULT_COLLISIONS_EAT);
    }

    // Reset behavior
    if (behavior) {
      behavior.enabled = true; // Playground default: on
      behavior.wanderWeight = DEFAULT_BEHAVIOR_WANDER_WEIGHT;
      behavior.cohesionWeight = DEFAULT_BEHAVIOR_COHESION_WEIGHT;
      behavior.alignmentWeight = DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT;
      behavior.separationWeight = DEFAULT_BEHAVIOR_SEPARATION_WEIGHT;
      behavior.chaseWeight = DEFAULT_BEHAVIOR_CHASE_WEIGHT;
      behavior.avoidWeight = DEFAULT_BEHAVIOR_AVOID_WEIGHT;
      behavior.separationRange = DEFAULT_BEHAVIOR_SEPARATION_RANGE;
      behavior.viewRadius = DEFAULT_BEHAVIOR_VIEW_RADIUS;
      behavior.viewAngle = DEFAULT_BEHAVIOR_VIEW_ANGLE;
    }

    // Reset fluid
    if (fluid) {
      fluid.setEnabled(false); // Playground default: off
      fluid.influenceRadius = DEFAULT_INFLUENCE_RADIUS;
      fluid.targetDensity = DEFAULT_TARGET_DENSITY;
      fluid.pressureMultiplier = DEFAULT_PRESSURE_MULTIPLIER;
      fluid.wobbleFactor = DEFAULT_WOBBLE_FACTOR;
    }

    // Reset sensors
    if (sensors) {
      sensors.setEnableTrail(DEFAULT_TRAIL_ENABLED);
      sensors.setTrailDecay(DEFAULT_TRAIL_DECAY);
      sensors.setTrailDiffuse(DEFAULT_TRAIL_DIFFUSE);
      sensors.setEnableSensors(DEFAULT_SENSORS_ENABLED);
      sensors.setSensorDistance(DEFAULT_SENSOR_DISTANCE);
      sensors.setSensorAngle(DEFAULT_SENSOR_ANGLE);
      sensors.setSensorRadius(DEFAULT_SENSOR_RADIUS);
      sensors.setSensorThreshold(DEFAULT_SENSOR_THRESHOLD);
      sensors.setSensorStrength(DEFAULT_SENSOR_STRENGTH);
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
            className="forces-button export-button"
            title="Export configuration"
          >
            <Download size={12} />
          </button>
          <button
            onClick={handleLoad}
            className="forces-button import-button"
            title="Import configuration"
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
          collisions={collisions}
          fluid={fluid}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Bounds">
        <BoundsControls key={`bounds-${refreshKey}`} bounds={bounds} />
      </CollapsibleSection>

      <CollapsibleSection title="Behavior">
        <BehaviorControls key={`behavior-${refreshKey}`} behavior={behavior} />
      </CollapsibleSection>

      <CollapsibleSection title="Sensors">
        <SensorsControls key={`sensors-${refreshKey}`} sensors={sensors} />
      </CollapsibleSection>
    </div>
  );
}
