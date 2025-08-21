import { useWebGPUPlayground } from "./hooks/useWebGPUPlayground";
import { useWindowSize } from "./hooks/useWindowSize";
import { useToolMode } from "./hooks/useToolMode";
import { useFullscreen } from "./hooks/useFullscreen";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "./components/TopBar";
import {
  InitControls,
  InitControlsRef,
} from "./components/control-sections/InitControls";

import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 60;

function WebGPUApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initControlsRef = useRef<InitControlsRef>(null);
  const { toolMode } = useToolMode();
  const [particleCount, setParticleCount] = useState(0);
  const [fps, setFPS] = useState(0);

  const {
    renderer,
    isInitialized,
    error,
    spawnParticles,
    setGravityStrength,
    play,
    pause,
    clear,
    resetParticles,
    getParticleCount,
    getFPS,
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
      renderer.setSize(
        isFullscreen ? size.width : size.width - LEFT_SIDEBAR_WIDTH,
        isFullscreen ? size.height : size.height - TOPBAR_HEIGHT
      );
    }
  }, [renderer, isInitialized, size, isFullscreen]);

  // Update particle count and FPS
  useEffect(() => {
    const interval = setInterval(() => {
      setParticleCount(getParticleCount());
      setFPS(getFPS());
    }, 100);

    return () => clearInterval(interval);
  }, [getParticleCount, getFPS]);

  // Auto-play when initialized
  useEffect(() => {
    if (isInitialized && renderer) {
      play();
    }
  }, [isInitialized, renderer, play]);

  // Add a timeout for initialization
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized && !error) {
        console.error("WebGPU initialization timeout");
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isInitialized, error]);

  let content = (
    <div className="control-section">
      <h3>WebGPU Particle System</h3>
      <div className="control-group">
        <p>Particles: {particleCount.toLocaleString()}</p>
        <p>FPS: {fps.toFixed(1)}</p>
      </div>
    </div>
  );

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
          className="left-sidebar"
          style={{
            display: isFullscreen ? "none" : "block",
          }}
        >
          {content}

          <InitControls
            ref={initControlsRef}
            onInitParticles={spawnParticles}
            onGravityStrengthChange={setGravityStrength}
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
        </div>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            id="canvas"
            className={isFullscreen ? "fullscreen" : ""}
            width={isFullscreen ? size.width : size.width - LEFT_SIDEBAR_WIDTH}
            height={isFullscreen ? size.height : size.height - TOPBAR_HEIGHT}
          />
        </div>
      </div>
    </div>
  );
}

export default WebGPUApp;
