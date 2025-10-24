import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import { Line } from "@cazala/party";
import {
  selectLines,
  setLinesEnabled,
  setLineWidth as setLineWidthAction,
  setLines as setLinesAction,
  setLineColor as setLineColorAction,
} from "../../slices/modules/lines";

export function useLines() {
  const dispatch = useAppDispatch();
  const { lines } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectLines(modulesState), [modulesState]);

  // Destructure individual properties
  const { enabled, lineWidth, list, lineColor } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (lines) {
      lines.setLineWidth(state.lineWidth);
      lines.setLines(state.list);
      lines.setLineColor(state.lineColor);
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

  const setLineColor = useCallback(
    (color: { r: number; g: number; b: number; a: number } | null) => {
      dispatch(setLineColorAction(color));
      lines?.setLineColor(color);
    },
    [dispatch, lines]
  );

  const setLines = useCallback(
    (linesToSet: Line[]) => {
      dispatch(setLinesAction(linesToSet));
      lines?.setLines(linesToSet);
    },
    [dispatch, lines]
  );

  const addLine = useCallback(
    (line: Line) => {
      lines?.add(line);
      // Update Redux state with new lines
      const updatedLines = lines?.getLines() || [];
      dispatch(setLinesAction(updatedLines));
    },
    [lines, dispatch]
  );

  const removeLine = useCallback(
    (aIndex: number, bIndex: number) => {
      lines?.remove(aIndex, bIndex);
      // Update Redux state with remaining lines
      const updatedLines = lines?.getLines() || [];
      dispatch(setLinesAction(updatedLines));
    },
    [lines, dispatch]
  );

  const removeAllLines = useCallback(() => {
    lines?.removeAll();
    dispatch(setLinesAction([]));
  }, [lines, dispatch]);

  return {
    // Individual state properties
    enabled,
    lineWidth,
    list,
    lineColor,
    isEnabled,
    // Actions
    setEnabled,
    setLineWidth,
    setLineColor,
    setLines,
    // Helper methods
    addLine,
    removeLine,
    removeAllLines,
  };
}
