import { useEffect, useRef } from "react";
import { ParticleSystem } from "@party/core";

export function useParty() {
  const ref = useRef<ParticleSystem | null>(null);

  useEffect(() => {
    if (!ref.current) {
      ref.current = new ParticleSystem();
    }
  }, []);

  return ref.current;
}
