/**
 * WebGL2 Shaders
 *
 * GLSL shader sources for particle simulation and rendering
 */

/**
 * Fullscreen quad vertex shader
 * Used for simulation passes (rendering to texture)
 */
export const fullscreenVertexShader = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Integration pass: integrate velocity into position, reset acceleration
 * Reads from particle texture, writes updated state
 */
export const integrateFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_particleTexture;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform int u_particleCount;

// Helper to get particle data texel index from particle ID
vec2 getTexelCoord(int particleId, int texelOffset) {
  int texelIndex = particleId * 3 + texelOffset;
  int x = texelIndex % int(1.0 / u_texelSize.x);
  int y = texelIndex / int(1.0 / u_texelSize.x);
  return vec2(float(x), float(y)) * u_texelSize + u_texelSize * 0.5;
}

void main() {
  // Determine which texel and which particle we're processing
  ivec2 texelCoord = ivec2(gl_FragCoord.xy);
  int texelIndex = texelCoord.y * int(1.0 / u_texelSize.x) + texelCoord.x;
  int particleId = texelIndex / 3;
  int texelOffset = texelIndex % 3;

  // If this texel is beyond active particles, pass through
  if (particleId >= u_particleCount) {
    fragColor = texelFetch(u_particleTexture, texelCoord, 0);
    return;
  }

  // Read particle data
  vec2 coord0 = getTexelCoord(particleId, 0);
  vec2 coord1 = getTexelCoord(particleId, 1);
  vec2 coord2 = getTexelCoord(particleId, 2);

  vec4 texel0 = texture(u_particleTexture, coord0); // pos.xy, vel.xy
  vec4 texel1 = texture(u_particleTexture, coord1); // ax, ay, size, mass
  vec4 texel2 = texture(u_particleTexture, coord2); // color

  // Integrate (Verlet integration)
  if (texelOffset == 0) {
    // Update position and velocity
    vec2 position = texel0.xy;
    vec2 velocity = texel0.zw;
    vec2 acceleration = texel1.xy;

    // v += a * dt
    velocity += acceleration * u_dt;
    // p += v * dt
    position += velocity * u_dt;

    fragColor = vec4(position, velocity);
  } else if (texelOffset == 1) {
    // Reset acceleration to zero, keep size and mass
    fragColor = vec4(0.0, 0.0, texel1.zw);
  } else {
    // Pass through color unchanged
    fragColor = texel2;
  }
}
`;

/**
 * Particle rendering vertex shader
 * Renders particles as points
 */
export const particleVertexShader = `#version 300 es
precision highp float;

uniform sampler2D u_particleTexture;
uniform vec2 u_texelSize;
uniform int u_particleCount;
uniform vec2 u_viewOffset;
uniform float u_viewZoom;
uniform vec2 u_viewSize;

out vec4 v_color;
out float v_mass;

// Helper to get particle data texel coord from particle ID
vec2 getTexelCoord(int particleId, int texelOffset) {
  int texelIndex = particleId * 3 + texelOffset;
  int x = texelIndex % int(1.0 / u_texelSize.x);
  int y = texelIndex / int(1.0 / u_texelSize.x);
  return vec2(float(x), float(y)) * u_texelSize + u_texelSize * 0.5;
}

