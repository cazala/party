import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectCollisions,
  setCollisionsEnabled,
  setCollisionsRestitution,
} from "../../slices/modules/collisions";

export function useCollisions() {
  const dispatch = useAppDispatch();
  const { collisions } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectCollisions(modulesState), [modulesState]);

  // Destructure individual properties
  const { restitution } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (collisions) {
      collisions.setRestitution(state.restitution);
    }
  }, [collisions, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setCollisionsEnabled(enabled));
    },
    [dispatch]
  );

  const setRestitution = useCallback(
    (value: number) => {
      dispatch(setCollisionsRestitution(value));
      collisions?.setRestitution(value);
    },
    [dispatch, collisions]
  );

  return {
    // Individual state properties
    restitution,
    isEnabled,
    // Actions
    setEnabled,
    setRestitution,
  };
}
