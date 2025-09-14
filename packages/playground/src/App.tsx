import { usePlayground } from "./hooks/usePlayground";
import { useWindowSize } from "./hooks/useWindowSize";
import { useToolMode } from "./hooks/useToolMode";
import { useFullscreen } from "./hooks/useFullscreen";
import { useEffect, useRef, useState } from "react";
import { SystemControls, SystemControlsRef } from "./components/SystemControls";
import { ForcesControls, ForcesControlsRef } from "./components/ForcesControls";
import { TopBar } from "./components/TopBar";
import { ToolBar } from "./components/ToolBar";
import { HelpModal } from "./components/HelpModal";
import { SaveSessionModal } from "./components/modals/SaveSessionModal";
import { LoadSessionModal } from "./components/modals/LoadSessionModal";

import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./components/ToolBar.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 320;
const TOPBAR_HEIGHT = 60;
const TOOLBAR_HEIGHT = 60;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemControlsRef = useRef<SystemControlsRef>(null);
  const forcesControlsRef = useRef<ForcesControlsRef>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [sessionLoadTrigger, setSessionLoadTrigger] = useState(0);
  const { toolMode, setToolMode } = useToolMode();

  const {
    system,
    environment,
    boundary,
    behavior,
    collisions,
    fluid,
    interaction,
    sensors,
    joints,
    renderer,
    spatialGrid,
    zoomStateRef,
    undoRedo,
    play,
    pause,
    clear,
    resetParticles,
    spawnParticles,
    setSpawnConfig,
    setEmitterConfig,
    currentlyGrabbedParticle,
    handleGrabToJoint,
    isCreatingJoint,
    handleJointToSpawn,
  } = usePlayground(canvasRef, toolMode);

  const { isFullscreen, toggleFullscreen } = useFullscreen({
    system: system || undefined,
    renderer: renderer || undefined,
    boundary: boundary || undefined,
    spatialGrid: spatialGrid || undefined,
    zoomStateRef,
  });
  const size = useWindowSize();

  useEffect(() => {
    if (
      !system ||
      !environment ||
      !boundary ||
      !behavior ||
      !collisions ||
      !fluid ||
      !interaction ||
      !sensors ||
      !joints ||
      !renderer
    )
      return;
    system.setSize(
      isFullscreen
        ? size.width
        : size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH,
      isFullscreen ? size.height : size.height - TOPBAR_HEIGHT - TOOLBAR_HEIGHT
    );
  }, [
    system,
    environment,
    boundary,
    behavior,
    collisions,
    fluid,
    interaction,
    sensors,
    joints,
    renderer,
    size,
    isFullscreen,
  ]);

  useEffect(() => {
    if (system) {
      resetParticles();
    }
  }, [system, resetParticles]);

  // Global keyboard shortcut to open hotkeys modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open help modal with '?' key
      if (e.key === "?" && !isHelpModalOpen) {
        e.preventDefault();
        setIsHelpModalOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isHelpModalOpen]);

  return (
    <div className="app">
      <TopBar
        system={system}
        onPlay={play}
        onPause={pause}
        onClear={clear}
        onReset={resetParticles}
        onShowHotkeys={() => setIsHelpModalOpen(true)}
        onSave={() => setIsSaveModalOpen(true)}
        onLoad={() => setIsLoadModalOpen(true)}
        onToggleFullscreen={toggleFullscreen}
        style={{
          display: isFullscreen ? "none" : "block",
        }}
      />
      <div
        className="app-content"
        style={{
          marginTop: isFullscreen ? "0" : "60px",
          height: isFullscreen ? "100vh" : "calc(100vh - 60px)",
        }}
      >
        <div
          className="left-sidebar"
          style={{
            display: isFullscreen ? "none" : "block",
          }}
        >
          <SystemControls
            ref={systemControlsRef}
            system={system}
            renderer={renderer}
            spatialGrid={spatialGrid}
            interaction={interaction}
            onInitParticles={spawnParticles}
            onGetInitConfig={() => ({
              numParticles: 100,
              shape: "grid" as const,
              spacing: 50,
              particleSize: 10,
              radius: 100,
              colors: undefined, // Will use default palette
              velocityConfig: {
                speed: 0,
                direction: "random" as const,
                angle: 0,
              },
              innerRadius: 50,
              squareSize: 200,
              cornerRadius: 0,
              camera: renderer
                ? {
                    x: renderer.getCamera().x,
                    y: renderer.getCamera().y,
                    zoom: renderer.getZoom(),
                  }
                : undefined,
            })}
            onSpawnConfigChange={setSpawnConfig}
            onEmitterConfigChange={setEmitterConfig}
            getCurrentCamera={
              renderer
                ? () => ({
                    x: renderer.getCamera().x,
                    y: renderer.getCamera().y,
                    zoom: renderer.getZoom(),
                  })
                : undefined
            }
            currentlyGrabbedParticle={currentlyGrabbedParticle}
          />
        </div>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            id="canvas"
            className={[
              toolMode === "grab"
                ? `grab-tool${!!currentlyGrabbedParticle ? " grabbing" : ""}`
                : "",
              isFullscreen ? "fullscreen" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            width={
              isFullscreen
                ? size.width
                : size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH
            }
            height={
              isFullscreen
                ? size.height
                : size.height - TOPBAR_HEIGHT - TOOLBAR_HEIGHT
            }
          />
          <ToolBar
            toolMode={toolMode}
            onToolModeChange={setToolMode}
            currentlyGrabbedParticle={currentlyGrabbedParticle}
            onGrabToJoint={handleGrabToJoint}
            isCreatingJoint={isCreatingJoint}
            onJointToSpawn={handleJointToSpawn}
            style={{
              display: isFullscreen ? "none" : "block",
            }}
          />
        </div>
        <div
          className="right-sidebar"
          style={{
            display: isFullscreen ? "none" : "block",
          }}
        >
          <ForcesControls
            ref={forcesControlsRef}
            system={system}
            environment={environment}
            behavior={behavior}
            boundary={boundary}
            collisions={collisions}
            fluid={fluid}
            sensors={sensors}
            joints={joints}
            undoRedo={undoRedo}
            sessionLoadTrigger={sessionLoadTrigger}
            renderer={renderer}
          />
        </div>
      </div>

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <SaveSessionModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        system={system}
        renderer={renderer}
        systemControlsRef={systemControlsRef}
        forcesControlsRef={forcesControlsRef}
        onSaveSuccess={(sessionName) => {
          console.log(`Session "${sessionName}" saved successfully`);
        }}
      />

      <LoadSessionModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        system={system}
        renderer={renderer!}
        boundary={boundary!}
        spatialGrid={spatialGrid!}
        zoomStateRef={zoomStateRef}
        undoRedo={undoRedo}
        systemControlsRef={systemControlsRef}
        forcesControlsRef={forcesControlsRef}
        onLoadSuccess={(sessionName) => {
          console.log(`Session "${sessionName}" loaded successfully`);
          // Trigger UI refresh to update controls with loaded configuration
          setSessionLoadTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}

export default App;
