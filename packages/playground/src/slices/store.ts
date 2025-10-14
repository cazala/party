import { configureStore } from "@reduxjs/toolkit";
import { initReducer } from "./init";
import { engineReducer } from "./engine";
import { toolsReducer } from "./tools";
import { modulesReducer } from "./modules";
import { uiReducer } from "./ui";
import { oscillatorsReducer } from "./oscillators";

export const store = configureStore({
  reducer: {
    init: initReducer,
    engine: engineReducer,
    tools: toolsReducer,
    modules: modulesReducer,
    ui: uiReducer,
    oscillators: oscillatorsReducer,
  },
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
