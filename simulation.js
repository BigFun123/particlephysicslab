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
    }

    initSensor() {
        if (!this.sensor) return;
        
        const width = Math.ceil(this.sensor.width / this.sensorResolution);
        const height = Math.ceil(this.sensor.height / this.sensorResolution);
        
        this.sensorHits = new Float32Array(width * height);
        this.sensorHits.fill(0);
    }

    initCenter() {
        const centerX = this.bounds.width / 2;
        const centerY = this.bounds.height / 2;
        const spawnRadius = 200;

        for (let i = 0; i < this.particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * spawnRadius;
            
            this.positions[i * 2] = centerX + Math.cos(angle) * radius;
            this.positions[i * 2 + 1] = centerY + Math.sin(angle) * radius;

            const speed = 50 + Math.random() * 150;
            const velAngle = Math.random() * Math.PI * 2;
            this.velocities[i * 2] = Math.cos(velAngle) * speed;
            this.velocities[i * 2 + 1] = Math.sin(velAngle) * speed;
        }
    }

    initLeft() {
        const spawnX = 100;
        const spawnHeight = this.bounds.height * 0.6;
        const spawnY = (this.bounds.height - spawnHeight) / 2;

        for (let i = 0; i < this.particleCount; i++) {
            this.positions[i * 2] = spawnX + Math.random() * 50;
            this.positions[i * 2 + 1] = spawnY + Math.random() * spawnHeight;

            const speed = 100 + Math.random() * 100;
            const angle = (Math.random() - 0.5) * 0.3; // Slight angle variation
            this.velocities[i * 2] = Math.cos(angle) * speed;
            this.velocities[i * 2 + 1] = Math.sin(angle) * speed;
        }
    }

    initRandom() {
        for (let i = 0; i < this.particleCount; i++) {
            this.positions[i * 2] = Math.random() * this.bounds.width;
            this.positions[i * 2 + 1] = Math.random() * this.bounds.height;

            const speed = 50 + Math.random() * 100;
            const angle = Math.random() * Math.PI * 2;
            this.velocities[i * 2] = Math.cos(angle) * speed;
            this.velocities[i * 2 + 1] = Math.sin(angle) * speed;
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
        });
    }

    handleShapeCollisions(idx) {
        const x = this.positions[idx];
        const y = this.positions[idx + 1];
        const r = this.particleRadius;

        for (const shape of this.shapes) {
            if (shape.type === 'rect') {
                if (shape.rotating && shape.angle) {
                    // Handle rotating rectangle collision
                    this.handleRotatingRectCollision(idx, shape, x, y, r);
                } else {
                    // Handle static rectangle collision
                    this.handleStaticRectCollision(idx, shape, x, y, r);
                }
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
        const {x: rx, y: ry, width: rw, height: rh, angle} = shape;
        
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

                // Reflect velocity
                const dot = this.velocities[idx] * worldNx + this.velocities[idx + 1] * worldNy;
                this.velocities[idx] = (this.velocities[idx] - 2 * dot * worldNx) * this.damping;
                this.velocities[idx + 1] = (this.velocities[idx + 1] - 2 * dot * worldNy) * this.damping;
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
}
