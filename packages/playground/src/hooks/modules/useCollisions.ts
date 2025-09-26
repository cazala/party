import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import {
  setCollisionsEnabled,
  setCollisionsRestitution,
} from "../../slices/modules/collisions";

export function useCollisions() {
  const dispatch = useAppDispatch();
  const { collisions } = useEngine();
  
  // Get state
  const state = useAppSelector((state) => state.modules.collisions);
  const isEnabled = useAppSelector((state) => state.modules.collisions.enabled);
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (collisions) {
      collisions.setRestitution(state.restitution);
    }
  }, [collisions, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setCollisionsEnabled(enabled));
  }, [dispatch]);
  
  const setRestitution = useCallback((value: number) => {
    dispatch(setCollisionsRestitution(value));
    collisions?.setRestitution(value);
  }, [dispatch, collisions]);
  
  return {
    state,
    isEnabled,
    setEnabled,
    setRestitution,
  };
}