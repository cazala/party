/**
 * Spawner
 *
 * Utility for generating initial `IParticle[]` configurations for common
 * shapes (grid, random, circle, donut, square, text) with optional initial velocity
 * presets (random/in/out/clockwise/counter-clockwise/custom). Also includes
 * lightweight color parsing helpers.
 */
import { IParticle } from "./interfaces";

export type VelocityDirection =
  | "random"
  | "in"
  | "out"
  | "custom"
  | "clockwise"
  | "counter-clockwise";

export interface VelocityConfig {
  speed: number;
  direction: VelocityDirection;
  angle?: number; // radians for custom
}

export type SpawnShape =
  | "grid"
  | "random"
  | "circle"
  | "donut"
  | "square"
  | "text"
  | "image";

export type TextHorizontalAlign = "left" | "center" | "right";
export type TextVerticalAlign = "top" | "center" | "bottom";

export const TEXT_SPAWNER_FONTS = ["sans-serif", "serif", "monospace"] as const;
export type TextSpawnerFont = (typeof TEXT_SPAWNER_FONTS)[number];

export interface SpawnOptions {
  count: number;
  shape: SpawnShape;
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
  velocity?: VelocityConfig;
  // text
  text?: string;
  font?: TextSpawnerFont | string;
  textSize?: number;
  position?: { x: number; y: number };
  align?: { horizontal: TextHorizontalAlign; vertical: TextVerticalAlign };
  // image
  imageData?: ImageData | null;
  imageSize?: number;
}

function calculateVelocity(
  position: { x: number; y: number },
  center: { x: number; y: number },
  cfg?: VelocityConfig
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

export class Spawner {
  initParticles(options: SpawnOptions): IParticle[] {
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
      text = "Party",
      font = "sans-serif",
      textSize = 64,
      position,
      align,
      imageData,
      imageSize,
    } = options;

    const particles: IParticle[] = [];

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

    if (shape === "text") {
      const textValue = text.trim();
      if (!textValue) return particles;

      const createCanvas = () => {
        if (typeof OffscreenCanvas !== "undefined") {
          return new OffscreenCanvas(1, 1);
        }
        if (typeof document !== "undefined") {
          return document.createElement("canvas");
        }
        return null;
      };

      const canvas = createCanvas();
      if (!canvas) return particles;

      const ctx = canvas.getContext("2d");
      if (!ctx) return particles;

      const fontSize = Math.max(1, Math.floor(textSize));
      const fontSpec = `${fontSize}px ${font}`;
      ctx.font = fontSpec;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";

      const metrics = ctx.measureText(textValue);
      const ascent = metrics.actualBoundingBoxAscent || fontSize;
      const descent = metrics.actualBoundingBoxDescent || fontSize * 0.25;
      const left = metrics.actualBoundingBoxLeft || 0;
      const right = metrics.actualBoundingBoxRight || metrics.width;
      const textWidth = Math.max(1, Math.ceil(left + right));
      const textHeight = Math.max(1, Math.ceil(ascent + descent));
      const padding = Math.ceil(fontSize * 0.25);

      canvas.width = textWidth + padding * 2;
      canvas.height = textHeight + padding * 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = fontSpec;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(textValue, padding + left, padding + ascent);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const sampleStep = Math.max(1, Math.round(size));
      const points: { x: number; y: number }[] = [];

      for (let y = 0; y < canvas.height; y += sampleStep) {
        for (let x = 0; x < canvas.width; x += sampleStep) {
          const idx = (y * canvas.width + x) * 4 + 3;
          if (data[idx] > 0) {
            points.push({ x, y });
          }
        }
      }

      const maxCount = Math.min(count, points.length);
      if (maxCount <= 0) return particles;

      const textPosition = position ?? center;
      const horizontal = align?.horizontal ?? "center";
      const vertical = align?.vertical ?? "center";
      const originX =
        horizontal === "left"
          ? textPosition.x
          : horizontal === "right"
          ? textPosition.x - textWidth
          : textPosition.x - textWidth / 2;
      const originY =
        vertical === "top"
          ? textPosition.y
          : vertical === "bottom"
          ? textPosition.y - textHeight
          : textPosition.y - textHeight / 2;

      const stride = points.length / maxCount;
      for (let i = 0; i < maxCount; i++) {
        const idx = Math.floor(i * stride);
        const point = points[idx];
        if (!point) continue;
        const x = originX + (point.x - padding);
        const y = originY + (point.y - padding);
        const { vx, vy } = calculateVelocity(
          { x, y },
          textPosition,
          velocity
        );
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

    if (shape === "image") {
      if (!imageData) return particles;
      const width = Math.floor(imageData.width);
      const height = Math.floor(imageData.height);
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      )
        return particles;

      const data = imageData.data;
      const sampleStepTarget = Math.max(1, Math.round(size));
      const targetSize =
        typeof imageSize === "number" && Number.isFinite(imageSize) && imageSize > 0
          ? imageSize
          : Math.max(width, height);
      const scale = Math.max(0.0001, targetSize / Math.max(width, height));
      const sampleStepSource = Math.max(1, Math.round(sampleStepTarget / scale));
      const points: {
        x: number;
        y: number;
        color: { r: number; g: number; b: number; a: number };
      }[] = [];

      for (let y = 0; y < height; y += sampleStepSource) {
        for (let x = 0; x < width; x += sampleStepSource) {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];
          if (alpha === 0) continue;
          points.push({
            x: x * scale,
            y: y * scale,
            color: {
              r: data[idx] / 255,
              g: data[idx + 1] / 255,
              b: data[idx + 2] / 255,
              a: alpha / 255,
            },
          });
        }
      }

      const maxCount = Math.max(0, Math.floor(count));
      if (maxCount <= 0 || points.length === 0) return particles;

      const imagePosition = position ?? center;
      const horizontal = align?.horizontal ?? "center";
      const vertical = align?.vertical ?? "center";
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      const originX =
        horizontal === "left"
          ? imagePosition.x
          : horizontal === "right"
          ? imagePosition.x - scaledWidth
          : imagePosition.x - scaledWidth / 2;
      const originY =
        vertical === "top"
          ? imagePosition.y
          : vertical === "bottom"
          ? imagePosition.y - scaledHeight
          : imagePosition.y - scaledHeight / 2;

      const baseCount = Math.min(maxCount, points.length);
      const stride = points.length / baseCount;
      for (let i = 0; i < baseCount; i++) {
        const idx = Math.floor(i * stride);
        const point = points[idx];
        if (!point) continue;
        const x = originX + point.x;
        const y = originY + point.y;
        const { vx, vy } = calculateVelocity(
          { x, y },
          imagePosition,
          velocity
        );
        particles.push({
          position: { x, y },
          velocity: { x: vx, y: vy },
          size,
          mass,
          color: point.color,
        });
      }

      const extraCount = maxCount - baseCount;
      if (extraCount > 0) {
        const jitter = sampleStepTarget * 0.4;
        for (let i = 0; i < extraCount; i++) {
          const point = points[Math.floor(Math.random() * points.length)];
          if (!point) continue;
          const x = originX + point.x + (Math.random() - 0.5) * jitter;
          const y = originY + point.y + (Math.random() - 0.5) * jitter;
          const { vx, vy } = calculateVelocity(
            { x, y },
            imagePosition,
            velocity
          );
          particles.push({
            position: { x, y },
            velocity: { x: vx, y: vy },
            size,
            mass,
            color: point.color,
          });
        }
      }

      return particles;
    }

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
