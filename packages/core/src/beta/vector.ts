export class Vector {
  constructor(public x: number = 0, public y: number = 0) {}

  add(vector: Vector): Vector {
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }

  subtract(vector: Vector): Vector {
    this.x -= vector.x;
    this.y -= vector.y;
    return this;
  }

  multiply(scalar: number): Vector {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divide(scalar: number): Vector {
    if (scalar === 0) throw new Error("Cannot divide by zero");
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector {
    const mag = this.magnitude();
    if (mag === 0) {
      this.x = 0;
      this.y = 0;
    } else {
      this.x /= mag;
      this.y /= mag;
    }
    return this;
  }

  limit(max: number): Vector {
    const mag = this.magnitude();
    if (mag > max) {
      this.normalize().multiply(max);
    }
    return this;
  }

  dot(vector: Vector): number {
    return this.x * vector.x + this.y * vector.y;
  }

  distance(vector: Vector): number {
    const dx = this.x - vector.x;
    const dy = this.y - vector.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  direction(vector: Vector): Vector {
    const distance = this.distance(vector);
    return new Vector(
      (vector.x - this.x) / distance,
      (vector.y - this.y) / distance
    );
  }

  clone(): Vector {
    return new Vector(this.x, this.y);
  }

  set(x: number, y: number): Vector {
    this.x = x;
    this.y = y;
    return this;
  }

  zero(): Vector {
    this.x = 0;
    this.y = 0;
    return this;
  }

  static random(min: number = -1, max: number = 1): Vector {
    return new Vector(
      Math.random() * (max - min) + min,
      Math.random() * (max - min) + min
    );
  }

  static zero(): Vector {
    return new Vector(0, 0);
  }

  /**
   * Create a Vector2D from an angle in radians
   * @param angle Angle in radians (0 = right, π/2 = down, π = left, 3π/2 = up)
   * @param magnitude Length of the vector (default: 1)
   */
  static fromAngle(angle: number, magnitude: number = 1): Vector {
    return new Vector(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }

  /**
   * Create a Vector2D from an angle in degrees
   * @param angle Angle in degrees (0° = right, 90° = down, 180° = left, 270° = up)
   * @param magnitude Length of the vector (default: 1)
   */
  static fromAngleDegrees(angle: number, magnitude: number = 1): Vector {
    const angleInRadians = (angle * Math.PI) / 180;
    return new Vector(
      Math.cos(angleInRadians) * magnitude,
      Math.sin(angleInRadians) * magnitude
    );
  }

  /**
   * Convert degrees to radians
   * @param degrees Angle in degrees
   * @returns Angle in radians
   */
  static degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert radians to degrees
   * @param radians Angle in radians
   * @returns Angle in degrees
   */
  static radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 * @param radians Angle in radians
 * @returns Angle in degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
