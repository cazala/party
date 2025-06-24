export const getDistance = (
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
) => {
  return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
};