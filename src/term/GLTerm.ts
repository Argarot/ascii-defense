/**
 * GLTerm — WebGL2 character-cell display.
 *
 * Replaces the canvas2d Term. Measured reason (ARCHITECTURE §4): under real
 * animation load canvas2d costs 38 ms/frame at 6,000 cells and caps at ~64
 * colours, because it must rasterise every glyph once per colour. Here colour
 * is a per-instance vertex attribute, so 24-bit per cell is free and a fully
 * churning 38,400-cell grid costs ~2.4 ms.
 *
 * Glyphs come from unscii-8 1-bit bitmaps expanded into an atlas at load, drawn
 * with NEAREST filtering. No webfont: at 8 px the browser's rasteriser would
 * decide what our art looks like.
 */

export interface GlyphSet {
  cell: [number, number];
  codepoints: number[];
  bits: string; // base64, 8 bytes per glyph
}

const VS = `#version 300 es
in vec2 a_corner;
in vec2 a_cell;
in float a_glyph;
in vec3 a_fg;
in vec3 a_bg;
uniform vec2 u_grid;
uniform vec2 u_atlasGrid;
out vec2 v_uv;
out vec3 v_fg;
out vec3 v_bg;
void main() {
  vec2 p = (a_cell + a_corner) / u_grid * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  float gx = mod(a_glyph, u_atlasGrid.x);
  float gy = floor(a_glyph / u_atlasGrid.x);
  v_uv = (vec2(gx, gy) + a_corner) / u_atlasGrid;
  v_fg = a_fg;
  v_bg = a_bg;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_fg;
in vec3 v_bg;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  float cov = texture(u_tex, v_uv).a;
  outColor = vec4(mix(v_bg, v_fg, cov), 1.0);
}`;

const ATLAS_COLS = 32;
const FLOATS_PER_CELL = 9;

export interface GLTermOptions {
  cols: number;
  rows: number;
  /** On-screen pixels per glyph, horizontally. Native for the font, or an
   *  integer multiple — a bitmap font at a fractional scale is mush. */
  cellPx?: number;
  /** Vertical pixels per glyph. Defaults to cellPx. Set this for non-square
   *  fonts such as spleen 5x8. */
  cellPxH?: number;
  background?: string;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class GLTerm {
  readonly canvas: HTMLCanvasElement;
  readonly cols: number;
  readonly rows: number;
  readonly cellPx: number;
  readonly cellPxH: number;

  private gl: WebGL2RenderingContext;
  private data: Float32Array;
  private vbo: WebGLBuffer;
  private index = new Map<number, number>(); // codepoint -> atlas slot
  private slotToCp: number[] = [];           // atlas slot -> codepoint
  private atlasRows: number;
  private bgDefault: [number, number, number];
  private cellCount: number;

  constructor(glyphs: GlyphSet, opts: GLTermOptions) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.cellPx = opts.cellPx ?? 8;
    this.cellPxH = opts.cellPxH ?? this.cellPx;
    this.cellCount = this.cols * this.rows;
    this.bgDefault = rgb(opts.background ?? '#07090c');

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cols * this.cellPx;
    this.canvas.height = this.rows * this.cellPxH;
    this.canvas.style.width = `${this.cols * this.cellPx}px`;
    this.canvas.style.imageRendering = 'pixelated';

    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) throw new Error('GLTerm: WebGL2 unavailable');
    this.gl = gl;

    const prog = this.link();
    gl.useProgram(prog);

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(prog, 'a_corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

    this.data = new Float32Array(this.cellCount * FLOATS_PER_CELL);
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS_PER_CELL * 4;
    const attr = (name: string, size: number, offset: number): void => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr('a_cell', 2, 0);
    attr('a_glyph', 1, 8);
    attr('a_fg', 3, 12);
    attr('a_bg', 3, 24);

    this.atlasRows = Math.ceil(glyphs.codepoints.length / ATLAS_COLS);
    this.uploadAtlas(glyphs);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_grid'), this.cols, this.rows);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_atlasGrid'), ATLAS_COLS, this.atlasRows);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.clear();
  }

  private link(): WebGLProgram {
    const gl = this.gl;
    const mk = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }

  /** Expand 1-bit unscii bitmaps into an 8-bit alpha atlas. */
  private uploadAtlas(glyphs: GlyphSet): void {
    const gl = this.gl;
    const [cw, ch] = glyphs.cell;
    const bin = atob(glyphs.bits);
    const w = ATLAS_COLS * cw;
    const h = this.atlasRows * ch;
    const px = new Uint8Array(w * h * 4);
    glyphs.codepoints.forEach((cp, slot) => {
      this.index.set(cp, slot);
      this.slotToCp[slot] = cp;
      const ox = (slot % ATLAS_COLS) * cw;
      const oy = Math.floor(slot / ATLAS_COLS) * ch;
      for (let row = 0; row < ch; row++) {
        const byte = bin.charCodeAt(slot * ch + row);
        for (let col = 0; col < cw; col++) {
          const on = (byte >> (7 - col)) & 1;
          const o = ((oy + row) * w + ox + col) * 4;
          px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = on ? 255 : 0;
        }
      }
    });
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // NEAREST is mandatory: this is a bitmap font, any filtering blurs it.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** True if the glyph set actually contains this character. */
  has(ch: string): boolean { return this.index.has(ch.codePointAt(0) ?? 32); }

  clear(bg?: string): void {
    const c = bg ? rgb(bg) : this.bgDefault;
    const space = this.index.get(32) ?? 0;
    const d = this.data;
    for (let i = 0; i < this.cellCount; i++) {
      const o = i * FLOATS_PER_CELL;
      d[o] = i % this.cols;
      d[o + 1] = (i / this.cols) | 0;
      d[o + 2] = space;
      d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2];
      d[o + 6] = c[0]; d[o + 7] = c[1]; d[o + 8] = c[2];
    }
  }

  put(x: number, y: number, ch: string, fg: string, bg?: string): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const slot = this.index.get(ch.codePointAt(0) ?? 32);
    if (slot === undefined) return; // glyph absent from the set: draw nothing
    const o = (y * this.cols + x) * FLOATS_PER_CELL;
    const f = rgb(fg);
    const d = this.data;
    d[o + 2] = slot;
    d[o + 3] = f[0]; d[o + 4] = f[1]; d[o + 5] = f[2];
    if (bg !== undefined) {
      const b = rgb(bg);
      d[o + 6] = b[0]; d[o + 7] = b[1]; d[o + 8] = b[2];
    }
  }

  write(x: number, y: number, text: string, fg: string, bg?: string): void {
    let i = 0;
    for (const ch of text) this.put(x + i++, y, ch, fg, bg);
  }

  /**
   * Screen state as plain text. This is the QA backbone, not a debug leftover:
   * golden files are git-diffable, so a failing snapshot shows the actual
   * screen in the PR diff. Strictly better than image comparison for an
   * ASCII game — no pixel tolerances, no binary blobs in the repo.
   */
  toText(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.rows; y++) {
      let line = '';
      for (let x = 0; x < this.cols; x++) {
        const slot = this.data[(y * this.cols + x) * FLOATS_PER_CELL + 2];
        line += String.fromCodePoint(this.slotToCp[slot] ?? 32);
      }
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }

  flush(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.cellCount);
  }
}
