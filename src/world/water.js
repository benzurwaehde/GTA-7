import * as THREE from 'three';
import { COAST } from './coast.js';

// Sea: one transparent mesh that follows the camera (snapped to the vertex grid, so waves stay put in world space).
// - four travelling sine waves (the two long ones also displace the vertices, all four give the analytic normal)
// - two scrolling normal-map layers in different directions for the fine ripples
// - Fresnel mix of water colour and sky colour, sun / moon glint
// - depth from the shared coast profile: shallow turquoise near the beach, foam band with a moving wash line
// Day / night: the colours and the light factor come from City._applyTime through setEnv().
const SIZE = 1700, SEG = 170, GRID = SIZE / SEG;

const GLSL_COMMON = /* glsl */`
  uniform float uTime;
  uniform vec4 uCoast; // flat, slopeEnd, slopeDepth, deepRate
  uniform float uSea;
  float groundH(float d){
    if (d <= uCoast.x) return 0.0;
    if (d >= uCoast.y) return uCoast.z - (d - uCoast.y) * uCoast.w;
    return uCoast.z * (d - uCoast.x) / (uCoast.y - uCoast.x);
  }
  // (height, dh/dx, dh/dz) of one directional wave
  vec3 wave(vec2 p, vec2 dir, float len, float amp, float spd){
    float k = 6.28318 / len;
    float ph = dot(p, dir) * k + uTime * spd;
    float s = sin(ph), c = cos(ph);
    return vec3(s * amp, c * amp * k * dir.x, c * amp * k * dir.y);
  }
`;

const VERT = /* glsl */`
  ${GLSL_COMMON}
  #include <fog_pars_vertex>
  varying vec3 vW;
  varying float vH;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float d = max(abs(wp.x), abs(wp.z));
    float depth = uSea - groundH(d);
    float fade = smoothstep(0.0, 0.9, depth);
    vec3 w = wave(wp.xz, normalize(vec2(1.0, 0.35)), 38.0, 0.16, 1.1) + wave(wp.xz, normalize(vec2(-0.5, 1.0)), 21.0, 0.10, 1.5);
    wp.y = uSea + w.x * fade;
    vH = w.x * fade;
    vW = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */`
  ${GLSL_COMMON}
  uniform sampler2D uNormal;
  uniform vec3 uDeep, uShallow, uTop, uHor, uSun;
  uniform float uNight, uLight;
  varying vec3 vW;
  varying float vH;
  #include <fog_pars_fragment>
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    vec2 p = vW.xz;
    float d = max(abs(p.x), abs(p.y));
    float depth = uSea - groundH(d);             // metres of water above the sea floor
    vec3 toCam = cameraPosition - vW;
    float dist = length(toCam);
    vec3 V = toCam / dist;

    // normal: 4 waves (analytic) + 2 scrolling normal maps
    float fade = smoothstep(0.0, 0.9, depth);
    vec3 g = wave(p, normalize(vec2(1.0, 0.35)), 38.0, 0.16, 1.1) + wave(p, normalize(vec2(-0.5, 1.0)), 21.0, 0.10, 1.5)
           + (wave(p, normalize(vec2(0.8, -0.6)), 11.0, 0.05, 2.1) + wave(p, normalize(vec2(-1.0, -0.2)), 6.0, 0.03, 2.8)) * (1.0 - smoothstep(50.0, 260.0, dist));
    vec3 N = normalize(vec3(-g.y * fade, 1.0, -g.z * fade));
    float far = 1.0 - smoothstep(40.0, 300.0, dist);
    vec3 n1 = texture2D(uNormal, p * 0.045 + vec2(uTime * 0.020, uTime * 0.013)).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormal, p * 0.105 * vec2(-1.0, 1.0) + vec2(-uTime * 0.017, uTime * 0.026)).xyz * 2.0 - 1.0;
    N = normalize(N + vec3(n1.x + n2.x, 0.0, n1.y + n2.y) * 0.32 * far);

    // colour by depth + Fresnel against the sky
    float dK = 1.0 - exp(-max(depth, 0.0) * 0.55);
    vec3 base = mix(uShallow, uDeep, dK) * (0.25 + 0.75 * uLight);
    vec3 R = reflect(-V, N);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 sky = mix(uHor, uTop, pow(max(R.y, 0.0), 0.5));
    vec3 sunCol = mix(vec3(1.0, 0.55, 0.28), vec3(1.0, 0.95, 0.82), clamp(uSun.y * 2.0, 0.0, 1.0));
    float sd = max(dot(R, uSun), 0.0);
    sky += sunCol * (pow(sd, 700.0) * 5.0 + pow(sd, 40.0) * 0.18) * (1.0 - uNight);
    float md = max(dot(R, -uSun), 0.0);
    sky += vec3(0.7, 0.8, 1.0) * (pow(md, 500.0) * 2.5 + pow(md, 30.0) * 0.06) * uNight;
    vec3 col = mix(base, sky, clamp(fres, 0.0, 0.92));
    col += uShallow * 0.12 * smoothstep(0.08, 0.26, vH) * uLight; // sunlit crests

    // foam: breaking line along the coast + a wash that runs up and down the beach
    float n = noise(p * 0.55 + uTime * 0.12);
    float edge = depth + (n - 0.5) * 0.28 + 0.16 * sin(uTime * 0.9 + (p.x + p.y) * 0.04);
    float band = smoothstep(0.62, 0.0, edge);
    float line = smoothstep(0.09, 0.0, abs(edge - 0.2)) * 0.55;
    float foam = clamp(band * (0.45 + 0.7 * noise(p * 1.6 - uTime * 0.2)) + line, 0.0, 1.0) * step(0.0, depth);
    foam += smoothstep(0.17, 0.26, vH) * 0.2 * noise(p * 0.9 + uTime * 0.3) * dK; // small white caps
    foam = clamp(foam, 0.0, 1.0);
    col = mix(col, vec3(0.92, 0.96, 0.97) * (0.2 + 0.8 * uLight) + vec3(0.04, 0.05, 0.08) * uNight, foam);

    float alpha = mix(0.55, 0.97, dK) * smoothstep(0.0, 0.1, depth);
    alpha = max(alpha, foam * 0.9);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// CPU mirror of the two long waves (same constants as the vertex shader) so boats can ride them.
