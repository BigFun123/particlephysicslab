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
        
        // Sensor for particle detection
        this.sensor = null;
        this.sensorHits = null; // 2D array tracking hit intensity
        this.sensorResolution = 1; // Pixels per hit cell
    }

    init(initType = 'center') {
        this.positions = new Float32Array(this.particleCount * 2);
        this.velocities = new Float32Array(this.particleCount * 2);

        if (initType === 'center') {
            this.initCenter();
        } else if (initType === 'left') {
            this.initLeft();
        } else if (initType === 'random') {
            this.initRandom();
        }
        
        // Initialize sensor hit map if sensor exists
        if (this.sensor) {
            this.initSensor();
        }
        
        // Initialize circle physics
        this.initCirclePhysics();
    }

    initCirclePhysics() {
        this.shapes.forEach(shape => {
            if (shape.type === 'circle' && shape.moveable) {
                // Initialize velocity if not set
                if (!shape.vx) shape.vx = 0;
                if (!shape.vy) shape.vy = 0;
                // Calculate mass based on radius if not set
                if (!shape.mass) {
                    shape.mass = Math.PI * shape.radius * shape.radius * 0.01; // Density factor
                }
            }
        });
    }

    initSensor() {
        if (!this.sensor) return;
        
        const width = Math.ceil(this.sensor.width / this.sensorResolution);
        const height = Math.ceil(this.sensor.height / this.sensorResolution);
        
        this.sensorHits = new Float32Array(width * height);
        this.sensorHits.fill(0);
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

    update(deltaTime) {
        const dt = deltaTime * this.speedMultiplier;
        this.time += dt;

        // Update rotating shapes
        this.updateShapes(dt);

        // Decay sensor hits over time (slower decay for brighter persistence)
        if (this.sensorHits) {
            for (let i = 0; i < this.sensorHits.length; i++) {
                this.sensorHits[i] *= 0.99; // Slower fade (was 0.98)
            }
        }

        // Update positions
        for (let i = 0; i < this.particleCount; i++) {
            const idx = i * 2;
            
            const oldX = this.positions[idx];
            const oldY = this.positions[idx + 1];
            
            this.positions[idx] += this.velocities[idx] * dt;
            this.positions[idx + 1] += this.velocities[idx + 1] * dt;

            // Check sensor collision
            if (this.sensor) {
                this.checkSensorHit(oldX, oldY, this.positions[idx], this.positions[idx + 1]);
            }

            // Boundary collisions
            if (this.positions[idx] <= this.particleRadius) {
                this.positions[idx] = this.particleRadius;
                this.velocities[idx] = Math.abs(this.velocities[idx]) * this.damping;
            } else if (this.positions[idx] >= this.bounds.width - this.particleRadius) {
                this.positions[idx] = this.bounds.width - this.particleRadius;
                this.velocities[idx] = -Math.abs(this.velocities[idx]) * this.damping;
            }

            if (this.positions[idx + 1] <= this.particleRadius) {
                this.positions[idx + 1] = this.particleRadius;
                this.velocities[idx + 1] = Math.abs(this.velocities[idx + 1]) * this.damping;
            } else if (this.positions[idx + 1] >= this.bounds.height - this.particleRadius) {
                this.positions[idx + 1] = this.bounds.height - this.particleRadius;
                this.velocities[idx + 1] = -Math.abs(this.velocities[idx + 1]) * this.damping;
            }

            // Shape collisions
            this.handleShapeCollisions(idx);
        }

        // Collision detection with spatial hashing
        this.buildSpatialHash();
        this.detectCollisionsOptimized();
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
                shape.vx *= 0.995;
                shape.vy *= 0.995;
                
                // Boundary collisions for circles
                if (shape.x - shape.radius <= 0) {
                    shape.x = shape.radius;
                    shape.vx = Math.abs(shape.vx) * 0.8;
                } else if (shape.x + shape.radius >= this.bounds.width) {
                    shape.x = this.bounds.width - shape.radius;
                    shape.vx = -Math.abs(shape.vx) * 0.8;
                }
                
                if (shape.y - shape.radius <= 0) {
                    shape.y = shape.radius;
                    shape.vy = Math.abs(shape.vy) * 0.8;
                } else if (shape.y + shape.radius >= this.bounds.height) {
                    shape.y = this.bounds.height - shape.radius;
                    shape.vy = -Math.abs(shape.vy) * 0.8;
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
                        // Calculate impulse based on masses
                        const impulse = (2 * dvDotN) / totalMass;
                        
                        c1.vx += nx * impulse * c2.mass * 0.9;
                        c1.vy += ny * impulse * c2.mass * 0.9;
                        c2.vx -= nx * impulse * c1.mass * 0.9;
                        c2.vy -= ny * impulse * c1.mass * 0.9;
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
                if (shape.rotating && shape.rotationSpeed) {
                    // Handle rotating rectangle collision
                    this.handleRotatingRectCollision(idx, shape, x, y, r);
                } else {
                    // Handle static rectangle collision
                    this.handleStaticRectCollision(idx, shape, x, y, r);
                }
            } else if (shape.type === 'circle') {
                this.handleCircleCollision(idx, shape, x, y, r);
            }
        }
    }

    handleStaticRectCollision(idx, shape, x, y, r) {
        const {x: rx, y: ry, width: rw, height: rh} = shape;

        // Find closest point on rectangle to particle
        const closestX = Math.max(rx, Math.min(x, rx + rw));
        const closestY = Math.max(ry, Math.min(y, ry + rh));

        const dx = x - closestX;
        const dy = y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < r * r) {
            const dist = Math.sqrt(distSq);
            if (dist > 0.01) {
                // Push particle out
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = r - dist;

                this.positions[idx] += nx * overlap;
                this.positions[idx + 1] += ny * overlap;

                // Reflect velocity
                const dot = this.velocities[idx] * nx + this.velocities[idx + 1] * ny;
                this.velocities[idx] = (this.velocities[idx] - 2 * dot * nx) * this.damping;
                this.velocities[idx + 1] = (this.velocities[idx + 1] - 2 * dot * ny) * this.damping;
            }
        }
    }

    handleRotatingRectCollision(idx, shape, x, y, r) {
        const {x: rx, y: ry, width: rw, height: rh, angle, rotationSpeed} = shape;
        
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

                // Calculate surface velocity at collision point
                // Convert closest point back to world space
                const worldClosestX = cos * closestX - sin * closestY + centerX;
                const worldClosestY = sin * closestX + cos * closestY + centerY;
                
                // Calculate velocity of rotating surface at this point
                // v = ω × r (cross product in 2D: perpendicular to radius)
                const radiusX = worldClosestX - centerX;
                const radiusY = worldClosestY - centerY;
                
                // Perpendicular velocity due to rotation (tangent to circle)
                const surfaceVelX = -radiusY * rotationSpeed;
                const surfaceVelY = radiusX * rotationSpeed;

                // Reflect particle velocity relative to moving surface
                const relativeVelX = this.velocities[idx] - surfaceVelX;
                const relativeVelY = this.velocities[idx + 1] - surfaceVelY;
                
                const dot = relativeVelX * worldNx + relativeVelY * worldNy;
                
                if (dot < 0) {
                    // Reflect relative velocity
                    const reflectedRelVelX = relativeVelX - 2 * dot * worldNx;
                    const reflectedRelVelY = relativeVelY - 2 * dot * worldNy;
                    
                    // Add surface velocity back and apply damping
                    this.velocities[idx] = (reflectedRelVelX + surfaceVelX) * this.damping;
                    this.velocities[idx + 1] = (reflectedRelVelY + surfaceVelY) * this.damping;
                }
            }
        }
    }

    handleCircleCollision(idx, shape, x, y, r) {
        const {x: cx, y: cy, radius} = shape;
        
        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;
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

            // Reflect velocity
            const dot = this.velocities[idx] * nx + this.velocities[idx + 1] * ny;
            if (dot < 0) {
                // Transfer momentum to circle if moveable
                if (shape.moveable) {
                    const particleMass = 1.0; // Assume unit mass for particles
                    const circleMass = shape.mass || 1000;
                    
                    // Calculate momentum transfer
                    const momentumTransfer = 2 * dot * particleMass / (particleMass + circleMass);
                    
                    // Apply momentum to circle
                    shape.vx -= nx * momentumTransfer * 0.5; // 0.5 is transfer coefficient
                    shape.vy -= ny * momentumTransfer * 0.5;
                }
                
                this.velocities[idx] = (this.velocities[idx] - 2 * dot * nx) * this.damping;
                this.velocities[idx + 1] = (this.velocities[idx + 1] - 2 * dot * ny) * this.damping;
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
                const impulse = dvDotN * this.damping;
                this.velocities[idx1] += nx * impulse;
                this.velocities[idx1 + 1] += ny * impulse;
                this.velocities[idx2] -= nx * impulse;
                this.velocities[idx2 + 1] -= ny * impulse;
            }
        }
    }

    checkSensorHit(x1, y1, x2, y2) {
        const sensor = this.sensor;
        
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
                
                if (index >= 0 && index < this.sensorHits.length) {
                    this.sensorHits[index] = Math.min(this.sensorHits[index] + 1.0, 20); // Increased from 0.5 to 1.0, max from 10 to 20
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
        // Store initial state - make sure to capture all relevant properties
        this.initialShapeStates.push({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            radius: shape.radius,
            vx: shape.vx || 0,
            vy: shape.vy || 0,
            angle: shape.angle || 0,
            type: shape.type
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
}