void main() {
  int particleId = gl_VertexID;

  if (particleId >= u_particleCount) {
    // Hide particle by placing it outside clip space
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_color = vec4(0.0);
    v_mass = 1.0;
    return;
  }

  // Read particle data from texture
  vec2 coord0 = getTexelCoord(particleId, 0);
  vec2 coord1 = getTexelCoord(particleId, 1);
  vec2 coord2 = getTexelCoord(particleId, 2);

  vec4 texel0 = texture(u_particleTexture, coord0); // pos.xy, vel.xy
  vec4 texel1 = texture(u_particleTexture, coord1); // ax, ay, size, mass
  vec4 texel2 = texture(u_particleTexture, coord2); // color

  vec2 position = texel0.xy;
  float size = texel1.z;
  float mass = texel1.w;
  v_color = texel2;
  v_mass = mass;

  // Transform to view space
  vec2 viewPos = (position - u_viewOffset) * u_viewZoom;

  // Convert to clip space (-1 to 1)
  vec2 clipPos = (viewPos / u_viewSize) * 2.0;

  gl_Position = vec4(clipPos, 0.0, 1.0);
  gl_PointSize = size * u_viewZoom;
}
`;

/**
 * Particle rendering fragment shader
 * Supports three color modes: Default (0), Custom (1), Hue (2)
 * Renders pinned particles (mass < 0) as hollow circles
 */
export const particleFragmentShader = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_mass;
out vec4 fragColor;

uniform float u_colorType;
uniform vec3 u_customColor;
uniform float u_hue;

// HSV to RGB conversion (S=1, V=1)
vec3 hueToRGB(float h) {
  float h6 = fract(h) * 6.0;
  float i = floor(h6);
  float f = h6 - i;
  float q = 1.0 - f;

  if (i < 1.0) {
    return vec3(1.0, f, 0.0);
  } else if (i < 2.0) {
    return vec3(q, 1.0, 0.0);
  } else if (i < 3.0) {
    return vec3(0.0, 1.0, f);
  } else if (i < 4.0) {
    return vec3(0.0, q, 1.0);
  } else if (i < 5.0) {
    return vec3(f, 0.0, 1.0);
  } else {
    return vec3(1.0, 0.0, q);
  }
}

void main() {
  // Calculate distance from center
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float dist = length(coord);

  // Determine base color based on colorType
  vec4 baseColor = v_color;
  if (u_colorType == 1.0) {
    // Custom color mode
    baseColor = vec4(u_customColor, 1.0);
  } else if (u_colorType == 2.0) {
    // Hue color mode
    vec3 rgb = hueToRGB(u_hue);
    baseColor = vec4(rgb, 1.0);
  }

  vec3 finalColor = baseColor.rgb;
  float finalAlpha = baseColor.a;

  // Pinned particles (mass < 0) render as hollow circles (donut shape)
  if (v_mass < 0.0) {
    // Create hollow ring effect
    float innerRadius = 0.30;
    float outerRadius = 0.45;
    float edgeSmooth = 0.05;

    // Discard if outside outer radius
    if (dist > outerRadius + edgeSmooth) {
      discard;
    }

    // Calculate ring alpha based on distance
    float ringAlpha = 1.0 - smoothstep(outerRadius - edgeSmooth, outerRadius + edgeSmooth, dist);
    ringAlpha = ringAlpha * smoothstep(innerRadius - edgeSmooth, innerRadius + edgeSmooth, dist);

    finalAlpha = finalAlpha * ringAlpha;
  } else {
    // Normal solid particle
    if (dist > 0.5) {
      discard;
    }
    finalAlpha = finalAlpha * (1.0 - smoothstep(0.45, 0.5, dist));
  }

  fragColor = vec4(finalColor, finalAlpha);
}
`;

/**
 * Copy shader for presenting scene to canvas
 */
export const copyVertexShader = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const copyFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_sceneTexture;

void main() {
  fragColor = texture(u_sceneTexture, v_texCoord);
}
`;

/**
 * Force application pass: apply forces to particle acceleration
 * This is a generic force shader that will be dynamically generated
 * based on enabled modules
 */
export function generateForceFragmentShader(forceCode: string): string {
  return `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_particleTexture;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform int u_particleCount;

// View uniforms for grid calculations
uniform vec2 u_viewOffset;
uniform float u_viewZoom;
uniform vec2 u_viewSize;

// Module-specific uniforms will be added here dynamically

// Helper to get particle data texel index from particle ID
vec2 getTexelCoord(int particleId, int texelOffset) {
  int texelIndex = particleId * 3 + texelOffset;
  int x = texelIndex % int(1.0 / u_texelSize.x);
  int y = texelIndex / int(1.0 / u_texelSize.x);
  return vec2(float(x), float(y)) * u_texelSize + u_texelSize * 0.5;
}

