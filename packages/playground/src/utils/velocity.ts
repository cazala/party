// Velocity configuration
const MAX_VELOCITY = 300; // maximum velocity magnitude in pixels/second

export const calculateVelocity = (
  startPos: { x: number; y: number },
  currentPos: { x: number; y: number }
) => {
  const dx = currentPos.x - startPos.x;
  const dy = currentPos.y - startPos.y;
  
  // Calculate velocity magnitude and cap it
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  const cappedMagnitude = Math.min(magnitude, MAX_VELOCITY);
  
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