import { configureStore } from "@reduxjs/toolkit";
import { initReducer } from "./init";
import { engineReducer } from "./engine";
import { toolsReducer } from "./tools";
import { modulesReducer } from "./modules";
import { performanceReducer } from "./performance";
import { oscillatorsReducer } from "./oscillators";
import { historyReducer } from "./history";
import { sessionReducer } from "./session";

export const store = configureStore({
  reducer: {
    init: initReducer,
    engine: engineReducer,
    tools: toolsReducer,
    modules: modulesReducer,
    performance: performanceReducer,
    oscillators: oscillatorsReducer,
    history: historyReducer,
    session: sessionReducer,
  },
  devTools: import.meta.env.DEV,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