// Grid boundary helpers (matches WebGPU GRID_* macros)
float GRID_MINX() {
  float halfW = u_viewSize.x / (2.0 * max(u_viewZoom, 0.0001));
  return u_viewOffset.x - halfW;
}

float GRID_MAXX() {
  float halfW = u_viewSize.x / (2.0 * max(u_viewZoom, 0.0001));
  return u_viewOffset.x + halfW;
}

float GRID_MINY() {
  float halfH = u_viewSize.y / (2.0 * max(u_viewZoom, 0.0001));
  return u_viewOffset.y - halfH;
}

float GRID_MAXY() {
  float halfH = u_viewSize.y / (2.0 / max(u_viewZoom, 0.0001));
  return u_viewOffset.y + halfH;
}

// Particle struct (logical representation)
struct Particle {
  vec2 position;
  vec2 velocity;
  vec2 acceleration;
  float size;
  float mass;
  vec4 color;
};

void main() {
  // Determine which texel and which particle we're processing
  ivec2 texelCoord = ivec2(gl_FragCoord.xy);
  int texelIndex = texelCoord.y * int(1.0 / u_texelSize.x) + texelCoord.x;
  int particleId = texelIndex / 3;
  int texelOffset = texelIndex % 3;

  // If this texel is beyond active particles, pass through
  if (particleId >= u_particleCount) {
    fragColor = texelFetch(u_particleTexture, texelCoord, 0);
    return;
  }

  // Read particle data
  vec2 coord0 = getTexelCoord(particleId, 0);
  vec2 coord1 = getTexelCoord(particleId, 1);
  vec2 coord2 = getTexelCoord(particleId, 2);

  vec4 texel0 = texture(u_particleTexture, coord0); // pos.xy, vel.xy
  vec4 texel1 = texture(u_particleTexture, coord1); // ax, ay, size, mass
  vec4 texel2 = texture(u_particleTexture, coord2); // color

  // Build particle struct
  Particle p;
  p.position = texel0.xy;
  p.velocity = texel0.zw;
  p.acceleration = texel1.xy;
  p.size = texel1.z;
  p.mass = texel1.w;
  p.color = texel2;

  // Apply forces (dynamically injected code)
${forceCode}

  // Write back modified data
  if (texelOffset == 0) {
    // Position and velocity unchanged in force pass
    fragColor = texel0;
  } else if (texelOffset == 1) {
    // Updated acceleration, keep size and mass
    fragColor = vec4(p.acceleration, texel1.zw);
  } else {
    // Color unchanged
    fragColor = texel2;
  }
}
`;
}

/**
 * Grid shader: Assign cellId to each particle
 * Writes cellId to grid texture
 */
export const gridAssignCellsFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_particleTexture;
uniform vec2 u_texelSize;
uniform int u_particleCount;

// Grid uniforms
uniform vec2 u_gridMin;      // minX, minY
uniform vec2 u_gridMax;      // maxX, maxY
uniform vec2 u_gridDims;     // cols, rows
uniform float u_gridCellSize;

// Helper to get particle data
vec2 getTexelCoord(int particleId, int texelOffset) {
  int texelIndex = particleId * 3 + texelOffset;
  int x = texelIndex % int(1.0 / u_texelSize.x);
  int y = texelIndex / int(1.0 / u_texelSize.x);
  return vec2(float(x), float(y)) * u_texelSize + u_texelSize * 0.5;
}

void main() {
  // Each pixel represents one particle
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);
  int particleId = pixelCoord.y * int(1.0 / u_texelSize.x) + pixelCoord.x;

  if (particleId >= u_particleCount) {
    // Out of range, store invalid cell ID
    fragColor = vec4(-1.0, float(particleId), 0.0, 0.0);
    return;
  }

  // Read particle position
  vec2 coord0 = getTexelCoord(particleId, 0);
  vec4 texel0 = texture(u_particleTexture, coord0);
  vec2 position = texel0.xy;

  // Read mass to check if particle is active
  vec2 coord1 = getTexelCoord(particleId, 1);
  vec4 texel1 = texture(u_particleTexture, coord1);
  float mass = texel1.w;

  // Inactive particles (mass == 0) get invalid cell ID
  if (mass == 0.0) {
    fragColor = vec4(-1.0, float(particleId), 0.0, 0.0);
    return;
  }

  // Calculate cell index
  int col = int(floor((position.x - u_gridMin.x) / u_gridCellSize));
  int row = int(floor((position.y - u_gridMin.y) / u_gridCellSize));

  // Clamp to grid bounds
  col = max(0, min(col, int(u_gridDims.x) - 1));
  row = max(0, min(row, int(u_gridDims.y) - 1));

  int cellId = row * int(u_gridDims.x) + col;

  // Store (cellId, particleId) - we'll use this for sorting
  fragColor = vec4(float(cellId), float(particleId), 0.0, 0.0);
}
`;

