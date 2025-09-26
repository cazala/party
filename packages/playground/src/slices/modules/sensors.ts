import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SensorsModuleState } from "./types";

const initialState: SensorsModuleState = {
  enabled: false,
  sensorDistance: 10,
  sensorAngle: Math.PI / 6, // 30 degrees in radians
  sensorRadius: 3,
  sensorThreshold: 0.1,
  sensorStrength: 100,
  followValue: "none",
  fleeValue: "none",
  colorSimilarityThreshold: 0.8,
  fleeAngle: Math.PI, // 180 degrees in radians
};

export const sensorsSlice = createSlice({
  name: "sensors",
  initialState,
  reducers: {
    setSensorsEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setSensorDistance: (state, action: PayloadAction<number>) => {
      state.sensorDistance = action.payload;
    },
    setSensorAngle: (state, action: PayloadAction<number>) => {
      state.sensorAngle = action.payload;
    },
    setSensorRadius: (state, action: PayloadAction<number>) => {
      state.sensorRadius = action.payload;
    },
    setSensorThreshold: (state, action: PayloadAction<number>) => {
      state.sensorThreshold = action.payload;
    },
    setSensorStrength: (state, action: PayloadAction<number>) => {
      state.sensorStrength = action.payload;
    },
    setSensorFollowValue: (state, action: PayloadAction<string>) => {
      state.followValue = action.payload;
    },
    setSensorFleeValue: (state, action: PayloadAction<string>) => {
      state.fleeValue = action.payload;
    },
    setSensorColorSimilarityThreshold: (
      state,
      action: PayloadAction<number>
    ) => {
      state.colorSimilarityThreshold = action.payload;
    },
    setSensorFleeAngle: (state, action: PayloadAction<number>) => {
      state.fleeAngle = action.payload;
    },
    resetSensors: () => initialState,
    importSensorsSettings: (
      state,
      action: PayloadAction<Partial<SensorsModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setSensorsEnabled,
  setSensorDistance,
  setSensorAngle,
  setSensorRadius,
  setSensorThreshold,
  setSensorStrength,
  setSensorFollowValue,
  setSensorFleeValue,
  setSensorColorSimilarityThreshold,
  setSensorFleeAngle,
  resetSensors,
  importSensorsSettings,
} = sensorsSlice.actions;

export const sensorsReducer = sensorsSlice.reducer;

// Selectors
export const selectSensorsModule = (state: { sensors: SensorsModuleState }) =>
  state.sensors;
export const selectSensorsEnabled = (state: { sensors: SensorsModuleState }) =>
  state.sensors.enabled;