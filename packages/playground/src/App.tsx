import { usePlayground } from "./hooks/usePlayground";
import { useWindowSize } from "./hooks/useWindowSize";
import { useToolMode } from "./hooks/useToolMode";
import { useEffect, useRef, useState } from "react";
import { SystemControls } from "./components/SystemControls";
import { ForcesControls } from "./components/ForcesControls";
import { TopBar } from "./components/TopBar";
import { HelpModal } from "./components/HelpModal";
import { SaveSessionModal } from "./components/modals/SaveSessionModal";
import { LoadSessionModal } from "./components/modals/LoadSessionModal";
import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 320;
const TOPBAR_HEIGHT = 60;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [sessionLoadTrigger, setSessionLoadTrigger] = useState(0);
  const { toolMode, setToolMode } = useToolMode();

  const {
    system,
    gravity,
    bounds,
    behavior,
    collisions,
    fluid,
    interaction,
    sensors,
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
  } = usePlayground(canvasRef, toolMode);
  const size = useWindowSize();

  useEffect(() => {
    if (
      !system ||
      !gravity ||
      !bounds ||
      !behavior ||
      !collisions ||
      !fluid ||
      !interaction ||
      !sensors ||
      !renderer
    )
      return;
    system.setSize(
      size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH,
      size.height - TOPBAR_HEIGHT
    );
  }, [
    system,
    gravity,
    bounds,
    behavior,
    collisions,
    fluid,
    interaction,
    sensors,
    renderer,
    size,
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
        toolMode={toolMode}
        onToolModeChange={setToolMode}
      />
      <div className="app-content">
        <div className="left-sidebar">
          <SystemControls
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
            getCurrentCamera={
              renderer
                ? () => ({
                    x: renderer.getCamera().x,
                    y: renderer.getCamera().y,
                    zoom: renderer.getZoom(),
                  })
                : undefined
            }
          />
        </div>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            id="canvas"
            width={size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH}
            height={size.height - TOPBAR_HEIGHT}
          />
        </div>
        <div className="right-sidebar">
          <ForcesControls
            system={system}
            gravity={gravity}
            behavior={behavior}
            bounds={bounds}
            collisions={collisions}
            fluid={fluid}
            sensors={sensors}
            sessionLoadTrigger={sessionLoadTrigger}
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
        onSaveSuccess={(sessionName) => {
          console.log(`Session "${sessionName}" saved successfully`);
        }}
      />

      <LoadSessionModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        system={system}
        renderer={renderer!}
        bounds={bounds!}
        spatialGrid={spatialGrid!}
        zoomStateRef={zoomStateRef}
        undoRedo={undoRedo}
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
