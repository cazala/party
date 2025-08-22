import {
  Canvas2DRenderer,
  SpatialGrid,
  Interaction,
  System,
  Fluid,
  Particle,
} from "@cazala/party";
import { InitControls, InitControlsRef } from "./control-sections/InitControls";
import { SpawnControls, SpawnConfig, SpawnControlsRef } from "./control-sections/SpawnControls";
import { EmitterControls, EmitterConfig, EmitterControlsRef } from "./control-sections/EmitterControls";
import { InteractionControls, InteractionControlsRef } from "./control-sections/InteractionControls";
import { RenderControls, RenderControlsRef } from "./control-sections/RenderControls";
import { PerformanceControls, PerformanceControlsRef } from "./control-sections/PerformanceControls";
import { CollapsibleSection } from "./CollapsibleSection";
import { useState, useRef, useImperativeHandle, forwardRef } from "react";

interface InitVelocityConfig {
  speed: number;
  direction:
    | "random"
    | "in"
    | "out"
    | "custom"
    | "clockwise"
    | "counter-clockwise";
  angle: number;
}

interface SystemControlsProps {
  system: System | null;
  renderer: Canvas2DRenderer | null;
  spatialGrid: SpatialGrid | null;
  interaction: Interaction | null;
  onInitParticles?: (
    numParticles: number,
    shape: "grid" | "random" | "circle" | "donut" | "square",
    spacing: number,
    particleSize: number,
    radius?: number,
    colors?: string[],
    velocityConfig?: InitVelocityConfig,
    innerRadius?: number,
    squareSize?: number,
    cornerRadius?: number,
    particleMass?: number
  ) => void;
  onGravityStrengthChange?: (strength: number) => void;
  onGetInitConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle" | "donut" | "square";
    spacing: number;
    particleSize: number;
    radius?: number;
    colors?: string[];
    velocityConfig?: InitVelocityConfig;
    camera?: { x: number; y: number; zoom: number };
    innerRadius?: number;
    squareSize?: number;
    cornerRadius?: number;
    particleMass?: number;
  };
  onSpawnConfigChange?: (config: SpawnConfig) => void;
  onEmitterConfigChange?: (config: EmitterConfig) => void;
  getCurrentCamera?: () => { x: number; y: number; zoom: number };
  currentlyGrabbedParticle: Particle | null;
}

export interface SystemControlsRef {
  getSystemControlsState: () => any;
  setSystemControlsState: (state: any) => void;
}

export const SystemControls = forwardRef<SystemControlsRef, SystemControlsProps>(({
  system,
  renderer,
  spatialGrid,
  interaction,
  onInitParticles,
  onGravityStrengthChange,
  onGetInitConfig,
  onSpawnConfigChange,
  onEmitterConfigChange,
  getCurrentCamera,
  currentlyGrabbedParticle,
}, ref) => {
  const [particleSize, setParticleSize] = useState(10);
  const [initColors, setInitColors] = useState<string[]>([]);
  
  // Refs for control components
  const initControlsRef = useRef<InitControlsRef>(null);
  const spawnControlsRef = useRef<SpawnControlsRef>(null);
  const emitterControlsRef = useRef<EmitterControlsRef>(null);
  const interactionControlsRef = useRef<InteractionControlsRef>(null);
  const renderControlsRef = useRef<RenderControlsRef>(null);
  const performanceControlsRef = useRef<PerformanceControlsRef>(null);

  // Expose state management methods
  useImperativeHandle(ref, () => ({
    getSystemControlsState: () => ({
      init: initControlsRef.current?.getState(),
      spawn: spawnControlsRef.current?.getState(),
      emitter: emitterControlsRef.current?.getState(),
      interaction: interactionControlsRef.current?.getState(),
      render: renderControlsRef.current?.getState(),
      performance: performanceControlsRef.current?.getState(),
    }),
    setSystemControlsState: (state) => {
      if (state.init && initControlsRef.current) {
        initControlsRef.current.setState(state.init);
      }
      if (state.spawn && spawnControlsRef.current) {
        spawnControlsRef.current.setState(state.spawn);
      }
      if (state.emitter && emitterControlsRef.current) {
        emitterControlsRef.current.setState(state.emitter);
      }
      if (state.interaction && interactionControlsRef.current) {
        interactionControlsRef.current.setState(state.interaction);
      }
      if (state.render && renderControlsRef.current) {
        renderControlsRef.current.setState(state.render);
      }
      if (state.performance && performanceControlsRef.current) {
        performanceControlsRef.current.setState(state.performance);
      }
    },
  }), []);

  const handleParticleSizeChange = (size: number) => {
    setParticleSize(size);
  };

  const handleColorsChange = (colors: string[]) => {
    setInitColors(colors);
  };
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>System</h3>
      </div>

      <CollapsibleSection title="Init">
        <InitControls
          ref={initControlsRef}
          onInitParticles={onInitParticles}
          onGetInitConfig={onGetInitConfig}
          onParticleSizeChange={handleParticleSizeChange}
          onColorsChange={handleColorsChange}
          onGravityStrengthChange={onGravityStrengthChange}
          getCurrentCamera={getCurrentCamera}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Spawn" tooltip="Click to spawn particles">
        <SpawnControls
          ref={spawnControlsRef}
          onSpawnConfigChange={onSpawnConfigChange}
          initialSize={particleSize}
          initialColors={initColors}
          currentlyGrabbedParticle={currentlyGrabbedParticle}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Emitters" tooltip="Place emitters that spawn particles continuously">
        <EmitterControls
          ref={emitterControlsRef}
          onEmitterConfigChange={onEmitterConfigChange}
          initialSize={particleSize}
          initialColors={initColors}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Interaction"
        tooltip="Right click to interact with particles"
      >
        <InteractionControls ref={interactionControlsRef} interaction={interaction} />
      </CollapsibleSection>

      <CollapsibleSection title="Render">
        <RenderControls
          ref={renderControlsRef}
          renderer={renderer}
          fluid={
            (system?.forces.find((force) => force instanceof Fluid) as Fluid) ||
            null
          }
        />
      </CollapsibleSection>

      <CollapsibleSection title="Performance">
        <PerformanceControls
          ref={performanceControlsRef}
          system={system}
          spatialGrid={spatialGrid}
          renderer={renderer}
        />
      </CollapsibleSection>
    </div>
  );
});
