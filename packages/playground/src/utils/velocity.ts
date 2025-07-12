// Velocity configuration
const BASE_MAX_VELOCITY = 300; // base maximum velocity magnitude in pixels/second

export const calculateVelocity = (
  startPos: { x: number; y: number },
  currentPos: { x: number; y: number },
  zoomScale: number = 1 // zoom scale factor (lower = zoomed out)
) => {
  const dx = currentPos.x - startPos.x;
  const dy = currentPos.y - startPos.y;
  
  // Scale max velocity inversely with zoom - when zoomed out (zoom < 1), allow higher velocity
  const scaledMaxVelocity = BASE_MAX_VELOCITY / zoomScale;
  
  // Calculate velocity magnitude and cap it
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  const cappedMagnitude = Math.min(magnitude, scaledMaxVelocity);
  
  // Calculate normalized direction and apply capped magnitude
  if (magnitude > 0) {
    const normalizedX = dx / magnitude;
    const normalizedY = dy / magnitude;
    return {
      x: normalizedX * cappedMagnitude,
      y: normalizedY * cappedMagnitude
    };
  } else {
    return { x: 0, y: 0 };
  }
};