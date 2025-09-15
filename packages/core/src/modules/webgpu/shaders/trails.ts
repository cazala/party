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
  // Read current trail color
  let current = textureLoad(input_texture, coords, 0);

  // If no decay, just copy through
  let d = clamp(trail_uniforms.decay_rate, 0.0, 1.0);
  if (d <= 0.00001) {
    textureStore(output_texture, coords, current);
    return;
  }

  // Blend RGB toward background color and fade alpha
  let bg = trail_uniforms.background_color;
  let out_rgb = mix(current.rgb, bg, d);
  let out_a = current.a * (1.0 - d);

  // Snap only when all components are below one LSB to avoid lingering dark gray
  let eps = 1.0 / 255.0;
  if (all(abs(out_rgb - bg) < vec3<f32>(eps)) && out_a < eps) {
    textureStore(output_texture, coords, vec4<f32>(bg, 0.0));
  } else {
    textureStore(output_texture, coords, vec4<f32>(out_rgb, out_a));
  }
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

@compute @workgroup_size(8, 8)
fn trail_blur(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coords = vec2<i32>(i32(global_id.x), i32(global_id.y));
  let dimensions = textureDimensions(input_texture);
  
  if (coords.x >= i32(dimensions.x) || coords.y >= i32(dimensions.y)) {
    return;
  }
  
  let radius_i = clamp(i32(round(blur_uniforms.blur_radius)), 0, 12);
  if (radius_i <= 0) {
    // No blur, just copy the pixel
    let c = textureLoad(input_texture, coords, 0);
    textureStore(output_texture, coords, c);
    return;
  }

  // Variable-radius Gaussian blur. Sigma derived from radius.
  let sigma = max(0.5, f32(radius_i) * 0.5);
  let twoSigma2 = 2.0 * sigma * sigma;

  var sum = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var wsum: f32 = 0.0;
  for (var dy = -radius_i; dy <= radius_i; dy++) {
    for (var dx = -radius_i; dx <= radius_i; dx++) {
      let d2 = f32(dx*dx + dy*dy);
      let w = exp(-d2 / twoSigma2);
      if (w < 1e-5) { continue; }

      let sample_coords = coords + vec2<i32>(dx, dy);
      let clamped_coords = clamp(
        sample_coords,
        vec2<i32>(0, 0),
        vec2<i32>(i32(dimensions.x) - 1, i32(dimensions.y) - 1)
      );
      let c = textureLoad(input_texture, clamped_coords, 0);
      sum += c * w;
      wsum += w;
    }
  }

  if (wsum > 0.0) {
    textureStore(output_texture, coords, sum / vec4<f32>(wsum));
  } else {
    textureStore(output_texture, coords, textureLoad(input_texture, coords, 0));
  }
}
`;
