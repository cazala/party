import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import {
  selectInvertColors,
  setInvertColors,
  toggleInvertColors,
} from "../slices/render";

export function useRender() {
  const dispatch = useAppDispatch();
  const invertColors = useAppSelector(selectInvertColors);

  const toggleInvertColorsCallback = useCallback(
    () => dispatch(toggleInvertColors()),
    [dispatch]
  );

  const setInvertColorsCallback = useCallback(
    (v: boolean) => dispatch(setInvertColors(v)),
    [dispatch]
  );

  return {
    invertColors,
    toggleInvertColors: toggleInvertColorsCallback,
    setInvertColors: setInvertColorsCallback,
  };
}
