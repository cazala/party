import { isMobileDevice } from "../utils/deviceCapabilities";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectMaxParticles } from "../slices/engine";
import "./MaxParticlesLabel.css";

export function MaxParticlesLabel() {
  const maxParticles = useAppSelector(selectMaxParticles);

  return (
    <div className="max-particles-label">
      maxParticles: {maxParticles.toLocaleString()}
      <br />
      is mobile: {isMobileDevice() ? "true" : "false"}
    </div>
  );
}

