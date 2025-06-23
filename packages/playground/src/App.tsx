import { Vector2D } from "../../core/src";
import { useParty } from "./hooks/useParty";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect } from "react";

function App() {
  const { system, gravity, bounds, flock, renderer } = useParty();
  const size = useWindowSize();

  useEffect(() => {
    if (!system || !gravity || !bounds || !flock || !renderer) return;
    console.log("new size", size);
    bounds.max = new Vector2D(size.width, size.height);
  }, [system, gravity, bounds, flock, renderer, size]);

  return (
    <div className="app">
      <canvas id="canvas" width={size.width} height={size.height} />
    </div>
  );
}

export default App;
