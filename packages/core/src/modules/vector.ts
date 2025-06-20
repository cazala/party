export class Vector2D {
  constructor(public x: number = 0, public y: number = 0) {}

  add(vector: Vector2D): Vector2D {
    return new Vector2D(this.x + vector.x, this.y + vector.y);
  }

  subtract(vector: Vector2D): Vector2D {
    return new Vector2D(this.x - vector.x, this.y - vector.y);
  }

  multiply(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  divide(scalar: number): Vector2D {
    if (scalar === 0) throw new Error('Cannot divide by zero');
    return new Vector2D(this.x / scalar, this.y / scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2D {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2D(0, 0);
    return this.divide(mag);
  }

  limit(max: number): Vector2D {
    const mag = this.magnitude();
    if (mag > max) {
      return this.normalize().multiply(max);
    }
    return new Vector2D(this.x, this.y);
  }

  dot(vector: Vector2D): number {
    return this.x * vector.x + this.y * vector.y;
  }

  distance(vector: Vector2D): number {
    return this.subtract(vector).magnitude();
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  set(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  static random(min: number = -1, max: number = 1): Vector2D {
    return new Vector2D(
      Math.random() * (max - min) + min,
      Math.random() * (max - min) + min
    );
  }

  static zero(): Vector2D {
    return new Vector2D(0, 0);
  }

  static fromAngle(angle: number, magnitude: number = 1): Vector2D {
    return new Vector2D(
      Math.cos(angle) * magnitude,
      Math.sin(angle) * magnitude
    );
  }
}