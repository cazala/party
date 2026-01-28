import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectReactionDiffusion,
  setReactionDiffusionEnabled,
  setReactionDiffusionFeed,
  setReactionDiffusionKill,
  setReactionDiffusionDiffusionA,
  setReactionDiffusionDiffusionB,
  setReactionDiffusionDt,
  resetReactionDiffusion,
} from "../../slices/modules/reactionDiffusion";

export function useReactionDiffusion() {
  const dispatch = useAppDispatch();
  const { reactionDiffusion } = useEngine();

  const modulesState = useAppSelector(selectModules);
  const state = useMemo(
    () => selectReactionDiffusion(modulesState),
    [modulesState]
  );
  const isEnabled = state.enabled;

  useEffect(() => {
    if (!reactionDiffusion) return;
    reactionDiffusion.write({
      feed: state.feed,
      kill: state.kill,
      diffusionA: state.diffusionA,
      diffusionB: state.diffusionB,
      dt: state.dt,
    });
  }, [reactionDiffusion, state]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setReactionDiffusionEnabled(enabled));
    },
    [dispatch]
  );

  const setFeed = useCallback(
    (value: number) => {
      dispatch(setReactionDiffusionFeed(value));
      reactionDiffusion?.write({ feed: value });
    },
    [dispatch, reactionDiffusion]
  );

  const setKill = useCallback(
    (value: number) => {
      dispatch(setReactionDiffusionKill(value));
      reactionDiffusion?.write({ kill: value });
    },
    [dispatch, reactionDiffusion]
  );

  const setDiffusionA = useCallback(
    (value: number) => {
      dispatch(setReactionDiffusionDiffusionA(value));
      reactionDiffusion?.write({ diffusionA: value });
    },
    [dispatch, reactionDiffusion]
  );

  const setDiffusionB = useCallback(
    (value: number) => {
      dispatch(setReactionDiffusionDiffusionB(value));
      reactionDiffusion?.write({ diffusionB: value });
    },
    [dispatch, reactionDiffusion]
  );

  const setDt = useCallback(
    (value: number) => {
      dispatch(setReactionDiffusionDt(value));
      reactionDiffusion?.write({ dt: value });
    },
    [dispatch, reactionDiffusion]
  );

  const reset = useCallback(() => {
    dispatch(resetReactionDiffusion());
  }, [dispatch]);

  return {
    ...state,
    isEnabled,
    setEnabled,
    setFeed,
    setKill,
    setDiffusionA,
    setDiffusionB,
    setDt,
    reset,
  };
}
