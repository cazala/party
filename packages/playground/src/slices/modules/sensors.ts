import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_SENSORS_COLOR_SIMILARITY_THRESHOLD,
  DEFAULT_SENSORS_FLEE_ANGLE,
  DEFAULT_SENSORS_FLEE_BEHAVIOR,
  DEFAULT_SENSORS_FOLLOW_BEHAVIOR,
  DEFAULT_SENSORS_SENSOR_DISTANCE,
  DEFAULT_SENSORS_SENSOR_RADIUS,
  DEFAULT_SENSORS_SENSOR_STRENGTH,
  DEFAULT_SENSORS_SENSOR_THRESHOLD,
} from "@cazala/party";

export interface SensorsModuleState {
  enabled: boolean;
  sensorDistance: number;
  sensorAngle: number; // stored in radians, displayed in degrees
  sensorRadius: number;
  sensorThreshold: number;
  sensorStrength: number;
  followValue: string;
  fleeValue: string;
  colorSimilarityThreshold: number;
  fleeAngle: number; // stored in radians, displayed in degrees
}

const initialState: SensorsModuleState = {
  enabled: false,
  sensorDistance: DEFAULT_SENSORS_SENSOR_DISTANCE,
  sensorAngle: Math.PI / 6, // 30 degrees in radians
  sensorRadius: DEFAULT_SENSORS_SENSOR_RADIUS,
  sensorThreshold: DEFAULT_SENSORS_SENSOR_THRESHOLD,
  sensorStrength: DEFAULT_SENSORS_SENSOR_STRENGTH,
  followValue: DEFAULT_SENSORS_FOLLOW_BEHAVIOR as string,
  fleeValue: DEFAULT_SENSORS_FLEE_BEHAVIOR as string,
  colorSimilarityThreshold: DEFAULT_SENSORS_COLOR_SIMILARITY_THRESHOLD,
  fleeAngle: DEFAULT_SENSORS_FLEE_ANGLE, // 180 degrees in radians
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
export const selectSensors = (state: { sensors: SensorsModuleState }) =>
  state.sensors;
