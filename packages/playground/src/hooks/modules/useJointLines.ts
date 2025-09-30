import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectJointLines,
  setJointLinesEnabled,
  setJointLinesLineWidth,
  setJointLinesJoints,
} from "../../slices/modules/joint-lines";

export function useJointLines() {
  const dispatch = useAppDispatch();
  const { jointLines } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectJointLines(modulesState), [modulesState]);

  // Destructure individual properties
  const { enabled, lineWidth, aIndexes, bIndexes } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (jointLines) {
      jointLines.setLineWidth(state.lineWidth);
      jointLines.setJoints(state.aIndexes, state.bIndexes);
    }
  }, [jointLines, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setJointLinesEnabled(enabled));
    },
    [dispatch]
  );

  const setLineWidth = useCallback(
    (value: number) => {
      dispatch(setJointLinesLineWidth(value));
      jointLines?.setLineWidth(value);
    },
    [dispatch, jointLines]
  );

  const setJoints = useCallback(
    (aIndexes: number[], bIndexes: number[]) => {
      dispatch(setJointLinesJoints({ aIndexes, bIndexes }));
      jointLines?.setJoints(aIndexes, bIndexes);
    },
    [dispatch, jointLines]
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
    setJoints,
  };
}