export class UIController {
    constructor(app) {
        this.app = app;
        this.activePresetButton = null;
        this.currentPresetIndex = 0; // Track current preset
        this.setupEventListeners();
        // Build preset buttons last, after everything else is ready
        setTimeout(() => this.buildPresetButtons(), 0);
    }

    buildPresetButtons() {
        console.log('Building preset buttons...');
        const presets = this.app.presetLoader.getPresets();
        console.log('Loaded presets:', presets);
        
        if (!presets || presets.length === 0) {
            console.error('No presets available');
            return;
        }

        const presetSection = document.querySelector('.control-section');
        
        if (!presetSection) {
            console.error('Preset section not found');
            return;
        }

        // Clear existing preset buttons
        const existingButtons = presetSection.querySelectorAll('.btn-preset');
        existingButtons.forEach(btn => btn.remove());

        const title = presetSection.querySelector('.section-title');
        if (!title) {
            console.error('Section title not found');
            return;
        }

        console.log(`Creating ${presets.length} preset buttons`);

        // Create container to hold buttons in correct order
        const buttonContainer = document.createDocumentFragment();

        // Create all buttons and add to fragment in correct order
        presets.forEach((preset, index) => {
            const button = document.createElement('button');
            button.className = 'btn btn-preset';
            button.textContent = preset.name;
            button.dataset.presetIndex = index;
            button.addEventListener('click', () => {
                // Store current preset
                this.currentPreset = preset;
                this.currentPresetIndex = index;
                
                console.log('Loading preset:', preset.name);
                this.app.loadPreset(index);
                this.showPresetDescription(preset, button);
            });
            
            buttonContainer.appendChild(button);
        });

        // Insert all buttons after title in one operation
        title.after(buttonContainer);

        console.log('Preset buttons created successfully');
    }

    showPresetDescription(preset, button) {
        // Update active button styling
        if (this.activePresetButton) {
            this.activePresetButton.classList.remove('active');
        }
        button.classList.add('active');
        this.activePresetButton = button;

        // Store current preset index
        this.currentPresetIndex = parseInt(button.dataset.presetIndex);

        // Show description in header
        const headerDescription = document.getElementById('headerDescription');
        
        if (preset.description) {
            headerDescription.textContent = preset.description;
            headerDescription.classList.add('visible');
        } else {
            headerDescription.textContent = '';
            headerDescription.classList.remove('visible');
        }
    }

    setupEventListeners() {
        // Particle count slider
        const particleCountSlider = document.getElementById('particleCountSlider');
        const particleCountValue = document.getElementById('particleCountValue');
        
        particleCountSlider.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            particleCountValue.textContent = count.toLocaleString();
        });

        particleCountSlider.addEventListener('change', (e) => {
            const count = parseInt(e.target.value);
            // Instead of reset, reload the preset with new particle count
            this.reloadPresetWithParticleCount(count);
        });

        // Particle size slider
        const particleSizeSlider = document.getElementById('particleSizeSlider');
        const particleSizeValue = document.getElementById('particleSizeValue');
        
        particleSizeSlider.addEventListener('input', (e) => {
            const size = parseFloat(e.target.value);
            particleSizeValue.textContent = size.toFixed(1);
            this.app.setParticleSize(size);
        });

        // Speed slider
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        
        speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            speedValue.textContent = speed.toFixed(1);
            this.app.setSpeed(speed);
        });

        // Damping slider
        const dampingSlider = document.getElementById('dampingSlider');
        const dampingValue = document.getElementById('dampingValue');
        
        dampingSlider.addEventListener('input', (e) => {
            const damping = parseFloat(e.target.value);
            dampingValue.textContent = damping.toFixed(2);
            this.app.setDamping(damping);
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            const particleCount = parseInt(document.getElementById('particleCountSlider').value);
            this.app.reset(particleCount);
        });

        // Pause button
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.addEventListener('click', () => {
            const isPaused = this.app.togglePause();
            pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
        });

        // Clear shapes button
        document.getElementById('clearShapesBtn').addEventListener('click', () => {
            this.app.clearShapes();
        });
    }

    reloadPresetWithParticleCount(newParticleCount) {
        // Get the current preset
        const preset = this.app.presetLoader.getPresetByIndex(this.currentPresetIndex);
        if (!preset) return;

        // Create a modified preset with new particle count
        const modifiedPreset = { ...preset, particles: newParticleCount };
        
        // Reload with modified preset
        const rect = this.app.canvas.getBoundingClientRect();
        this.app.simulation = new (this.app.simulation.constructor)(modifiedPreset.particles);
        this.app.simulation.bounds.width = rect.width;
        this.app.simulation.bounds.height = rect.height;
        this.app.simulation.shapes = modifiedPreset.shapes || [];
        this.app.simulation.sensor = modifiedPreset.sensor || null;
        this.app.simulation.init(modifiedPreset.initType || 'center');
        
        // Restore other settings from preset
        if (modifiedPreset.glowIntensity !== undefined) {
            this.app.renderer.glowIntensity = modifiedPreset.glowIntensity;
        }
        if (modifiedPreset.particleSize !== undefined) {
            this.app.renderer.particleSize = modifiedPreset.particleSize;
        }
        if (modifiedPreset.speed !== undefined) {
            this.app.simulation.speedMultiplier = modifiedPreset.speed;
        }
        if (modifiedPreset.damping !== undefined) {
            this.app.simulation.damping = modifiedPreset.damping;
        }
        
        document.getElementById('particleCount').textContent = newParticleCount.toLocaleString();
    }

    updateParticleCount(count) {
        document.getElementById('particleCount').textContent = count.toLocaleString();
    }
}
