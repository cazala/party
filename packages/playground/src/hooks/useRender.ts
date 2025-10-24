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

  return {
    invertColors,
    toggleInvertColors: useCallback(
      () => dispatch(toggleInvertColors()),
      [dispatch]
    ),
    setInvertColors: useCallback(
      (v: boolean) => dispatch(setInvertColors(v)),
      [dispatch]
    ),
  };
}
