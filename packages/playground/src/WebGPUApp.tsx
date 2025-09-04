import { useWebGPUPlayground } from "./hooks/useWebGPUPlayground";
import { useWindowSize } from "./hooks/useWindowSize";
import { useToolMode } from "./hooks/useToolMode";
import { useFullscreen } from "./hooks/useFullscreen";
import { useEffect, useRef } from "react";
import { TopBar } from "./components/TopBar";
import {
  InitControls,
  InitControlsRef,
} from "./components/control-sections/InitControls";
import { WebGPUForceControls } from "./components/WebGPUForceControls";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { SimulationControls } from "./components/control-sections/SimulationControls";

import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 60;

function WebGPUApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initControlsRef = useRef<InitControlsRef>(null);
  const { toolMode } = useToolMode();

  const {
    renderer,
    system,
    isInitialized,
    error,
    spawnParticles,
    environment,
    boundary,
    collisions,
    fluid,
    behavior,
    play,
    pause,
    clear,
    resetParticles,
    handleZoom,
    setZoomSensitivity,
  } = useWebGPUPlayground(canvasRef, toolMode);

  const { isFullscreen, toggleFullscreen } = useFullscreen({
    system: undefined,
    renderer: undefined,
    boundary: undefined,
    spatialGrid: undefined,
    zoomStateRef: { current: { x: 0, y: 0, zoom: 1 } },
  });
  const size = useWindowSize();

  // Update canvas size when window size changes
  useEffect(() => {
    if (renderer && isInitialized) {
      const targetWidth = isFullscreen
        ? size.width
        : size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
      const targetHeight = isFullscreen
        ? size.height
        : size.height - TOPBAR_HEIGHT;
      renderer.setSize(targetWidth, targetHeight);
    }
  }, [renderer, isInitialized, size, isFullscreen]);

  // Auto-play when initialized
  useEffect(() => {
    if (isInitialized && renderer) {
      play();
    }
  }, [isInitialized, renderer, play]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !handleZoom) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll

      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      handleZoom(e.deltaY, centerX, centerY);
    };

    canvas.addEventListener('wheel', onWheel);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [handleZoom]);

  // Add a timeout for initialization
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized && !error) {
        console.error("WebGPU initialization timeout");
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isInitialized, error]);

  let content = null;

  if (error) {
    content = (
      <div className="app" style={{ padding: "20px", textAlign: "center" }}>
        <h2>WebGPU Not Available</h2>
        <p>{error}</p>
        <p>
          WebGPU requires a modern browser with WebGPU support enabled. Try
          Chrome Canary or Firefox Nightly with WebGPU flags enabled.
        </p>
      </div>
    );
  }

  if (!isInitialized) {
    content = (
      <div className="app" style={{ padding: "20px", textAlign: "center" }}>
        <h2>Initializing WebGPU...</h2>
        <p>Setting up GPU particle system...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        system={null}
        onPlay={play}
        onPause={pause}
        onClear={clear}
        onReset={resetParticles}
        onShowHotkeys={() => {}}
        onSave={() => {}}
        onLoad={() => {}}
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
          className="left-sidebar controls-panel"
          style={{
            display: isFullscreen ? "none" : "block",
          }}
        >
          {content}

          <div className="controls-header">
            <h3>System</h3>
          </div>

          <CollapsibleSection title="INIT" defaultOpen={true}>
            <InitControls
              ref={initControlsRef}
              onInitParticles={spawnParticles}
              onGetInitConfig={() => ({
                numParticles: 10000,
                shape: "grid" as const,
                spacing: 25,
                particleSize: 5,
                radius: 100,
                colors: undefined,
                velocityConfig: {
                  speed: 0,
                  direction: "random" as const,
                  angle: 0,
                },
                innerRadius: 50,
                squareSize: 200,
                cornerRadius: 0,
              })}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Simulation">
            <SimulationControls
              setConstrainIterations={(v) => system?.setConstrainIterations(v)}
              setZoomSensitivity={setZoomSensitivity}
            />
          </CollapsibleSection>
        </div>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            id="canvas"
            className={isFullscreen ? "fullscreen" : ""}
            width={
              isFullscreen
                ? size.width
                : size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH
            }
            height={isFullscreen ? size.height : size.height - TOPBAR_HEIGHT}
            onWheel={(e) => {
              if (!handleZoom) return;
              
              e.preventDefault();
              
              // Get canvas bounds for coordinate calculation
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = e.clientX - rect.left - rect.width / 2;
              const centerY = e.clientY - rect.top - rect.height / 2;
              
              handleZoom(e.deltaY, centerX, centerY);
            }}
          />
        </div>
        <div
          className="right-sidebar"
          style={{ display: isFullscreen ? "none" : "block" }}
        >
          <WebGPUForceControls
            environment={environment}
            boundary={boundary}
            collisions={collisions}
            fluid={fluid}
            behavior={behavior}
          />
        </div>
      </div>
    </div>
  );
}

export default WebGPUApp;
