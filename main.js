import { ParticleRenderer } from './renderer.js';
import { ParticleSimulation } from './simulation.js';
import { UIController } from './ui.js';
import { PresetLoader } from './presetLoader.js';

const SELECTED_PRESET_COOKIE = 'selectedPreset';

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
        
        this.mouseShape = null;
        this.initialPresetIndex = 0;
        this.init();
    }

    getSelectedPresetFromCookie() {
        const cookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${SELECTED_PRESET_COOKIE}=`));

        if (!cookie) {
            return null;
        }

        const value = cookie.substring(SELECTED_PRESET_COOKIE.length + 1);
        return value ? decodeURIComponent(value) : null;
    }

    setSelectedPresetCookie(presetName) {
        const maxAgeSeconds = 60 * 60 * 24 * 365;
        document.cookie = `${SELECTED_PRESET_COOKIE}=${encodeURIComponent(presetName)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
    }

    getInitialPresetIndex(presets) {
        const savedPresetName = this.getSelectedPresetFromCookie();
        if (!savedPresetName) {
            return 0;
        }

        const savedIndex = presets.findIndex((preset) => preset.name === savedPresetName);
        return savedIndex >= 0 ? savedIndex : 0;
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        try {
            // Load presets first
            await this.presetLoader.loadPresets();
            
            // Set screen size for preset scaling
            const rect = this.canvas.getBoundingClientRect();
            this.presetLoader.setScreenSize(rect.width, rect.height);

            this.renderer = new ParticleRenderer(this.canvas);
            await this.renderer.init();
            
            const presets = this.presetLoader.getPresets();
            if (presets && presets.length > 0) {
                this.initialPresetIndex = this.getInitialPresetIndex(presets);
                this.loadPreset(this.initialPresetIndex);
            } else {
                // Fallback to default values if no presets available
                this.simulation = new ParticleSimulation(10000);
                this.simulation.init();
                this.renderer.glowIntensity = 1.5;
            }
            
            // Create UI after presets are loaded
            this.ui = new UIController(this);
            
            this.setupMouseInteraction();
            this.isRunning = true;
            this.animate(0);
        } catch (error) {
            console.error('Failed to initialize:', error);
            alert('Failed to initialize WebGL. Please use a modern browser with WebGL support.');
        }
    }

    setupMouseInteraction() {
        const canvas = this.canvas;

        const getSimPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getSimPos(e);
            this.mouseShape = {
                type: 'circle',
                x: pos.x,
                y: pos.y,
                radius: 50,
                moveable: false,
                color: '#445566'
            };
            this.simulation.shapes.push(this.mouseShape);
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.mouseShape) return;
            const pos = getSimPos(e);
            this.mouseShape.x = pos.x;
            this.mouseShape.y = pos.y;
        });

        const removeMouseShape = () => {
            if (!this.mouseShape) return;
            const idx = this.simulation.shapes.indexOf(this.mouseShape);
            if (idx !== -1) this.simulation.shapes.splice(idx, 1);
            this.mouseShape = null;
        };

        canvas.addEventListener('mouseup', removeMouseShape);
        canvas.addEventListener('mouseleave', removeMouseShape);
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
        
        // Update preset loader screen size
        if (this.presetLoader) {
            this.presetLoader.setScreenSize(rect.width, rect.height);
        }
        
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

            // Reinitialize particle density field if it exists
            if (this.simulation.showParticleDensity) {
                this.simulation.initParticleDensity();
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
            this.simulation.sensors,
            this.simulation.sensorHits,
            this.simulation.forceField,
            this.simulation.forceFieldWidth,
            this.simulation.forceFieldHeight,
            this.simulation.forceFieldResolution,
            this.simulation.particleDensity,
            this.simulation.particleDensityWidth,
            this.simulation.particleDensityHeight,
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
        let selectedPresetIndex = -1;
        
        const rect = this.canvas.getBoundingClientRect();
        
        // Update screen size before getting preset
        this.presetLoader.setScreenSize(rect.width, rect.height);
        
        if (typeof presetNameOrIndex === 'string') {
            preset = this.presetLoader.getPresetByName(presetNameOrIndex);
            selectedPresetIndex = this.presetLoader.getPresets().findIndex((item) => item.name === presetNameOrIndex);
        } else {
            preset = this.presetLoader.getPresetByIndex(presetNameOrIndex);
            selectedPresetIndex = presetNameOrIndex;
        }

        if (!preset) {
            console.error('Preset not found:', presetNameOrIndex);
            return;
        }

        this.setSelectedPresetCookie(preset.name);
        if (selectedPresetIndex >= 0) {
            this.initialPresetIndex = selectedPresetIndex;
        }

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
        // Support both single sensor and sensors array
        this.simulation.sensors = preset.sensors || (preset.sensor ? [preset.sensor] : []);
        
        
        // Set wrap edges BEFORE setEmitter and init
        this.simulation.wrapEdges = preset.wrapEdges || false;
        
        // Set liquid configuration from preset
        if (preset.liquid) {
            this.simulation.liquidConfig = preset.liquid;
        } else {
            this.simulation.liquidConfig = null;
        }
        
        // Set emitter if present (position already scaled by preset loader)
        if (preset.emitter) {
            this.simulation.setEmitter({...preset.emitter});
        } else {
            this.simulation.setEmitter(null);
        }
        
        this.simulation.init(preset.initType || 'center');
        
        // Set glow intensity if specified, otherwise use brighter default
        if (preset.glowIntensity !== undefined) {
            this.renderer.glowIntensity = preset.glowIntensity;
            document.getElementById('glowIntensitySlider').value = preset.glowIntensity;
            document.getElementById('glowIntensityValue').textContent = preset.glowIntensity.toFixed(1);
        } else {
            this.renderer.glowIntensity = 1.5;
            document.getElementById('glowIntensitySlider').value = 1.5;
            document.getElementById('glowIntensityValue').textContent = '1.5';
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

        // Set particle density visibility from preset
        if (preset.showParticleDensity !== undefined) {
            this.simulation.setShowParticleDensity(preset.showParticleDensity);
            const particleDensityCheckbox = document.getElementById('particleDensityCheckbox');
            if (particleDensityCheckbox) {
                particleDensityCheckbox.checked = preset.showParticleDensity;
            }
        } else {
            this.simulation.setShowParticleDensity(false);
            const particleDensityCheckbox = document.getElementById('particleDensityCheckbox');
            if (particleDensityCheckbox) {
                particleDensityCheckbox.checked = false;
            }
        }
        
        // Update wrap edges checkbox (single declaration)
        const wrapEdgesCheckbox = document.getElementById('wrapEdgesCheckbox');
        if (wrapEdgesCheckbox) {
            wrapEdgesCheckbox.checked = this.simulation.wrapEdges;
        }

        // Set particle collisions flag
        this.simulation.particleCollisions = preset.particleCollisions !== false;

        // Update particle collisions checkbox
        const particleCollisionsCheckbox = document.getElementById('particleCollisionsCheckbox');
        if (particleCollisionsCheckbox) {
            particleCollisionsCheckbox.checked = this.simulation.particleCollisions;
        }
        
        document.getElementById('particleCount').textContent = preset.particles.toLocaleString();
        document.getElementById('particleCountSlider').value = preset.particles;
        document.getElementById('particleCountValue').textContent = preset.particles.toLocaleString();

        // Sync optional emitter controls UI with currently loaded preset
        this.ui?.updateEmitterControls?.();
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

    setGlowIntensity(glowIntensity) {
        this.renderer.glowIntensity = glowIntensity;
    }

    toggleForceField(show) {
        this.simulation.setShowForceField(show);
    }

    toggleParticleDensity(show) {
        this.simulation.setShowParticleDensity(show);
    }

    toggleWrapEdges(wrap) {
        this.simulation.wrapEdges = wrap;
    }

    toggleParticleCollisions(enabled) {
        this.simulation.particleCollisions = enabled;
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
        // Setup sensors (support both single sensor and sensors array)
        simulation.sensors = preset.sensors || (preset.sensor ? [preset.sensor] : []);
        
        
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
