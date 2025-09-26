import { useDispatch } from "react-redux";
import type { AppDispatch } from "../slices/store";

export const useAppDispatch = () => useDispatch<AppDispatch>();
