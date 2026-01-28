import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectElementaryCA,
  setElementaryCAEnabled,
  setElementaryCARule,
  setElementaryCACellSize,
  resetElementaryCA,
} from "../../slices/modules/elementaryCa";

export function useElementaryCA() {
  const dispatch = useAppDispatch();
  const { elementaryCa, engine } = useEngine();

  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectElementaryCA(modulesState), [modulesState]);
  const isEnabled = state.enabled;

  useEffect(() => {
    if (!elementaryCa) return;
    elementaryCa.write({
      rule: state.rule,
      cellSize: state.cellSize,
    });
    engine?.notifyModuleSettingsChanged?.();
  }, [elementaryCa, engine, state]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setElementaryCAEnabled(enabled));
    },
    [dispatch]
  );

  const setRule = useCallback(
    (value: number) => {
      dispatch(setElementaryCARule(value));
      elementaryCa?.write({ rule: value });
    },
    [dispatch, elementaryCa]
  );

  const setCellSize = useCallback(
    (value: number) => {
      dispatch(setElementaryCACellSize(value));
      elementaryCa?.write({ cellSize: value });
      engine?.notifyModuleSettingsChanged?.();
    },
    [dispatch, elementaryCa, engine]
  );

  const reset = useCallback(() => {
    dispatch(resetElementaryCA());
  }, [dispatch]);

  return {
    ...state,
    isEnabled,
    setEnabled,
    setRule,
    setCellSize,
    reset,
  };
}
