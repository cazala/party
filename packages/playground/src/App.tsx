import { EngineProvider } from "./contexts/EngineContext";
import { Canvas } from "./components/Canvas";
import { Overlay } from "./components/Overlay";
import { TopBar } from "./components/TopBar";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { Provider } from "react-redux";
import { store } from "./slices/store";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  return (
    <div className="app">
      <TopBar />
      <div className="app-content">
        <SystemSidebar />
        <div className="playground">
          <Toolbar style={{ display: "block" }} />
          <div className="canvas-container">
            <Canvas />
            <Overlay />
          </div>
        </div>
        <div className="right-sidebar" style={{ display: "block" }}>
          <ModulesSidebar />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <EngineProvider>
        <AppContent />
      </EngineProvider>
    </Provider>
  );
}

export default App;
