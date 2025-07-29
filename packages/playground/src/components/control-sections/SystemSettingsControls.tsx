import { System } from "@cazala/party";

interface SystemSettingsControlsProps {
  system: System | null;
}

export function SystemSettingsControls({
  system: _system,
}: SystemSettingsControlsProps) {
  return (
    <div className="control-section">
      <div className="control-group">
        <p>
          No system settings available. Collision and momentum settings have
          been moved to the Collisions section.
        </p>
      </div>
    </div>
  );
}
