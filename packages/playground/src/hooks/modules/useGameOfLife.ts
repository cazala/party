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
  setGameOfLifeCellSize,
  resetGameOfLife,
} from "../../slices/modules/gameOfLife";

export function useGameOfLife() {
  const dispatch = useAppDispatch();
  const { gameOfLife, engine } = useEngine();

  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectGameOfLife(modulesState), [modulesState]);
  const isEnabled = state.enabled;

  useEffect(() => {
    if (!gameOfLife) return;
    gameOfLife.write({
      birthMask: state.birthMask,
      surviveMask: state.surviveMask,
      seedDensity: state.seedDensity,
      cellSize: state.cellSize,
    });
    engine?.notifyModuleSettingsChanged?.();
  }, [gameOfLife, engine, state]);

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

  const setCellSize = useCallback(
    (value: number) => {
      dispatch(setGameOfLifeCellSize(value));
      gameOfLife?.write({ cellSize: value });
      engine?.notifyModuleSettingsChanged?.();
    },
    [dispatch, gameOfLife, engine]
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
    setCellSize,
    reset,
  };
}
