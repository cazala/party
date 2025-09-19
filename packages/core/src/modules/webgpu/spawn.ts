import { WebGPUParticle } from "./particle-store";

export type WebGPUVelocityDirection =
  | "random"
  | "in"
  | "out"
  | "custom"
  | "clockwise"
  | "counter-clockwise";

export interface WebGPUVelocityConfig {
  speed: number;
  direction: WebGPUVelocityDirection;
  angle?: number; // radians for custom
}

export interface WebGPUSpawnOptions {
  count: number;
  shape: "grid" | "random" | "circle" | "donut" | "square";
  center: { x: number; y: number };
  colors?: string[];
  spacing?: number; // grid
  radius?: number; // circle/donut outer
  innerRadius?: number; // donut inner
  squareSize?: number; // square size
  cornerRadius?: number; // square corner radius
  size?: number; // particle size
  mass?: number; // particle mass
  bounds?: { width: number; height: number }; // random
  velocity?: WebGPUVelocityConfig;
}

function calculateVelocity(
  position: { x: number; y: number },
  center: { x: number; y: number },
  cfg?: WebGPUVelocityConfig
): { vx: number; vy: number } {
  if (!cfg || cfg.speed === 0) return { vx: 0, vy: 0 };

  const speed = cfg.speed;
  let angle = 0;

  switch (cfg.direction) {
    case "random":
      angle = Math.random() * Math.PI * 2;
      break;
    case "in": {
      const dx = center.x - position.x;
      const dy = center.y - position.y;
      angle = Math.atan2(dy, dx);
      break;
    }
    case "out": {
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      angle = Math.atan2(dy, dx);
      break;
    }
    case "clockwise": {
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      angle = Math.atan2(-dx, dy);
      break;
    }
    case "counter-clockwise": {
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      angle = Math.atan2(dx, -dy);
      break;
    }
    case "custom":
      angle = cfg.angle || 0;
      break;
  }

  return { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) };
}

export class WebGPUSpawner {
  initParticles(options: WebGPUSpawnOptions): WebGPUParticle[] {
    const {
      count,
      shape,
      center,
      spacing = 25,
      radius = 100,
      innerRadius = 50,
      squareSize = 200,
      cornerRadius = 0,
      size = 5,
      mass = 1,
      bounds,
      velocity,
      colors,
    } = options;

    const particles: WebGPUParticle[] = [];

    if (count <= 0) return particles;

    const toColor = (
      hex: string
    ): { r: number; g: number; b: number; a: number } => {
      let h = hex.trim();
      if (h.startsWith("#")) h = h.slice(1);
      if (h.length === 3) {
        const r = parseInt(h[0] + h[0], 16);
        const g = parseInt(h[1] + h[1], 16);
        const b = parseInt(h[2] + h[2], 16);
        return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
      }
      if (h.length >= 6) {
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
      }
      return { r: 1, g: 1, b: 1, a: 1 };
    };

    const getColor = () => {
      if (!colors || colors.length === 0) return { r: 1, g: 1, b: 1, a: 1 };
      return toColor(colors[Math.floor(Math.random() * colors.length)]);
    };

    if (shape === "grid") {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const totalW = (cols - 1) * spacing;
      const totalH = (rows - 1) * spacing;
      const startX = center.x - totalW / 2;
      const startY = center.y - totalH / 2;

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * spacing;
        const y = startY + row * spacing;
        const { vx, vy } = calculateVelocity({ x, y }, center, velocity);
        particles.push({
          position: { x, y },
          velocity: { x: vx, y: vy },
          size,
          mass,
          color: getColor(),
        });
      }
      return particles;
    }

    if (shape === "random") {
      const w = bounds?.width ?? radius * 2;
      const h = bounds?.height ?? radius * 2;
      const left = center.x - w / 2;
      const top = center.y - h / 2;
      for (let i = 0; i < count; i++) {
        const x = left + Math.random() * w;
        const y = top + Math.random() * h;
        const { vx, vy } = calculateVelocity({ x, y }, center, velocity);
        particles.push({
          position: { x, y },
          velocity: { x: vx, y: vy },
          size,
          mass,
          color: getColor(),
        });
      }
      return particles;
    }

