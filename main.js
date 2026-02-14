import { ParticleRenderer } from './renderer.js';
import { ParticleSimulation } from './simulation.js';
import { UIController } from './ui.js';
import { PresetLoader } from './presetLoader.js';

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
                this.simulation = new ParticleSimulation(firstPreset.particles);
                this.simulation.bounds.width = this.canvas.getBoundingClientRect().width;
                this.simulation.bounds.height = this.canvas.getBoundingClientRect().height;
                this.simulation.shapes = firstPreset.shapes || [];
                this.simulation.sensor = firstPreset.sensor || null;
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
            
            // Auto-select first preset button
            setTimeout(() => {
                const firstButton = document.querySelector('.btn-preset');
                if (firstButton) {
                    firstButton.classList.add('active');
                    const firstPresetData = this.presetLoader.getPresetByIndex(0);
                    if (firstPresetData && firstPresetData.description) {
                        document.getElementById('presetDescription').textContent = firstPresetData.description;
                        document.getElementById('descriptionSection').style.display = 'block';
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
            this.simulation.bounds.width = rect.width;
            this.simulation.bounds.height = rect.height;
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
            this.simulation.sensorHits
        );

        requestAnimationFrame((time) => this.animate(time));
    }

    reset(particleCount) {
        this.simulation = new ParticleSimulation(particleCount);
        this.simulation.bounds.width = this.canvas.getBoundingClientRect().width;
        this.simulation.bounds.height = this.canvas.getBoundingClientRect().height;
        this.simulation.init();
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
        this.simulation.shapes = preset.shapes || [];
        this.simulation.sensor = preset.sensor || null;
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
        
        document.getElementById('particleCount').textContent = preset.particles.toLocaleString();
        document.getElementById('particleCountSlider').value = preset.particles;
        document.getElementById('particleCountValue').textContent = preset.particles.toLocaleString();
    }

    clearShapes() {
        this.simulation.shapes = [];
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
}

new ParticleAccelerator();
