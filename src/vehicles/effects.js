// Vehicle effects: soft billboard particles (smoke, fire), explosions (flash light, fireball, debris, smoke
// mushroom), tire skid marks and cheap additive light pools on the road for night driving.
// Everything is pooled: one draw call each for smoke, fire, debris, skid marks and light pools.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0), _e = new THREE.Euler();

// ---- canvas sprites ---------------------------------------------------------------------------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = () => canvasTex(64, (g, n) => {
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
});
// Puffy smoke: a few overlapping soft blobs so it does not look like a perfect disc.
const puffTex = () => canvasTex(128, (g, n) => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.283, d = rnd() * n * 0.17, x = n / 2 + Math.cos(a) * d, y = n / 2 + Math.sin(a) * d, r = n * (0.2 + rnd() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }
});

// ---- billboard particle pool ------------------------------------------------------------------
const VERT = `
attribute vec3 iPos; attribute vec2 iSR; attribute vec4 iCol;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vUv = uv; vCol = iCol;
  float c = cos(iSR.y), s = sin(iSR.y);
  vec2 o = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSR.x;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.xy += o;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map; uniform vec3 uTint;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vCol.rgb * uTint, vCol.a * t.a);
}`;

class Particles {
  // kind 0 = smoke (normal blending, rises, dark -> grey), kind 1 = fire (additive, orange -> red -> black)
  constructor(scene, kind, max, tex) {
    this.kind = kind; this.max = max;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iSR', this.aSR); geo.setAttribute('iCol', this.aCol);
    geo.instanceCount = max;
    this.uTint = { value: new THREE.Vector3(1, 1, 1) };
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uTint: this.uTint }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: kind === 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.amp = new Float32Array(max);
    this.rot = new Float32Array(max); this.rotV = new Float32Array(max);
    this.next = 0; this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, amp = 1) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    if (this.life[i] <= 0) this.active++;
    this.life[i] = this.maxLife[i] = life;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.s0[i] = s0; this.s1[i] = s1; this.amp[i] = amp;
    this.rot[i] = Math.random() * 6.283; this.rotV[i] = (Math.random() - 0.5) * 1.2;
  }
  update(dt) {
    if (!this.active) return;
    const P = this.aPos.array, SR = this.aSR.array, C = this.aCol.array, smoke = this.kind === 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.active--; SR[i * 2] = 0; continue; }
      const t = 1 - this.life[i] / this.maxLife[i], k = i * 3;
      this.vel[k + 1] += (smoke ? 0.5 : 1.4) * dt;
      const damp = Math.exp(-(smoke ? 1.0 : 1.6) * dt);
      this.vel[k] *= damp; this.vel[k + 1] *= smoke ? Math.exp(-0.35 * dt) : damp; this.vel[k + 2] *= damp;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.rot[i] += this.rotV[i] * dt;
      P[k] = this.pos[k]; P[k + 1] = this.pos[k + 1]; P[k + 2] = this.pos[k + 2];
      // ease-out growth, so puffs expand fast then settle
      const grow = 1 - (1 - t) * (1 - t);
      SR[i * 2] = this.s0[i] + (this.s1[i] - this.s0[i]) * grow; SR[i * 2 + 1] = this.rot[i];
      const c = i * 4;
      if (smoke) {
        const g = 0.1 + t * 0.32;
        C[c] = g; C[c + 1] = g * 0.97; C[c + 2] = g * 0.95;
        C[c + 3] = this.amp[i] * Math.min(1, t * 10) * (1 - t) * (1 - t * 0.2);
      } else {
        const f = 1 - t;
        C[c] = 1.0 * Math.min(1, f * 1.6); C[c + 1] = 0.82 * f * f + 0.1 * f; C[c + 2] = 0.3 * f * f * f;
        C[c + 3] = this.amp[i] * f * (t < 0.08 ? t / 0.08 : 1);
      }
    }
    this.aPos.needsUpdate = true; this.aSR.needsUpdate = true; this.aCol.needsUpdate = true;
  }
}

