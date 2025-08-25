import { useState, useEffect } from "react";
import WebGPUApp from "./WebGPUApp";
import App from "./App";
// Simplified feature detection

function AppWithWebGPU() {
  const [useWebGPU, setUseWebGPU] = useState<boolean | null>(null);

  useEffect(() => {
    const supported = typeof navigator !== "undefined" && !!navigator.gpu;
    setUseWebGPU(supported);
  }, []);

  if (useWebGPU === null) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <h2>Checking WebGPU Support...</h2>
        <div>
          Detecting GPU capabilities for high-performance particle system
        </div>
      </div>
    );
  }

  if (useWebGPU) {
    return (
      <div>
        <div
          style={{
            position: "fixed",
            top: "10px",
            right: "10px",
            background: "rgba(0, 255, 0, 0.8)",
            color: "white",
            padding: "5px 10px",
            borderRadius: "5px",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          WebGPU Enabled
        </div>
        <WebGPUApp />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          background: "rgba(255, 165, 0, 0.8)",
          color: "white",
          padding: "5px 10px",
          borderRadius: "5px",
          fontSize: "12px",
          zIndex: 1000,
        }}
      >
        CPU Fallback
      </div>
      <App />
    </div>
  );
}

export default AppWithWebGPU;
