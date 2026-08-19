"use client";

import { useEffect, useRef } from "react";

/**
 * The hero backdrop: a domain-warped fractal noise field.
 *
 * Two noise fields where the first distorts the input coordinates of the
 * second. Plain noise looks like cloud; warped noise looks like liquid —
 * it is the same trick behind marbling and ink-in-water.
 *
 * Raw WebGL on a single full-screen triangle. No Three.js, no model files,
 * no textures — which makes it dramatically cheaper than the 3D product
 * render it replaced, and it degrades to flat paper if WebGL is missing.
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;

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
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 q = uv;
  q.x *= u_res.x / u_res.y;

  float t = u_time * 0.055;
  vec2 drift = (u_mouse - 0.5) * 0.22;

  vec2 w = vec2(
    fbm(q * 1.9 + vec2(0.0, t) + drift),
    fbm(q * 1.9 + vec2(3.7, -t * 0.85) + drift)
  );
  float f = fbm(q * 2.4 + w * 2.4 + vec2(t * 0.5, 0.0));
  f = f * 0.5 + 0.5;

  vec3 paper = vec3(0.980, 0.972, 0.960);
  vec3 stone = vec3(0.871, 0.831, 0.769);
  vec3 sage  = vec3(0.545, 0.627, 0.494);
  vec3 deep  = vec3(0.325, 0.408, 0.290);
  vec3 amber = vec3(0.816, 0.573, 0.263);

  vec3 col = mix(paper, stone, smoothstep(0.24, 0.55, f));
  col = mix(col, sage, smoothstep(0.38, 0.74, f));
  col = mix(col, deep, smoothstep(0.66, 0.94, f) * 0.85);
  col = mix(col, amber,
    smoothstep(0.60, 0.72, f) * (1.0 - smoothstep(0.72, 0.84, f)) * 0.55);

  float sheen = smoothstep(0.38, 0.47, f) * (1.0 - smoothstep(0.47, 0.60, f));
  col += sheen * 0.16;

  // One soft organic mass right of centre, so the headline sits on clean
  // paper rather than fighting the artwork. The noise chews at the
  // silhouette so the edge reads organic instead of as a circle.
  vec2 c = vec2(0.715, 0.47);
  vec2 d = (uv - c) * vec2(u_res.x / u_res.y * 0.52, 1.0);
  float mass = 1.0 - smoothstep(0.06, 0.74, length(d));
  mass = clamp(mass + (f - 0.5) * 0.50, 0.0, 1.0);
  mass = smoothstep(0.04, 0.72, mass);
  col = mix(paper, col, mass);

  col *= 1.0 - 0.10 * pow(length(uv - 0.5) * 1.2, 2.6);
  // A touch of dither, or large flat gradients band on 8-bit displays.
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.006;

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("could not create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

export default function LiquidHero() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return; // Falls back to the paper background beneath.

    let frame = 0;
    let disposed = false;

    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      // One oversized triangle covers the viewport more cheaply than a quad.
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, "u_res");
      const uTime = gl.getUniformLocation(prog, "u_time");
      const uMouse = gl.getUniformLocation(prog, "u_mouse");

      let mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
      const onMove = (e: PointerEvent) => {
        tmx = e.clientX / window.innerWidth;
        tmy = 1 - e.clientY / window.innerHeight;
      };
      window.addEventListener("pointermove", onMove);

      const resize = () => {
        // Capped device pixel ratio: a full-screen shader at 3x on a
        // retina display costs far more than it looks better.
        const dpr = Math.min(window.devicePixelRatio, 1.75);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      window.addEventListener("resize", resize);
      resize();

      const loop = (t: number) => {
        if (disposed) return;
        mx += (tmx - mx) * 0.035;
        my += (tmy - my) * 0.035;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, t * 0.001);
        gl.uniform2f(uMouse, mx, my);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", resize);
      };
    } catch {
      // A failed shader compile should leave plain paper, not a black hole.
      canvas.style.display = "none";
    }
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 -z-10 h-full w-full"
    />
  );
}
