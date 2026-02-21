import { ParticleRenderer } from './renderer.js';
import { ParticleSimulation } from './simulation.js';
import { UIController } from './ui.js';
import { PresetLoader } from './presetLoader.js';

// Make ParticleSimulation available to UI controller
window.ParticleSimulation = ParticleSimulation;

class ParticleAccelerator {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.renderer = null;
        this.simulation = null;
        this.ui = null;
        this.presetLoader = new PresetLoader();
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.frameCount = 0;
        this.fpsTime = 0;
        
        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        try {
            // Load presets first
            await this.presetLoader.loadPresets();

            this.renderer = new ParticleRenderer(this.canvas);
            await this.renderer.init();
            
            // Load first preset instead of hardcoded values
            const firstPreset = this.presetLoader.getPresetByIndex(0);
            if (firstPreset) {
                const rect = this.canvas.getBoundingClientRect();
                
                this.simulation = new ParticleSimulation(firstPreset.particles);
                this.simulation.bounds.width = rect.width;
                this.simulation.bounds.height = rect.height;
                this.simulation.shapes = firstPreset.shapes || [];
                this.simulation.sensor = firstPreset.sensor || null;
                
                // Set emitter if present - handle centering
                if (firstPreset.emitter) {
                    const emitter = {...firstPreset.emitter};
                    if (emitter.x === -1) {
                        emitter.x = rect.width / 2;
                    }
                    if (emitter.y === -1) {
                        emitter.y = rect.height / 2;
                    }
                    this.simulation.setEmitter(emitter);
                }
                
                // Set force field visibility from preset BEFORE init
                if (firstPreset.showForceField !== undefined) {
                    this.simulation.showForceField = firstPreset.showForceField;
                }
                
                // Set wrap edges from preset
                this.simulation.wrapEdges = firstPreset.wrapEdges || false;
                
                this.simulation.init(firstPreset.initType || 'center');
                
                // Set renderer properties from preset
                this.renderer.glowIntensity = firstPreset.glowIntensity || 1.5;
                this.renderer.particleSize = firstPreset.particleSize || 2.0;
                
                // Set simulation speed from preset
                this.simulation.speedMultiplier = firstPreset.speed || 1.0;
                
                // Set damping from preset
                this.simulation.damping = firstPreset.damping || 0.8;
                
                // Update particle count display
                document.getElementById('particleCount').textContent = firstPreset.particles.toLocaleString();
            } else {
                // Fallback to default values if no presets available
                this.simulation = new ParticleSimulation(10000);
                this.simulation.init();
                this.renderer.glowIntensity = 1.5;
            }
            
            // Create UI after presets are loaded
            this.ui = new UIController(this);
            
            // Auto-select first preset button and update UI checkbox
            setTimeout(() => {
                const firstButton = document.querySelector('.btn-preset');
                if (firstButton) {
                    firstButton.classList.add('active');
                    this.ui.currentPresetIndex = 0;
                    const firstPresetData = this.presetLoader.getPresetByIndex(0);
                    if (firstPresetData && firstPresetData.description) {
                        const headerDescription = document.getElementById('headerDescription');
                        headerDescription.textContent = firstPresetData.description;
                        headerDescription.classList.add('visible');
                    }
                    
                    // Update force field checkbox to match preset
                    if (firstPresetData && firstPresetData.showForceField !== undefined) {
                        const forceFieldCheckbox = document.getElementById('forceFieldCheckbox');
                        if (forceFieldCheckbox) {
                            forceFieldCheckbox.checked = firstPresetData.showForceField;
                        }
                    }
                    
                    // Update wrap edges checkbox to match preset
                    if (firstPresetData) {
                        const wrapEdgesCheckbox = document.getElementById('wrapEdgesCheckbox');
                        if (wrapEdgesCheckbox) {
                            wrapEdgesCheckbox.checked = firstPresetData.wrapEdges || false;
                        }
                    }
                }
            }, 100);
            
            this.isRunning = true;
            this.animate(0);
        } catch (error) {
            console.error('Failed to initialize:', error);
            alert('Failed to initialize WebGL. Please use a modern browser with WebGL support.');
        }
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas internal resolution
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        // Set canvas CSS size (should match parent)
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        if (this.renderer) {
            this.renderer.resize(this.canvas.width, this.canvas.height);
        }
        
