export class ParticleSimulation {
    constructor(particleCount) {
        this.particleCount = particleCount;
        this.positions = null;
        this.velocities = null;
        this.speedMultiplier = 1.0;
        this.damping = 0.98;
        this.particleRadius = 2.0;
        this.bounds = { width: 1920, height: 1080 };
        
        // Spatial hashing for collision detection
        this.cellSize = 5;
        this.grid = new Map();
        
        // Solid collision shapes
        this.shapes = [];
        this.initialShapeStates = []; // Store initial states
        this.time = 0;
        // Sensors for particle detection (support single or multiple)
        this.sensors = [];
        this.sensorHits = []; // Array of 2D arrays tracking hit intensity for each sensor
        this.sensorResolution = 1; // Pixels per hit cell
        
        
        // Force field visualization
        this.showForceField = false;
        this.forceFieldResolution = 20; // Size of each grid cell in pixels
        this.forceField = null;
        this.forceFieldWidth = 0;
        this.forceFieldHeight = 0;

        // Particle density visualization
        this.showParticleDensity = false;
        this.particleDensity = null;
        this.particleDensityWidth = 0;
        this.particleDensityHeight = 0;
        
        // Particle emitter
        this.emitter = null;
        this.emitterAccumulator = 0;
        this.activeParticles = 0; // Track actually active particles
        this.nextParticleIndex = 0; // Track which particle to reuse next
        
        // Edge collision behavior
        this.wrapEdges = false;
        this.particleCollisions = true;
        
        // Liquid simulation (SPH - Smoothed Particle Hydrodynamics)
        this.liquidConfig = null;
        this.densities = null;
        this.pressures = null;
    }

    init(initType = 'center') {
        // If emitter is managing particles in standalone mode (no emitterStartIndex), skip normal init
        if (this.emitter && this.emitter.maxParticles && this.emitter.emitterStartIndex === undefined) {
            // Allocate arrays if not already allocated
            if (!this.positions) {
                this.positions = new Float32Array(this.particleCount * 2);
                this.velocities = new Float32Array(this.particleCount * 2);
            }
            if (this.sensors.length > 0) this.initSensors();
            this.initCirclePhysics();
            this.initForceField();
            return;
        }
        
        this.positions = new Float32Array(this.particleCount * 2);
        this.velocities = new Float32Array(this.particleCount * 2);

        if (initType === 'center') {
            this.initCenter();
        } else if (initType === 'left') {
            this.initLeft();
        } else if (initType === 'random') {
            this.initRandom();
        } else if (initType === 'static') {
            this.initStatic();
        } else if (initType === 'liquid') {
            this.initLiquid();
        }
        
        if (this.sensors.length > 0) {
            this.initSensors();
        }

        // If emitter uses emitterStartIndex, clear its pool range off-screen and prime activeParticles
        if (this.emitter && this.emitter.maxParticles && this.emitter.emitterStartIndex !== undefined) {
            const poolStart = this.emitter.emitterStartIndex;
            const poolSize = this.emitter.maxParticles;
            const poolEnd = Math.min(poolStart + poolSize, this.particleCount);
            for (let i = poolStart; i < poolEnd; i++) {
                this.positions[i * 2] = -1000;
                this.positions[i * 2 + 1] = -1000;
                this.velocities[i * 2] = 0;
                this.velocities[i * 2 + 1] = 0;
            }
            this.activeParticles = poolStart;
            this.nextParticleIndex = 0;
        }
        
        this.initCirclePhysics();
        this.initForceField();
        this.initParticleDensity();
    }

    initCirclePhysics() {
        this.shapes.forEach(shape => {
            if (shape.type === 'circle' && shape.moveable) {
                // Only initialize if not already explicitly set
                if (shape.vx === undefined) shape.vx = 0;
                if (shape.vy === undefined) shape.vy = 0;
                if (!shape.mass) {
                    shape.mass = Math.PI * shape.radius * shape.radius * 0.01; // Density factor
                }
            }
        });
    }

    initSensors() {
        if (this.sensors.length === 0) return;
        
        this.sensorHits = [];
        for (let i = 0; i < this.sensors.length; i++) {
            const sensor = this.sensors[i];
            const width = Math.ceil(sensor.width / this.sensorResolution);
            const height = Math.ceil(sensor.height / this.sensorResolution);
            
            const hits = new Float32Array(width * height);
            hits.fill(0);
            this.sensorHits.push(hits);
        }
    }

    initForceField() {
        if (!this.showForceField) return;
        
        // Use simulation bounds (in CSS pixels), not canvas resolution
        this.forceFieldWidth = Math.ceil(this.bounds.width / this.forceFieldResolution);
        this.forceFieldHeight = Math.ceil(this.bounds.height / this.forceFieldResolution);
        
        this.forceField = new Float32Array(this.forceFieldWidth * this.forceFieldHeight);
        this.forceField.fill(0);
    }

    initParticleDensity() {
        if (!this.showParticleDensity) return;

        this.particleDensityWidth = Math.ceil(this.bounds.width / this.forceFieldResolution);
        this.particleDensityHeight = Math.ceil(this.bounds.height / this.forceFieldResolution);

        this.particleDensity = new Float32Array(this.particleDensityWidth * this.particleDensityHeight);
        this.particleDensity.fill(0);
    }

    isPointInShape(x, y, shape) {
        const dx = x - shape.x;
        const dy = y - shape.y;
        
        if (shape.type === 'circle') {
            return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
        } else if (shape.type === 'rect') {
            // For rectangles, check against the bounding box
            return x >= shape.x && x <= shape.x + shape.width &&
                   y >= shape.y && y <= shape.y + shape.height;
        }
        return false;
    }

    isPositionOccupied(x, y) {
        for (const shape of this.shapes) {
            if (this.isPointInShape(x, y, shape)) {
                return true;
            }
        }
        return false;
    }

    initCenter() {
        const centerX = this.bounds.width / 2;
        const centerY = this.bounds.height / 2;
        const spawnRadius = 200;

        let placed = 0;
        let attempts = 0;
        const maxTotalAttempts = this.particleCount * 100;

        while (placed < this.particleCount && attempts < maxTotalAttempts) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * spawnRadius;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            attempts++;

            if (!this.isPositionOccupied(x, y)) {
                this.positions[placed * 2] = x;
                this.positions[placed * 2 + 1] = y;

                const speed = 50 + Math.random() * 150;
                const velAngle = Math.random() * Math.PI * 2;
                this.velocities[placed * 2] = Math.cos(velAngle) * speed;
                this.velocities[placed * 2 + 1] = Math.sin(velAngle) * speed;
                
                placed++;
            }
        }
        
