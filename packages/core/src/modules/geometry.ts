import { Vector2D } from "./vector";
import { Particle } from "./particle";

/**
 * Geometric utility functions for collision detection and spatial calculations
 */

/**
 * Check if two line segments intersect (geometric intersection test)
 */
export function lineSegmentsIntersect(
  p1: Vector2D,
  q1: Vector2D,
  p2: Vector2D,
  q2: Vector2D
): boolean {
  const orientation = (p: Vector2D, q: Vector2D, r: Vector2D): number => {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-10) return 0; // Collinear
    return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
  };

  const onSegment = (p: Vector2D, q: Vector2D, r: Vector2D): boolean => {
    return (
      q.x <= Math.max(p.x, r.x) &&
      q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) &&
      q.y >= Math.min(p.y, r.y)
    );
  };

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  // Special cases (collinear points)
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/**
 * Find the closest point on a line segment to a given point
 */
export function getClosestPointOnLineSegment(
  point: Vector2D,
  lineStart: Vector2D,
  lineEnd: Vector2D
): Vector2D {
  // Vector from line start to line end
  const lineVector = lineEnd.clone().subtract(lineStart);

  // Vector from line start to point
  const pointVector = point.clone().subtract(lineStart);

  // Project point onto line (parameterized as t)
  const lineLength = lineVector.magnitude();

  if (lineLength === 0) {
    // Line has zero length, return the start point
    return lineStart.clone();
  }

  const t = pointVector.dot(lineVector) / (lineLength * lineLength);

  // Clamp t to [0, 1] to stay within line segment bounds
  const clampedT = Math.max(0, Math.min(1, t));

  // Calculate the closest point
  return lineStart.clone().add(lineVector.multiply(clampedT));
}

/**
 * Calculate minimum distance between two line segments
 */
export function getDistanceBetweenLineSegments(
  line1Start: Vector2D,
  line1End: Vector2D,
  line2Start: Vector2D,
  line2End: Vector2D
): number {
  // Check all possible cases: segment to segment, point to segment
  const distances = [
    // Distance from line1 endpoints to line2 segment
    line1Start.distance(getClosestPointOnLineSegment(line1Start, line2Start, line2End)),
    line1End.distance(getClosestPointOnLineSegment(line1End, line2Start, line2End)),
    // Distance from line2 endpoints to line1 segment
    line2Start.distance(getClosestPointOnLineSegment(line2Start, line1Start, line1End)),
    line2End.distance(getClosestPointOnLineSegment(line2End, line1Start, line1End))
  ];

  return Math.min(...distances);
}

/**
 * Check if a moving particle (represented by a line segment) intersects with a joint segment
 */
export function checkLineSegmentIntersection(
  particleStart: Vector2D,
  particleEnd: Vector2D,
  jointStart: Vector2D,
  jointEnd: Vector2D,
  particleRadius: number
): boolean {
  // Calculate the distance between the particle path and joint segment
  const minDistance = getDistanceBetweenLineSegments(
    particleStart,
    particleEnd,
    jointStart,
    jointEnd
  );

  return minDistance < particleRadius;
}

/**
 * Calculate the centroid (center of mass) of a collection of particles
 */
export function calculateCentroid(
  particles: Iterable<Particle>
): Vector2D {
  let totalMass = 0;
  let weightedPosition = new Vector2D(0, 0);

  for (const particle of particles) {
    weightedPosition.add(particle.position.clone().multiply(particle.mass));
    totalMass += particle.mass;
  }

  if (totalMass > 0) {
    weightedPosition.divide(totalMass);
  }

  return weightedPosition;
}

/**
 * Calculate total mass of a collection of particles
 */
export function calculateTotalMass(
  particles: Iterable<Particle>
): number {
  let totalMass = 0;
  for (const particle of particles) {
    totalMass += particle.mass;
  }
  return totalMass > 0 ? totalMass : 1; // Avoid division by zero
}