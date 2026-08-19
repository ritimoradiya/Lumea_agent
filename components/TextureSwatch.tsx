"use client";

import { useEffect, useRef } from "react";

/**
 * A procedural texture swatch — what a product physically feels like.
 *
 * Real skincare sites show this: a smear of cream, a bead of oil, a gel drop.
 * It is half of how the category sells, and it is the one thing a drawn bottle
 * cannot convey.
 *
 * Each texture is a different fragment shader rather than a different image:
 *
 *   gel    — high refraction, tight caustics, a wet clinging edge
 *   oil    — slow-flowing, warm, broad soft highlights
 *   cream  — matte, opaque, soft-shadowed peaks rather than reflections
 *   water  — thin, fast ripples, almost colourless
 *
 * Raw WebGL on one triangle: no images, no libraries, no download.
 */

export type Texture = "gel" | "oil" | "cream" | "water";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_tint;
/** 0 gel · 1 oil · 2 cream · 3 water */
uniform float u_kind;

vec2 hash(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i + vec2(0,0)), f - vec2(0,0)),
                 dot(hash(i + vec2(1,0)), f - vec2(1,0)), u.x),
             mix(dot(hash(i + vec2(0,1)), f - vec2(0,1)),
                 dot(hash(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p, int octaves){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * noise(p); p *= 2.03; a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 q = uv;
  q.x *= u_res.x / u_res.y;

  // Each texture moves at its own pace. Viscosity is mostly speed.
  float speed = u_kind < 0.5 ? 0.05 : u_kind < 1.5 ? 0.028 : u_kind < 2.5 ? 0.016 : 0.14;
  float t = u_time * speed;

  int octaves = u_kind < 1.5 ? 5 : u_kind < 2.5 ? 3 : 4;
  float scale = u_kind < 0.5 ? 3.4 : u_kind < 1.5 ? 2.2 : u_kind < 2.5 ? 5.2 : 4.6;

  // Domain warp: the surface of a fluid distorts what you see through it.
  vec2 w = vec2(fbm(q * scale + vec2(0.0, t), octaves),
                fbm(q * scale + vec2(4.3, -t), octaves));
  float warpAmount = u_kind < 0.5 ? 1.5 : u_kind < 1.5 ? 1.1 : u_kind < 2.5 ? 0.5 : 1.9;
  float h = fbm(q * scale * 0.9 + w * warpAmount + vec2(t * 0.6, 0.0), octaves);
  h = h * 0.5 + 0.5;

  // A height field gives us a normal, and a normal gives us light.
  float e = 0.0035;
  float hx = fbm((q + vec2(e,0.0)) * scale * 0.9 + w * warpAmount, octaves) * 0.5 + 0.5;
  float hy = fbm((q + vec2(0.0,e)) * scale * 0.9 + w * warpAmount, octaves) * 0.5 + 0.5;
  vec3 normal = normalize(vec3((h - hx) / e, (h - hy) / e, 1.0));

  vec3 lightDir = normalize(vec3(-0.55, 0.72, 0.42));
  float diffuse = max(dot(normal, lightDir), 0.0);
  float specPower = u_kind < 0.5 ? 46.0 : u_kind < 1.5 ? 26.0 : u_kind < 2.5 ? 9.0 : 68.0;
  float specStrength = u_kind < 0.5 ? 0.85 : u_kind < 1.5 ? 0.62 : u_kind < 2.5 ? 0.18 : 1.0;
  float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0,0.0,1.0)), 0.0), specPower);

  vec3 base = u_tint;
  // Cream is opaque and pale; the others take colour from depth, the way a
  // translucent fluid does.
  float depth = u_kind < 2.5 ? mix(0.55, 1.25, h) : mix(0.9, 1.06, h);
  vec3 col = base * depth;
  col += vec3(0.42, 0.40, 0.36) * diffuse * (u_kind < 2.5 ? 0.5 : 0.85);
  col += vec3(1.0) * specular * specStrength;

  // Caustics: light focused by the fluid's own curvature. Gel and water only.
  if (u_kind < 0.5 || u_kind > 2.5) {
    float caustic = pow(max(0.0, 1.0 - abs(h - 0.52) * 7.0), 3.0);
    col += vec3(1.0, 0.98, 0.92) * caustic * 0.34;
  }

  // A soft round edge, so it reads as a placed drop rather than a full bleed.
  float d = length((uv - 0.5) * vec2(u_res.x / u_res.y, 1.0));
  float mask = 1.0 - smoothstep(0.30, 0.49, d);
  mask = clamp(mask + (h - 0.5) * 0.30, 0.0, 1.0);

  vec3 paper = vec3(0.965, 0.957, 0.941);
  col = mix(paper, col, smoothstep(0.05, 0.55, mask));

  // Dither, or a large smooth gradient bands on an 8-bit display.
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.006;
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader alloc failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "compile failed");
  }
  return sh;
}

const KIND: Record<Texture, number> = { gel: 0, oil: 1, cream: 2, water: 3 };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function TextureSwatch({
  texture,
  tint = "#c9b896",
  className,
}: {
  texture: Texture;
  tint?: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // preserveDrawingBuffer keeps the rendered frame readable after
    // compositing, which is what lets these be screenshotted or read back at
    // all. Slight cost, worth it for four small canvases.
    const gl = canvas.getContext("webgl", {
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return;

    let raf = 0;
    let stopped = false;

    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, "u_res");
      const uTime = gl.getUniformLocation(prog, "u_time");
      const uTint = gl.getUniformLocation(prog, "u_tint");
      const uKind = gl.getUniformLocation(prog, "u_kind");

      /**
       * Never size the buffer to zero.
       *
       * A canvas in a hidden tab, a collapsed panel, or a container that has
       * not laid out yet reports clientWidth 0. Writing that to canvas.width
       * gives a zero-size drawing buffer, and every subsequent frame draws
       * nothing — silently, with no GL error. The ResizeObserver will call
       * this again once the element has real dimensions.
       */
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio, 1.6);
        const w = Math.round(canvas.clientWidth * dpr);
        const h = Math.round(canvas.clientHeight * dpr);
        if (w < 2 || h < 2) return;
        if (canvas.width === w && canvas.height === h) return;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      const [r, g, b] = hexToRgb(tint);
      const loop = (t: number) => {
        if (stopped) return;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, t * 0.001);
        gl.uniform3f(uTint, r, g, b);
        gl.uniform1f(uKind, KIND[texture]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      return () => {
        stopped = true;
        cancelAnimationFrame(raf);
        observer.disconnect();
      };
    } catch (error) {
      // A shader that fails to compile should leave nothing rather than a
      // black rectangle, and should say why in the console.
      console.warn("[TextureSwatch] shader unavailable:", error);
      canvas.style.display = "none";
    }
  }, [texture, tint]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
