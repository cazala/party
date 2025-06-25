export class Vector2D {
  constructor(public x: number = 0, public y: number = 0) {}

  add(vector: Vector2D): Vector2D {
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }

  subtract(vector: Vector2D): Vector2D {
    this.x -= vector.x;
    this.y -= vector.y;
    return this;
  }

  multiply(scalar: number): Vector2D {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divide(scalar: number): Vector2D {
    if (scalar === 0) throw new Error("Cannot divide by zero");
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2D {
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

  limit(max: number): Vector2D {
    const mag = this.magnitude();
    if (mag > max) {
      this.normalize().multiply(max);
    }
    return this;
  }

  dot(vector: Vector2D): number {
    return this.x * vector.x + this.y * vector.y;
  }

  distance(vector: Vector2D): number {
    const dx = this.x - vector.x;
    const dy = this.y - vector.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  direction(vector: Vector2D): Vector2D {
    const distance = this.distance(vector);
    return new Vector2D(
      (vector.x - this.x) / distance,
      (vector.y - this.y) / distance
    );
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  set(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  zero(): Vector2D {
    this.x = 0;
    this.y = 0;
    return this;
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
