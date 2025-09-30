import { useCallback, useEffect } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import {
  addJoint as addJointAction,
  removeJoint as removeJointAction,
  setEnableCollisions as setEnableCollisionsAction,
  setLineWidth as setLineWidthAction,
  setJoints as setJointsAction,
  setJointsEnabled,
  selectModules,
} from "../../slices/modules";
import { useEngine } from "../useEngine";

export function useJoints() {
  const dispatch = useAppDispatch();
  const { joints } = useAppSelector(selectModules);
  const { engine } = useEngine();

  // Sync Redux → engine module if present
  useEffect(() => {
    if (!engine || !(engine as any).joints) return;
    const mod = (engine as any).joints;
    if (mod.setEnabled) mod.setEnabled(joints.enabled);
    if (mod.setEnableCollisions)
      mod.setEnableCollisions(joints.enableCollisions ? 1 : 0);
    if (mod.setLineWidth) mod.setLineWidth(joints.lineWidth);
    if (mod.setJoints)
      mod.setJoints(joints.aIndexes, joints.bIndexes, joints.restLengths);
  }, [engine, joints]);

  const addJoint = useCallback(
    (a: number, b: number, rest: number) => {
      if (a === b) return;
      let aa = a;
      let bb = b;
      if (bb < aa) {
        const t = aa;
        aa = bb;
        bb = t;
      }
      // Check existing
      for (let i = 0; i < joints.aIndexes.length; i++) {
        if (joints.aIndexes[i] === aa && joints.bIndexes[i] === bb) return;
      }
      dispatch(addJointAction({ a: aa, b: bb, rest }));
    },
    [dispatch, joints.aIndexes, joints.bIndexes]
  );

  const removeJoint = useCallback(
    (i: number) => dispatch(removeJointAction(i)),
    [dispatch]
  );

  const setEnableCollisions = useCallback(
    (v: boolean) => dispatch(setEnableCollisionsAction(v)),
    [dispatch]
  );

  const setLineWidth = useCallback(
    (v: number) => dispatch(setLineWidthAction(v)),
    [dispatch]
  );

  const setEnabled = useCallback(
    (v: boolean) => dispatch(setJointsEnabled(v)),
    [dispatch]
  );

  const setJoints = useCallback(
    (aIndexes: number[], bIndexes: number[], restLengths: number[]) =>
      dispatch(setJointsAction({ aIndexes, bIndexes, restLengths })),
    [dispatch]
  );

  return {
    state: joints,
    addJoint,
    removeJoint,
    setEnableCollisions,
    setLineWidth,
    setEnabled,
    setJoints,
  };
}
