import { configureStore } from "@reduxjs/toolkit";
import { initReducer } from "./init/slice";
import { engineReducer } from "./engine/slice";
import { toolsReducer } from "./tools/slice";
import { modulesReducer } from "./modules/slice";

export const store = configureStore({
  reducer: {
    init: initReducer,
    engine: engineReducer,
    tools: toolsReducer,
    modules: modulesReducer,
  },
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
