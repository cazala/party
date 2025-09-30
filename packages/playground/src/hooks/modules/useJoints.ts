import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  addJoint as addJointAction,
  removeJoint as removeJointAction,
  setEnableCollisions as setEnableCollisionsAction,
  setLineWidth as setLineWidthAction,
  setJoints as setJointsAction,
  setJointsEnabled,
  selectJoints,
} from "../../slices/modules/joints";

export function useJoints() {
  const dispatch = useAppDispatch();
  const { joints } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectJoints(modulesState), [modulesState]);

  // Destructure individual properties
  const { enabled, enableCollisions, lineWidth, aIndexes, bIndexes, restLengths } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (joints) {
      joints.setEnabled(state.enabled);
      joints.setEnableCollisions(state.enableCollisions ? 1 : 0);
      joints.setLineWidth(state.lineWidth);
      joints.setJoints(state.aIndexes, state.bIndexes, state.restLengths);
    }
  }, [joints, state]);

  const addJoint = useCallback(
    (a: number, b: number, rest: number) => {
      console.log("🔗 useJoints.addJoint called:", { a, b, rest });
      console.log("🔗 Current joints state:", { enabled, aIndexes, bIndexes, restLengths });
      dispatch(addJointAction({ a, b, rest }));
    },
    [dispatch, enabled, aIndexes, bIndexes, restLengths]
  );

  const removeJoint = useCallback(
    (i: number) => dispatch(removeJointAction(i)),
    [dispatch]
  );

  const setEnableCollisions = useCallback(
    (value: boolean) => {
      dispatch(setEnableCollisionsAction(value));
      joints?.setEnableCollisions(value ? 1 : 0);
    },
    [dispatch, joints]
  );

  const setLineWidth = useCallback(
    (value: number) => {
      dispatch(setLineWidthAction(value));
      joints?.setLineWidth(value);
    },
    [dispatch, joints]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setJointsEnabled(enabled));
    },
    [dispatch]
  );

  const setJoints = useCallback(
    (aIndexes: number[], bIndexes: number[], restLengths: number[]) => {
      dispatch(setJointsAction({ aIndexes, bIndexes, restLengths }));
      joints?.setJoints(aIndexes, bIndexes, restLengths);
    },
    [dispatch, joints]
  );

  return {
    // Individual state properties
    enabled,
    enableCollisions,
    lineWidth,
    aIndexes,
    bIndexes,
    restLengths,
    isEnabled,
    // Actions
    addJoint,
    removeJoint,
    setEnableCollisions,
    setLineWidth,
    setEnabled,
    setJoints,
  };
}
