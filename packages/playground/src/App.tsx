import { Vector2D } from "../../core/src";
import { useParty } from "./hooks/useParty";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect } from "react";
import { Controls } from "./components/Controls";
import { TopBar } from "./components/TopBar";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

function App() {
  const { system, gravity, bounds, flock, renderer, play, pause, clear } = useParty();
  const size = useWindowSize();

  useEffect(() => {
    if (!system || !gravity || !bounds || !flock || !renderer) return;
    console.log("new size", size);
    bounds.max = new Vector2D(size.width, size.height - 60);
  }, [system, gravity, bounds, flock, renderer, size]);

  return (
    <div className="app">
      <TopBar 
        system={system} 
        onPlay={play} 
        onPause={pause} 
        onClear={clear} 
      />
      <canvas id="canvas" width={size.width} height={size.height - 60} />
      <Controls gravity={gravity} flock={flock} />
    </div>
  );
}

export default App;
