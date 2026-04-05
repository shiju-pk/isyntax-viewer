import type { CanvasTransform } from '../camera/types';
import type { IRendererBackend } from './IRendererBackend';

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

uniform mat3 u_transform;

out vec2 v_texCoord;

void main() {
  vec3 pos = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_windowCenter;
uniform float u_windowWidth;
uniform bool u_applyVOI;
uniform bool u_invert;

out vec4 fragColor;

void main() {
  vec4 color = texture(u_image, v_texCoord);

  if (u_applyVOI) {
    float lower = (u_windowCenter - u_windowWidth * 0.5) / 255.0;
    float upper = (u_windowCenter + u_windowWidth * 0.5) / 255.0;
    float range = upper - lower;
    if (range > 0.0) {
      color.rgb = clamp((color.rgb - lower) / range, 0.0, 1.0);
    }
  }

  if (u_invert) {
    color.rgb = 1.0 - color.rgb;
  }

  fragColor = color;
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${info}`);
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking failed: ${info}`);
  }

  return program;
}

interface UniformLocations {
  u_transform: WebGLUniformLocation | null;
  u_image: WebGLUniformLocation | null;
  u_windowCenter: WebGLUniformLocation | null;
  u_windowWidth: WebGLUniformLocation | null;
  u_applyVOI: WebGLUniformLocation | null;
  u_invert: WebGLUniformLocation | null;
}

export class WebGLBackend implements IRendererBackend {
  private canvas!: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private texture!: WebGLTexture;
  private uniforms!: UniformLocations;
  private initialized = false;

  // VOI state (set externally)
  private windowCenter = 128;
  private windowWidth = 256;
  private applyVOI = false;
  private invert = false;
  private _transformMatrix = new Float32Array(9);

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error('WebGL2 is not supported in this browser');
    }

    this.gl = gl;

    // Compile shaders
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    this.program = createProgram(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Cache uniform locations
    this.uniforms = {
      u_transform: gl.getUniformLocation(this.program, 'u_transform'),
      u_image: gl.getUniformLocation(this.program, 'u_image'),
      u_windowCenter: gl.getUniformLocation(this.program, 'u_windowCenter'),
      u_windowWidth: gl.getUniformLocation(this.program, 'u_windowWidth'),
      u_applyVOI: gl.getUniformLocation(this.program, 'u_applyVOI'),
      u_invert: gl.getUniformLocation(this.program, 'u_invert'),
    };

    // Create full-screen quad geometry
    // positions: clip-space quad, texCoords: [0,0]-[1,1]
    const positions = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);

    const aTexCoord = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);

    // Create texture
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.initialized = true;
  }

  setVOI(windowCenter: number, windowWidth: number, apply = true): void {
    this.windowCenter = windowCenter;
    this.windowWidth = windowWidth;
    this.applyVOI = apply;
  }

  setInvert(invert: boolean): void {
    this.invert = invert;
  }

  clear(color: [number, number, number] = [0, 0, 0]): void {
    if (!this.initialized) return;
    const gl = this.gl;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (
      this.canvas.width !== displayWidth * dpr ||
      this.canvas.height !== displayHeight * dpr
    ) {
      this.canvas.width = displayWidth * dpr;
      this.canvas.height = displayHeight * dpr;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(color[0] / 255, color[1] / 255, color[2] / 255, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawImage(
    source: ImageBitmap | ImageData | OffscreenCanvas,
    transform: CanvasTransform,
    imageWidth: number,
    imageHeight: number
  ): void {
    if (!this.initialized) return;
    const gl = this.gl;

    // Upload texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (source instanceof ImageData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        imageWidth,
        imageHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source.data
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source as TexImageSource
      );
    }

    // Compute transform matrix (3x3 for 2D)
    const canvasW = this.canvas.clientWidth;
    const canvasH = this.canvas.clientHeight;
    const drawW = imageWidth * Math.abs(transform.scaleX);
    const drawH = imageHeight * Math.abs(transform.scaleY);

    // Convert from pixel coordinates to clip space [-1, 1]
    const sx = drawW / canvasW;
    const sy = drawH / canvasH;
    const tx = (2 * transform.offsetX + drawW) / canvasW - 1;
    const ty = 1 - (2 * transform.offsetY + drawH) / canvasH;

    const flipX = transform.scaleX < 0 ? -1 : 1;
    const flipY = transform.scaleY < 0 ? -1 : 1;

    // Column-major 3x3 matrix (reuse pre-allocated array)
    const m = this._transformMatrix;
    m[0] = sx * flipX; m[1] = 0;          m[2] = 0;
    m[3] = 0;          m[4] = sy * flipY; m[5] = 0;
    m[6] = tx;         m[7] = ty;         m[8] = 1;

    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uniforms.u_transform, false, m);
    gl.uniform1i(this.uniforms.u_image, 0);
    gl.uniform1f(this.uniforms.u_windowCenter, this.windowCenter);
    gl.uniform1f(this.uniforms.u_windowWidth, this.windowWidth);
    gl.uniform1i(this.uniforms.u_applyVOI, this.applyVOI ? 1 : 0);
    gl.uniform1i(this.uniforms.u_invert, this.invert ? 1 : 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number): void {
    if (!this.initialized) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  dispose(): void {
    if (!this.initialized) return;
    const gl = this.gl;

    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);

    this.initialized = false;
  }
}
