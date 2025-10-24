import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import { toggleBarsWithLock, toggleFullscreen, restoreBarsFromFullscreen, setBarsVisible, selectBarsVisible } from "../slices/ui";

export function useUI() {
  const dispatch = useAppDispatch();
  const barsVisible = useAppSelector(selectBarsVisible);

  const toggleBarsVisibility = useCallback(() => {
    dispatch(toggleBarsWithLock());
  }, [dispatch]);

  const setBarsVisibility = useCallback(
    (visible: boolean) => {
      dispatch(setBarsVisible(visible));
    },
    [dispatch]
  );

  const toggleFullscreenMode = useCallback(() => {
    dispatch(toggleFullscreen());
  }, [dispatch]);

  const restoreBarsFromFullscreenMode = useCallback(() => {
    dispatch(restoreBarsFromFullscreen());
  }, [dispatch]);

  return {
    barsVisible,
    toggleBarsVisibility,
    setBarsVisibility,
    toggleFullscreenMode,
    restoreBarsFromFullscreenMode,
  };
}