// ---- debris -----------------------------------------------------------------------------------
// Charred wreck pieces: irregular slabs in the burnt paint colour of the car that blew up (dark metal for the rest).
// They tumble, land and stay for a few seconds before shrinking away.
const DEBRIS = 72;
function slabGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), P = g.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) {        // jitter shared corners identically so the faces stay closed
    const k = Math.sin(P[i] * 91.7 + P[i + 1] * 47.3 + P[i + 2] * 23.1) * 43758.5453;
    const j = (k - Math.floor(k) - 0.5) * 0.45;
    P[i] += j * Math.sign(P[i]) * 0.5; P[i + 2] += j * 0.4; P[i + 1] += j * 0.15;
  }
  g.computeVertexNormals();
  return g;
}
class Debris {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(slabGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.15, flatShading: true }), DEBRIS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    for (let i = 0; i < DEBRIS; i++) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _c.setRGB(0.1, 0.1, 0.1)); }
    scene.add(this.mesh);
    this.life = new Float32Array(DEBRIS); this.size = new Float32Array(DEBRIS * 3);
    this.pos = new Float32Array(DEBRIS * 3); this.vel = new Float32Array(DEBRIS * 3);
    this.rot = new Float32Array(DEBRIS * 3); this.rotV = new Float32Array(DEBRIS * 3);
    this.next = 0; this.active = 0;
  }
  // size = (sx, sy, sz) in metres, color = THREE.Color (copied)
  emit(x, y, z, vx, vy, vz, sx, sy, sz, color) {
    const i = this.next; this.next = (this.next + 1) % DEBRIS;
    if (this.life[i] <= 0) this.active++;
    const k = i * 3;
    this.life[i] = 6 + Math.random() * 3;
    this.size[k] = sx; this.size[k + 1] = sy; this.size[k + 2] = sz;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.rot[k] = Math.random() * 6; this.rot[k + 1] = Math.random() * 6; this.rot[k + 2] = Math.random() * 6;
    this.rotV[k] = (Math.random() - 0.5) * 14; this.rotV[k + 1] = (Math.random() - 0.5) * 14; this.rotV[k + 2] = (Math.random() - 0.5) * 14;
    this.mesh.setColorAt(i, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    if (!this.active) return;
    for (let i = 0; i < DEBRIS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.active--; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      const k = i * 3;
      this.vel[k + 1] -= 20 * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const floor = this.size[k + 1] * 0.5 + 0.03;
      if (this.pos[k + 1] < floor) {
        this.pos[k + 1] = floor;
        if (this.vel[k + 1] < 0) this.vel[k + 1] *= -0.3;
        this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6;
        this.rotV[k] *= 0.5; this.rotV[k + 1] *= 0.5; this.rotV[k + 2] *= 0.5;
      }
      this.rot[k] += this.rotV[k] * dt; this.rot[k + 1] += this.rotV[k + 1] * dt; this.rot[k + 2] += this.rotV[k + 2] * dt;
      const f = Math.min(1, this.life[i] * 1.5);
      _p.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      _q.setFromEuler(_e.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]));
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(this.size[k] * f, this.size[k + 1] * f, this.size[k + 2] * f)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---- skid marks -------------------------------------------------------------------------------
const SKIDS = 360, SKID_LIFE = 28;
class Skids {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, SKIDS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    for (let i = 0; i < SKIDS; i++) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
    scene.add(this.mesh);
    this.age = new Float32Array(SKIDS).fill(-1); this.dark = new Float32Array(SKIDS);
    this.next = 0; this.active = 0; this.fade = 0;
  }
  add(x, z, heading, len, width, dark) {
    const i = this.next; this.next = (this.next + 1) % SKIDS;
    if (this.age[i] < 0) this.active++;
    this.age[i] = 0; this.dark[i] = dark;
    _q.setFromAxisAngle(_up, heading);
    this.mesh.setMatrixAt(i, _m.compose(_p.set(x, 0.11, z), _q, _s.set(width, 1, len)));
    this.mesh.setColorAt(i, _c.setRGB(dark, dark, dark));
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    if (!this.active) return;
    this.fade -= dt;
    if (this.fade > 0) return;
    this.fade = 0.4;   // colours fade in coarse steps, cheap enough
    for (let i = 0; i < SKIDS; i++) {
      if (this.age[i] < 0) continue;
      this.age[i] += 0.4;
      const k = this.age[i] / SKID_LIFE;
      if (k >= 1) { this.age[i] = -1; this.active--; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.instanceMatrix.needsUpdate = true; continue; }
      // multiply blend: dark value -> white (no effect)
      const v = Math.min(1, this.dark[i] + (1 - this.dark[i]) * k * k);
      this.mesh.setColorAt(i, _c.setRGB(v, v, v));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---- road light pools (night) -----------------------------------------------------------------
const POOLS = 220;
class LightPools {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: glowTex(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, POOLS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.count = 0;
    this.mesh.setColorAt(0, _c.setRGB(0, 0, 0));
    scene.add(this.mesh);
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, z, heading, w, l, r, g, b) {
    if (this.n >= POOLS) return;
    _q.setFromAxisAngle(_up, heading);
    this.mesh.setMatrixAt(this.n, _m.compose(_p.set(x, 0.13, z), _q, _s.set(w, 1, l)));
    this.mesh.setColorAt(this.n, _c.setRGB(r, g, b));
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---- main -------------------------------------------------------------------------------------
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new Particles(scene, 0, 420, puffTex());
    this.fire = new Particles(scene, 1, 220, glowTex());
    this.debris = new Debris(scene);
    this.skids = new Skids(scene);
    this.pools = new LightPools(scene);
    // single pooled blast light (always in the scene, intensity 0 when idle -> no shader recompiles)
    this.blastLight = new THREE.PointLight(0xff9a45, 0, 55, 1.6);
    this.blastLight.position.set(0, -50, 0);
    scene.add(this.blastLight);
    this.blastT = 9;
    this.blasts = [];
  }
  setNight(f) {
    const k = 1 - 0.72 * f;
    this.smoke.uTint.value.set(k, k, k * 1.05);
  }
  smokePuff(x, y, z, strength = 1) {
    this.smoke.emit(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8, 1.8 + Math.random() * 1.4, 0.5 * strength, 1.9 * strength, 0.6);
  }
  firePuff(x, y, z) {
    this.fire.emit(x + (Math.random() - 0.5) * 1.0, y, z + (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8, 0.45 + Math.random() * 0.5, 0.9, 0.3, 0.85);
  }
  // paint = hex colour of the exploding car: the debris is that paint, burnt black (default: dark metal only)
  explosion(x, y, z, paint) {
    const cy = y + 0.9;
    // hot core flash + fireball made of overlapping soft sprites
    this.fire.emit(x, cy + 0.4, z, 0, 0.5, 0, 0.35, 5, 10, 1);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, el = (Math.random() - 0.25) * 1.4, sp = 1.5 + Math.random() * 6.5;
      this.fire.emit(x, cy, z, Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 1.5, Math.sin(a) * Math.cos(el) * sp, 0.55 + Math.random() * 0.75, 1.4, 3.4 + Math.random() * 1.6, 0.9);
    }
    // dark, billowing smoke that follows the fireball
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.283, sp = 1 + Math.random() * 4;
      this.smoke.emit(x, cy + 0.3, z, Math.cos(a) * sp, 1.5 + Math.random() * 3.5, Math.sin(a) * sp, 2.4 + Math.random() * 1.8, 1.6, 4.8 + Math.random() * 1.8, 0.85);
    }
    // debris: burnt pieces of the car's paint colour (every 3rd one dark metal), thin slabs of different sizes
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, sp = 3 + Math.random() * 8, sz = 0.14 + Math.random() * 0.3;
      if (paint === undefined || i % 3 === 0) _c.setRGB(0.03, 0.03, 0.035).multiplyScalar(0.6 + Math.random() * 0.8);
      else _c.setHex(paint).multiplyScalar(0.1 + Math.random() * 0.14);       // charred paint
      this.debris.emit(x, cy, z, Math.cos(a) * sp, 6 + Math.random() * 9, Math.sin(a) * sp, sz * (0.6 + Math.random() * 1.2), sz * (0.12 + Math.random() * 0.3), sz * (0.5 + Math.random()), _c);
    }
    this.blastT = 0;
    this.blastLight.position.set(x, y + 3, z);
    this.blasts.push({ x, z, y, t: 0, cap: false });
    if (this.blasts.length > 4) this.blasts.shift();
  }
  // Called by the manager: the dedicated night glow strength and the road light pools.
  update(dt) {
    this.smoke.update(dt); this.fire.update(dt); this.debris.update(dt); this.skids.update(dt);
    if (this.blastT < 1) {
      this.blastT += dt;
      const k = Math.max(0, 1 - this.blastT / 0.7);
      this.blastLight.intensity = 900 * k * k;
      if (this.blastT >= 0.7) this.blastLight.position.y = -50;
    }
    // smoke column + mushroom cap, emitted over ~1.7 s
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]; b.t += dt;
      if (b.t < 1.5) {
        b._acc = (b._acc || 0) + dt * 34;
        while (b._acc >= 1) {
          b._acc -= 1;
          const h = 1 + b.t * 5.2;
          this.smoke.emit(b.x + (Math.random() - 0.5) * 0.9, b.y + h, b.z + (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6, 2.2 + Math.random(), (Math.random() - 0.5) * 0.6, 3 + Math.random() * 1.2, 1.3, 3.4, 0.7);
        }
      }
      if (!b.cap && b.t > 0.75) {
        b.cap = true;
        const hc = b.y + 1 + 0.75 * 5.2 + 2.5;
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * 6.283 + Math.random() * 0.4, sp = 3.2 + Math.random() * 1.6;
          this.smoke.emit(b.x + Math.cos(a) * 0.6, hc, b.z + Math.sin(a) * 0.6, Math.cos(a) * sp, 0.6 + Math.random() * 1.4, Math.sin(a) * sp, 3.4 + Math.random() * 1.2, 2.2, 5.4 + Math.random() * 1.6, 0.75);
        }
        for (let k = 0; k < 6; k++) this.smoke.emit(b.x + (Math.random() - 0.5), hc + 0.5, b.z + (Math.random() - 0.5), (Math.random() - 0.5), 1.8, (Math.random() - 0.5), 3.6, 3, 7, 0.7);
      }
      if (b.t > 4) this.blasts.splice(i, 1);
    }
  }
  // Skid mark quad(s) for a rear wheel; dir = direction of travel (radians), dark 0.1 = very dark.
  skid(x, z, dir, len, dark = 0.16) { this.skids.add(x, z, dir, len, 0.22, dark); }
}
