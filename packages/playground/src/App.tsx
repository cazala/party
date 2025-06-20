import { useParty } from "./hooks/useParty";
import { useWindowSize } from "./hooks/useWindowSize";

function App() {
  useParty();
  const size = useWindowSize();

  return (
    <div className="app">
      <canvas id="canvas" width={size.width} height={size.height} />
    </div>
  );
}

export default App;