    if (shape === "circle") {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        const { vx, vy } = calculateVelocity({ x, y }, center, velocity);
        particles.push({
          position: { x, y },
          velocity: { x: vx, y: vy },
          size,
          mass,
          color: getColor(),
        });
      }
      return particles;
    }

    if (shape === "donut") {
      for (let i = 0; i < count; i++) {
        const ringR = innerRadius + Math.random() * (radius - innerRadius);
        const angle = Math.random() * Math.PI * 2;
        const x = center.x + Math.cos(angle) * ringR;
        const y = center.y + Math.sin(angle) * ringR;
        const { vx, vy } = calculateVelocity({ x, y }, center, velocity);
        particles.push({
          position: { x, y },
          velocity: { x: vx, y: vy },
          size,
          mass,
          color: getColor(),
        });
      }
      return particles;
    }

    if (shape === "square") {
      const half = squareSize / 2;
      const r = Math.max(0, Math.min(cornerRadius, half));
      const straight = Math.max(0, squareSize - 2 * r); // length of each straight segment
      const cornerArcLen = r > 0 ? (Math.PI * r) / 2 : 0; // quarter circle arc length
      const totalPerimeter = 4 * straight + 4 * cornerArcLen;

      // Helper to compute point on straight sides
      const posOnSide = (
        side: "top" | "right" | "bottom" | "left",
        t: number
      ) => {
        // t in [0,1] along straight portion
        const offset = (t - 0.5) * straight;
        switch (side) {
          case "top":
            return { x: center.x + offset, y: center.y - half };
          case "right":
            return { x: center.x + half, y: center.y + offset };
          case "bottom":
            return { x: center.x - offset, y: center.y + half };
          case "left":
            return { x: center.x - half, y: center.y - offset };
        }
      };

      // Helper to compute point on rounded corner
      const posOnCorner = (
        corner: "top-right" | "bottom-right" | "bottom-left" | "top-left",
        t: number
      ) => {
        // t in [0,1] around quarter circle
        const cornerCenterOffset = half - r;
        let cx = center.x;
        let cy = center.y;
        let startAngle = 0;
        switch (corner) {
          case "top-right":
            cx = center.x + cornerCenterOffset;
            cy = center.y - cornerCenterOffset;
            startAngle = 1.5 * Math.PI; // from up to right
            break;
          case "bottom-right":
            cx = center.x + cornerCenterOffset;
            cy = center.y + cornerCenterOffset;
            startAngle = 0; // from right to down
            break;
          case "bottom-left":
            cx = center.x - cornerCenterOffset;
            cy = center.y + cornerCenterOffset;
            startAngle = 0.5 * Math.PI; // from down to left
            break;
          case "top-left":
            cx = center.x - cornerCenterOffset;
            cy = center.y - cornerCenterOffset;
            startAngle = Math.PI; // from left to up
            break;
        }
        const ang = startAngle + t * (Math.PI / 2);
        return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
      };

      for (let i = 0; i < count; i++) {
        const d = Math.random() * totalPerimeter;
        let rem = d;

        // top side straight
        if (straight > 0 && rem <= straight) {
          const t = rem / straight;
          const p = posOnSide("top", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= straight;

        // top-right corner
        if (cornerArcLen > 0 && rem <= cornerArcLen) {
          const t = rem / cornerArcLen;
          const p = posOnCorner("top-right", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= cornerArcLen;

        // right side straight
        if (straight > 0 && rem <= straight) {
          const t = rem / straight;
          const p = posOnSide("right", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= straight;

        // bottom-right corner
        if (cornerArcLen > 0 && rem <= cornerArcLen) {
          const t = rem / cornerArcLen;
          const p = posOnCorner("bottom-right", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= cornerArcLen;

        // bottom side straight
        if (straight > 0 && rem <= straight) {
          const t = rem / straight;
          const p = posOnSide("bottom", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= straight;

        // bottom-left corner
        if (cornerArcLen > 0 && rem <= cornerArcLen) {
          const t = rem / cornerArcLen;
          const p = posOnCorner("bottom-left", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= cornerArcLen;

        // left side straight
        if (straight > 0 && rem <= straight) {
          const t = rem / straight;
          const p = posOnSide("left", t);
          const { vx, vy } = calculateVelocity(p, center, velocity);
          particles.push({
            position: { x: p.x, y: p.y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: getColor(),
          });
          continue;
        }
        rem -= straight;

        // top-left corner (fallback)
        const t = cornerArcLen > 0 ? rem / cornerArcLen : 0;
        const p =
          cornerArcLen > 0
            ? posOnCorner("top-left", t)
            : { x: center.x - half, y: center.y - half };
        const { vx, vy } = calculateVelocity(p, center, velocity);
        particles.push({
          position: { x: p.x, y: p.y },
          velocity: { x: vx, y: vy },
          size,
          mass,
          color: getColor(),
        });
      }
      return particles;
    }

    return particles;
  }
}