/**
 * Grid shader: Build cell ranges from sorted indices
 * For each cell, finds the start and count of particles in that cell
 */
export const gridBuildRangesFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_sortedIndices;
uniform vec2 u_sortedTexelSize;
uniform int u_particleCount;
uniform int u_cellCount;

void main() {
  // Each pixel represents one grid cell
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);
  int cellTexWidth = int(1.0 / u_sortedTexelSize.x);
  int cellId = pixelCoord.y * cellTexWidth + pixelCoord.x;

  if (cellId >= u_cellCount) {
    // Out of range
    fragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // Search through sorted particles to find range for this cell
  int start = -1;
  int count = 0;

  int particleTexWidth = int(1.0 / u_sortedTexelSize.x);

  for (int i = 0; i < 100000; i++) {
    if (i >= u_particleCount) break;

    // Read sorted index entry
    int px = i % particleTexWidth;
    int py = i / particleTexWidth;
    vec2 coord = (vec2(float(px), float(py)) + 0.5) * u_sortedTexelSize;
    vec4 entry = texture(u_sortedIndices, coord);

    int entryCellId = int(entry.x);

    if (entryCellId == cellId) {
      if (start == -1) {
        start = i;
      }
      count++;
    } else if (entryCellId > cellId && start != -1) {
      // We've passed this cell's range
      break;
    }
  }

  if (start == -1) {
    start = 0;
    count = 0;
  }

  // Store (start, count) for this cell
  fragColor = vec4(float(start), float(count), 0.0, 0.0);
}
`;

/**
 * Bitonic sort pass for GPU sorting
 * This implements one stage of bitonic sort on (cellId, particleId) pairs
 */
export function generateBitonicSortFragmentShader(
  stage: number,
  step: number
): string {
  return `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_sortedIndices;
uniform vec2 u_texelSize;
uniform int u_particleCount;

const int STAGE = ${stage};
const int STEP = ${step};

void main() {
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);
  int texWidth = int(1.0 / u_texelSize.x);
  int index = pixelCoord.y * texWidth + pixelCoord.x;

  if (index >= u_particleCount) {
    fragColor = texelFetch(u_sortedIndices, pixelCoord, 0);
    return;
  }

  // Bitonic sort logic
  int distance = 1 << (STEP);
  int blockSize = 1 << (STAGE + 1);

  int partner = index ^ distance;

  if (partner >= u_particleCount) {
    fragColor = texelFetch(u_sortedIndices, pixelCoord, 0);
    return;
  }

  // Read current and partner values
  vec4 current = texelFetch(u_sortedIndices, pixelCoord, 0);

  int partnerX = partner % texWidth;
  int partnerY = partner / texWidth;
  vec4 partnerValue = texelFetch(u_sortedIndices, ivec2(partnerX, partnerY), 0);

  float currentKey = current.x;
  float partnerKey = partnerValue.x;

  // Determine sort direction
  bool ascending = ((index / blockSize) % 2) == 0;

  // Swap if needed
  bool shouldSwap = (ascending && currentKey > partnerKey) || (!ascending && currentKey < partnerKey);

  if (shouldSwap && index > partner) {
    fragColor = partnerValue;
  } else if (shouldSwap && index < partner) {
    fragColor = current;
  } else if (!shouldSwap && index > partner) {
    fragColor = current;
  } else {
    fragColor = partnerValue;
  }

  // Simpler: just output current if lower index, partner if higher index after swap decision
  if (shouldSwap) {
    fragColor = (index < partner) ? partnerValue : current;
  } else {
    fragColor = current;
  }
}
`;
}

/**
 * GLSL helper functions for neighbor iteration
 * These are included in shaders that need neighbor queries
 */
export const neighborIteratorHelpers = `
// Neighbor query helpers
uniform sampler2D u_gridCellRanges;
uniform sampler2D u_gridSortedIndices;
uniform vec2 u_gridCellRangesTexelSize;
uniform vec2 u_gridSortedIndicesTexelSize;
uniform vec2 u_gridMin;
uniform vec2 u_gridMax;
uniform vec2 u_gridDims;
uniform float u_gridCellSize;
uniform int u_maxNeighbors;