        // Update particle count to actual placed particles
        if (placed < this.particleCount) {
            this.particleCount = placed;
        }
    }

    initLeft() {
        const spawnX = 100;
        const spawnHeight = this.bounds.height * 0.6;
        const spawnY = (this.bounds.height - spawnHeight) / 2;

        let placed = 0;
        let attempts = 0;
        const maxTotalAttempts = this.particleCount * 100;

        while (placed < this.particleCount && attempts < maxTotalAttempts) {
            const x = spawnX + Math.random() * 50;
            const y = spawnY + Math.random() * spawnHeight;

            attempts++;

            if (!this.isPositionOccupied(x, y)) {
                this.positions[placed * 2] = x;
                this.positions[placed * 2 + 1] = y;

                const speed = 100 + Math.random() * 100;
                const angle = (Math.random() - 0.5) * 0.3;
                this.velocities[placed * 2] = Math.cos(angle) * speed;
                this.velocities[placed * 2 + 1] = Math.sin(angle) * speed;
                
                placed++;
            }
        }
        
        if (placed < this.particleCount) {
            this.particleCount = placed;
        }
    }

    initRandom() {
        let placed = 0;
        let attempts = 0;
        const maxTotalAttempts = this.particleCount * 100;

        while (placed < this.particleCount && attempts < maxTotalAttempts) {
            const x = Math.random() * this.bounds.width;
            const y = Math.random() * this.bounds.height;

            attempts++;

            if (!this.isPositionOccupied(x, y)) {
                this.positions[placed * 2] = x;
                this.positions[placed * 2 + 1] = y;

                const speed = 50 + Math.random() * 100;
                const angle = Math.random() * Math.PI * 2;
                this.velocities[placed * 2] = Math.cos(angle) * speed;
                this.velocities[placed * 2 + 1] = Math.sin(angle) * speed;
                
                placed++;
            }
        }
        
        if (placed < this.particleCount) {
            this.particleCount = placed;
        }
    }

    initStatic() {
        let placed = 0;
        let attempts = 0;
        const maxTotalAttempts = this.particleCount * 100;

        while (placed < this.particleCount && attempts < maxTotalAttempts) {
            const x = Math.random() * this.bounds.width;
            const y = Math.random() * this.bounds.height;

            attempts++;

            if (!this.isPositionOccupied(x, y)) {
                this.positions[placed * 2] = x;
                this.positions[placed * 2 + 1] = y;
                // Zero velocity - particles only move when hit
                this.velocities[placed * 2] = 0;
                this.velocities[placed * 2 + 1] = 0;
                placed++;
            }
        }

        if (placed < this.particleCount) {
            this.particleCount = placed;
        }
    }

    initLiquid() {
        // Initialize liquid particles in a compact area (top-center)
        const startX = this.bounds.width * 0.3;
        const startY = 100;
        const width = this.bounds.width * 0.4;
        const height = 300;
        const spacing = this.liquidConfig ? this.liquidConfig.smoothingRadius * 0.5 : 8;
        
        let placed = 0;
        for (let y = startY; y < startY + height && placed < this.particleCount; y += spacing) {
            for (let x = startX; x < startX + width && placed < this.particleCount; x += spacing) {
                if (!this.isPositionOccupied(x, y)) {
                    this.positions[placed * 2] = x + (Math.random() - 0.5) * 2;
                    this.positions[placed * 2 + 1] = y + (Math.random() - 0.5) * 2;
                    this.velocities[placed * 2] = 0;
                    this.velocities[placed * 2 + 1] = 0;
                    placed++;
                }
            }
        }
        
        if (placed < this.particleCount) {
            this.particleCount = placed;
        }
        
        // Initialize liquid-specific arrays
        if (this.liquidConfig) {
            this.densities = new Float32Array(this.particleCount);
            this.pressures = new Float32Array(this.particleCount);
        }
    }

    update(deltaTime) {
        const dt = deltaTime * this.speedMultiplier;
        this.time += dt;

        this.updateShapes(dt);
        
        if (this.emitter) {
            this.updateEmitter(dt);
        }
        
        if (this.showForceField) {
            this.updateForceField();
        }

        if (this.showParticleDensity) {
            this.updateParticleDensity();
        }
        
        // Update liquid simulation if enabled
        if (this.liquidConfig && this.liquidConfig.enabled) {
            this.updateLiquidSimulation(dt);
        }

        if (this.sensorHits.length > 0) {
            for (let s = 0; s < this.sensorHits.length; s++) {
                for (let i = 0; i < this.sensorHits[s].length; i++) {
                    this.sensorHits[s][i] *= 0.995; // Slower decay for better visibility
                }
            }
        }

        const maxX = this.bounds.width - this.particleRadius;
        const maxY = this.bounds.height - this.particleRadius;
        const minX = this.particleRadius;
        const minY = this.particleRadius;
        const wrap = this.wrapEdges; // Cache to avoid property lookup in loop
        const w = this.bounds.width;
        const h = this.bounds.height;

        for (let i = 0; i < this.particleCount; i++) {
            const idx = i * 2;
            
            const oldX = this.positions[idx];
            const oldY = this.positions[idx + 1];
            
            this.positions[idx] += this.velocities[idx] * dt;
            this.positions[idx + 1] += this.velocities[idx + 1] * dt;

            if (this.sensors.length > 0) {
                this.checkSensorHits(oldX, oldY, this.positions[idx], this.positions[idx + 1]);
            }

            if (wrap) {
                // Randomize particle position if it goes out of bounds
                if (this.positions[idx] < 0 || this.positions[idx] >= w || 
                    this.positions[idx + 1] < 0 || this.positions[idx + 1] >= h) {
                    this.positions[idx] = Math.random() * w;
                    this.positions[idx + 1] = Math.random() * h;
                }
            } else {
                if (this.positions[idx] <= minX) {
                    this.positions[idx] = minX;
                    this.velocities[idx] = Math.abs(this.velocities[idx]) * this.damping;
                } else if (this.positions[idx] >= maxX) {
                    this.positions[idx] = maxX;
                    this.velocities[idx] = -Math.abs(this.velocities[idx]) * this.damping;
                }

                if (this.positions[idx + 1] <= minY) {
                    this.positions[idx + 1] = minY;
                    this.velocities[idx + 1] = Math.abs(this.velocities[idx + 1]) * this.damping;
                } else if (this.positions[idx + 1] >= maxY) {
                    this.positions[idx + 1] = maxY;
                    this.velocities[idx + 1] = -Math.abs(this.velocities[idx + 1]) * this.damping;
                }
            }

            this.handleShapeCollisions(idx);
        }

        if (this.particleCollisions) {
            this.buildSpatialHash();
            this.detectCollisionsOptimized();
        }
    }

    updateShapes(dt) {
        this.shapes.forEach(shape => {
            if (shape.rotating && shape.rotationSpeed) {
                if (!shape.angle) shape.angle = 0;
                shape.angle += shape.rotationSpeed * dt;
            }
            
            // Update moveable circles
            if (shape.type === 'circle' && shape.moveable) {
                // Update position based on velocity
                shape.x += shape.vx * dt;
                shape.y += shape.vy * dt;
                
                // Apply damping to circle velocity
                shape.vx *= 0.9999;
                shape.vy *= 0.9999;
                
                // If constantSpeed, restore speed magnitude after damping/collisions
                if (shape.constantSpeed) {
                    const currentSpeed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
                    if (currentSpeed > 0.01) {
                        const scale = shape.constantSpeed / currentSpeed;
                        shape.vx *= scale;
                        shape.vy *= scale;
                    } else {
                        // Restore from initial state if stalled
                        shape.vx = shape.constantSpeed;
                        shape.vy = 0;
                    }
                }

                // Handle edge behavior - wrap or bounce
                if (shape.wrapEdges) {
                    // Randomize position if shape goes out of bounds
                    if (shape.x - shape.radius > this.bounds.width || 
                        shape.x + shape.radius < 0 ||
                        shape.y - shape.radius > this.bounds.height || 
                        shape.y + shape.radius < 0) {
                        shape.x = shape.radius + Math.random() * (this.bounds.width - 2 * shape.radius);
                        shape.y = shape.radius + Math.random() * (this.bounds.height - 2 * shape.radius);
                    }
                } else {
                    // Bounce off edges
                    const bounceFactorX = shape.bounceX ? 1.0 : 0.5;
                    const bounceFactorY = shape.bounceY ? 1.0 : 0.5;

                    if (shape.x - shape.radius <= 0) {
                        shape.x = shape.radius;
                        shape.vx = Math.abs(shape.vx) * bounceFactorX;
                    } else if (shape.x + shape.radius >= this.bounds.width) {
                        shape.x = this.bounds.width - shape.radius;
                        shape.vx = -Math.abs(shape.vx) * bounceFactorX;
                    }
                    
                    if (shape.y - shape.radius <= 0) {
                        shape.y = shape.radius;
                        shape.vy = Math.abs(shape.vy) * bounceFactorY;
                    } else if (shape.y + shape.radius >= this.bounds.height) {
                        shape.y = this.bounds.height - shape.radius;
                        shape.vy = -Math.abs(shape.vy) * bounceFactorY;
                    }
                }
            }
        });
        
        // Check collisions between moveable circles
        this.checkShapeCollisions();
    }

    checkShapeCollisions() {
        const moveableCircles = this.shapes.filter(s => s.type === 'circle' && s.moveable);
        
        for (let i = 0; i < moveableCircles.length; i++) {
            for (let j = i + 1; j < moveableCircles.length; j++) {
                const c1 = moveableCircles[i];
                const c2 = moveableCircles[j];
                
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const distSq = dx * dx + dy * dy;
                const minDist = c1.radius + c2.radius;
                const minDistSq = minDist * minDist;
                
                if (distSq < minDistSq && distSq > 0.01) {
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;
                    
                    // Separate circles
                    const overlap = minDist - dist;
                    const totalMass = c1.mass + c2.mass;
                    const ratio1 = c2.mass / totalMass;
                    const ratio2 = c1.mass / totalMass;
                    
                    c1.x -= nx * overlap * ratio1;
                    c1.y -= ny * overlap * ratio1;
                    c2.x += nx * overlap * ratio2;
                    c2.y += ny * overlap * ratio2;
                    
                    // Elastic collision response
                    const dvx = c2.vx - c1.vx;
                    const dvy = c2.vy - c1.vy;
                    const dvDotN = dvx * nx + dvy * ny;
                    
                    if (dvDotN < 0) {
                        // Apply a small damping effect scaled from the damping property
                        // damping=1.0 means fully elastic, damping=0.0 means fully inelastic
                        const restitution = 0.5 + this.damping * 0.5; // maps [0,1] -> [0.5, 1.0]
                        const impulse = dvDotN * restitution;
                        c1.vx += nx * impulse * ratio1;
                        c1.vy += ny * impulse * ratio1;
                        c2.vx -= nx * impulse * ratio2;
                        c2.vy -= ny * impulse * ratio2;
                    }
                }
            }
        }
    }

    handleShapeCollisions(idx) {
        const x = this.positions[idx];
        const y = this.positions[idx + 1];
        const r = this.particleRadius;

        for (const shape of this.shapes) {
            if (shape.type === 'rect') {
                if ((shape.rotating && shape.rotationSpeed) || shape.angle !== undefined) {
                    // Handle rotating or angled rectangle collision
                    this.handleRotatingRectCollision(idx, shape, x, y, r);
                } else {
                    // Handle static rectangle collision
                    this.handleStaticRectCollision(idx, shape, x, y, r);
                }
            } else if (shape.type === 'circle') {
                if (shape.absorb) {
                    this.handleAbsorbCircle(idx, shape, x, y);
                } else {
                    this.handleCircleCollision(idx, shape, x, y, r);
                }
            }
        }
    }

    handleAbsorbCircle(idx, shape, x, y) {
        const dx = x - shape.x;
        const dy = y - shape.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < shape.radius * shape.radius) {
            // Apply momentum transfer to shape before teleporting particle
            if (shape.moveable) {
                const circleMass = shape.mass || 1000;
                const particleMass = 1.0;
                // Transfer particle momentum to shape (inelastic absorption)
                shape.vx += (this.velocities[idx] * particleMass) / circleMass;
                shape.vy += (this.velocities[idx + 1] * particleMass) / circleMass;
            }

            // Teleport particle to a random position away from all absorbing circles
            let placed = false;
            for (let attempt = 0; attempt < 20; attempt++) {
                const rx = Math.random() * this.bounds.width;
                const ry = Math.random() * this.bounds.height;
                let inside = false;
                for (const s of this.shapes) {
                    if (s.absorb && s.type === 'circle') {
                        const ddx = rx - s.x;
                        const ddy = ry - s.y;
                        if (ddx * ddx + ddy * ddy < s.radius * s.radius) {
                            inside = true;
                            break;
                        }
                    }
                }
                if (!inside) {
                    this.positions[idx] = rx;
                    this.positions[idx + 1] = ry;
                    const speed = 50 + Math.random() * 100;
                    const angle = Math.random() * Math.PI * 2;
                    this.velocities[idx] = Math.cos(angle) * speed;
                    this.velocities[idx + 1] = Math.sin(angle) * speed;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                // Fallback: just push to edge
                this.positions[idx] = Math.random() * this.bounds.width;
                this.positions[idx + 1] = 0;
            }
        }
    }

    handleStaticRectCollision(idx, shape, x, y, r) {
        const {x: rx, y: ry, width: rw, height: rh} = shape;

        // Current position
        const cx = this.positions[idx];
        const cy = this.positions[idx + 1];

        // Check if shape has acceleration property - if so, only accelerate, don't collide
        if (shape.accelerate) {
            if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) {
                // Get current velocity
                const vx = this.velocities[idx];
                const vy = this.velocities[idx + 1];
                const currentSpeed = Math.sqrt(vx * vx + vy * vy);
                
                // Normalize the acceleration direction
                const accelMag = Math.sqrt(shape.accelerate.x * shape.accelerate.x + shape.accelerate.y * shape.accelerate.y);
                if (accelMag > 0.01) {
                    const accelDirX = shape.accelerate.x / accelMag;
                    const accelDirY = shape.accelerate.y / accelMag;
                    
                    // Strongly lerp velocity direction towards acceleration direction
                    const lerpFactor = 0.5;
                    const newVx = vx + (accelDirX * currentSpeed - vx) * lerpFactor;
                    const newVy = vy + (accelDirY * currentSpeed - vy) * lerpFactor;
                    
                    // Normalize and add speed
                    const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
                    if (newSpeed > 0.01) {
                        const finalSpeed = currentSpeed + accelMag;
                        this.velocities[idx] = (newVx / newSpeed) * finalSpeed;
                        this.velocities[idx + 1] = (newVy / newSpeed) * finalSpeed;
                    }
                }
            }
            return; // Skip all collision handling for accelerator shapes
        }

        // Expand rectangle by particle radius for swept test
        const ex = rx - r;
        const ey = ry - r;
        const ew = rw + r * 2;
        const eh = rh + r * 2;

        // Find closest point on expanded rectangle to particle
        const closestX = Math.max(ex, Math.min(cx, ex + ew));
        const closestY = Math.max(ey, Math.min(cy, ey + eh));

        const dx = cx - closestX;
        const dy = cy - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < r * r || (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh)) {
            // Standard push-out resolution
            const closestX2 = Math.max(rx, Math.min(cx, rx + rw));
            const closestY2 = Math.max(ry, Math.min(cy, ry + rh));
            const dx2 = cx - closestX2;
            const dy2 = cy - closestY2;
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

            if (dist2 > 0.01) {
                const nx = dx2 / dist2;
                const ny = dy2 / dist2;
                const overlap = r - dist2;
                this.positions[idx] += nx * (overlap + 0.1);
                this.positions[idx + 1] += ny * (overlap + 0.1);
                const dot = this.velocities[idx] * nx + this.velocities[idx + 1] * ny;
                if (dot < 0) {
                    // Use liquid restitution if available, otherwise use damping
                    const restitution = (this.liquidConfig && this.liquidConfig.restitution !== undefined) 
                        ? this.liquidConfig.restitution 
                        : this.damping;
                    this.velocities[idx] = (this.velocities[idx] - 2 * dot * nx) * restitution;
                    this.velocities[idx + 1] = (this.velocities[idx + 1] - 2 * dot * ny) * restitution;
                }
            } else {
                // Particle is inside rect - push out through nearest face
                const dLeft = cx - rx;
                const dRight = (rx + rw) - cx;
                const dTop = cy - ry;
                const dBottom = (ry + rh) - cy;
                const minD = Math.min(dLeft, dRight, dTop, dBottom);
                // Use liquid restitution if available, otherwise use damping
                const restitution = (this.liquidConfig && this.liquidConfig.restitution !== undefined) 
                    ? this.liquidConfig.restitution 
                    : this.damping;
                if (minD === dLeft) {
                    this.positions[idx] = rx - r;
                    this.velocities[idx] = -Math.abs(this.velocities[idx]) * restitution;
                } else if (minD === dRight) {
                    this.positions[idx] = rx + rw + r;
                    this.velocities[idx] = Math.abs(this.velocities[idx]) * restitution;
                } else if (minD === dTop) {
                    this.positions[idx + 1] = ry - r;
                    this.velocities[idx + 1] = -Math.abs(this.velocities[idx + 1]) * restitution;
                } else {
                    this.positions[idx + 1] = ry + rh + r;
                    this.velocities[idx + 1] = Math.abs(this.velocities[idx + 1]) * restitution;
                }
            }
            return;
        }

        // Swept test: check if particle path crosses rectangle
        const prevX = x;
        const prevY = y;
        if (prevX === cx && prevY === cy) return;

        // Check if path segment intersects expanded rectangle
        if (this.lineIntersectsRect(prevX, prevY, cx, cy, ex, ey, ew, eh)) {
            // Find which face was hit by checking velocity direction
            const vx = this.velocities[idx];
            const vy = this.velocities[idx + 1];

            // Determine dominant collision axis
            let nx = 0, ny = 0;
            if (Math.abs(vx) > Math.abs(vy)) {
                nx = vx > 0 ? -1 : 1;
                this.positions[idx] = nx > 0 ? rx - r : rx + rw + r;
            } else {
                ny = vy > 0 ? -1 : 1;
                this.positions[idx + 1] = ny > 0 ? ry - r : ry + rh + r;
            }

            const dot = vx * nx + vy * ny;
            if (dot < 0) {
                // Use liquid restitution if available, otherwise use damping
                const restitution = (this.liquidConfig && this.liquidConfig.restitution !== undefined) 
                    ? this.liquidConfig.restitution 
                    : this.damping;
                this.velocities[idx] = (vx - 2 * dot * nx) * restitution;
                this.velocities[idx + 1] = (vy - 2 * dot * ny) * restitution;
            }
        }
    }

    handleRotatingRectCollision(idx, shape, x, y, r) {
        const {x: rx, y: ry, width: rw, height: rh, rotationSpeed} = shape;
        // Use the angle directly (already in radians)
        const angle = shape.angle !== undefined ? shape.angle : 0;
        
        // Calculate center of rectangle
        const centerX = rx + rw / 2;
        const centerY = ry + rh / 2;

        // Transform particle position to rectangle's local space
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = cos * (x - centerX) - sin * (y - centerY);
        const localY = sin * (x - centerX) + cos * (y - centerY);

        // Find closest point in local space
        const halfW = rw / 2;
        const halfH = rh / 2;
        const closestX = Math.max(-halfW, Math.min(localX, halfW));
        const closestY = Math.max(-halfH, Math.min(localY, halfH));

        const dx = localX - closestX;
        const dy = localY - closestY;
        const distSq = dx * dx + dy * dy;

        // Check if shape has acceleration property - if so, only accelerate, don't collide
        if (shape.accelerate) {
            // Check if particle is inside the rotated rectangle
            if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
                // Get current velocity
                const vx = this.velocities[idx];
                const vy = this.velocities[idx + 1];
                const currentSpeed = Math.sqrt(vx * vx + vy * vy);
                
                // Calculate direction to center line (localY = 0) in local space
                const centeringForce = -localY / halfH; // Normalized distance from center (-1 to 1)
                
                // Rotate acceleration vector by shape's angle to world space
                const accelCos = Math.cos(angle);
                const accelSin = Math.sin(angle);
                let worldAccelX = accelCos * shape.accelerate.x - accelSin * shape.accelerate.y;
                let worldAccelY = accelSin * shape.accelerate.x + accelCos * shape.accelerate.y;
                
                // Store original acceleration magnitude for speed increase
                const originalAccelMag = Math.sqrt(worldAccelX * worldAccelX + worldAccelY * worldAccelY);
                
                // Add centering component perpendicular to acceleration direction
                const perpX = -worldAccelY; // Perpendicular to acceleration
                const perpY = worldAccelX;
                const perpMag = Math.sqrt(perpX * perpX + perpY * perpY);
                if (perpMag > 0.01) {
                    const centeringStrength = 5.0; // Strong centering
                    worldAccelX += (perpX / perpMag) * centeringForce * centeringStrength;
                    worldAccelY += (perpY / perpMag) * centeringForce * centeringStrength;
                }
                
                // Normalize the combined direction for steering
                const accelMag = Math.sqrt(worldAccelX * worldAccelX + worldAccelY * worldAccelY);
                if (accelMag > 0.01) {
                    const accelDirX = worldAccelX / accelMag;
                    const accelDirY = worldAccelY / accelMag;
                    
                    // Strongly lerp velocity direction towards acceleration direction
                    const lerpFactor = 0.5;
                    const newVx = vx + (accelDirX * currentSpeed - vx) * lerpFactor;
                    const newVy = vy + (accelDirY * currentSpeed - vy) * lerpFactor;
                    
                    // Normalize to get direction
                    const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
                    if (newSpeed > 0.01) {
                        // Apply direction AND add speed from original acceleration
                        const speedIncrease = originalAccelMag;
                        const finalSpeed = currentSpeed + speedIncrease;
                        this.velocities[idx] = (newVx / newSpeed) * finalSpeed;
                        this.velocities[idx + 1] = (newVy / newSpeed) * finalSpeed;
                    }
                }
            }
            return; // Skip all collision handling for accelerator shapes
        }

        if (distSq < r * r) {
            const dist = Math.sqrt(distSq);
            if (dist > 0.01) {
                // Normal in local space
                const localNx = dx / dist;
                const localNy = dy / dist;

                // Transform normal back to world space
                const worldNx = cos * localNx + sin * localNy;
                const worldNy = -sin * localNx + cos * localNy;

                const overlap = r - dist;

                this.positions[idx] += worldNx * overlap;
                this.positions[idx + 1] += worldNy * overlap;

                // Calculate surface velocity at collision point (only for rotating shapes)
                let surfaceVelX = 0;
                let surfaceVelY = 0;
                
                if (rotationSpeed) {
                    // Convert closest point back to world space
                    const worldClosestX = cos * closestX - sin * closestY + centerX;
                    const worldClosestY = sin * closestX + cos * closestY + centerY;
                    
                    // Calculate velocity of rotating surface at this point
                    // v = ω × r (cross product in 2D: perpendicular to radius)
                    const radiusX = worldClosestX - centerX;
                    const radiusY = worldClosestY - centerY;
                    
                    // Perpendicular velocity due to rotation (tangent to circle)
                    surfaceVelX = -radiusY * rotationSpeed;
                    surfaceVelY = radiusX * rotationSpeed;
                }

                // Reflect particle velocity relative to moving surface
                const relativeVelX = this.velocities[idx] - surfaceVelX;
                const relativeVelY = this.velocities[idx + 1] - surfaceVelY;
                
                const dot = relativeVelX * worldNx + relativeVelY * worldNy;
                
                if (dot < 0) {
                    // Reflect relative velocity
                    const reflectedRelVelX = relativeVelX - 2 * dot * worldNx;
                    const reflectedRelVelY = relativeVelY - 2 * dot * worldNy;
                    
                    // Add surface velocity back and apply damping
                    // Use liquid restitution if available, otherwise use damping
                    const restitution = (this.liquidConfig && this.liquidConfig.restitution !== undefined) 
                        ? this.liquidConfig.restitution 
                        : this.damping;
                    this.velocities[idx] = (reflectedRelVelX + surfaceVelX) * restitution;
                    this.velocities[idx + 1] = (reflectedRelVelY + surfaceVelY) * restitution;
                }
            }
        }
    }

    handleCircleCollision(idx, shape, x, y, r) {
        // Ghost shapes don't collide with particles (for gravity shadow effect)
        if (shape.ghost) return;
        
        const {x: cx, y: cy, radius} = shape;
        
        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;

        // Check if shape has acceleration property - if so, only accelerate, don't collide
        if (shape.accelerate) {
            if (distSq < radius * radius) {
                // Get current velocity
                const vx = this.velocities[idx];
                const vy = this.velocities[idx + 1];
                const currentSpeed = Math.sqrt(vx * vx + vy * vy);
                
                // Normalize the acceleration direction
                const accelMag = Math.sqrt(shape.accelerate.x * shape.accelerate.x + shape.accelerate.y * shape.accelerate.y);
                if (accelMag > 0.01) {
                    const accelDirX = shape.accelerate.x / accelMag;
                    const accelDirY = shape.accelerate.y / accelMag;
                    
                    // Strongly lerp velocity direction towards acceleration direction
                    const lerpFactor = 0.5;
                    const newVx = vx + (accelDirX * currentSpeed - vx) * lerpFactor;
                    const newVy = vy + (accelDirY * currentSpeed - vy) * lerpFactor;
                    
                    // Normalize and add speed
                    const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
                    if (newSpeed > 0.01) {
                        const finalSpeed = currentSpeed + accelMag;
                        this.velocities[idx] = (newVx / newSpeed) * finalSpeed;
                        this.velocities[idx + 1] = (newVy / newSpeed) * finalSpeed;
                    }
                }
            }
            return; // Skip all collision handling for accelerator shapes
        }

        const combinedRadius = r + radius;
        const combinedRadiusSq = combinedRadius * combinedRadius;

        if (distSq < combinedRadiusSq && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Push particle out
            const overlap = combinedRadius - dist;
            this.positions[idx] += nx * overlap;
            this.positions[idx + 1] += ny * overlap;

            if (shape.moveable) {
                const circleMass = shape.mass || 1000;
                const particleMass = 1.0;
                const totalMass = circleMass + particleMass;

                // Relative velocity of particle with respect to circle surface
                const relVx = this.velocities[idx] - shape.vx;
                const relVy = this.velocities[idx + 1] - shape.vy;
                const relDotN = relVx * nx + relVy * ny;

                if (relDotN < 0) {
                    // Full elastic impulse with mass ratio
                    const impulse = (2.0 * relDotN) / totalMass;

                    this.velocities[idx] -= nx * impulse * circleMass;
                    this.velocities[idx + 1] -= ny * impulse * circleMass;
                    shape.vx += nx * impulse * particleMass;
                    shape.vy += ny * impulse * particleMass;
                }
            } else {
                // Static circle - plain reflection with damping
                const dot = this.velocities[idx] * nx + this.velocities[idx + 1] * ny;
                if (dot < 0) {
                    // Use liquid restitution if available, otherwise use damping
                    const restitution = (this.liquidConfig && this.liquidConfig.restitution !== undefined) 
                        ? this.liquidConfig.restitution 
                        : this.damping;
                    this.velocities[idx] = (this.velocities[idx] - 2 * dot * nx) * restitution;
                    this.velocities[idx + 1] = (this.velocities[idx + 1] - 2 * dot * ny) * restitution;
                }
            }
        }
    }

    buildSpatialHash() {
        this.grid.clear();

        for (let i = 0; i < this.particleCount; i++) {
            const x = this.positions[i * 2];
            const y = this.positions[i * 2 + 1];
            const cellX = Math.floor(x / this.cellSize);
            const cellY = Math.floor(y / this.cellSize);
            const key = `${cellX},${cellY}`;

            if (!this.grid.has(key)) {
                this.grid.set(key, []);
            }
            this.grid.get(key).push(i);
        }
    }

    detectCollisionsOptimized() {
        const collisionDist = this.particleRadius * 2;
        const collisionDistSq = collisionDist * collisionDist;

        // Process each cell
        for (const [key, particles] of this.grid) {
            if (particles.length === 0) continue;

            const [cellX, cellY] = key.split(',').map(Number);

            // Check particles within same cell
            for (let i = 0; i < particles.length; i++) {
                const p1 = particles[i];
                const idx1 = p1 * 2;

                // Check same cell
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    this.handleCollision(p1, p2, collisionDistSq, collisionDist);
                }

                // Check neighboring cells (only right, down, and diagonal to avoid duplicates)
                const neighbors = [
                    `${cellX + 1},${cellY}`,     // right
                    `${cellX},${cellY + 1}`,     // down
                    `${cellX + 1},${cellY + 1}`, // diagonal down-right
                    `${cellX - 1},${cellY + 1}`  // diagonal down-left
                ];

                for (const neighborKey of neighbors) {
                    const neighborParticles = this.grid.get(neighborKey);
                    if (!neighborParticles) continue;

                    for (const p2 of neighborParticles) {
                        this.handleCollision(p1, p2, collisionDistSq, collisionDist);
                    }
                }
            }
        }
    }

    handleCollision(i, j, collisionDistSq, collisionDist) {
        const idx1 = i * 2;
        const idx2 = j * 2;

        const dx = this.positions[idx2] - this.positions[idx1];
        const dy = this.positions[idx2 + 1] - this.positions[idx1 + 1];
        const distSq = dx * dx + dy * dy;

        if (distSq < collisionDistSq && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate particles
            const overlap = collisionDist - dist;
            const separationX = nx * overlap * 0.5;
            const separationY = ny * overlap * 0.5;
            
            this.positions[idx1] -= separationX;
            this.positions[idx1 + 1] -= separationY;
            this.positions[idx2] += separationX;
            this.positions[idx2 + 1] += separationY;

            // Elastic collision response
            const dvx = this.velocities[idx2] - this.velocities[idx1];
            const dvy = this.velocities[idx2 + 1] - this.velocities[idx1 + 1];
            const dvDotN = dvx * nx + dvy * ny;

            if (dvDotN < 0) {
                // Apply a small damping effect scaled from the damping property
                // damping=1.0 means fully elastic, damping=0.0 means fully inelastic
                const restitution = 0.5 + this.damping * 0.5; // maps [0,1] -> [0.5, 1.0]
                const impulse = dvDotN * restitution;
                this.velocities[idx1] += nx * impulse;
                this.velocities[idx1 + 1] += ny * impulse;
                this.velocities[idx2] -= nx * impulse;
                this.velocities[idx2 + 1] -= ny * impulse;
            }
        }
    }

    checkSensorHits(x1, y1, x2, y2) {
        for (let s = 0; s < this.sensors.length; s++) {
            const sensor = this.sensors[s];
            const sensorHits = this.sensorHits[s];
            
            // Check if line segment crosses sensor bounds
            if (this.lineIntersectsRect(x1, y1, x2, y2, sensor.x, sensor.y, sensor.width, sensor.height)) {
                // Calculate which cell was hit
                const hitX = (x2 + x1) / 2;
                const hitY = (y2 + y1) / 2;
                
                if (hitX >= sensor.x && hitX < sensor.x + sensor.width &&
                    hitY >= sensor.y && hitY < sensor.y + sensor.height) {
                    
                    const cellX = Math.floor((hitX - sensor.x) / this.sensorResolution);
                    const cellY = Math.floor((hitY - sensor.y) / this.sensorResolution);
                    const width = Math.ceil(sensor.width / this.sensorResolution);
                    const index = cellY * width + cellX;
                    
                    if (index >= 0 && index < sensorHits.length) {
                        sensorHits[index] = Math.min(sensorHits[index] + 1.0, 20);
                    }
                }
            }
        }
    }

    lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
        // Check if either point is inside the rectangle
        if ((x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) ||
            (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh)) {
            return true;
        }
        
        // Check if line crosses any edge of rectangle
        return this.lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
               this.lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
               this.lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh) ||
               this.lineIntersectsLine(x1, y1, x2, y2, rx, ry + rh, rx, ry);
    }

    lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.0001) return false;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    addShape(shape) {
        this.shapes.push(shape);
        this.initialShapeStates.push({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            radius: shape.radius,
            vx: shape.vx !== undefined ? shape.vx : 0,
            vy: shape.vy !== undefined ? shape.vy : 0,
            angle: shape.angle || 0,
            type: shape.type,
            bounceX: shape.bounceX || false,
            bounceY: shape.bounceY || false
        });
    }

    resetShapes() {
        for (let i = 0; i < this.shapes.length; i++) {
            const shape = this.shapes[i];
            const initialState = this.initialShapeStates[i];
            
            if (initialState) {
                shape.x = initialState.x;
                shape.y = initialState.y;
                if (shape.type === 'circle' && shape.moveable) {
                    shape.vx = initialState.vx;
                    shape.vy = initialState.vy;
                }
                if (shape.rotating) {
                    shape.angle = initialState.angle;
                }
            }
        }
    }

    clearShapes() {
        this.shapes = [];
        this.initialShapeStates = [];
    }

    updateForceField() {
        // Reset force field
        this.forceField.fill(0);
        
        // Calculate particle pressure in each grid cell
        for (let i = 0; i < this.particleCount; i++) {
            const x = this.positions[i * 2];
            const y = this.positions[i * 2 + 1];
            const vx = this.velocities[i * 2];
            const vy = this.velocities[i * 2 + 1];
            
            // Get grid cell
            const cellX = Math.floor(x / this.forceFieldResolution);
            const cellY = Math.floor(y / this.forceFieldResolution);
            
            if (cellX >= 0 && cellX < this.forceFieldWidth && 
                cellY >= 0 && cellY < this.forceFieldHeight) {
                const index = cellY * this.forceFieldWidth + cellX;
                
                // Add particle momentum/force to cell
                const speed = Math.sqrt(vx * vx + vy * vy);
                this.forceField[index] += speed * 0.1; // Increased from 0.01 for wider range
            }
        }
        
        // Smooth the force field (optional - makes it look better)
        this.smoothForceField();
    }

    smoothForceField() {
        const smoothed = new Float32Array(this.forceField.length);
        
        for (let y = 0; y < this.forceFieldHeight; y++) {
            for (let x = 0; x < this.forceFieldWidth; x++) {
                const index = y * this.forceFieldWidth + x;
                let sum = 0;
                let count = 0;
                
                // Average with neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        if (nx >= 0 && nx < this.forceFieldWidth && 
                            ny >= 0 && ny < this.forceFieldHeight) {
                            const nIndex = ny * this.forceFieldWidth + nx;
                            sum += this.forceField[nIndex];
                            count++;
                        }
                    }
                }
                
                smoothed[index] = sum / count;
            }
        }
        
        this.forceField = smoothed;
    }

    updateParticleDensity() {
        if (!this.particleDensity) {
            this.initParticleDensity();
            if (!this.particleDensity) return;
        }

        this.particleDensity.fill(0);

        for (let i = 0; i < this.particleCount; i++) {
            const x = this.positions[i * 2];
            const y = this.positions[i * 2 + 1];

            const cellX = Math.floor(x / this.forceFieldResolution);
            const cellY = Math.floor(y / this.forceFieldResolution);

            if (cellX >= 0 && cellX < this.particleDensityWidth &&
                cellY >= 0 && cellY < this.particleDensityHeight) {
                const index = cellY * this.particleDensityWidth + cellX;
                this.particleDensity[index] += 1;
            }
        }

        const smoothed = new Float32Array(this.particleDensity.length);
        for (let y = 0; y < this.particleDensityHeight; y++) {
            for (let x = 0; x < this.particleDensityWidth; x++) {
                const index = y * this.particleDensityWidth + x;
                let sum = 0;
                let count = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < this.particleDensityWidth &&
                            ny >= 0 && ny < this.particleDensityHeight) {
                            const nIndex = ny * this.particleDensityWidth + nx;
                            sum += this.particleDensity[nIndex];
                            count++;
                        }
                    }
                }

                smoothed[index] = sum / count;
            }
        }

        this.particleDensity = smoothed;
    }

    setShowForceField(show) {
        this.showForceField = show;
        if (show) {
            if (!this.forceField) {
                this.initForceField();
            }
        } else {
            // Clear force field data so renderer skips it
            this.forceField = null;
            this.forceFieldWidth = 0;
            this.forceFieldHeight = 0;
        }
    }

    setShowParticleDensity(show) {
        this.showParticleDensity = show;
        if (show) {
            if (!this.particleDensity) {
                this.initParticleDensity();
            }
        } else {
            this.particleDensity = null;
            this.particleDensityWidth = 0;
            this.particleDensityHeight = 0;
        }
    }

    setEmitter(emitter) {
        this.emitter = emitter;
        this.emitterAccumulator = 0;
        
        // Standalone emitter (no emitterStartIndex): manages its own particle pool
        if (emitter && emitter.maxParticles && emitter.emitterStartIndex === undefined) {
            this.particleCount = emitter.maxParticles;
            this.positions = new Float32Array(this.particleCount * 2);
            this.velocities = new Float32Array(this.particleCount * 2);
            this.activeParticles = 0;
            
            // Fill positions off-screen initially
            for (let i = 0; i < this.particleCount; i++) {
                this.positions[i * 2] = -1000;
                this.positions[i * 2 + 1] = -1000;
                this.velocities[i * 2] = 0;
                this.velocities[i * 2 + 1] = 0;
            }
        }
        // emitterStartIndex mode: normal init runs; pool is cleared after init()
    }

    updateEmitter(dt) {
        if (!this.emitter || !this.emitter.particlesPerSecond) return;

        // If attached to a shape, follow its position each frame
        if (this.emitter.attachToShape !== undefined) {
            const shape = this.shapes[this.emitter.attachToShape];
            if (shape) {
                const offsetX = this.emitter.offsetX || 0;
                const offsetY = this.emitter.offsetY || 0;
                
                // Calculate the reference point (center for shapes)
                let centerX, centerY;
                if (shape.type === 'rect') {
                    // For rectangles, (x,y) is top-left, so calculate center
                    centerX = shape.x + shape.width / 2;
                    centerY = shape.y + shape.height / 2;
                } else if (shape.type === 'circle') {
                    // For circles, (x,y) is already the center
                    centerX = shape.x;
                    centerY = shape.y;
                } else {
                    // Default: use x,y directly
                    centerX = shape.x;
                    centerY = shape.y;
                }
                
                // If the shape has an angle, rotate the offset
                if (shape.angle !== undefined && shape.angle !== 0) {
                    const cos = Math.cos(shape.angle);
                    const sin = Math.sin(shape.angle);
                    this.emitter.x = centerX + (offsetX * cos - offsetY * sin);
                    this.emitter.y = centerY + (offsetX * sin + offsetY * cos);
                } else {
                    this.emitter.x = centerX + offsetX;
                    this.emitter.y = centerY + offsetY;
                }
            }
        }
        
        // Accumulate time for particle emission
        this.emitterAccumulator += dt;
        
        // Calculate how many particles to emit this frame
        const emitInterval = 1.0 / this.emitter.particlesPerSecond;
        let particlesToEmit = 0;
        
        while (this.emitterAccumulator >= emitInterval) {
            particlesToEmit++;
            this.emitterAccumulator -= emitInterval;
        }

        // Determine pool bounds (standalone: starts at 0; emitterStartIndex mode: starts at index)
        const poolStart = this.emitter.emitterStartIndex !== undefined ? this.emitter.emitterStartIndex : 0;
        const poolSize = this.emitter.maxParticles;
        
        // Emit particles
        for (let i = 0; i < particlesToEmit; i++) {
            if (poolSize) {
                const localActive = this.activeParticles - poolStart;
                if (localActive >= poolSize) {
                    // Reuse particles in round-robin fashion within pool
                    this.emitParticle(poolStart + this.nextParticleIndex);
                    this.nextParticleIndex = (this.nextParticleIndex + 1) % poolSize;
                } else if (this.activeParticles < this.particleCount) {
                    // Activate next particle in pool
                    this.emitParticle(this.activeParticles);
                    this.activeParticles++;
                }
            } else if (this.activeParticles < this.particleCount) {
                // No maxParticles: emit from activeParticles sequentially
                this.emitParticle(this.activeParticles);
                this.activeParticles++;
            }
        }
    }

    emitParticle(index) {
        const idx = index * 2;
        
        // Check if emitter has a direction vector
        if (this.emitter.direction) {
            // Emit in specified direction with configurable spread
            const baseAngle = Math.atan2(this.emitter.direction.y, this.emitter.direction.x);
            const spread = this.emitter.spread !== undefined ? this.emitter.spread : 0.2; // Default spread of 0.2 radians (~11 degrees)
            const angle = baseAngle + (Math.random() - 0.5) * spread;
            
            // Position offset: if spread is 0, spawn at exact emitter position; otherwise random circle
            if (spread === 0) {
                // Spawn at exact emitter position for perfect line
                this.positions[idx] = this.emitter.x;
                this.positions[idx + 1] = this.emitter.y;
            } else {
                // Random offset within emitter radius
                const offsetRadius = Math.random() * this.emitter.radius * 0.5;
                const offsetAngle = Math.random() * Math.PI * 2;
                this.positions[idx] = this.emitter.x + Math.cos(offsetAngle) * offsetRadius;
                this.positions[idx + 1] = this.emitter.y + Math.sin(offsetAngle) * offsetRadius;
            }
            
            // Velocity: if spread is 0, use exact speed; otherwise add variation
            const speedVariation = spread === 0 ? 0 : 0.2;
            const speed = this.emitter.particleSpeed * (1.0 - speedVariation + Math.random() * speedVariation * 2);
            this.velocities[idx] = Math.cos(angle) * speed;
            this.velocities[idx + 1] = Math.sin(angle) * speed;
        } else {
            // Random angle for emission (original behavior)
            const angle = Math.random() * Math.PI * 2;
            
            // Position at emitter location with small random offset
            const offsetRadius = Math.random() * this.emitter.radius * 0.5;
            this.positions[idx] = this.emitter.x + Math.cos(angle) * offsetRadius;
            this.positions[idx + 1] = this.emitter.y + Math.sin(angle) * offsetRadius;
            
            // Velocity in random direction
            const speed = this.emitter.particleSpeed * (0.8 + Math.random() * 0.4);
            this.velocities[idx] = Math.cos(angle) * speed;
            this.velocities[idx + 1] = Math.sin(angle) * speed;
        }

        // Newton's 3rd Law: if enabled and attached to a shape, apply equal and opposite
        // reaction momentum to that shape (rocket thrust)
        // this is for illustration purposes only and not part of particle physics
        if (this.emitter.thirdLawForces !== false && this.emitter.attachToShape !== undefined) {
            const shape = this.shapes[this.emitter.attachToShape];
            if (shape && shape.moveable) {
                const shapeMass = shape.mass || 1000;
                shape.vx -= this.velocities[idx] / shapeMass;
                shape.vy -= this.velocities[idx + 1] / shapeMass;
            }
        }
    }

    // SPH (Smoothed Particle Hydrodynamics) kernel function
    sphKernel(r, h) {
        if (r >= h) return 0;
        const q = r / h;
        const factor = 315.0 / (64.0 * Math.PI * Math.pow(h, 9));
        return factor * Math.pow(h * h - r * r, 3);
    }

    // SPH kernel gradient
    sphKernelGradient(dx, dy, r, h) {
        if (r >= h || r < 0.0001) return { x: 0, y: 0 };
        const q = r / h;
        const factor = -945.0 / (32.0 * Math.PI * Math.pow(h, 9));
        const gradMag = factor * Math.pow(h * h - r * r, 2);
        return {
            x: gradMag * dx,
            y: gradMag * dy
        };
    }

    updateLiquidSimulation(dt) {
        const config = this.liquidConfig;
        const h = config.smoothingRadius;
        const h2 = h * h;
        
        // Step 1: Compute densities
        for (let i = 0; i < this.particleCount; i++) {
            const xi = this.positions[i * 2];
            const yi = this.positions[i * 2 + 1];
            let density = 0;
            
            // Find neighbors within smoothing radius
            for (let j = 0; j < this.particleCount; j++) {
                const xj = this.positions[j * 2];
                const yj = this.positions[j * 2 + 1];
                const dx = xi - xj;
                const dy = yi - yj;
                const r2 = dx * dx + dy * dy;
                
                if (r2 < h2) {
                    const r = Math.sqrt(r2);
                    density += config.particleMass * this.sphKernel(r, h);
                }
            }
            
            this.densities[i] = Math.max(density, config.restDensity * 0.01);
        }
        
        // Step 2: Compute pressures
        for (let i = 0; i < this.particleCount; i++) {
            // Equation of state: P = k * (ρ - ρ₀)
            this.pressures[i] = config.gasConstant * (this.densities[i] - config.restDensity);
        }
        
        // Step 3: Compute forces and update velocities
        for (let i = 0; i < this.particleCount; i++) {
            const xi = this.positions[i * 2];
            const yi = this.positions[i * 2 + 1];
            let fx = 0;
            let fy = config.gravity; // Gravity force
            
            // Pressure and viscosity forces
            for (let j = 0; j < this.particleCount; j++) {
                if (i === j) continue;
                
                const xj = this.positions[j * 2];
                const yj = this.positions[j * 2 + 1];
                const dx = xi - xj;
                const dy = yi - yj;
                const r2 = dx * dx + dy * dy;
                
                if (r2 < h2 && r2 > 0.0001) {
                    const r = Math.sqrt(r2);
                    const grad = this.sphKernelGradient(dx, dy, r, h);
                    
                    // Pressure force (symmetric formulation)
                    const pressureTerm = (this.pressures[i] + this.pressures[j]) / 
                                        (2.0 * this.densities[j]);
                    fx -= config.particleMass * pressureTerm * grad.x;
                    fy -= config.particleMass * pressureTerm * grad.y;
                    
                    // Viscosity force
                    const vxi = this.velocities[i * 2];
                    const vyi = this.velocities[i * 2 + 1];
                    const vxj = this.velocities[j * 2];
                    const vyj = this.velocities[j * 2 + 1];
                    const dvx = vxj - vxi;
                    const dvy = vyj - vyi;
                    
                    const viscosityTerm = config.viscosity * config.particleMass / this.densities[j];
                    const dot = (dx * dvx + dy * dvy) / (r2 + 0.01 * h2);
                    fx += viscosityTerm * dot * dx;
                    fy += viscosityTerm * dot * dy;
                }
            }
            
            // Update velocity
            const acceleration_x = fx / this.densities[i];
            const acceleration_y = fy / this.densities[i];
            this.velocities[i * 2] += acceleration_x * dt;
            this.velocities[i * 2 + 1] += acceleration_y * dt;
            
            // Apply damping
            this.velocities[i * 2] *= this.damping;
            this.velocities[i * 2 + 1] *= this.damping;
        }
    }
}
