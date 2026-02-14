export class ParticleRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.positionBuffer = null;
        this.velocityBuffer = null;
        this.particleSize = 2.0;
        this.glowIntensity = 1.0;
        this.ctx2d = null;
    }

    async init() {
        const gl = this.canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            powerPreference: 'high-performance'
        });

        if (!gl) {
            throw new Error('WebGL 2 not supported');
        }

        this.gl = gl;

        // Create 2D context for shapes (using a temporary canvas)
        const tempCanvas = document.createElement('canvas');
        this.ctx2d = tempCanvas.getContext('2d');        

        const vertexShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 a_position;
            in vec2 a_velocity;
            
            uniform vec2 u_resolution;
            uniform float u_pointSize;
            uniform float u_glowIntensity;
            
            out vec4 v_color;
            
            void main() {
                vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                gl_PointSize = u_pointSize * u_glowIntensity * 0.5;
                
                float speed = length(a_velocity);
                float hue = clamp(speed * 0.002, 0.0, 1.0); // Adjusted for better speed to color mapping
                
                // HSV to RGB conversion for velocity-based coloring
                vec3 baseColor;
                float saturation = 0.8;
                float value = 1.0;
                
                float c = value * saturation;
                float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
                float m = value - c;
                
                if (hue < 0.166) baseColor = vec3(c, x, 0);
                else if (hue < 0.333) baseColor = vec3(x, c, 0);
                else if (hue < 0.5) baseColor = vec3(0, c, x);
                else if (hue < 0.666) baseColor = vec3(0, x, c);
                else if (hue < 0.833) baseColor = vec3(x, 0, c);
                else baseColor = vec3(c, 0, x);
                
                baseColor = baseColor + vec3(m);
                
                // Apply glow intensity
                vec3 finalColor = baseColor * u_glowIntensity + vec3(0.4);
                finalColor = clamp(finalColor, 0.0, 3.0);
                
                v_color = vec4(finalColor, min(0.95 * u_glowIntensity, 1.0));
            }
        `;

        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec4 v_color;
            out vec4 fragColor;
            
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float dist = length(coord);
                if (dist > 0.5) discard;
                
                // Softer falloff for more visible glow
                float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
                fragColor = vec4(v_color.rgb, v_color.a * alpha);
            }
        `;

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);

        this.positionBuffer = gl.createBuffer();
        this.velocityBuffer = gl.createBuffer();

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    render(positions, velocities, shapes = [], sensor = null, sensorHits = null) {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Draw shapes first
        this.drawShapes(shapes);
        
        // Draw sensor with hit visualization
        if (sensor && sensorHits) {
            this.drawSensor(sensor, sensorHits);
        }
        
        // Then draw particles
        gl.useProgram(this.program);

        // Position attribute
        const positionLoc = gl.getAttribLocation(this.program, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // Velocity attribute
        const velocityLoc = gl.getAttribLocation(this.program, 'a_velocity');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.velocityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(velocityLoc);
        gl.vertexAttribPointer(velocityLoc, 2, gl.FLOAT, false, 0, 0);

        // Uniforms
        const resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
        gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);

        const pointSizeLoc = gl.getUniformLocation(this.program, 'u_pointSize');
        gl.uniform1f(pointSizeLoc, this.particleSize * window.devicePixelRatio);

        const glowIntensityLoc = gl.getUniformLocation(this.program, 'u_glowIntensity');
        gl.uniform1f(glowIntensityLoc, this.glowIntensity);

        gl.drawArrays(gl.POINTS, 0, positions.length / 2);
    }

    drawSensor(sensor, sensorHits) {
        const gl = this.gl;
        const dpr = window.devicePixelRatio || 1;

        if (!this.sensorProgram) {
            const vertexShader = this.createShader(gl.VERTEX_SHADER, `#version 300 es
                precision highp float;
                in vec2 a_position;
                in float a_intensity;
                uniform vec2 u_resolution;
                out float v_intensity;
                
                void main() {
                    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
                    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                    v_intensity = a_intensity;
                }
            `);

            const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, `#version 300 es
                precision highp float;
                in float v_intensity;
                out vec4 fragColor;
                
                void main() {
                    // Brighter color gradient from blue to bright white
                    float intensity = clamp(v_intensity / 5.0, 0.0, 1.0);
                    intensity = pow(intensity, 0.7); // Gamma correction for brighter appearance
                    
                    vec3 color = mix(
                        vec3(0.2, 0.3, 0.5),  // Brighter blue base
                        vec3(1.5, 2.0, 2.0),  // Very bright cyan/white (values > 1.0 for bloom effect)
                        intensity
                    );
                    fragColor = vec4(color, 0.9);
                }
            `);

            this.sensorProgram = gl.createProgram();
            gl.attachShader(this.sensorProgram, vertexShader);
            gl.attachShader(this.sensorProgram, fragmentShader);
            gl.linkProgram(this.sensorProgram);

            this.sensorPositionBuffer = gl.createBuffer();
            this.sensorIntensityBuffer = gl.createBuffer();
        }

        gl.useProgram(this.sensorProgram);

        const resolution = 1;
        const width = Math.ceil(sensor.width / resolution);
        const height = Math.ceil(sensor.height / resolution);
        
        // Create vertices and intensities for each cell
        const vertices = [];
        const intensities = [];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const px = (sensor.x + x * resolution) * dpr;
                const py = (sensor.y + y * resolution) * dpr;
                const pw = resolution * dpr;
                const ph = resolution * dpr;
                
                const index = y * width + x;
                const intensity = sensorHits[index] || 0;
                
                // Two triangles per cell
                vertices.push(
                    px, py,
                    px + pw, py,
                    px, py + ph,
                    px, py + ph,
                    px + pw, py,
                    px + pw, py + ph
                );
                
                for (let i = 0; i < 6; i++) {
                    intensities.push(intensity);
                }
            }
        }

        const posLoc = gl.getAttribLocation(this.sensorProgram, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sensorPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const intensityLoc = gl.getAttribLocation(this.sensorProgram, 'a_intensity');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sensorIntensityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(intensities), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(intensityLoc);
        gl.vertexAttribPointer(intensityLoc, 1, gl.FLOAT, false, 0, 0);

        const resLoc = gl.getUniformLocation(this.sensorProgram, 'u_resolution');
        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
    }

    drawShapes(shapes) {
        if (shapes.length === 0) return;

        const dpr = window.devicePixelRatio;

        // Draw shapes using immediate mode rendering
        shapes.forEach(shape => {
            if (shape.type === 'rect') {
                const angle = shape.angle || 0;
                this.drawRect(
                    shape.x * dpr, 
                    shape.y * dpr, 
                    shape.width * dpr, 
                    shape.height * dpr,
                    angle
                );
            }
        });
    }

    drawRect(x, y, width, height, angle = 0) {
        const gl = this.gl;

        // Create a simple shader program for rectangles if not exists
        if (!this.rectProgram) {
            const vertexShader = this.createShader(gl.VERTEX_SHADER, `#version 300 es
                precision highp float;
                in vec2 a_position;
                uniform vec2 u_resolution;
                uniform vec2 u_center;
                uniform float u_angle;
                
                void main() {
                    // Rotate around center
                    vec2 pos = a_position - u_center;
                    float c = cos(u_angle);
                    float s = sin(u_angle);
                    vec2 rotated = vec2(
                        pos.x * c - pos.y * s,
                        pos.x * s + pos.y * c
                    );
                    vec2 final = rotated + u_center;
                    
                    vec2 clipSpace = (final / u_resolution) * 2.0 - 1.0;
                    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                }
            `);

            const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, `#version 300 es
                precision highp float;
                out vec4 fragColor;
                
                void main() {
                    fragColor = vec4(0.3, 0.3, 0.4, 1.0);
                }
            `);

            this.rectProgram = gl.createProgram();
            gl.attachShader(this.rectProgram, vertexShader);
            gl.attachShader(this.rectProgram, fragmentShader);
            gl.linkProgram(this.rectProgram);

            this.rectBuffer = gl.createBuffer();
        }

        gl.useProgram(this.rectProgram);

        // Create rectangle vertices
        const vertices = new Float32Array([
            x, y,
            x + width, y,
            x, y + height,
            x, y + height,
            x + width, y,
            x + width, y + height
        ]);

        const posLoc = gl.getAttribLocation(this.rectProgram, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const resLoc = gl.getUniformLocation(this.rectProgram, 'u_resolution');
        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);

        const centerLoc = gl.getUniformLocation(this.rectProgram, 'u_center');
        gl.uniform2f(centerLoc, (x + width / 2) * (window.devicePixelRatio || 1), 
                                (y + height / 2) * (window.devicePixelRatio || 1));

        const angleLoc = gl.getUniformLocation(this.rectProgram, 'u_angle');
        gl.uniform1f(angleLoc, angle);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    resize(width, height) {
        this.gl.viewport(0, 0, width, height);
    }
}
