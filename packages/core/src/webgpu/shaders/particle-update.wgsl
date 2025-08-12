/**
 * Particle Position Update Compute Shader
 * 
 * This shader handles basic particle physics integration including
 * position updates, velocity integration, and boundary handling.
 * Optimized for high-throughput processing of thousands of particles.
 */

// Particle structure matching CPU layout
struct Particle {
    position: vec2<f32>,        // Current position (x, y)
    velocity: vec2<f32>,        // Current velocity (vx, vy)
    acceleration: vec2<f32>,    // Current acceleration (ax, ay)
    mass: f32,                  // Particle mass
    size: f32,                  // Particle radius/size
    color: vec4<f32>,           // Particle color (r, g, b, a)
    lifetime: vec2<f32>,        // Lifetime data (age, duration)
    state: u32,                 // State flags bitfield
}

// Physics parameters for the simulation
struct PhysicsParams {
    gravityStrength: f32,       // Strength of gravity
    gravityDirection: vec2<f32>, // Gravity direction vector
    inertia: f32,               // Momentum preservation factor
    friction: f32,              // Friction/damping coefficient
    deltaTime: f32,             // Time step for integration
    boundsWidth: f32,           // Simulation width bounds
    boundsHeight: f32,          // Simulation height bounds
    _padding: f32,              // Padding for alignment
}

// Boundary handling parameters
struct BoundaryParams {
    mode: u32,                  // Boundary mode (0=bounce, 1=wrap, 2=kill)
    bounce: f32,                // Bounce coefficient (0-1)
    friction: f32,              // Boundary friction
    repelDistance: f32,         // Distance for repel force
    repelStrength: f32,         // Strength of repel force
    _padding: vec3<f32>,        // Padding for alignment
}

// Particle state bit flags
const PARTICLE_ACTIVE: u32 = 1u;
const PARTICLE_PINNED: u32 = 2u;
const PARTICLE_GRABBED: u32 = 4u;
const PARTICLE_DEAD: u32 = 8u;
const PARTICLE_BOUNDARY_COLLISION: u32 = 64u;

// Boundary modes
const BOUNDARY_BOUNCE: u32 = 0u;
const BOUNDARY_WRAP: u32 = 1u;
const BOUNDARY_KILL: u32 = 2u;

// Bind group 0: Main particle data and physics params
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> physics: PhysicsParams;
@group(0) @binding(2) var<uniform> boundary: BoundaryParams;

/**
 * Main particle update compute shader
 * Processes particles in parallel using 64 threads per workgroup
 */
@workgroup_size(64, 1, 1)
@compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    // Bounds check - exit if beyond particle array
    if (index >= arrayLength(&particles)) {
        return;
    }
    
    var particle = particles[index];
    
    // Skip processing for inactive, pinned, grabbed, or dead particles
    if ((particle.state & PARTICLE_ACTIVE) == 0u || 
        (particle.state & PARTICLE_PINNED) != 0u ||
        (particle.state & PARTICLE_GRABBED) != 0u ||
        (particle.state & PARTICLE_DEAD) != 0u) {
        return;
    }
    
    // Clear boundary collision flag from previous frame
    particle.state = particle.state & ~PARTICLE_BOUNDARY_COLLISION;
    
    // === FORCE INTEGRATION ===
    
    // Reset acceleration (forces will be accumulated)
    particle.acceleration = vec2<f32>(0.0, 0.0);
    
    // Apply gravity force if enabled
    if (physics.gravityStrength > 0.0) {
        let gravityForce = physics.gravityDirection * physics.gravityStrength;
        particle.acceleration += gravityForce;
    }
    
    // Apply air resistance/friction
    if (physics.friction > 0.0) {
        let drag = -particle.velocity * physics.friction;
        particle.acceleration += drag / max(particle.mass, 0.001); // Avoid division by zero
    }
    
    // === VELOCITY INTEGRATION ===
    
    // Update velocity using acceleration (Verlet integration)
    particle.velocity += particle.acceleration * physics.deltaTime;
    
    // Apply inertia damping (momentum preservation)
    if (physics.inertia < 1.0) {
        particle.velocity *= physics.inertia;
    }
    
    // === POSITION INTEGRATION ===
    
    // Store old position for boundary detection
    let oldPosition = particle.position;
    
    // Update position using velocity
    particle.position += particle.velocity * physics.deltaTime;
    
    // === BOUNDARY HANDLING ===
    
    var boundaryCorrected = false;
    
    // Handle X-axis boundaries
    if (particle.position.x < particle.size) {
        boundaryCorrected = true;
        handleBoundaryCollision(&particle, vec2<f32>(1.0, 0.0), particle.size - particle.position.x);
    } else if (particle.position.x > physics.boundsWidth - particle.size) {
        boundaryCorrected = true;
        let penetration = particle.position.x - (physics.boundsWidth - particle.size);
        handleBoundaryCollision(&particle, vec2<f32>(-1.0, 0.0), penetration);
    }
    
    // Handle Y-axis boundaries  
    if (particle.position.y < particle.size) {
        boundaryCorrected = true;
        handleBoundaryCollision(&particle, vec2<f32>(0.0, 1.0), particle.size - particle.position.y);
    } else if (particle.position.y > physics.boundsHeight - particle.size) {
        boundaryCorrected = true;
        let penetration = particle.position.y - (physics.boundsHeight - particle.size);
        handleBoundaryCollision(&particle, vec2<f32>(0.0, -1.0), penetration);
    }
    
    // Set boundary collision flag if correction occurred
    if (boundaryCorrected) {
        particle.state = particle.state | PARTICLE_BOUNDARY_COLLISION;
    }
    
    // === LIFETIME MANAGEMENT ===
    
    // Update particle age if it has a finite lifetime
    if (particle.lifetime.y > 0.0) {
        particle.lifetime.x += physics.deltaTime * 1000.0; // Convert to milliseconds
        
        // Mark particle as dead if lifetime exceeded
        if (particle.lifetime.x >= particle.lifetime.y) {
            particle.state = particle.state | PARTICLE_DEAD;
        }
    }
    
    // Write the updated particle back to memory
    particles[index] = particle;
}