        if (this.simulation) {
            // Use CSS pixels for simulation bounds, not physical pixels
            this.simulation.bounds.width = rect.width;
            this.simulation.bounds.height = rect.height;
            
            // Reinitialize force field if it exists
            if (this.simulation.showForceField) {
                this.simulation.initForceField();
            }
        }
    }

    animate(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // FPS calculation
        this.frameCount++;
        this.fpsTime += deltaTime;
        if (this.fpsTime >= 0.5) {
            const fps = Math.round(this.frameCount / this.fpsTime);
            document.getElementById('fps').textContent = fps;
            this.frameCount = 0;
            this.fpsTime = 0;
        }

        if (!this.isPaused) {
            this.simulation.update(deltaTime);
        }
        
        this.renderer.render(
            this.simulation.positions, 
            this.simulation.velocities, 
            this.simulation.shapes,
            this.simulation.sensor,
            this.simulation.sensorHits,
            this.simulation.forceField,
            this.simulation.forceFieldWidth,
            this.simulation.forceFieldHeight,
            this.simulation.forceFieldResolution,
            this.simulation.emitter
        );

        requestAnimationFrame((time) => this.animate(time));
    }

    reset(particleCount) {
        this.simulation.resetShapes(); // Reset shapes to initial positions first
        this.simulation.particleCount = particleCount;
        this.simulation.bounds.width = this.canvas.getBoundingClientRect().width;
        this.simulation.bounds.height = this.canvas.getBoundingClientRect().height;
        
        // Use current preset's initType if available, otherwise default to 'center'
        const initType = this.ui?.currentPreset?.initType || 'center';
        this.simulation.init(initType);
        
        document.getElementById('particleCount').textContent = particleCount.toLocaleString();
    }

    loadPreset(presetNameOrIndex) {
        let preset;
        
        if (typeof presetNameOrIndex === 'string') {
            preset = this.presetLoader.getPresetByName(presetNameOrIndex);
        } else {
            preset = this.presetLoader.getPresetByIndex(presetNameOrIndex);
        }

        if (!preset) {
            console.error('Preset not found:', presetNameOrIndex);
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        this.simulation = new ParticleSimulation(preset.particles);
        this.simulation.bounds.width = rect.width;
        this.simulation.bounds.height = rect.height;
        
        // Use addShape instead of direct assignment to track initial states
        this.simulation.shapes = [];
        this.simulation.initialShapeStates = [];
        if (preset.shapes) {
            preset.shapes.forEach(shape => {
                this.simulation.addShape({...shape}); // Clone to avoid reference issues
            });
        }
        
        this.simulation.sensor = preset.sensor || null;
        
        // Set wrap edges BEFORE setEmitter and init
        this.simulation.wrapEdges = preset.wrapEdges || false;
        
        // Set emitter if present and adjust position if needed
        if (preset.emitter) {
            const emitter = {...preset.emitter};
            if (emitter.x === -1) emitter.x = rect.width / 2;
            if (emitter.y === -1) emitter.y = rect.height / 2;
            this.simulation.setEmitter(emitter);
        } else {
            this.simulation.setEmitter(null);
        }
        
        // Adjust sensor position if needed
        if (this.simulation.sensor) {
            if (this.simulation.sensor.x === -1) {
                this.simulation.sensor.x = (rect.width - this.simulation.sensor.width) / 2;
            }
            if (this.simulation.sensor.y === -1) {
                this.simulation.sensor.y = (rect.height - this.simulation.sensor.height) / 2;
            }
        }
        
        this.simulation.init(preset.initType || 'center');
        
        // Set glow intensity if specified, otherwise use brighter default
        if (preset.glowIntensity !== undefined) {
            this.renderer.glowIntensity = preset.glowIntensity;
        } else {
            this.renderer.glowIntensity = 1.5;
        }
        
        // Set particle size if specified
        if (preset.particleSize !== undefined) {
            this.renderer.particleSize = preset.particleSize;
            // Update UI slider
            document.getElementById('particleSizeSlider').value = preset.particleSize;
            document.getElementById('particleSizeValue').textContent = preset.particleSize.toFixed(1);
        } else {
            this.renderer.particleSize = 2.0; // Default
            document.getElementById('particleSizeSlider').value = 2.0;
            document.getElementById('particleSizeValue').textContent = '2.0';
        }
        
        // Set speed if specified (lowercase 'speed')
        if (preset.speed !== undefined) {
            this.simulation.speedMultiplier = preset.speed;
            // Update UI slider
            document.getElementById('speedSlider').value = preset.speed;
            document.getElementById('speedValue').textContent = preset.speed.toFixed(1);
        } else {
            this.simulation.speedMultiplier = 1.0; // Default
            document.getElementById('speedSlider').value = 1.0;
            document.getElementById('speedValue').textContent = '1.0';
        }
        
        // Set damping if specified
        if (preset.damping !== undefined) {
            this.simulation.damping = preset.damping;
            // Update UI slider
            document.getElementById('dampingSlider').value = preset.damping;
            document.getElementById('dampingValue').textContent = preset.damping.toFixed(2);
        } else {
            this.simulation.damping = 0.8; // Default
            document.getElementById('dampingSlider').value = 0.8;
            document.getElementById('dampingValue').textContent = '0.80';
        }
        
        // Set force field visibility from preset
        if (preset.showForceField !== undefined) {
            this.simulation.setShowForceField(preset.showForceField);
            const forceFieldCheckbox = document.getElementById('forceFieldCheckbox');
            if (forceFieldCheckbox) {
                forceFieldCheckbox.checked = preset.showForceField;
            }
        } else {
            this.simulation.setShowForceField(false);
            const forceFieldCheckbox = document.getElementById('forceFieldCheckbox');
            if (forceFieldCheckbox) {
                forceFieldCheckbox.checked = false;
            }
        }
        
        // Update wrap edges checkbox (single declaration)
        const wrapEdgesCheckbox = document.getElementById('wrapEdgesCheckbox');
        if (wrapEdgesCheckbox) {
            wrapEdgesCheckbox.checked = this.simulation.wrapEdges;
        }
        
        document.getElementById('particleCount').textContent = preset.particles.toLocaleString();
        document.getElementById('particleCountSlider').value = preset.particles;
        document.getElementById('particleCountValue').textContent = preset.particles.toLocaleString();
    }

    clearShapes() {
        this.simulation.clearShapes();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    setSpeed(speed) {
        this.simulation.speedMultiplier = speed;
    }

    setDamping(damping) {
        this.simulation.damping = damping;
    }

    setParticleSize(size) {
        this.renderer.particleSize = size;
    }

    toggleForceField(show) {
        this.simulation.setShowForceField(show);
    }

    toggleWrapEdges(wrap) {
        this.simulation.wrapEdges = wrap;
    }
}

function isPointInShape(x, y, shape) {
    const dx = x - shape.x;
    const dy = y - shape.y;
    
    if (shape.type === 'circle') {
        return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
    } else if (shape.type === 'rect') {
        return Math.abs(dx) <= shape.width / 2 && 
               Math.abs(dy) <= shape.height / 2;
    }
    return false;
}

function isPositionOccupied(x, y) {
    for (const shape of simulation.shapes) {
        if (isPointInShape(x, y, shape)) {
            return true;
        }
    }
    return false;
}

function initParticles() {
    for (let i = 0; i < particleCount; i++) {
        let x, y;
        let attempts = 0;
        const maxAttempts = 100;
        
        // Try to find an empty position
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
            attempts++;
        } while (isPositionOccupied(x, y) && attempts < maxAttempts);
        
        // Only add particle if we found a valid position
        if (attempts < maxAttempts) {
            particles.push({
                x: x,
                y: y,
                vx: 0,
                vy: 0
            });
        }
    }
}

function updateParticleCountDisplay() {
    particleCountDisplay.textContent = simulation.particleCount;
}

function resetSimulation() {
    // Reset shapes to original positions first
    simulation.resetShapes();
    
    // Then reinitialize particles with the current particle count
    const particleCount = parseInt(particleCountSlider.value);
    simulation.particleCount = particleCount;
    simulation.init(currentPreset?.initType || 'random');
    
    updateParticleCountDisplay();
}

new ParticleAccelerator();

// Load presets
presets.forEach((preset, index) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-preset';
    btn.textContent = preset.name;
    
    btn.addEventListener('click', () => {
        currentPreset = preset;
        
        // Clear existing shapes
        simulation.clearShapes();
        
        // Setup shapes using addShape to track initial states
        if (preset.shapes) {
            preset.shapes.forEach(shape => {
                simulation.addShape({...shape}); // Clone to avoid reference issues
            });
        }
        
        // Setup sensor
        simulation.sensor = preset.sensor || null;
        
        // Update header description
        headerDescription.textContent = preset.description || '';
        
        // Reset simulation with new configuration
        resetSimulation();
    });
    
    // ...existing code...
});

clearShapesBtn.addEventListener('click', () => {
    simulation.clearShapes();
});
