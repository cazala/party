import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectLines,
  setLinesEnabled,
  setLineWidth as setLineWidthAction,
  setLines as setLinesAction,
} from "../../slices/modules/lines";

export function useLines() {
  const dispatch = useAppDispatch();
  const { lines } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectLines(modulesState), [modulesState]);

  // Destructure individual properties
  const { enabled, lineWidth, aIndexes, bIndexes } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (lines) {
      lines.setLineWidth(state.lineWidth);
      lines.setLines(state.aIndexes, state.bIndexes);
    }
  }, [lines, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setLinesEnabled(enabled));
    },
    [dispatch]
  );

  const setLineWidth = useCallback(
    (value: number) => {
      dispatch(setLineWidthAction(value));
      lines?.setLineWidth(value);
    },
    [dispatch, lines]
  );

  const setLines = useCallback(
    (aIndexes: number[], bIndexes: number[]) => {
      dispatch(setLinesAction({ aIndexes, bIndexes }));
      lines?.setLines(aIndexes, bIndexes);
    },
    [dispatch, lines]
  );

  return {
    // Individual state properties
    enabled,
    lineWidth,
    aIndexes,
    bIndexes,
    isEnabled,
    // Actions
    setEnabled,
    setLineWidth,
    setLines,
  };
}
