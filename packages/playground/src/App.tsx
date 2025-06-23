import { Vector2D } from "../../core/src";
import { useParty } from "./hooks/useParty";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect } from "react";
import { Controls } from "./components/Controls";
import { TopBar } from "./components/TopBar";
import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

const SIDEBAR_WIDTH = 320;
const TOPBAR_HEIGHT = 60;

function App() {
  const { system, gravity, bounds, flock, renderer, play, pause, clear } = useParty();
  const size = useWindowSize();

  useEffect(() => {
    if (!system || !gravity || !bounds || !flock || !renderer) return;
    console.log("new size", size);
    bounds.max = new Vector2D(size.width - SIDEBAR_WIDTH, size.height - TOPBAR_HEIGHT);
  }, [system, gravity, bounds, flock, renderer, size]);

  return (
    <div className="app">
      <TopBar 
        system={system} 
        onPlay={play} 
        onPause={pause} 
        onClear={clear} 
      />
      <div className="app-content">
        <div className="canvas-container">
          <canvas id="canvas" width={size.width - SIDEBAR_WIDTH} height={size.height - TOPBAR_HEIGHT} />
        </div>
        <div className="sidebar">
          <Controls gravity={gravity} flock={flock} bounds={bounds} />
        </div>
      </div>
    </div>
  );
}

export default App;
