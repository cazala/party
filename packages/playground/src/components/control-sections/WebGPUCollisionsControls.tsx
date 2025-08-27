import { useEffect, useState } from "react";

interface WebGPUCollisionsLike {
  setRestitution: (value: number) => void;
}

export function WebGPUCollisionsControls({
  collisions,
}: {
  collisions: WebGPUCollisionsLike | null;
}) {
  const [restitution, setRestitution] = useState(0.8);

  useEffect(() => {
    // no-op: hydrate if getters exist later
  }, [collisions]);

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Restitution: {restitution.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={restitution}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setRestitution(v);
              collisions?.setRestitution(v);
            }}
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