// Get cell index from position
int gridCellIndex(vec2 pos) {
  int col = int(floor((pos.x - u_gridMin.x) / u_gridCellSize));
  int row = int(floor((pos.y - u_gridMin.y) / u_gridCellSize));
  col = max(0, min(col, int(u_gridDims.x) - 1));
  row = max(0, min(row, int(u_gridDims.y) - 1));
  return row * int(u_gridDims.x) + col;
}

// Get cell index from row/col
int gridCellIndexFromRC(int row, int col) {
  int r = max(0, min(row, int(u_gridDims.y) - 1));
  int c = max(0, min(col, int(u_gridDims.x) - 1));
  return r * int(u_gridDims.x) + c;
}

// Read cell range (start, count) for a cell
vec2 readCellRange(int cellId) {
  int cellTexWidth = int(1.0 / u_gridCellRangesTexelSize.x);
  int cellX = cellId % cellTexWidth;
  int cellY = cellId / cellTexWidth;
  vec2 coord = (vec2(float(cellX), float(cellY)) + 0.5) * u_gridCellRangesTexelSize;
  vec4 range = texture(u_gridCellRanges, coord);
  return range.xy; // (start, count)
}

// Read sorted particle ID at index
int readSortedParticleId(int index) {
  int texWidth = int(1.0 / u_gridSortedIndicesTexelSize.x);
  int px = index % texWidth;
  int py = index / texWidth;
  vec2 coord = (vec2(float(px), float(py)) + 0.5) * u_gridSortedIndicesTexelSize;
  vec4 entry = texture(u_gridSortedIndices, coord);
  return int(entry.y); // particleId is stored in .y component
}

// Iterate neighbors within radius
// Returns array of neighbor IDs (caller must allocate)
// Usage:
//   int neighbors[64];
//   int count = getNeighbors(position, radius, selfIndex, neighbors, 64);
int getNeighbors(vec2 pos, float radius, int selfIndex, out int neighbors[64], int maxCount) {
  int count = 0;

  // Calculate search bounds in grid space
  int centerCol = int(floor((pos.x - u_gridMin.x) / u_gridCellSize));
  int centerRow = int(floor((pos.y - u_gridMin.y) / u_gridCellSize));
  int reach = max(1, int(ceil(radius / u_gridCellSize)));

  // Scan neighboring cells
  for (int dr = -reach; dr <= reach; dr++) {
    for (int dc = -reach; dc <= reach; dc++) {
      int cellId = gridCellIndexFromRC(centerRow + dr, centerCol + dc);
      vec2 range = readCellRange(cellId);
      int start = int(range.x);
      int cellCount = int(range.y);

      // Iterate particles in this cell
      for (int i = 0; i < cellCount; i++) {
        if (count >= maxCount || count >= u_maxNeighbors) {
          return count;
        }

        int particleId = readSortedParticleId(start + i);
        if (particleId != selfIndex) {
          neighbors[count] = particleId;
          count++;
        }
      }
    }
  }

  return count;
}
`;

