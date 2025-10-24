import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: ReactNode;
}

export function ModalPortal({ children }: ModalPortalProps) {
  return createPortal(children, document.body);
}