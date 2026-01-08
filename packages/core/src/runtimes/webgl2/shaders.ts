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
  v_color = texel2;

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
 */
export const particleFragmentShader = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  // Draw circular particles
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float dist = length(coord);
  if (dist > 1.0) {
    discard;
  }

  // Soft edge
  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
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
