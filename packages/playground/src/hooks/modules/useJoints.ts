import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import { Joint } from "@cazala/party";
import {
  setEnableCollisions as setEnableCollisionsAction,
  setJoints as setJointsAction,
  setJointsEnabled,
  setMomentum as setMomentumAction,
  setRestitution as setRestitutionAction,
  setSeparation as setSeparationAction,
  setFriction as setFrictionAction,
  selectJoints,
} from "../../slices/modules/joints";

export function useJoints() {
  const dispatch = useAppDispatch();
  const { joints } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectJoints(modulesState), [modulesState]);

  // Destructure individual properties
  const { enabled, enableCollisions, list, momentum, restitution, separation, friction } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (joints) {
      joints.setEnabled(state.enabled);
      joints.setEnableCollisions(state.enableCollisions ? 1 : 0);
      joints.setMomentum(state.momentum);
      joints.setRestitution(state.restitution);
      joints.setSeparation(state.separation);
      joints.setFriction(state.friction);
      joints.setJoints(state.list);
    }
  }, [joints, state]);


  const setEnableCollisions = useCallback(
    (value: boolean) => {
      dispatch(setEnableCollisionsAction(value));
      joints?.setEnableCollisions(value ? 1 : 0);
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
    (jointsToSet: Joint[]) => {
      dispatch(setJointsAction(jointsToSet));
      joints?.setJoints(jointsToSet);
    },
    [dispatch, joints]
  );

  const setMomentum = useCallback(
    (value: number) => {
      dispatch(setMomentumAction(value));
      joints?.setMomentum(value);
    },
    [dispatch, joints]
  );

  const addJoint = useCallback(
    (joint: Joint) => {
      joints?.add(joint);
      // Update Redux state with new joints
      const updatedJoints = joints?.getJoints() || [];
      dispatch(setJointsAction(updatedJoints));
    },
    [joints, dispatch]
  );

  const removeJoint = useCallback(
    (aIndex: number, bIndex: number) => {
      joints?.remove(aIndex, bIndex);
      // Update Redux state with remaining joints
      const updatedJoints = joints?.getJoints() || [];
      dispatch(setJointsAction(updatedJoints));
    },
    [joints, dispatch]
  );

  const removeAllJoints = useCallback(() => {
    joints?.removeAll();
    dispatch(setJointsAction([]));
  }, [joints, dispatch]);

  const setRestitution = useCallback(
    (value: number) => {
      dispatch(setRestitutionAction(value));
      joints?.setRestitution(value);
    },
    [dispatch, joints]
  );

  const setSeparation = useCallback(
    (value: number) => {
      dispatch(setSeparationAction(value));
      joints?.setSeparation(value);
    },
    [dispatch, joints]
  );

  const setFriction = useCallback(
    (value: number) => {
      dispatch(setFrictionAction(value));
      joints?.setFriction(value);
    },
    [dispatch, joints]
  );

  return {
    // Individual state properties
    enabled,
    enableCollisions,
    list,
    momentum,
    restitution,
    separation,
    friction,
    isEnabled,
    // Actions
    setEnableCollisions,
    setEnabled,
    setJoints,
    setMomentum,
    setRestitution,
    setSeparation,
    setFriction,
    // Helper methods
    addJoint,
    removeJoint,
    removeAllJoints,
  };
}
