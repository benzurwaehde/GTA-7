import * as THREE from 'three';
import { SPECS, PAINTS, FIXED_PAINT, MATS, buildCarModel } from './models.js';
import { dent, breakGlass, char, disposeDamage } from './damage.js';

const moveToward = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const _tmp = { x: 0, z: 0 };
const _near = [];
const _hit = { nx: 0, nz: 0 };

// Allocation-free circle-vs-AABB push-out (same result as core/physics resolveCircleVsBoxes). Moves pos, fills _hit.
function resolveCircle(pos, r, boxes) {
  let hit = false;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), push = r - d;
      pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      _hit.nx = dx / d; _hit.nz = dz / d;
    } else {   // centre inside the box: leave along the shortest axis
      const l = pos.x - b.minX + r, rr = b.maxX - pos.x + r, t = pos.z - b.minZ + r, bo = b.maxZ - pos.z + r;
      const m = Math.min(l, rr, t, bo);
      if (m === l) { pos.x -= l; _hit.nx = -1; _hit.nz = 0; }
      else if (m === rr) { pos.x += rr; _hit.nx = 1; _hit.nz = 0; }
      else if (m === t) { pos.z -= t; _hit.nx = 0; _hit.nz = -1; }
      else { pos.z += bo; _hit.nx = 0; _hit.nz = 1; }
    }
    hit = true;
  }
  return hit;
}

// Arcade car. Steering convention: setControls({steer}) positive = turn RIGHT (D key), negative = left.
export class Vehicle {
  constructor(manager, type, x, z, heading, opts = {}) {
    if (!SPECS[type]) type = 'sedan';
    this.manager = manager;
    this.type = type;
    this.spec = SPECS[type];
    const paint = FIXED_PAINT[type] ?? opts.color ?? PAINTS[(Math.random() * PAINTS.length) | 0];
    this.color = paint;
    this.model = buildCarModel(type, paint);
    this.mesh = this.model.root;
    this.position = this.mesh.position;           // === mesh.position
    this.position.set(x, 0, z);
    this.heading = heading || 0;
    this.speed = 0;                               // signed forward speed (m/s)
    this.vx = 0; this.vz = 0;                     // world velocity
    this.yawVel = 0; this.steerAngle = 0;
    this.radius = Math.max(this.spec.W / 2 + 0.15, this.spec.L * 0.38);
    this.cr = this.spec.W / 2;                    // collision circle radius
    this.coff = this.spec.L / 2 - this.cr - 0.05; // collision circle offset from center
    this.mass = this.spec.mass;
    this.driver = opts.driver ?? null;
    this.health = opts.health ?? this.spec.health ?? 100;
    this.destroyed = false;
    this.isPolice = type === 'police';
    this.sirenOn = false;
    this.controls = { throttle: 0, steer: 0, brake: 0, handbrake: false };
    this.owned = false;                           // player used it: never auto-despawn nearby
    this.sleeping = false;
    this.crashCd = 0; this.burnT = 0; this.hopV = 0;
    this.glassBroken = false; this.fallT = 0; this.fallSide = 1;   // damage state; fallT > 0: motorcycle lying on its side
    this.ai = null;
    this.accel = 0; this.roll = 0; this.pitch = 0; this.wheelAngle = 0; this.braking = false;
    this.mesh.rotation.y = this.heading;
    this.mesh.userData.vehicle = this;
  }

  setControls(c = {}) {
    const k = this.controls;
    k.throttle = Math.max(-1, Math.min(1, c.throttle || 0));
    k.steer = Math.max(-1, Math.min(1, c.steer || 0));
    k.brake = Math.max(0, Math.min(1, +c.brake || 0));
    k.handbrake = !!c.handbrake;
    if (this.sleeping && (k.throttle || k.brake)) this.sleeping = false;
  }

  wake() { this.sleeping = false; }

