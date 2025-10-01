import {
  Module,
  ModuleRole,
  type WebGPUDescriptor,
  CPUDescriptor,
  DataType,
} from "../../module";

// Default configuration values for joints module
export const DEFAULT_JOINTS_RESTITUTION = 0.9;
export const DEFAULT_JOINTS_SEPARATION = 0.5;
export const DEFAULT_JOINTS_STEPS = 48;
export const DEFAULT_JOINTS_FRICTION = 0.01;
export const DEFAULT_JOINTS_MOMENTUM = 0.7;
export const DEFAULT_JOINTS_ENABLE_COLLISIONS = 1;

export interface Joint {
  aIndex: number;
  bIndex: number;
  restLength: number;
}

type JointsInputs = {
  aIndexes: number[];
  bIndexes: number[];
  restLengths: number[];
  enableCollisions: number;
  momentum: number;
  restitution: number; // particle-vs-joint restitution
  separation: number; // joint-joint positional separation strength per iteration
  steps: number; // substeps for CCD sweep
  friction: number; // 0=no friction, 1=high friction
  groupIds: number[]; // per-particle rigid body id
};

export class Joints extends Module<"joints", JointsInputs> {
  readonly name = "joints" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    aIndexes: DataType.ARRAY,
    bIndexes: DataType.ARRAY,
    restLengths: DataType.ARRAY,
    enableCollisions: DataType.NUMBER,
    momentum: DataType.NUMBER,
    restitution: DataType.NUMBER,
    separation: DataType.NUMBER,
    steps: DataType.NUMBER,
    friction: DataType.NUMBER,
    groupIds: DataType.ARRAY,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    joints?: Joint[];
    aIndexes?: number[];
    bIndexes?: number[];
    restLengths?: number[];
    enableCollisions?: number;
    momentum?: number;
    restitution?: number;
    separation?: number;
    steps?: number;
    friction?: number;
  }) {
    super();

    // Handle joints array if provided, otherwise use separate arrays
    let aIndexes: number[], bIndexes: number[], restLengths: number[];
    if (opts?.joints) {
      aIndexes = opts.joints.map((j) => j.aIndex);
      bIndexes = opts.joints.map((j) => j.bIndex);
      restLengths = opts.joints.map((j) => j.restLength);
    } else {
      aIndexes = opts?.aIndexes ?? [];
      bIndexes = opts?.bIndexes ?? [];
      restLengths = opts?.restLengths ?? [];
    }

    this.write({
      aIndexes,
      bIndexes,
      restLengths,
      enableCollisions:
        opts?.enableCollisions ?? DEFAULT_JOINTS_ENABLE_COLLISIONS,
      momentum: opts?.momentum ?? DEFAULT_JOINTS_MOMENTUM,
      restitution: opts?.restitution ?? DEFAULT_JOINTS_RESTITUTION,
      separation: opts?.separation ?? DEFAULT_JOINTS_SEPARATION,
      steps: opts?.steps ?? DEFAULT_JOINTS_STEPS,
      friction: opts?.friction ?? DEFAULT_JOINTS_FRICTION,
      groupIds: [],
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  getJoints(): Joint[] {
    const aIndexes = this.readArray("aIndexes") as number[];
    const bIndexes = this.readArray("bIndexes") as number[];
    const restLengths = this.readArray("restLengths") as number[];

    const joints: Joint[] = [];
    const length = Math.min(
      aIndexes.length,
      bIndexes.length,
      restLengths.length
    );
    for (let i = 0; i < length; i++) {
      joints.push({
        aIndex: aIndexes[i],
        bIndex: bIndexes[i],
        restLength: restLengths[i],
      });
    }
    return joints;
  }

  setJoints(joints: Joint[]): void;
  setJoints(
    aIndexes: number[],
    bIndexes: number[],
    restLengths: number[]
  ): void;
  setJoints(
    jointsOrAIndexes: Joint[] | number[],
    bIndexes?: number[],
    restLengths?: number[]
  ): void {
    let aIndexes: number[], bIndexesArray: number[], restLengthsArray: number[];

    // Check if first argument is Joint[] or number[]
    if (bIndexes === undefined && restLengths === undefined) {
      // First overload: Joint[]
      const joints = jointsOrAIndexes as Joint[];
      aIndexes = joints.map((j) => j.aIndex);
      bIndexesArray = joints.map((j) => j.bIndex);
      restLengthsArray = joints.map((j) => j.restLength);
    } else {
      // Second overload: separate arrays
      aIndexes = jointsOrAIndexes as number[];
      bIndexesArray = bIndexes!;
      restLengthsArray = restLengths!;
    }

    // Always write joint arrays
    this.write({
      aIndexes,
      bIndexes: bIndexesArray,
      restLengths: restLengthsArray,
    });

    // Compute rigid body groupIds from joints (BFS over joint graph) and write them once here
    const n = Math.max(
      aIndexes.length ? Math.max(...aIndexes) + 1 : 0,
      bIndexesArray.length ? Math.max(...bIndexesArray) + 1 : 0
    );
    if (n > 0) {
      const adj: number[][] = Array.from({ length: n }, () => []);
      const deg = new Array<number>(n).fill(0);
      const validLen = Math.min(aIndexes.length, bIndexesArray.length);
      for (let i = 0; i < validLen; i++) {
        const u = aIndexes[i] >>> 0;
        const v = bIndexesArray[i] >>> 0;
        if (u >= n || v >= n) continue;
        adj[u].push(v);
        adj[v].push(u);
        deg[u]++;
        deg[v]++;
      }
      const groupIds = new Array<number>(n).fill(-1);
      let gid = 0;
      for (let i = 0; i < n; i++) {
        if (groupIds[i] !== -1) continue;
        if (deg[i] === 0) continue; // ignore isolated
        const queue: number[] = [i];
        groupIds[i] = gid;
        while (queue.length) {
          const u = queue.shift() as number;
          const nbrs = adj[u];
          for (let k = 0; k < nbrs.length; k++) {
            const v = nbrs[k];
            if (groupIds[v] === -1) {
              groupIds[v] = gid;
              queue.push(v);
            }
          }
        }
        gid++;
      }
      this.write({ groupIds });
    } else {
      this.write({ groupIds: [] });
    }
  }

  getEnableCollisions() {
    return this.readValue("enableCollisions");
  }

  setEnableCollisions(val: number): void {
    this.write({ enableCollisions: val });
  }

  getMomentum() {
    return this.readValue("momentum");
  }

  setMomentum(val: number): void {
    this.write({ momentum: Math.max(0, Math.min(1, val)) }); // Clamp between 0 and 1
  }

  getRestitution() {
    return this.readValue("restitution");
  }

  setRestitution(val: number): void {
    this.write({ restitution: Math.max(0, Math.min(1, val)) });
  }

  getSeparation() {
    return this.readValue("separation");
  }

  setSeparation(val: number): void {
    this.write({ separation: Math.max(0.01, Math.min(1, val)) });
  }

  getSteps() {
    return this.readValue("steps");
  }

  setSteps(val: number): void {
    const steps = Math.max(1, Math.min(128, Math.floor(val)));
    this.write({ steps });
  }

  getFriction() {
    return this.readValue("friction");
  }

  setFriction(val: number): void {
    this.write({ friction: Math.max(0, Math.min(1, val)) });
  }

  add(joint: Joint): void {
    const currentJoints = this.getJoints();

    // Normalize joint (ensure aIndex <= bIndex) and dedupe
    let { aIndex, bIndex, restLength } = joint;
    if (aIndex === bIndex) return; // Skip self-joints
    if (bIndex < aIndex) [aIndex, bIndex] = [bIndex, aIndex];

    // Check for duplicates
    for (const existing of currentJoints) {
      let { aIndex: existingA, bIndex: existingB } = existing;
      if (existingB < existingA)
        [existingA, existingB] = [existingB, existingA];
      if (existingA === aIndex && existingB === bIndex) return;
    }

    // Add the joint
    currentJoints.push({ aIndex, bIndex, restLength });
    this.setJoints(currentJoints);
  }

  remove(aIndex: number, bIndex: number): void {
    const currentJoints = this.getJoints();

    // Normalize indices for comparison
    let searchA = aIndex,
      searchB = bIndex;
    if (searchB < searchA) [searchA, searchB] = [searchB, searchA];

    // Find and remove the joint (works with flipped indices too)
    const filteredJoints = currentJoints.filter((joint) => {
      let { aIndex: jointA, bIndex: jointB } = joint;
      if (jointB < jointA) [jointA, jointB] = [jointB, jointA];
      return !(jointA === searchA && jointB === searchB);
    });

    this.setJoints(filteredJoints);
  }

  removeAll(): void {
    this.setJoints([]);
  }

  // groupIds are derived from joints; no external setters/getters

  webgpu(): WebGPUDescriptor<JointsInputs, "prevX" | "prevY"> {
    return {
      states: ["prevX", "prevY"] as const,

      // Store pre-physics positions for momentum preservation
      state: ({ particleVar, getLength, setState }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount > 0u) {
    // Store current position before physics integration
    ${setState("prevX", `${particleVar}.position.x`)};
    ${setState("prevY", `${particleVar}.position.y`)};
  }
}`,

      // v1: constrain in per-particle pass, linear scan over joints for simplicity
      constrain: ({ particleVar, getUniform, getLength }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount == 0u) { return; }
  
  // For v1: linear scan joints; future: binary search over sorted aIndexes
  for (var j = 0u; j < jointCount; j++) {
    let a = u32(${getUniform("aIndexes", "j")});
    let b = u32(${getUniform("bIndexes", "j")});
    let rest = ${getUniform("restLengths", "j")};
    if (rest <= 0.0) { continue; }
    var selfIndex = index;
    var otherIndex = 0xffffffffu;
    if (a == selfIndex) {
      otherIndex = b;
    } else if (b == selfIndex) {
      otherIndex = a;
    }
    if (otherIndex == 0xffffffffu) { continue; }
    var other = particles[otherIndex];
    // Skip removed
    if (${particleVar}.mass == 0.0 || other.mass == 0.0) { continue; }
    let delta = other.position - ${particleVar}.position;
    let dist2 = dot(delta, delta);
    if (dist2 < 1e-8) { continue; }
    let dist = sqrt(dist2);
    let dir = delta / dist;
    let diff = dist - rest;
    if (abs(diff) < 1e-6) { continue; }
    let invM_self = select(0.0, 1.0 / ${particleVar}.mass, ${particleVar}.mass > 0.0);
    let invM_other = select(0.0, 1.0 / other.mass, other.mass > 0.0);
    let invSum = invM_self + invM_other;
    if (invSum <= 0.0) { continue; }
    let corr = dir * (diff * (invM_self / invSum));
    ${particleVar}.position = ${particleVar}.position + corr;
  }

  // Optional collision handling with joints (particle vs joint, joint vs joint)
  // Only for particles that are part of at least one joint
  var hasJoint = false;
  for (var jj = 0u; jj < jointCount; jj++) {
    let ja = u32(${getUniform("aIndexes", "jj")});
    let jb = u32(${getUniform("bIndexes", "jj")});
    if (ja == index || jb == index) { hasJoint = true; break; }
  }
  if (${getUniform(
    "enableCollisions"
  )} > 0.0 && ${particleVar}.mass > 0.0 && hasJoint) {
    // Particle vs Joint: find deepest overlap with any segment not incident to this particle
    var bestOverlap: f32 = 0.0;
    var bestNormal: vec2<f32> = vec2<f32>(0.0, 0.0);
    for (var j2 = 0u; j2 < jointCount; j2++) {
      let a2 = u32(${getUniform("aIndexes", "j2")});
      let b2 = u32(${getUniform("bIndexes", "j2")});
      if (a2 == index || b2 == index) { continue; }
      var A = particles[a2];
      var B = particles[b2];
      // Guard
      if (A.mass == 0.0 || B.mass == 0.0) { continue; }
      let AB = B.position - A.position;
      let AB2 = dot(AB, AB);
      if (AB2 < 1e-8) { continue; }
      let AP = ${particleVar}.position - A.position;
      let t = clamp(dot(AP, AB) / AB2, 0.0, 1.0);
      let closest = A.position + AB * t;
      let pc = ${particleVar}.position - closest;
      let d2 = dot(pc, pc);
      let r = ${particleVar}.size;
      if (d2 < r * r && d2 > 1e-8) {
        let d = sqrt(d2);
        let overlap = r - d;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestNormal = pc / d;
        }
      }
    }
    if (bestOverlap > 0.0) {
      // Position correction (move current particle only)
      let push = min(bestOverlap * 0.6, ${particleVar}.size);
      ${particleVar}.position = ${particleVar}.position + bestNormal * push;
      // Low-restitution impulse to reduce interpenetration
      var v = ${particleVar}.velocity;
      let n = bestNormal;
      let relN = dot(v, n);
      let vt = v - n * relN; // tangential component
      if (relN < 0.0) {
        let e = ${getUniform("restitution")};
        let mu = clamp(${getUniform("friction")}, 0.0, 1.0);
        let vReflected = v - n * (relN * (1.0 + e));
        let vtScaled = vt * (1.0 - mu);
        ${particleVar}.velocity = vReflected + (vtScaled - vt);
      }
    }

    // Joint vs Joint: for joints incident to this particle, nudge to resolve crossings
    for (var j3 = 0u; j3 < jointCount; j3++) {
      let a3 = u32(${getUniform("aIndexes", "j3")});
      let b3 = u32(${getUniform("bIndexes", "j3")});
      var isIncident = (a3 == index) || (b3 == index);
      if (!isIncident) { continue; }
      var A1 = particles[a3];
      var B1 = particles[b3];
      let x1 = A1.position.x; let y1 = A1.position.y;
      let x2 = B1.position.x; let y2 = B1.position.y;
      for (var k = 0u; k < jointCount; k++) {
        if (k == j3) { continue; }
        let a4 = u32(${getUniform("aIndexes", "k")});
        let b4 = u32(${getUniform("bIndexes", "k")});
        // Skip if shares endpoints
        if (a4 == a3 || a4 == b3 || b4 == a3 || b4 == b3) { continue; }
        // Skip same rigid body using precomputed groupIds
        let gidA = i32(${getUniform("groupIds", "a3")});
        let gidB = i32(${getUniform("groupIds", "b3")});
        let gidC = i32(${getUniform("groupIds", "a4")});
        let gidD = i32(${getUniform("groupIds", "b4")});
        if ((gidA >= 0 && gidC >= 0 && gidA == gidC) || (gidA >= 0 && gidD >= 0 && gidA == gidD) ||
            (gidB >= 0 && gidC >= 0 && gidB == gidC) || (gidB >= 0 && gidD >= 0 && gidB == gidD)) {
          continue;
        }
        var A2 = particles[a4];
        var B2 = particles[b4];
        let x3 = A2.position.x; let y3 = A2.position.y;
        let x4 = B2.position.x; let y4 = B2.position.y;
        let dx1 = x2 - x1; let dy1 = y2 - y1;
        let dx2 = x4 - x3; let dy2 = y4 - y3;
        let denom = dx1 * dy2 - dy1 * dx2;
        if (abs(denom) < 1e-6) { continue; }
        let t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denom;
        let u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denom;
        if (t >= 0.0 && t <= 1.0 && u >= 0.0 && u <= 1.0) {
          // Intersection detected: nudge current particle away along midpoint normal
          let m1 = vec2<f32>((x1 + x2) * 0.5, (y1 + y2) * 0.5);
          let m2 = vec2<f32>((x3 + x4) * 0.5, (y3 + y4) * 0.5);
          var n = m1 - m2;
          let n2 = dot(n, n);
          if (n2 < 1e-6) {
            // random tiny direction based on index
            let ang = fract(sin(f32(index) * 12.9898) * 43758.5453) * 6.283185307;
            n = vec2<f32>(cos(ang), sin(ang));
          } else {
            n = normalize(n);
          }
          let sep = ${getUniform("separation")};
          ${particleVar}.position = ${particleVar}.position + n * sep;
          // Only one nudge per incident joint per iteration
          break;
        }
      }
    }
  }
}`,

      // CCD against joints with substeps, then apply momentum preservation after constraint solving
      correct: ({ particleVar, getUniform, getLength, getState, dtVar }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount == 0u) { return; }
  
  // Substep CCD: particle-vs-joint should run for all particles
  var hasJoint = false; // still used below for joint-segment CCD and momentum
  for (var jj = 0u; jj < jointCount; jj++) {
    let ja = u32(${getUniform("aIndexes", "jj")});
    let jb = u32(${getUniform("bIndexes", "jj")});
    if (ja == index || jb == index) { hasJoint = true; break; }
  }
  if (${getUniform("enableCollisions")} > 0.0) {
    // Substep CCD: sweep particle (as a circle of radius r) from previous to current position
    let prevX = ${getState("prevX")};
    let prevY = ${getState("prevY")};
    let p0 = vec2<f32>(prevX, prevY);
    let p1 = ${particleVar}.position;
    let r = ${particleVar}.size;
    // Choose steps from uniform; engine iterates constraints many times
    let steps: u32 = max(1u, u32(${getUniform("steps")}));
    for (var sstep = 1u; sstep <= steps; sstep++) {
      let t = f32(sstep) / f32(steps);
      let ps = mix(p0, p1, t);
      var collided = false;
      var n: vec2<f32> = vec2<f32>(0.0, 0.0);
      for (var j = 0u; j < jointCount; j++) {
        let a = u32(${getUniform("aIndexes", "j")});
        let b = u32(${getUniform("bIndexes", "j")});
        if (a == index || b == index) { continue; }
        // Skip if same rigid body by two-hop connectivity with current incident joint endpoints
        // We approximate by checking connections to current particle's incident joint endpoints (handled above per j0)
        var A = particles[a];
        var B = particles[b];
        let ab = B.position - A.position;
        let ab2 = dot(ab, ab);
        if (ab2 < 1e-8) { continue; }
        let ap = ps - A.position;
        let u = clamp(dot(ap, ab) / ab2, 0.0, 1.0);
        let closest = A.position + ab * u;
        let pc = ps - closest;
        let d2 = dot(pc, pc);
        if (d2 < r * r && d2 > 1e-10) {
          let d = sqrt(d2);
          n = pc / d;
          collided = true;
          // Re-position to contact, slightly outside to avoid re-penetration
          ${particleVar}.position = closest + n * (r + 0.001);
          // Reflect velocity along normal with restitution and apply tangential friction
          var v = ${particleVar}.velocity;
          let relN = dot(v, n);
          if (relN < 0.0) {
            let e = ${getUniform("restitution")};
            let mu = clamp(${getUniform("friction")}, 0.0, 1.0);
            let vt = v - n * relN;
            let vReflected = v - n * (relN * (1.0 + e));
            let vtScaled = vt * (1.0 - mu);
            ${particleVar}.velocity = vReflected + (vtScaled - vt);
          }
          break;
        }
      }
      if (collided) { break; }
    }
  }

  // Joint-segment CCD for joints incident to this particle against other joints
  if (${getUniform("enableCollisions")} > 0.0 && hasJoint) {
    let stepsJS: u32 = max(1u, u32(${getUniform("steps")}));
    for (var j0 = 0u; j0 < jointCount; j0++) {
      let a0 = u32(${getUniform("aIndexes", "j0")});
      let b0 = u32(${getUniform("bIndexes", "j0")});
      var incident = (a0 == index) || (b0 == index);
      if (!incident) { continue; }
      var otherIdx: u32 = a0;
      if (a0 == index) { otherIdx = b0; } else { otherIdx = a0; }
      // Previous positions of both endpoints
      let prevAx = ${getState("prevX")};
      let prevAy = ${getState("prevY")};
      let prevBx = ${getState("prevX", "otherIdx")};
      let prevBy = ${getState("prevY", "otherIdx")};

      for (var sstep2 = 1u; sstep2 <= stepsJS; sstep2++) {
        let t2 = f32(sstep2) / f32(stepsJS);
        let Apos = mix(vec2<f32>(prevAx, prevAy), ${particleVar}.position, t2);
        let Bpos = mix(vec2<f32>(prevBx, prevBy), particles[otherIdx].position, t2);
        // Test against all other joints
        var separated = false;
        for (var k0 = 0u; k0 < jointCount; k0++) {
          if (k0 == j0) { continue; }
          let cIdx = u32(${getUniform("aIndexes", "k0")});
          let dIdx = u32(${getUniform("bIndexes", "k0")});
          if (cIdx == a0 || cIdx == b0 || dIdx == a0 || dIdx == b0) { continue; }
          // Skip same rigid body using precomputed groupIds
          let gidA0 = i32(${getUniform("groupIds", "a0")});
          let gidB0 = i32(${getUniform("groupIds", "b0")});
          let gidC0 = i32(${getUniform("groupIds", "cIdx")});
          let gidD0 = i32(${getUniform("groupIds", "dIdx")});
          if ((gidA0 >= 0 && gidC0 >= 0 && gidA0 == gidC0) || (gidA0 >= 0 && gidD0 >= 0 && gidA0 == gidD0) ||
              (gidB0 >= 0 && gidC0 >= 0 && gidB0 == gidC0) || (gidB0 >= 0 && gidD0 >= 0 && gidB0 == gidD0)) {
            continue;
          }
          let Cpos = particles[cIdx].position;
          let Dpos = particles[dIdx].position;
          // Segment intersect test between Apos->Bpos and Cpos->Dpos
          let r = Bpos - Apos;
          let s = Dpos - Cpos;
          let rxs = r.x * s.y - r.y * s.x;
          if (abs(rxs) < 1e-6) { continue; }
          let q_p = Cpos - Apos;
          let tA = (q_p.x * s.y - q_p.y * s.x) / rxs;
          let uA = (q_p.x * r.y - q_p.y * r.x) / rxs;
          if (tA >= 0.0 && tA <= 1.0 && uA >= 0.0 && uA <= 1.0) {
            // Found crossing; push current particle endpoint out along midpoint normal
            let mAB = (Apos + Bpos) * 0.5;
            let mCD = (Cpos + Dpos) * 0.5;
            let diff = mAB - mCD;
            let len2 = dot(diff, diff);
            var n = vec2<f32>(0.0, 1.0);
            if (len2 > 1e-6) {
              n = diff / sqrt(len2);
            }
            let sep = ${getUniform("separation")};
            ${particleVar}.position = ${particleVar}.position + n * sep;
            separated = true;
            break;
          }
        }
        if (separated) { break; }
      }
    }
  }

  let momentum = ${getUniform("momentum")};
  if (momentum <= 0.0 || !hasJoint) { return; }
  
  // Get stored pre-physics position
  let prevX2 = ${getState("prevX")};
  let prevY2 = ${getState("prevY")};
  let prevPos = vec2<f32>(prevX2, prevY2);
  
  // Calculate actual total movement (from pre-physics to post-constraint)
  let totalMovement = ${particleVar}.position - prevPos;
  let actualVelocity = totalMovement / ${dtVar};
  
  // Blend current velocity with actual movement velocity
  ${particleVar}.velocity = ${particleVar}.velocity * (1.0 - momentum) + actualVelocity * momentum;
}`,
    };
  }

  cpu(): CPUDescriptor<JointsInputs, "prevX" | "prevY"> {
    return {
      states: ["prevX", "prevY"] as const,

      // Store pre-physics positions for momentum preservation
      state: ({ particle, setState, input }) => {
        // Store current position before physics integration (only for particles with joints)
        const jointCount = Math.min(
          input.aIndexes.length,
          input.bIndexes.length
        );

        if (jointCount > 0) {
          setState("prevX", particle.position.x);
          setState("prevY", particle.position.y);
        }
      },

      // Force part: apply distance constraints with inverse-mass split
      constrain: ({ particle, index, particles, input }) => {
        if (particle.mass === 0) return;
        const a = input.aIndexes;
        const b = input.bIndexes;
        const rest = input.restLengths;
        const count = Math.min(a.length, b.length, rest.length);
        for (let j = 0; j < count; j++) {
          const ia = a[j] >>> 0;
          const ib = b[j] >>> 0;
          if (ia !== index && ib !== index) continue;
          const otherIndex = ia === index ? ib : ia;
          const other = particles[otherIndex];
          if (!other) continue;
          if (other.mass === 0) continue; // removed
          const dx = other.position.x - particle.position.x;
          const dy = other.position.y - particle.position.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 1e-8) continue;
          const dist = Math.sqrt(dist2);
          const rl = rest[j] ?? dist;
          const diff = dist - rl;
          if (Math.abs(diff) < 1e-6) continue;
          const invM_self = particle.mass > 0 ? 1 / particle.mass : 0;
          const invM_other = other.mass > 0 ? 1 / other.mass : 0;
          const invSum = invM_self + invM_other;
          if (invSum <= 0) continue; // both pinned
          const nx = dx / dist;
          const ny = dy / dist;
          const corrMag = diff * (invM_self / invSum);
          particle.position.x += nx * corrMag;
          particle.position.y += ny * corrMag;
        }

        // Optional collision handling
        const enableCollisions = input.enableCollisions;
        if (enableCollisions > 0 && particle.mass > 0) {
          // Particle vs Joint: deepest overlap
          let bestOverlap = 0;
          let bestNx = 0;
          let bestNy = 0;
          for (let j2 = 0; j2 < count; j2++) {
            const ia2 = a[j2] >>> 0;
            const ib2 = b[j2] >>> 0;
            if (ia2 === index || ib2 === index) continue;
            const A = particles[ia2];
            const B = particles[ib2];
            if (!A || !B) continue;
            if (A.mass === 0 || B.mass === 0) continue;
            const ABx = B.position.x - A.position.x;
            const ABy = B.position.y - A.position.y;
            const AB2 = ABx * ABx + ABy * ABy;
            if (AB2 < 1e-8) continue;
            const APx = particle.position.x - A.position.x;
            const APy = particle.position.y - A.position.y;
            let t = (APx * ABx + APy * ABy) / AB2;
            t = Math.max(0, Math.min(1, t));
            const cx = A.position.x + ABx * t;
            const cy = A.position.y + ABy * t;
            const pcx = particle.position.x - cx;
            const pcy = particle.position.y - cy;
            const d2 = pcx * pcx + pcy * pcy;
            const r = particle.size;
            if (d2 < r * r && d2 > 1e-8) {
              const d = Math.sqrt(d2);
              const overlap = r - d;
              if (overlap > bestOverlap) {
                bestOverlap = overlap;
                bestNx = pcx / d;
                bestNy = pcy / d;
              }
            }
          }
          if (bestOverlap > 0) {
            const push = Math.min(bestOverlap * 0.6, particle.size);
            particle.position.x += bestNx * push;
            particle.position.y += bestNy * push;
            const vx = particle.velocity.x;
            const vy = particle.velocity.y;
            const relN = vx * bestNx + vy * bestNy;
            const tx = vx - bestNx * relN;
            const ty = vy - bestNy * relN;
            if (relN < 0) {
              const e = input.restitution as number;
              const mu = Math.max(0, Math.min(1, input.friction as number));
              const vRx = vx - bestNx * (relN * (1 + e));
              const vRy = vy - bestNy * (relN * (1 + e));
              const vtScaledX = tx * (1 - mu);
              const vtScaledY = ty * (1 - mu);
              particle.velocity.x = vRx + (vtScaledX - tx);
              particle.velocity.y = vRy + (vtScaledY - ty);
            }
          }

          // Joint vs Joint: for joints incident to this particle, nudge on intersection
          for (let j3 = 0; j3 < count; j3++) {
            const ia3 = a[j3] >>> 0;
            const ib3 = b[j3] >>> 0;
            const isIncident = ia3 === index || ib3 === index;
            if (!isIncident) continue;
            const A1 = particles[ia3];
            const B1 = particles[ib3];
            if (!A1 || !B1) continue;
            const x1 = A1.position.x,
              y1 = A1.position.y;
            const x2 = B1.position.x,
              y2 = B1.position.y;
            for (let k = 0; k < count; k++) {
              if (k === j3) continue;
              const ia4 = a[k] >>> 0;
              const ib4 = b[k] >>> 0;
              if (ia4 === ia3 || ia4 === ib3 || ib4 === ia3 || ib4 === ib3)
                continue;
              // Skip same rigid body using groupIds
              const gidA = (input.groupIds as number[])[ia3] ?? -1;
              const gidB = (input.groupIds as number[])[ib3] ?? -1;
              const gidC = (input.groupIds as number[])[ia4] ?? -1;
              const gidD = (input.groupIds as number[])[ib4] ?? -1;
              if (
                (gidA >= 0 && gidC >= 0 && gidA === gidC) ||
                (gidA >= 0 && gidD >= 0 && gidA === gidD) ||
                (gidB >= 0 && gidC >= 0 && gidB === gidC) ||
                (gidB >= 0 && gidD >= 0 && gidB === gidD)
              ) {
                continue;
              }
              const A2 = particles[ia4];
              const B2 = particles[ib4];
              if (!A2 || !B2) continue;
              const x3 = A2.position.x,
                y3 = A2.position.y;
              const x4 = B2.position.x,
                y4 = B2.position.y;
              const dx1 = x2 - x1,
                dy1 = y2 - y1;
              const dx2 = x4 - x3,
                dy2 = y4 - y3;
              const denom = dx1 * dy2 - dy1 * dx2;
              if (Math.abs(denom) < 1e-6) continue;
              const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denom;
              const u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denom;
              if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                const m1x = (x1 + x2) * 0.5,
                  m1y = (y1 + y2) * 0.5;
                const m2x = (x3 + x4) * 0.5,
                  m2y = (y3 + y4) * 0.5;
                let nx = m1x - m2x;
                let ny = m1y - m2y;
                const n2 = nx * nx + ny * ny;
                if (n2 < 1e-6) {
                  const ang =
                    (Math.sin(index * 12.9898) -
                      Math.floor(Math.sin(index * 12.9898))) *
                    Math.PI *
                    2;
                  nx = Math.cos(ang);
                  ny = Math.sin(ang);
                } else {
                  const nlen = Math.sqrt(n2);
                  nx /= nlen;
                  ny /= nlen;
                }
                const sep = (input.separation as number) ?? 0.12;
                particle.position.x += nx * sep;
                particle.position.y += ny * sep;
                // no velocity impulse; rely on positional nudge and engine iterations
                break;
              }
            }
          }
        }
      },

      // CCD against joints with substeps, then apply momentum preservation after constraint solving
      correct: ({ particle, getState, dt, prevPos, particles, input }) => {
        if (dt <= 0) return;
        // Substep CCD on CPU path
        const enableCollisions = input.enableCollisions as number;
        if (enableCollisions > 0) {
          const a = input.aIndexes;
          const b = input.bIndexes;
          const count = Math.min(a.length, b.length);
          const p0x = prevPos.x,
            p0y = prevPos.y;
          const p1x = particle.position.x,
            p1y = particle.position.y;
          const r = particle.size;
          const steps = Math.max(
            1,
            Math.min(128, Math.floor((input.steps as number) || 1))
          );
          outer: for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const psx = p0x + (p1x - p0x) * t;
            const psy = p0y + (p1y - p0y) * t;
            for (let j = 0; j < count; j++) {
              const ia = a[j] >>> 0;
              const ib = b[j] >>> 0;
              if (ia === particle.id || ib === particle.id) continue;
              const A = particles[ia];
              const B = particles[ib];
              if (!A || !B) continue;
              const abx = B.position.x - A.position.x;
              const aby = B.position.y - A.position.y;
              const ab2 = abx * abx + aby * aby;
              if (ab2 < 1e-8) continue;
              const apx = psx - A.position.x;
              const apy = psy - A.position.y;
              let u = (apx * abx + apy * aby) / ab2;
              if (u < 0) u = 0;
              else if (u > 1) u = 1;
              const cx = A.position.x + abx * u;
              const cy = A.position.y + aby * u;
              const pcx = psx - cx;
              const pcy = psy - cy;
              const d2 = pcx * pcx + pcy * pcy;
              if (d2 < r * r && d2 > 1e-10) {
                const d = Math.sqrt(d2);
                const nx = pcx / d;
                const ny = pcy / d;
                particle.position.x = cx + nx * (r + 0.001);
                particle.position.y = cy + ny * (r + 0.001);
                const vx = particle.velocity.x;
                const vy = particle.velocity.y;
                const relN = vx * nx + vy * ny;
                const tx = vx - nx * relN;
                const ty = vy - ny * relN;
                if (relN < 0) {
                  const e = input.restitution as number;
                  const mu = Math.max(0, Math.min(1, input.friction as number));
                  const vRx = vx - nx * (relN * (1 + e));
                  const vRy = vy - ny * (relN * (1 + e));
                  const vtScaledX = tx * (1 - mu);
                  const vtScaledY = ty * (1 - mu);
                  particle.velocity.x = vRx + (vtScaledX - tx);
                  particle.velocity.y = vRy + (vtScaledY - ty);
                }
                break outer;
              }
            }
          }
        }

        // Joint-segment CCD for joints incident to this particle against other joints (CPU)
        if (enableCollisions > 0) {
          const steps = Math.max(
            1,
            Math.min(128, Math.floor((input.steps as number) || 1))
          );
          const a2 = input.aIndexes;
          const b2 = input.bIndexes;
          const count2 = Math.min(a2.length, b2.length);
          for (let j0 = 0; j0 < count2; j0++) {
            const a0 = a2[j0] >>> 0;
            const b0 = b2[j0] >>> 0;
            const incident = a0 === particle.id || b0 === particle.id;
            if (!incident) continue;
            const otherIdx = a0 === particle.id ? b0 : a0;

            const prevAx = getState("prevX");
            const prevAy = getState("prevY");
            const prevBx = getState("prevX", otherIdx);
            const prevBy = getState("prevY", otherIdx);

            outer2: for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const Aposx = prevAx + (particle.position.x - prevAx) * t;
              const Aposy = prevAy + (particle.position.y - prevAy) * t;
              const Bcur = particles[otherIdx];
              if (!Bcur) break;
              const Bposx = prevBx + (Bcur.position.x - prevBx) * t;
              const Bposy = prevBy + (Bcur.position.y - prevBy) * t;

              for (let k0 = 0; k0 < count2; k0++) {
                if (k0 === j0) continue;
                const cIdx = a2[k0] >>> 0;
                const dIdx = b2[k0] >>> 0;
                if (cIdx === a0 || cIdx === b0 || dIdx === a0 || dIdx === b0)
                  continue;
                // Skip same rigid body using precomputed groupIds
                const gidA0 = (input.groupIds as number[])[a0] ?? -1;
                const gidB0 = (input.groupIds as number[])[b0] ?? -1;
                const gidC0 = (input.groupIds as number[])[cIdx] ?? -1;
                const gidD0 = (input.groupIds as number[])[dIdx] ?? -1;
                if (
                  (gidA0 >= 0 && gidC0 >= 0 && gidA0 === gidC0) ||
                  (gidA0 >= 0 && gidD0 >= 0 && gidA0 === gidD0) ||
                  (gidB0 >= 0 && gidC0 >= 0 && gidB0 === gidC0) ||
                  (gidB0 >= 0 && gidD0 >= 0 && gidB0 === gidD0)
                ) {
                  continue;
                }
                const C = particles[cIdx];
                const D = particles[dIdx];
                if (!C || !D) continue;
                const Cx = C.position.x,
                  Cy = C.position.y;
                const Dx = D.position.x,
                  Dy = D.position.y;

                const rx = Bposx - Aposx,
                  ry = Bposy - Aposy;
                const sx = Dx - Cx,
                  sy = Dy - Cy;
                const rxs = rx * sy - ry * sx;
                if (Math.abs(rxs) < 1e-6) continue;
                const qpx = Cx - Aposx,
                  qpy = Cy - Aposy;
                const tA = (qpx * sy - qpy * sx) / rxs;
                const uA = (qpx * ry - qpy * rx) / rxs;
                if (tA >= 0 && tA <= 1 && uA >= 0 && uA <= 1) {
                  const mABx = (Aposx + Bposx) * 0.5;
                  const mABy = (Aposy + Bposy) * 0.5;
                  const mCDx = (Cx + Dx) * 0.5;
                  const mCDy = (Cy + Dy) * 0.5;
                  let nx = mABx - mCDx;
                  let ny = mABy - mCDy;
                  const n2 = nx * nx + ny * ny;
                  if (n2 < 1e-9) {
                    nx = 0;
                    ny = 1;
                  } else {
                    const inv = 1 / Math.sqrt(n2);
                    nx *= inv;
                    ny *= inv;
                  }
                  const sep = (input.separation as number) ?? 0.12;
                  particle.position.x += nx * sep;
                  particle.position.y += ny * sep;
                  break outer2;
                }
              }
            }
          }
        }

        const momentum = this.readValue("momentum") as number;
        if (momentum <= 0) return;

        // Check if this particle has any joints
        const a = (this.readArray("aIndexes") as number[]) || [];
        const b = (this.readArray("bIndexes") as number[]) || [];
        const hasJoints = a.includes(particle.id) || b.includes(particle.id);

        if (!hasJoints) return;

        // Get stored pre-physics position
        const prevX = getState("prevX");
        const prevY = getState("prevY");

        // Calculate actual total movement (from pre-physics to post-constraint)
        const totalMovementX = particle.position.x - prevX;
        const totalMovementY = particle.position.y - prevY;
        const actualVelocityX = totalMovementX / dt;
        const actualVelocityY = totalMovementY / dt;

        // Blend current velocity with actual movement velocity
        particle.velocity.x =
          particle.velocity.x * (1 - momentum) + actualVelocityX * momentum;
        particle.velocity.y =
          particle.velocity.y * (1 - momentum) + actualVelocityY * momentum;
      },
    };
  }
}
