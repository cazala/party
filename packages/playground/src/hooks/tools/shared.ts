export type Point = { x: number; y: number };

export const OVERLAY_WHITE = "rgba(255,255,255,0.8)";
export const OVERLAY_WHITE_FAINT = "rgba(255,255,255,0.6)";
export const DASH_SMALL = [4, 4];
export const DASH_MED = [6, 6];

export function getMouseInfo(
  ev: MouseEvent,
  canvas: HTMLCanvasElement
): { sx: number; sy: number; ctrl: boolean; shift: boolean } {
  const rect = canvas.getBoundingClientRect();
  return {
    sx: ev.clientX - rect.left,
    sy: ev.clientY - rect.top,
    ctrl: !!(ev.ctrlKey || ev.metaKey),
    shift: !!ev.shiftKey,
  };
}

export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color = "rgba(255,255,255,0.8)",
  width = 2,
  dash: number[] = [6, 6]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawDashedCircle(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  color = "rgba(255,255,255,0.8)",
  width = 2,
  dash: number[] = [8, 4]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawDot(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius = 3,
  color = "#ffffff"
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