  // ---- physics -----------------------------------------------------------------------------
  step(dt, boxes) {
    const s = this.spec, pos = this.position;
    let { throttle, steer, brake, handbrake: hb } = this.controls;
    if (this.fallT > 0) this.fallT -= dt;
    if (this.destroyed || this.driver === null || this.fallT > 0) { throttle = 0; steer = 0; brake = 1; hb = true; }

    if (this.sleeping) {
      if (this.vx * this.vx + this.vz * this.vz < 0.01 && Math.abs(this.yawVel) < 0.02) { this.speed = 0; this.accel = 0; return; }
      this.sleeping = false;
    }

    // steering (bicycle model, arcade tuned). positive steer = right = heading decreases
    const v0 = this.speed;
    const lim = s.maxSteer / (1 + (Math.abs(v0) / s.steerSpeed) ** 2);
    this.steerAngle += (steer * lim - this.steerAngle) * Math.min(1, dt * 9);
    let yaw = (v0 * Math.tan(this.steerAngle) / s.wb) * 1.25;
    if (hb && Math.abs(v0) > 3) yaw *= 1.6;
    this.yawRate = yaw;
    this.heading += (-yaw + this.yawVel) * dt;
    this.yawVel *= Math.exp(-3 * dt);
    if (this.heading > Math.PI) this.heading -= Math.PI * 2; else if (this.heading < -Math.PI) this.heading += Math.PI * 2;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * rx + this.vz * rz;
    const vfPrev = vf;

    if (throttle > 0) {
      if (vf < -0.5) vf = moveToward(vf, 0, s.brake * dt);
      else vf += throttle * s.accel * Math.max(0, 1 - vf / s.top) * dt;
    } else if (throttle < 0) {
      if (vf > 0.5) vf = moveToward(vf, 0, s.brake * -throttle * dt);
      else vf += throttle * s.accel * 0.6 * Math.max(0, 1 - -vf / (s.top * 0.3)) * dt;
    } else {
      vf = moveToward(vf, 0, (1.2 + Math.abs(vf) * 0.06) * dt);
    }
    if (brake > 0) vf = moveToward(vf, 0, s.brake * brake * dt);
    if (hb) vf = moveToward(vf, 0, (this.driver ? 8 : 25) * dt);
    this.braking = brake > 0.1 || (throttle < 0 && vf > 0.5) || (throttle > 0 && vf < -0.5) || (hb && this.driver);

    const grip = hb ? s.grip * 0.1 : s.grip;
    vl *= Math.exp(-grip * dt);
    this.vx = fx * vf + rx * vl; this.vz = fz * vf + rz * vl;
    this.speed = vf;
    this.accel += ((vf - vfPrev) / dt - this.accel) * Math.min(1, dt * 6);

    pos.x += this.vx * dt; pos.z += this.vz * dt;

    // static colliders: two circles (front/back)
    if (boxes && boxes.length) this.collideWorld(boxes, fx, fz);

    // hard world limit
    const lim2 = 330;
    if (Math.abs(pos.x) > lim2) { pos.x = Math.sign(pos.x) * lim2; this.vx *= -0.3; }
    if (Math.abs(pos.z) > lim2) { pos.z = Math.sign(pos.z) * lim2; this.vz *= -0.3; }

    if (this.hopV !== 0 || pos.y > 0) {
      this.hopV -= 14 * dt; pos.y += this.hopV * dt;
      if (pos.y <= 0) { pos.y = 0; this.hopV = 0; }
    }

    if (!this.driver && !this.destroyed && this.vx * this.vx + this.vz * this.vz < 0.0025 && Math.abs(this.yawVel) < 0.01) this.sleeping = true;
  }

