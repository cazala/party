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
import { WebGPUForceControls } from "./components/WebGPUForceControls";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { WebGPUToolBar } from "./components/WebGPUToolBar";

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
  const [tool, setTool] = useState<"cursor" | "spawn">("cursor");
  const { toolMode } = useToolMode();
  const [particleCount, setParticleCount] = useState(0);
  const [fps, setFPS] = useState(0);
  const [constrainIterations, setConstrainIterations] = useState(0); // Will be set from engine
  const [cellSize, setCellSize] = useState(0); // Will be set from engine
  const [clearColor, setClearColor] = useState({ r: 0, g: 0, b: 0, a: 1 }); // Will be set from engine

  const {
    system,
    isInitialized,
    isInitializing,
    error,
    spawnParticles,
    environment,
    boundary,
    collisions,
    fluid,
    behavior,
    sensors,
    trails,
    interaction,
    play,
    pause,
    clear,
    handleZoom,
    getParticleCount,
    getFPS,
    useWebGPU,
    toggleEngineType,
    engineType,
    isSupported,
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
    if (system && isInitialized) {
      const targetWidth = isFullscreen
        ? size.width
        : size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
      const targetHeight = isFullscreen
        ? size.height
        : size.height - TOPBAR_HEIGHT;
      system.setSize(targetWidth, targetHeight);
    }
  }, [system, isInitialized, size, isFullscreen, useWebGPU]);

  // Spawn initial particles when initialized
  useEffect(() => {
    if (isInitialized && system) {
      play();
    }
  }, [isInitialized, system, play]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !handleZoom || !isInitialized) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll

      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      handleZoom(e.deltaY, centerX, centerY);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [handleZoom, isInitialized, engineType]); // Add engineType and isInitialized to dependencies

  // Add a timeout for initialization
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized && !error) {
        console.error("WebGPU initialization timeout");
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isInitialized, error]);

  // Update performance metrics periodically
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      setParticleCount(getParticleCount());
      setFPS(getFPS());
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isInitialized, getParticleCount, getFPS]);

  // Sync slider values with actual engine values when initialized or engine type changes
  useEffect(() => {
    if (system && isInitialized && !isInitializing) {
      setConstrainIterations(system.getConstrainIterations());
      setCellSize(system.getCellSize());
      setClearColor(system.getClearColor());
    }
  }, [system, isInitialized, isInitializing, useWebGPU]);

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

  const handleRestart = () => {
    // Re-spawn particles using current INIT panel config
    const cfg = initControlsRef.current?.getState();
    if (!cfg) return;
    spawnParticles(
      cfg.numParticles,
      cfg.spawnShape,
      cfg.spacing,
      cfg.particleSize,
      cfg.radius,
      cfg.colors,
      cfg.velocityConfig,
      cfg.innerRadius,
      cfg.squareSize,
      cfg.cornerRadius,
      cfg.particleMass
    );
    play();
  };

  const handleConstrainIterationsChange = (value: number) => {
    setConstrainIterations(value);
    if (system && isInitialized) {
      system.setConstrainIterations(value);
    }
  };

  const handleCellSizeChange = (value: number) => {
    setCellSize(value);
    if (system && isInitialized) {
      system.setCellSize(value);
    }
  };

  const handleClearColorChange = (color: {
    r: number;
    g: number;
    b: number;
    a: number;
  }) => {
    setClearColor(color);
    if (system && isInitialized) {
      system.setClearColor(color);
    }
  };

  const handleColorPickerChange = (hex: string) => {
    const newColor = hexToRgba(hex, 1); // Always use alpha = 1
    handleClearColorChange(newColor);
  };

  // Utility functions for color conversion
  const rgbaToHex = (color: { r: number; g: number; b: number; a: number }) => {
    const toHex = (value: number) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  const hexToRgba = (hex: string, alpha: number = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
          a: alpha,
        }
      : { r: 0, g: 0, b: 0, a: 1 };
  };

  return (
    <div className="app">
      <TopBar
        system={null}
        onPlay={play}
        onPause={pause}
        onClear={clear}
        onReset={handleRestart}
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
              onInitParticles={isInitialized ? spawnParticles : undefined}
            />
          </CollapsibleSection>

          <CollapsibleSection title="PERFORMANCE" defaultOpen={true}>
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useWebGPU}
                  onChange={() => toggleEngineType()}
                />
                Use WebGPU
              </label>
            </div>

            <div className="control-group">
              <label>
                Constrain Iterations: {constrainIterations}
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={constrainIterations || 1}
                  onChange={(e) =>
                    handleConstrainIterationsChange(parseInt(e.target.value))
                  }
                  className="slider"
                  disabled={!isInitialized || isInitializing}
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                Grid Cell Size: {cellSize}px
                <input
                  type="range"
                  min="4"
                  max="64"
                  step="2"
                  value={cellSize || 4}
                  onChange={(e) =>
                    handleCellSizeChange(parseInt(e.target.value))
                  }
                  className="slider"
                  disabled={!isInitialized || isInitializing}
                />
              </label>
            </div>

            <div className="control-group">
              <div className="metric-display">
                <span className="metric-label">Particles:</span>
                <span className="metric-value">
                  {particleCount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="control-group">
              <div className="metric-display">
                <span className="metric-label">FPS:</span>
                <span className="metric-value">{fps.toFixed(1)}</span>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="RENDER" defaultOpen={true}>
            <div className="control-group">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <label style={{ marginBottom: 0 }}>Clear Color:</label>
                <div style={{ position: "relative" }}>
                  <div
                    className="color-square"
                    style={{
                      backgroundColor: rgbaToHex(clearColor),
                      cursor:
                        !isInitialized || isInitializing
                          ? "not-allowed"
                          : "pointer",
                    }}
                    onClick={() => {
                      if (!isInitialized || isInitializing) return;
                      document.getElementById("clear-color-picker")?.click();
                    }}
                    title={`Clear color: ${rgbaToHex(clearColor)}`}
                  />
                  <input
                    id="clear-color-picker"
                    type="color"
                    value={rgbaToHex(clearColor)}
                    onChange={(e) => handleColorPickerChange(e.target.value)}
                    disabled={!isInitialized || isInitializing}
                    style={{
                      position: "absolute",
                      top: "0",
                      left: "0",
                      width: "24px",
                      height: "24px",
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
        <div className="canvas-container">
          <WebGPUToolBar
            tool={tool}
            onChange={(t) => {
              setTool(t);
              (window as any).__webgpu_tool = t;
            }}
            style={{ display: isFullscreen ? "none" : "block" }}
          />
          <canvas
            key={engineType} // Force canvas recreation when engine type changes
            ref={canvasRef}
            id="canvas"
            className={isFullscreen ? "fullscreen" : ""}
            width={
              isFullscreen
                ? size.width
                : size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH
            }
            height={isFullscreen ? size.height : size.height - TOPBAR_HEIGHT}
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
            sensors={sensors}
            trails={trails}
            interaction={interaction}
            isSupported={isSupported}
          />
        </div>
      </div>
    </div>
  );
}

export default WebGPUApp;