/**
 * Handle collision with simulation boundaries
 * @param particle - Pointer to particle being updated
 * @param normal - Surface normal of the boundary (unit vector)
 * @param penetration - How far the particle has penetrated the boundary
 */
fn handleBoundaryCollision(particle: ptr<function, Particle>, normal: vec2<f32>, penetration: f32) {
    switch (boundary.mode) {
        case BOUNDARY_BOUNCE: {
            // Bounce mode: reflect velocity and correct position
            
            // Correct position to prevent penetration
            (*particle).position += normal * penetration;
            
            // Calculate velocity component along normal
            let velocityNormal = dot((*particle).velocity, normal);
            
            // Only bounce if moving towards the boundary
            if (velocityNormal < 0.0) {
                // Reflect velocity with bounce coefficient
                (*particle).velocity -= normal * velocityNormal * (1.0 + boundary.bounce);
                
                // Apply boundary friction
                if (boundary.friction > 0.0) {
                    let velocityTangent = (*particle).velocity - normal * dot((*particle).velocity, normal);
                    (*particle).velocity -= velocityTangent * boundary.friction;
                }
            }
        }
        case BOUNDARY_WRAP: {
            // Wrap mode: teleport to opposite side
            if (abs(normal.x) > 0.5) {
                // X-axis wrap
                if (normal.x > 0.0) {
                    (*particle).position.x = physics.boundsWidth - (*particle).size;
                } else {
                    (*particle).position.x = (*particle).size;
                }
            }
            if (abs(normal.y) > 0.5) {
                // Y-axis wrap
                if (normal.y > 0.0) {
                    (*particle).position.y = physics.boundsHeight - (*particle).size;
                } else {
                    (*particle).position.y = (*particle).size;
                }
            }
        }
        case BOUNDARY_KILL: {
            // Kill mode: mark particle as dead
            (*particle).state = (*particle).state | PARTICLE_DEAD;
        }
        default: {
            // Default to bounce behavior
            (*particle).position += normal * penetration;
            let velocityNormal = dot((*particle).velocity, normal);
            if (velocityNormal < 0.0) {
                (*particle).velocity -= normal * velocityNormal * 1.8; // Slight bounce
            }
        }
    }
}

/**
 * Apply boundary repel force when particle is near boundary
 * @param particle - Pointer to particle being updated
 * @param distance - Distance to nearest boundary
 * @param normal - Normal vector pointing away from boundary
 */
fn applyBoundaryRepel(particle: ptr<function, Particle>, distance: f32, normal: vec2<f32>) {
    if (distance < boundary.repelDistance && boundary.repelStrength > 0.0) {
        let repelFactor = 1.0 - (distance / boundary.repelDistance);
        let repelForce = normal * boundary.repelStrength * repelFactor * repelFactor;
        (*particle).acceleration += repelForce / max((*particle).mass, 0.001);
    }
}

/**
 * Clamp position to simulation bounds (fallback safety measure)
 */
fn clampToBounds(position: vec2<f32>, size: f32) -> vec2<f32> {
    return vec2<f32>(
        clamp(position.x, size, physics.boundsWidth - size),
        clamp(position.y, size, physics.boundsHeight - size)
    );
}