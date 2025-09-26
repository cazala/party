import { EngineProvider, EngineCanvas } from "./contexts/EngineContext";
import { TopBar } from "./components/TopBar";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { Provider } from "react-redux";
import { store } from "./modules/store";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  return (
    <div className="app">
      <TopBar />
      <div className="app-content">
        <SystemSidebar />
        <div className="canvas-playground">
          <Toolbar style={{ display: "block" }} />
          <div className="canvas-container">
            <EngineCanvas />
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
