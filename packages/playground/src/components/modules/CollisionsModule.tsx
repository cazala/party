import { useState } from "react";
import { DEFAULT_COLLISIONS_RESTITUTION, Collisions } from "@cazala/party";

export function CollisionsModule({
  collisions,
  enabled = true,
}: {
  collisions: Collisions | null;
  enabled?: boolean;
}) {
  const [restitution, setRestitution] = useState(
    DEFAULT_COLLISIONS_RESTITUTION
  );

  return (
    <>
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
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </>
  );
}
