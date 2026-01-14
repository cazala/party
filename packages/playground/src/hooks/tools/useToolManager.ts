import { useCallback } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import {
  setTool,
  toggleTool,
  resetTool,
  selectActiveTool,
  selectIsSpawnMode,
  selectIsRemoveMode,
  selectIsJointMode,
  selectIsGrabMode,
  selectIsPinMode,
  selectIsDrawMode,
  selectIsBrushMode,
  selectIsShapeMode,
  selectIsInteractionMode,
  ToolMode,
} from "../../slices/tools";

export function useToolManager() {
  const dispatch = useAppDispatch();

  // Redux selectors
  const toolMode = useAppSelector(selectActiveTool);
  const isSpawnMode = useAppSelector(selectIsSpawnMode);
  const isRemoveMode = useAppSelector(selectIsRemoveMode);
  const isJointMode = useAppSelector(selectIsJointMode);
  const isGrabMode = useAppSelector(selectIsGrabMode);
  const isPinMode = useAppSelector(selectIsPinMode);
  const isDrawMode = useAppSelector(selectIsDrawMode);
  const isBrushMode = useAppSelector(selectIsBrushMode);
  const isShapeMode = useAppSelector(selectIsShapeMode);
  const isInteractionMode = useAppSelector(selectIsInteractionMode);

  // Redux action dispatchers
  const setToolMode = useCallback(
    (mode: ToolMode) => {
      dispatch(setTool(mode));
    },
    [dispatch]
  );

  const toggleToolMode = useCallback(() => {
    dispatch(toggleTool());
  }, [dispatch]);

  const resetToolMode = useCallback(() => {
    dispatch(resetTool());
  }, [dispatch]);

  return {
    // Tool mode state
    toolMode,
    isSpawnMode,
    isRemoveMode,
    isJointMode,
    isGrabMode,
    isPinMode,
    isDrawMode,
    isBrushMode,
    isShapeMode,
    isInteractionMode,

    // Tool mode actions
    setToolMode,
    toggleToolMode,
    resetToolMode,
  };
}
