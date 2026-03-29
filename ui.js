export class UIController {
    constructor(app) {
        this.app = app;
        this.activePresetButton = null;
        this.currentPresetIndex = 0; // Track current preset
        this.setupEventListeners();
        this.setupEmitterControls();
        this.updateEmitterControls();
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
                this.currentPreset = preset;
                this.currentPresetIndex = index;
                this.app.loadPreset(index);
                this.updateEmitterControls();
                this.showPresetDescription(preset, button);
                
                // Close mobile menu after selection
                if (this.handlePresetClick) {
                    this.handlePresetClick();
                }
            });
            
            buttonContainer.appendChild(button);
        });

        // Insert all buttons after title in one operation
        title.after(buttonContainer);

        // Auto-select the startup preset button (saved preset if available)
        const desiredIndex = Number.isInteger(this.app.initialPresetIndex) ? this.app.initialPresetIndex : 0;
        const safeIndex = Math.min(Math.max(desiredIndex, 0), presets.length - 1);
        const initialButton = presetSection.querySelector(`.btn-preset[data-preset-index="${safeIndex}"]`);
        if (initialButton) {
            this.currentPresetIndex = safeIndex;
            this.currentPreset = presets[safeIndex];
            this.showPresetDescription(this.currentPreset, initialButton);
        }
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

        // Show preset name and description in header
        const headerPresetName = document.getElementById('headerPresetName');
        const headerDescription = document.getElementById('headerDescription');
        
        if (preset.name) {
            headerPresetName.textContent = preset.name;
            headerPresetName.classList.add('visible');
        } else {
            headerPresetName.textContent = '';
            headerPresetName.classList.remove('visible');
        }
        
        if (preset.description) {
            headerDescription.textContent = preset.description;
            headerDescription.classList.add('visible');
        } else {
            headerDescription.textContent = '';
            headerDescription.classList.remove('visible');
        }

        const headerEquation = document.getElementById('headerEquation');
        if (preset.equation) {
            headerEquation.innerHTML = preset.equation;
            headerEquation.classList.add('visible');
            if (window.MathJax) {
                MathJax.typesetPromise([headerEquation]).catch(err => console.log(err));
            }
        } else {
            headerEquation.innerHTML = '';
            headerEquation.classList.remove('visible');
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const controlPanel = document.querySelector('.control-panel');
        
        if (mobileMenuToggle && controlPanel) {
            mobileMenuToggle.addEventListener('click', () => {
                controlPanel.classList.toggle('open');
                mobileMenuToggle.textContent = controlPanel.classList.contains('open') ? '✕' : '☰';
            });

            // Close menu when clicking on the drag handle area
            controlPanel.addEventListener('click', (e) => {
                if (e.target === controlPanel && window.innerWidth <= 768) {
                    controlPanel.classList.remove('open');
                    mobileMenuToggle.textContent = '☰';
                }
            });

            // Close menu when a preset is selected on mobile
            const handlePresetClick = () => {
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        controlPanel.classList.remove('open');
                        mobileMenuToggle.textContent = '☰';
                    }, 300);
                }
            };

            // Add this handler to preset buttons after they're created
            this.handlePresetClick = handlePresetClick;
        }

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

        // Glow intensity slider
        const glowIntensitySlider = document.getElementById('glowIntensitySlider');
        const glowIntensityValue = document.getElementById('glowIntensityValue');

        glowIntensitySlider.addEventListener('input', (e) => {
            const glow = parseFloat(e.target.value);
            glowIntensityValue.textContent = glow.toFixed(1);
            this.app.setGlowIntensity(glow);
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

        // Force field checkbox
        const forceFieldCheckbox = document.getElementById('forceFieldCheckbox');
        if (forceFieldCheckbox) {
            forceFieldCheckbox.addEventListener('change', (e) => {
                this.app.toggleForceField(e.target.checked);
            });
            forceFieldCheckbox.checked = !!this.app.simulation?.showForceField;
        }

        // Particle density checkbox
        const particleDensityCheckbox = document.getElementById('particleDensityCheckbox');
        if (particleDensityCheckbox) {
            particleDensityCheckbox.addEventListener('change', (e) => {
                this.app.toggleParticleDensity(e.target.checked);
            });
            particleDensityCheckbox.checked = !!this.app.simulation?.showParticleDensity;
        }

        // Wrap edges checkbox
        const wrapEdgesCheckbox = document.getElementById('wrapEdgesCheckbox');
        if (wrapEdgesCheckbox) {
            wrapEdgesCheckbox.addEventListener('change', (e) => {
                this.app.toggleWrapEdges(e.target.checked);
            });
        }

        // Particle collisions checkbox
        const particleCollisionsCheckbox = document.getElementById('particleCollisionsCheckbox');
        if (particleCollisionsCheckbox) {
            particleCollisionsCheckbox.addEventListener('change', (e) => {
                this.app.toggleParticleCollisions(e.target.checked);
            });
        }
    }

    setupEmitterControls() {
        const bindSlider = (sliderId, valueId, formatter, onChange) => {
            const slider = document.getElementById(sliderId);
            const value = document.getElementById(valueId);
            if (!slider || !value) return;

            slider.addEventListener('input', (e) => {
                const parsed = parseFloat(e.target.value);
                value.textContent = formatter(parsed);
                onChange(parsed);
            });
        };

        bindSlider('emitterParticlesPerSecondSlider', 'emitterParticlesPerSecondValue', (v) => Math.round(v).toString(), (v) => {
            if (this.app.simulation?.emitter) this.app.simulation.emitter.particlesPerSecond = Math.round(v);
        });

        bindSlider('emitterParticleSpeedSlider', 'emitterParticleSpeedValue', (v) => Math.round(v).toString(), (v) => {
            if (this.app.simulation?.emitter) this.app.simulation.emitter.particleSpeed = v;
        });

        bindSlider('emitterRadiusSlider', 'emitterRadiusValue', (v) => Math.round(v).toString(), (v) => {
            if (this.app.simulation?.emitter) this.app.simulation.emitter.radius = v;
        });

        bindSlider('emitterSpreadSlider', 'emitterSpreadValue', (v) => v.toFixed(2), (v) => {
            if (this.app.simulation?.emitter) this.app.simulation.emitter.spread = v;
        });

        bindSlider('emitterOffsetXSlider', 'emitterOffsetXValue', (v) => Math.round(v).toString(), (v) => {
            if (this.app.simulation?.emitter) this.app.simulation.emitter.offsetX = Math.round(v);
        });

        bindSlider('emitterOffsetYSlider', 'emitterOffsetYValue', (v) => Math.round(v).toString(), (v) => {
            if (this.app.simulation?.emitter) this.app.simulation.emitter.offsetY = Math.round(v);
        });

        const thirdLawCheckbox = document.getElementById('emitterThirdLawCheckbox');
        if (thirdLawCheckbox) {
            thirdLawCheckbox.addEventListener('change', (e) => {
                if (this.app.simulation?.emitter) {
                    this.app.simulation.emitter.thirdLawForces = e.target.checked;
                }
            });
        }
    }

    updateEmitterControls() {
        const section = document.getElementById('emitterControlsSection');
        const emitter = this.app.simulation?.emitter;
        if (!section) return;

        if (!emitter) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';

        const setSlider = (sliderId, valueId, rawValue, formatter) => {
            const slider = document.getElementById(sliderId);
            const value = document.getElementById(valueId);
            if (!slider || !value) return;
            const resolved = rawValue ?? 0;
            slider.value = resolved;
            value.textContent = formatter(resolved);
        };

        setSlider('emitterParticlesPerSecondSlider', 'emitterParticlesPerSecondValue', emitter.particlesPerSecond, (v) => Math.round(v).toString());
        setSlider('emitterParticleSpeedSlider', 'emitterParticleSpeedValue', emitter.particleSpeed, (v) => Math.round(v).toString());
        setSlider('emitterRadiusSlider', 'emitterRadiusValue', emitter.radius, (v) => Math.round(v).toString());
        setSlider('emitterSpreadSlider', 'emitterSpreadValue', emitter.spread, (v) => Number(v).toFixed(2));
        setSlider('emitterOffsetXSlider', 'emitterOffsetXValue', emitter.offsetX, (v) => Math.round(v).toString());
        setSlider('emitterOffsetYSlider', 'emitterOffsetYValue', emitter.offsetY, (v) => Math.round(v).toString());

        const thirdLawCheckbox = document.getElementById('emitterThirdLawCheckbox');
        if (thirdLawCheckbox) {
            thirdLawCheckbox.checked = emitter.thirdLawForces !== false;
        }
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
        // Support both single sensor and sensors array
        this.app.simulation.sensors = modifiedPreset.sensors || (modifiedPreset.sensor ? [modifiedPreset.sensor] : []);
        
        // Set liquid configuration BEFORE init
        if (modifiedPreset.liquid) {
            this.app.simulation.liquidConfig = modifiedPreset.liquid;
        }

        // Set emitter before init so emitter pool modes initialize correctly
        if (modifiedPreset.emitter) {
            this.app.simulation.setEmitter({ ...modifiedPreset.emitter });
        } else {
            this.app.simulation.setEmitter(null);
        }
        
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

        this.updateEmitterControls();
        
        document.getElementById('particleCount').textContent = newParticleCount.toLocaleString();
    }

    updateParticleCount(count) {
        document.getElementById('particleCount').textContent = count.toLocaleString();
    }
}
