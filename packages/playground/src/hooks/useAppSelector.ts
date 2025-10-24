import { TypedUseSelectorHook, useSelector } from "react-redux";
import type { RootState } from "../slices/store";

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