// out = { h, gx, gz }: height above the sea level and the slope along x / z. Only valid in deep water.
const D1 = [1 / Math.hypot(1, 0.35), 0.35 / Math.hypot(1, 0.35)], D2 = [-0.5 / Math.hypot(0.5, 1), 1 / Math.hypot(0.5, 1)];
export function seaSurface(x, z, t, out) {
  const k1 = 6.28318 / 38, k2 = 6.28318 / 21;
  const p1 = (x * D1[0] + z * D1[1]) * k1 + t * 1.1, p2 = (x * D2[0] + z * D2[1]) * k2 + t * 1.5;
  out.h = Math.sin(p1) * 0.16 + Math.sin(p2) * 0.10;
  const c1 = Math.cos(p1) * 0.16 * k1, c2 = Math.cos(p2) * 0.10 * k2;
  out.gx = c1 * D1[0] + c2 * D2[0]; out.gz = c1 * D1[1] + c2 * D2[1];
  return out;
}

export class Sea {
  constructor(normalTex) {
    const c = COAST;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uSea: { value: c.sea },
        uCoast: { value: new THREE.Vector4(c.flat, c.slopeEnd, c.slopeDepth, c.deepRate) },
        uNormal: { value: normalTex },
        uDeep: { value: new THREE.Color(0x0c4468) }, uShallow: { value: new THREE.Color(0x2cb4b0) },
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
        uNight: { value: 0 }, uLight: { value: 1 },
      }]),
    });
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = -5;
    this.time = 0;
  }

  // env: { top, hor: Color, sun: Vector3, night, light }
  setEnv(env) {
    const u = this.material.uniforms;
    u.uTop.value.copy(env.top); u.uHor.value.copy(env.hor); u.uSun.value.copy(env.sun);
    u.uNight.value = env.night; u.uLight.value = env.light;
  }

  update(dt, camPos) {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
    if (camPos) {
      this.mesh.position.x = Math.round(camPos.x / GRID) * GRID;
      this.mesh.position.z = Math.round(camPos.z / GRID) * GRID;
    }
  }
}
