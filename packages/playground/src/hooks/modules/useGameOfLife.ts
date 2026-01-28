import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectGameOfLife,
  setGameOfLifeEnabled,
  setGameOfLifeBirthMask,
  setGameOfLifeSurviveMask,
  setGameOfLifeSeedDensity,
  resetGameOfLife,
} from "../../slices/modules/gameOfLife";

export function useGameOfLife() {
  const dispatch = useAppDispatch();
  const { gameOfLife } = useEngine();

  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectGameOfLife(modulesState), [modulesState]);
  const isEnabled = state.enabled;

  useEffect(() => {
    if (!gameOfLife) return;
    gameOfLife.write({
      birthMask: state.birthMask,
      surviveMask: state.surviveMask,
      seedDensity: state.seedDensity,
    });
  }, [gameOfLife, state]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setGameOfLifeEnabled(enabled));
    },
    [dispatch]
  );

  const setBirthMask = useCallback(
    (value: number) => {
      dispatch(setGameOfLifeBirthMask(value));
      gameOfLife?.write({ birthMask: value });
    },
    [dispatch, gameOfLife]
  );

  const setSurviveMask = useCallback(
    (value: number) => {
      dispatch(setGameOfLifeSurviveMask(value));
      gameOfLife?.write({ surviveMask: value });
    },
    [dispatch, gameOfLife]
  );

  const setSeedDensity = useCallback(
    (value: number) => {
      dispatch(setGameOfLifeSeedDensity(value));
      gameOfLife?.write({ seedDensity: value });
    },
    [dispatch, gameOfLife]
  );

  const reset = useCallback(() => {
    dispatch(resetGameOfLife());
  }, [dispatch]);

  return {
    ...state,
    isEnabled,
    setEnabled,
    setBirthMask,
    setSurviveMask,
    setSeedDensity,
    reset,
  };
}
