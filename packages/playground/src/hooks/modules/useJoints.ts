import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import { Joint } from "@cazala/party";
import {
  setEnableParticleCollisions as setEnableParticleCollisionsAction,
  setEnableJointCollisions as setEnableJointCollisionsAction,
  setJoints as setJointsAction,
  setJointsEnabled,
  setMomentum as setMomentumAction,
  setRestitution as setRestitutionAction,
  setSeparation as setSeparationAction,
  setSteps as setStepsAction,
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
  const {
    enabled,
    enableParticleCollisions,
    enableJointCollisions,
    list,
    momentum,
    restitution,
    separation,
    steps,
    friction,
  } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (joints) {
      joints.setEnabled(state.enabled);
      joints.setEnableParticleCollisions(state.enableParticleCollisions);
      joints.setEnableJointCollisions(state.enableJointCollisions);
      joints.setMomentum(state.momentum);
      joints.setRestitution(state.restitution);
      joints.setSeparation(state.separation);
      joints.setSteps(state.steps);
      joints.setFriction(state.friction);
      joints.setJoints(state.list);
    }
  }, [joints, state]);

  const setEnableParticleCollisions = useCallback(
    (value: boolean) => {
      dispatch(setEnableParticleCollisionsAction(value));
      joints?.setEnableParticleCollisions(value);
    },
    [dispatch, joints]
  );

  const setEnableJointCollisions = useCallback(
    (value: boolean) => {
      dispatch(setEnableJointCollisionsAction(value));
      joints?.setEnableJointCollisions(value);
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

  const setSteps = useCallback(
    (value: number) => {
      dispatch(setStepsAction(value));
      joints?.setSteps(value);
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
    enableParticleCollisions,
    enableJointCollisions,
    list,
    momentum,
    restitution,
    separation,
    steps,
    friction,
    isEnabled,
    // Actions
    setEnableParticleCollisions,
    setEnableJointCollisions,
    setEnabled,
    setJoints,
    setMomentum,
    setRestitution,
    setSeparation,
    setSteps,
    setFriction,
    // Helper methods
    addJoint,
    removeJoint,
    removeAllJoints,
  };
}
