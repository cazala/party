import { useState, useEffect } from "react";
import WebGPUApp from "./WebGPUApp";
import App from "./App";
import { diagnoseWebGPU } from "./utils/webgpuDiagnostics";

function AppWithWebGPU() {
  const [useWebGPU, setUseWebGPU] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for WebGPU support using diagnostics
    const checkWebGPUSupport = async () => {
      const result = await diagnoseWebGPU();
      console.log("WebGPU diagnostic result:", result);
      
      if (result.supported) {
        console.log("WebGPU is fully supported!");
        setUseWebGPU(true);
      } else {
        console.log("WebGPU not supported:", result.error);
        setUseWebGPU(false);
      }
    };

    checkWebGPUSupport();
  }, []);

  if (useWebGPU === null) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        flexDirection: "column",
        gap: "20px"
      }}>
        <h2>Checking WebGPU Support...</h2>
        <div>Detecting GPU capabilities for high-performance particle system</div>
      </div>
    );
  }

  if (useWebGPU) {
    return (
      <div>
        <div style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          background: "rgba(0, 255, 0, 0.8)",
          color: "white",
          padding: "5px 10px",
          borderRadius: "5px",
          fontSize: "12px",
          zIndex: 1000,
        }}>
          WebGPU Enabled
        </div>
        <WebGPUApp />
      </div>
    );
  }

  return (
    <div>
      <div style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "rgba(255, 165, 0, 0.8)",
        color: "white",
        padding: "5px 10px",
        borderRadius: "5px",
        fontSize: "12px",
        zIndex: 1000,
      }}>
        CPU Fallback
      </div>
      <App />
    </div>
  );
}

export default AppWithWebGPU;