  collideWorld(boxes, fx, fz) {
    const pos = this.position, R = this.coff + this.cr + 1.5;
    _near.length = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.maxX < pos.x - R || b.minX > pos.x + R || b.maxZ < pos.z - R || b.minZ > pos.z + R) continue;
      _near.push(b);
    }
    if (!_near.length) return;
    let maxImpact = 0, cx = 0, cz = 0;
    for (let ki = 0; ki < 2; ki++) {      // front and rear collision circle
      const k = ki === 0 ? 1 : -1;
      _tmp.x = pos.x + fx * this.coff * k; _tmp.z = pos.z + fz * this.coff * k;
      const ox = _tmp.x, oz = _tmp.z;
      if (!resolveCircle(_tmp, this.cr, _near)) continue;
      pos.x += _tmp.x - ox; pos.z += _tmp.z - oz;
      const nx = _hit.nx, nz = _hit.nz, vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        const impact = -vn;
        this.vx -= (1.2) * vn * nx; this.vz -= (1.2) * vn * nz;
        this.vx *= 0.985; this.vz *= 0.985;
        // yaw kick from off-center contact
        const rX = fx * this.coff * k, rZ = fz * this.coff * k;
        const jx = nx * impact, jz = nz * impact;
        this.yawVel = Math.max(-2.5, Math.min(2.5, this.yawVel + 0.35 * (jx * rZ - jz * rX) / 1.9));
        if (impact > maxImpact) { maxImpact = impact; cx = _tmp.x - nx * this.cr; cz = _tmp.z - nz * this.cr; }
      }
    }
    if (maxImpact > 0) {
      this.speed = this.vx * fx + this.vz * fz;
      this.manager.registerImpact(this, null, maxImpact, cx, cz);
    }
  }

  // ---- damage looks ------------------------------------------------------------------------
  // World contact point -> dent in the body shell. amount = depth in metres.
  dentAt(wx, wz, amount) {
    if (this.destroyed || !(amount > 0.01)) return;
    const dx = wx - this.position.x, dz = wz - this.position.z, sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    dent(this.model, dx * ch - dz * sh, dx * sh + dz * ch, amount, this.spec.W * 0.5 + 0.55);
  }
  crackGlass() { if (this.glassBroken || this.destroyed) return; this.glassBroken = true; breakGlass(this.model); }
  disposeVisual() { disposeDamage(this.model); }

  // ---- visuals -----------------------------------------------------------------------------
  updateVisual(dt, time) {
    const m = this.model, s = this.spec;
    this.mesh.rotation.y = this.heading;
    this.wheelAngle += this.speed * dt / s.wheelR;
    m.wheelF.rotation.x = this.wheelAngle; m.wheelR.rotation.x = this.wheelAngle;
    m.wheelFGroup.rotation.y = -this.steerAngle;
    let rollT, pitchT;
    if (s.lean) {
      // motorcycle: leans INTO the curve (opposite of a car's body roll), rests on its stand when parked, lies down when fallen
      rollT = Math.max(-0.5, Math.min(0.5, (this.yawRate || 0) * this.speed * 0.02));
      if (this.fallT > 0 || this.destroyed) rollT = 1.4 * this.fallSide;
      else if (this.driver === null) rollT = -0.2;
      pitchT = Math.max(-0.12, Math.min(0.12, -this.accel * 0.006));
      m.rider.visible = this.driver !== null && this.fallT <= 0 && !this.destroyed;
    } else {
      rollT = Math.max(-0.07, Math.min(0.07, -(this.yawRate || 0) * this.speed * 0.0035));
      pitchT = Math.max(-0.05, Math.min(0.05, -this.accel * 0.003));
    }
    const k = Math.min(1, dt * (s.lean ? 6 : 8));
    this.roll += (rollT - this.roll) * k; this.pitch += (pitchT - this.pitch) * k;
    m.chassis.rotation.z = this.roll + (this.destroyed && !s.lean ? 0.12 : 0);
    m.chassis.rotation.x = this.pitch;
    if (!this.destroyed) {
      const lit = this.driver !== null;
      const tail = !lit ? MATS.tailIdle : this.braking ? MATS.tailOn : MATS.tailOff, head = lit ? MATS.head : MATS.headIdle;
      if (m.tail.material !== tail) m.tail.material = tail;
      if (m.head.material !== head) m.head.material = head;
      if (m.red) {
        const ph = this.sirenOn ? ((time * 7) | 0) % 2 : -1;
        m.red.material = ph === 0 ? MATS.redOn : MATS.redOff;
        m.blue.material = ph === 1 ? MATS.blueOn : MATS.blueOff;
      }
    }
  }

  // Burnt-out wreck: charcoal shell with black windows, dead lamps, burnt tyres, body sunk a little.
  blacken() {
    const m = this.model;
    char(m);
    m.body.material = MATS.charred;
    m.head.material = MATS.off; m.tail.material = MATS.off;
    m.wheelF.material = MATS.burnt; m.wheelR.material = MATS.burnt;
    if (m.red) { m.red.material = MATS.off; m.blue.material = MATS.off; }
    if (m.rider) m.rider.visible = false;
    m.chassis.position.y = -0.06;
    m.body.castShadow = true;
  }
}
