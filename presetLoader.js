export class PresetLoader {
    constructor() {
        this.presets = [];
        this.loaded = false;
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
        return this.presets;
    }

    getPresetByName(name) {
        return this.presets.find(preset => preset.name === name);
    }

    getPresetByIndex(index) {
        return this.presets[index];
    }
}
