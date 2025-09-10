export const trailDecayShaderWGSL = `
struct TrailUniforms {
  canvas_size: vec2<f32>,
  decay_rate: f32,
  background_color: vec3<f32>,
  _padding: f32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> trail_uniforms: TrailUniforms;

@compute @workgroup_size(8, 8)
fn trail_decay(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coords = vec2<i32>(i32(global_id.x), i32(global_id.y));
  let dimensions = textureDimensions(input_texture);
  
  if (coords.x >= i32(dimensions.x) || coords.y >= i32(dimensions.y)) {
    return;
  }
  
  // Read current pixel color
  let current_color = textureLoad(input_texture, coords, 0);
  
  // Apply trail decay by interpolating toward background color
  let background = vec4<f32>(trail_uniforms.background_color, 0.0);
  let decay_factor = trail_uniforms.decay_rate;
  
  // Ensure minimum decay to prevent permanent trails
  let min_decay = 0.001;
  let effective_decay = max(decay_factor, min_decay);
  
  // Interpolate between current color and background
  let final_color = mix(current_color, background, effective_decay);
  
  textureStore(output_texture, coords, final_color);
}
`;

export const trailBlurShaderWGSL = `
struct BlurUniforms {
  canvas_size: vec2<f32>,
  blur_radius: f32,
  _padding: f32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> blur_uniforms: BlurUniforms;

// Gaussian blur kernel weights (5x5)
const blur_weights = array<f32, 25>(
  1.0/256.0,  4.0/256.0,  6.0/256.0,  4.0/256.0, 1.0/256.0,
  4.0/256.0, 16.0/256.0, 24.0/256.0, 16.0/256.0, 4.0/256.0,
  6.0/256.0, 24.0/256.0, 36.0/256.0, 24.0/256.0, 6.0/256.0,
  4.0/256.0, 16.0/256.0, 24.0/256.0, 16.0/256.0, 4.0/256.0,
  1.0/256.0,  4.0/256.0,  6.0/256.0,  4.0/256.0, 1.0/256.0
);

@compute @workgroup_size(8, 8)
fn trail_blur(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coords = vec2<i32>(i32(global_id.x), i32(global_id.y));
  let dimensions = textureDimensions(input_texture);
  
  if (coords.x >= i32(dimensions.x) || coords.y >= i32(dimensions.y)) {
    return;
  }
  
  var blurred_color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  let radius = i32(blur_uniforms.blur_radius);
  
  // Apply 5x5 Gaussian blur if radius > 0
  if (radius > 0) {
    var weight_index = 0;
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        let sample_coords = coords + vec2<i32>(dx, dy);
        
        // Clamp to texture bounds
        let clamped_coords = clamp(
          sample_coords, 
          vec2<i32>(0, 0), 
          vec2<i32>(i32(dimensions.x) - 1, i32(dimensions.y) - 1)
        );
        
        let sample_color = textureLoad(input_texture, clamped_coords, 0);
        blurred_color += sample_color * blur_weights[weight_index];
        weight_index++;
      }
    }
  } else {
    // No blur, just copy the pixel
    blurred_color = textureLoad(input_texture, coords, 0);
  }
  
  textureStore(output_texture, coords, blurred_color);
}
`;