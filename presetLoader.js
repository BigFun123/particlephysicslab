export class PresetLoader {
    constructor() {
        this.presets = [];
        this.loaded = false;
        this.referenceWidth = 1920;
        this.referenceHeight = 1080;
        this.currentWidth = 1920;
        this.currentHeight = 1080;
    }

    setScreenSize(width, height) {
        this.currentWidth = width;
        this.currentHeight = height;
    }

    async loadPresets() {
        console.log('Loading presets from presets.json...');
        try {
            const response = await fetch('presets.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            console.log('Raw JSON:', text);
            
            this.presets = JSON.parse(text);
            this.loaded = true;
            console.log('Presets loaded successfully:', this.presets);
            return this.presets;
        } catch (error) {
            console.error('Error loading presets:', error);
            console.log('Using default presets as fallback');
            // Return default presets as fallback
            this.presets = this.getDefaultPresets();
            this.loaded = true;
            return this.presets;
        }
    }

    getDefaultPresets() {
        return [
            {
                name: "Small Field",
                particles: 10000,
                initType: "random",
                shapes: []
            },
            {
                name: "Blank Field",
                particles: 100000,
                initType: "random",
                shapes: []
            },
            {
                name: "Center Explosion",
                particles: 1000000,
                initType: "center",
                shapes: []
            }
        ];
    }

    getPresets() {
        // Return scaled presets if screen size is set
        if (this.currentWidth && this.currentHeight) {
            return this.presets.map(preset => 
                this.scalePresetToScreen(preset, this.currentWidth, this.currentHeight)
            );
        }
        return this.presets;
    }

    getPresetByName(name, screenWidth, screenHeight) {
        const preset = this.presets.find(preset => preset.name === name);
        if (!preset) return null;
        
        // Use provided dimensions or fall back to current screen size
        const width = screenWidth || this.currentWidth;
        const height = screenHeight || this.currentHeight;
        
        if (width && height) {
            return this.scalePresetToScreen(preset, width, height);
        }
        return preset;
    }

    getPresetByIndex(index, screenWidth, screenHeight) {
        const preset = this.presets[index];
        if (!preset) return null;
        
        // Use provided dimensions or fall back to current screen size
        const width = screenWidth || this.currentWidth;
        const height = screenHeight || this.currentHeight;
        
        if (width && height) {
            return this.scalePresetToScreen(preset, width, height);
        }
        return preset;
    }

    scalePresetToScreen(preset, screenWidth, screenHeight) {
        const scaleX = screenWidth / this.referenceWidth;
        const scaleY = screenHeight / this.referenceHeight;
        
        // Use uniform scaling to maintain aspect ratio and prevent distortion
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate centering offsets for uniform scaling
        const offsetX = (screenWidth - this.referenceWidth * scale) / 2;
        const offsetY = (screenHeight - this.referenceHeight * scale) / 2;
        
        // Create a deep copy of the preset to avoid modifying the original
        const scaledPreset = JSON.parse(JSON.stringify(preset));
        
        // Scale shapes
        if (scaledPreset.shapes && scaledPreset.shapes.length > 0) {
            scaledPreset.shapes = scaledPreset.shapes.map(shape => {
                const scaledShape = { ...shape };
                
                if (shape.type === 'rect') {
                    scaledShape.x = shape.x * scale + offsetX;
                    scaledShape.y = shape.y * scale + offsetY;
                    scaledShape.width = shape.width * scale;
                    scaledShape.height = shape.height * scale;
                } else if (shape.type === 'circle') {
                    scaledShape.x = shape.x * scale + offsetX;
                    scaledShape.y = shape.y * scale + offsetY;
                    scaledShape.radius = shape.radius * scale;
                    
                    // Scale velocity if present
                    if (shape.vx !== undefined) {
                        scaledShape.vx = shape.vx * scale;
                    }
                    if (shape.vy !== undefined) {
                        scaledShape.vy = shape.vy * scale;
                    }
                    if (shape.constantSpeed !== undefined) {
                        scaledShape.constantSpeed = shape.constantSpeed * scale;
                    }
                }
                
                return scaledShape;
            });
        }
        
        // Scale sensor
        if (scaledPreset.sensor) {
            scaledPreset.sensor = { ...scaledPreset.sensor };
            
            // Handle -1 values (center positioning)
            if (scaledPreset.sensor.x === -1) {
                scaledPreset.sensor.x = (screenWidth - scaledPreset.sensor.width * scale) / 2;
            } else {
                scaledPreset.sensor.x = scaledPreset.sensor.x * scale + offsetX;
            }
            
            if (scaledPreset.sensor.y === -1) {
                scaledPreset.sensor.y = (screenHeight - scaledPreset.sensor.height * scale) / 2;
            } else {
                scaledPreset.sensor.y = scaledPreset.sensor.y * scale + offsetY;
            }
            
            scaledPreset.sensor.width = scaledPreset.sensor.width * scale;
            scaledPreset.sensor.height = scaledPreset.sensor.height * scale;
        }
        
        // Scale emitter
        if (scaledPreset.emitter) {
            scaledPreset.emitter = { ...scaledPreset.emitter };
            
            // Handle -1 values (center positioning)
            if (scaledPreset.emitter.x === -1) {
                scaledPreset.emitter.x = screenWidth / 2;
            } else {
                scaledPreset.emitter.x = scaledPreset.emitter.x * scale + offsetX;
            }
            
            if (scaledPreset.emitter.y === -1) {
                scaledPreset.emitter.y = screenHeight / 2;
            } else {
                scaledPreset.emitter.y = scaledPreset.emitter.y * scale + offsetY;
            }
            
            scaledPreset.emitter.radius = scaledPreset.emitter.radius * scale;
            scaledPreset.emitter.particleSpeed = scaledPreset.emitter.particleSpeed * scale;
        }
        
        return scaledPreset;
    }
}
