import * as THREE from 'three';
import { Human, humanAvailable } from '../characters/Human.js';
import { surfaceY } from '../characters/surface.js';

// Procedural humanoid. Origin = feet, model faces +Z. Every limb is a pivot Group so animation is pure rotation maths.
const mats = {
  skin: new THREE.MeshStandardMaterial({ color: 0xd9a47a, roughness: 0.8 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 }),
  jacket: new THREE.MeshStandardMaterial({ color: 0xc23b5a, roughness: 0.65 }),
  jacketTrim: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.7 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 }),
  jeans: new THREE.MeshStandardMaterial({ color: 0x2f4f86, roughness: 0.85 }),
  shoe: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 }),
  shade: new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.2, metalness: 0.4 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.4, metalness: 0.7 }),
  gunLight: new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 0.4, metalness: 0.7 }),
};
const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z); me.castShadow = true; return me;
};
const cyl = (rt, rb, h, m, seg = 10) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.castShadow = true; return me; };
const pivot = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g; };
const clamp01 = v => Math.max(0, Math.min(1, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

class ProceduralCharacter {
  constructor() {
    this.root = new THREE.Group();          // positioned/yawed by the player
    this.body = pivot(0, 0, 0, this.root);  // tilted when dying
    this.phase = 0; this.punchT = 1; this.punchSide = 1; this.aim = 0; this.jumpBlend = 0; this.speedBlend = 0; this.t = 0;

    // hips / torso
    this.hips = pivot(0, 0.95, 0, this.body);
    this.hips.add(box(0.42, 0.22, 0.26, mats.jeans, 0, 0.02, 0));
    this.spine = pivot(0, 0.1, 0, this.hips);
    const torso = box(0.5, 0.55, 0.28, mats.jacket, 0, 0.3, 0); this.spine.add(torso);
    this.spine.add(box(0.2, 0.45, 0.02, mats.shirt, 0, 0.32, 0.145));      // open jacket front
    this.spine.add(box(0.52, 0.06, 0.3, mats.jacketTrim, 0, 0.05, 0));     // hem
    this.spine.add(box(0.54, 0.07, 0.3, mats.jacketTrim, 0, 0.55, 0));     // collar line
    // head
    this.neck = pivot(0, 0.6, 0, this.spine);
    this.head = pivot(0, 0.02, 0, this.neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), mats.skin); skull.position.y = 0.15; skull.scale.set(0.95, 1.1, 1); skull.castShadow = true; this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.157, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair); hair.position.set(0, 0.17, -0.01); hair.scale.set(0.97, 1.1, 1.02); this.head.add(hair);
    this.head.add(box(0.27, 0.06, 0.05, mats.shade, 0, 0.19, 0.13)); // sunglasses
    this.head.add(box(0.05, 0.05, 0.05, mats.skin, 0, 0.12, 0.15)); // nose
    // arms
    const mkArm = side => {
      const sh = pivot(side * 0.33, 0.5, 0, this.spine);
      const up = cyl(0.065, 0.058, 0.3, mats.jacket); up.position.y = -0.15; sh.add(up);
      const elbow = pivot(0, -0.3, 0, sh);
      const low = cyl(0.057, 0.05, 0.28, mats.jacket); low.position.y = -0.14; elbow.add(low);
      const hand = pivot(0, -0.3, 0, elbow);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mats.skin); h.castShadow = true; hand.add(h);
      return { sh, elbow, hand };
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    // legs
    const mkLeg = side => {
      const hip = pivot(side * 0.12, -0.05, 0, this.hips); // child of hips so torso bob moves them; compensated below
      const up = cyl(0.095, 0.08, 0.45, mats.jeans); up.position.y = -0.225; hip.add(up);
      const knee = pivot(0, -0.45, 0, hip);
      const low = cyl(0.08, 0.065, 0.42, mats.jeans); low.position.y = -0.21; knee.add(low);
      const foot = box(0.11, 0.08, 0.26, mats.shoe, 0, -0.45, 0.06); knee.add(foot);
      return { hip, knee };
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);

    // weapons in right hand (gun's +Z axis maps onto the arm direction)
    this.gunMount = pivot(0, 0, 0, this.armR.hand); this.gunMount.rotation.x = Math.PI / 2;
    this.guns = {};
    const pistol = new THREE.Group();
    pistol.add(box(0.05, 0.07, 0.24, mats.gun, 0, 0.0, 0.1));
    pistol.add(box(0.045, 0.12, 0.06, mats.gunLight, 0, -0.08, 0.02));
    pistol.muzzle = pivot(0, 0.01, 0.24, pistol);
    const smg = new THREE.Group();
    smg.add(box(0.06, 0.09, 0.4, mats.gun, 0, 0.0, 0.15));
    smg.add(box(0.045, 0.2, 0.06, mats.gunLight, 0, -0.14, 0.12));
    smg.add(box(0.045, 0.12, 0.06, mats.gunLight, 0, -0.1, 0.0));
    smg.add(box(0.04, 0.05, 0.12, mats.gunLight, 0, 0.0, 0.42));
    smg.muzzle = pivot(0, 0.0, 0.5, smg);
    this.guns.pistol = pistol; this.guns.smg = smg;
    for (const g of Object.values(this.guns)) { g.visible = false; this.gunMount.add(g); }
    this.currentGun = null;

    this.root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
    this.rightHand = this.armR.hand;   // same contract as the skinned character
  }
  setPose() { /* procedural fallback has no poses */ }
  setWeaponStyle() { /* procedural fallback: one-handed only */ }

  setWeapon(id) {
    this.currentGun = this.guns[id] || null;
    for (const [k, g] of Object.entries(this.guns)) g.visible = k === id;
  }
  get muzzleObject() { return this.currentGun?.muzzle || this.armR.hand; }
  punch() { this.punchT = 0; this.punchSide *= -1; }
  get punching() { return this.punchT < 1; }

  // speed: horizontal m/s, grounded: bool, aiming: 0..1 target, dying: 0..1 fall progress
  update(dt, { speed = 0, grounded = true, aiming = false, dying = 0, vy = 0, sprint = false, reload = -1 } = {}) {
    this.t += dt;
    if (dying > 0) { this.updateDeath(dying); return; }
    this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0);
    this.punchT = Math.min(1, this.punchT + dt / 0.36);
    this.aim = damp(this.aim, aiming ? 1 : 0, 14, dt);
    this.jumpBlend = damp(this.jumpBlend, grounded ? 0 : 1, 14, dt);
    this.speedBlend = damp(this.speedBlend, speed, 10, dt);
    const sp = this.speedBlend;
    const moving = clamp01(sp / 1.2);
    const runK = clamp01((sp - 4.2) / 3.5);
    this.phase += dt * Math.max(sp, 0.01) * 1.35;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = (0.55 + 0.45 * runK) * moving * (1 - this.jumpBlend);
    const air = this.jumpBlend;

    // legs
    const stand = (1 - air);
    this.legL.hip.rotation.x = s * amp * 1.0 * stand + air * (vy > 0 ? -0.9 : -0.35);
    this.legR.hip.rotation.x = -s * amp * 1.0 * stand + air * (vy > 0 ? 0.25 : -0.6);
    this.legL.knee.rotation.x = (Math.max(0, -c) * 1.0 * (0.4 + runK * 0.9) * moving) * stand + air * (vy > 0 ? 1.3 : 0.5);
    this.legR.knee.rotation.x = (Math.max(0, c) * 1.0 * (0.4 + runK * 0.9) * moving) * stand + air * (vy > 0 ? 0.3 : 0.9);
    // body bob & lean
    const bob = Math.abs(Math.cos(this.phase)) * 0.05 * moving * (1 + runK) * stand;
    const idle = Math.sin(this.t * 2) * 0.006 * (1 - moving);
    this.hips.position.y = 0.95 - bob * 0.8 + idle - air * 0.03;
    this.spine.rotation.x = 0.04 + runK * 0.22 + moving * 0.05;
    this.spine.rotation.y = -s * 0.12 * amp * 1.0;
    this.neck.rotation.x = -this.spine.rotation.x * 0.7;
    this.head.rotation.x = Math.sin(this.t * 1.3) * 0.02;
    // arms
    const swing = amp * 0.9;
    let lx = -s * swing * (1 - air) - air * 2.4;
    let rx = s * swing * (1 - air) - air * 2.4;
    let lz = 0.07 + air * 0.5, rz = -0.07 - air * 0.5;
    let le = -0.15 - runK * 1.2 * moving, re = le;
    if (air > 0.5) { le = re = -0.3; }
    // aim: right arm straight out, left arm bracing
    const a = this.aim;
    if (a > 0.01) {
      rx = rx * (1 - a) + (-1.5) * a; rz = rz * (1 - a); re = re * (1 - a) - 0.05 * a;
      lx = lx * (1 - a) + (-1.25) * a; lz = lz * (1 - a) + 0.35 * a; le = le * (1 - a) - 0.7 * a;
      this.spine.rotation.y += 0.1 * a;
    }
    // reload: left hand comes over to the gun, gun drops towards the chest and back (reload = progress 0..1)
    if (reload >= 0) {
      const e = Math.sin(clamp01(reload) * Math.PI), q = clamp01(e * 2.5);
      rx = rx * (1 - q) + (-0.75) * q; re = re * (1 - q) - 1.1 * q;
      lx = lx * (1 - q) + (-1.0) * q; lz = lz * (1 - q) + 0.5 * q; le = le * (1 - q) - 1.2 * q;
      this.spine.rotation.x += 0.12 * q;
    }
    // punch
    if (this.punchT < 1) {
      const t = this.punchT, k = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      const e = Math.sin(clamp01(k) * Math.PI / 2);
      const arm = this.punchSide > 0 ? 'R' : 'L';
      const A = arm === 'R' ? this.armR : this.armL;
      const ax = -1.55 * e;
      if (arm === 'R') { rx = rx * (1 - e) + ax; re = re * (1 - e) - 0.1 * e; rz = rz * (1 - e); }
      else { lx = lx * (1 - e) + ax; le = le * (1 - e) - 0.1 * e; lz = lz * (1 - e); }
      this.spine.rotation.y += (arm === 'R' ? -1 : 1) * -0.45 * e;
      this.hips.position.z = 0.05 * e;
      void A;
    } else this.hips.position.z = 0;
    this.armL.sh.rotation.set(lx, 0, lz); this.armR.sh.rotation.set(rx, 0, rz);
    this.armL.elbow.rotation.x = le; this.armR.elbow.rotation.x = re;
    // fists-only guard pose when idle is just hanging arms (fine)
  }

  updateDeath(p) {
    const k = clamp01(p), e = 1 - Math.pow(1 - k, 3);
    this.body.rotation.set(-e * (Math.PI / 2 - 0.05), 0, e * 0.25);
    this.body.position.set(0, 0.18 * e, -0.15 * e);
    this.legL.hip.rotation.x = -0.2 * e; this.legR.hip.rotation.x = 0.15 * e;
    this.legL.knee.rotation.x = 0.3 * e; this.legR.knee.rotation.x = 0.5 * e;
    this.armL.sh.rotation.set(-0.3 * e, 0, 0.9 * e); this.armR.sh.rotation.set(0.2 * e, 0, -1.0 * e);
    this.spine.rotation.set(0, 0, 0); this.hips.position.y = 0.95; this.hips.position.z = 0;
  }
}

// ---- skinned character (GLB), falls back to the procedural one when the model is missing ----
const WALK_REF = 1.65, RUN_REF = 3.6;   // m/s the clips travel at timeScale 1 (foot contact speed measured in Blender)
const PLAYER_LOOK = { shirt: 0xc23b5a, pants: 0x2f4f86, hair: 0x2a1a12, skin: 0xd9a47a };
const gunMat = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.4, metalness: 0.7 });
const gunMat2 = new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 0.4, metalness: 0.7 });
const gbox = (w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); return me; };

export class Character {
  constructor() {
    if (!humanAvailable('human_man_a')) return new ProceduralCharacter();
    this.human = new Human('human_man_a', PLAYER_LOOK);
    this.root = this.human.root;
    this.rightHand = this.human.makeRightHand();   // +Z = hand/forearm direction; weapons mount here
    this.gunMount = null;
    // fallback guns (only shown when the weapon system has no model for the weapon)
    const pistol = new THREE.Group(); pistol.add(gbox(0.05, 0.07, 0.24, gunMat, 0, 0, 0.1), gbox(0.045, 0.12, 0.06, gunMat2, 0, -0.08, 0.02));
    pistol.muzzle = new THREE.Object3D(); pistol.muzzle.position.set(0, 0.01, 0.24); pistol.add(pistol.muzzle);
    const smg = new THREE.Group(); smg.add(gbox(0.06, 0.09, 0.4, gunMat, 0, 0, 0.15), gbox(0.045, 0.2, 0.06, gunMat2, 0, -0.14, 0.12));
    smg.muzzle = new THREE.Object3D(); smg.muzzle.position.set(0, 0, 0.5); smg.add(smg.muzzle);
    this.guns = { pistol, smg };
    for (const g of Object.values(this.guns)) { g.visible = false; this.rightHand.add(g); }
    this.currentGun = null;
    this.pose = 'idle'; this.punchHold = false; this.t = 0; this.speedBlend = 0; this.airT = 0;
    this.human.play('idle', { fade: 0 });
  }
  setWeapon(id) {
    this.currentGun = this.guns[id] || null;
    for (const [k, g] of Object.entries(this.guns)) g.visible = k === id;
  }
  get muzzleObject() { return this.currentGun?.muzzle || this.rightHand; }
  // 'aim' raises the arms, anything else is the normal locomotion pose
  // opts.twoHanded: left hand grips the fore-end (rifle, shotgun, sniper)
  setPose(name, opts = {}) { this.pose = name || 'idle'; if (opts && opts.twoHanded !== undefined) this.human.twoHanded = !!opts.twoHanded; }
  // 'pistol' = one-handed aim, 'rifle' = two-handed aim with the left hand on the fore-end, 'none' = fists
  setWeaponStyle(style) { this.weaponStyle = style; this.human.twoHanded = style === 'rifle'; }
  punch() { this.human.play('punch', { fade: 0.06, restart: true, speed: 1.5 }); this.punchHold = true; }
  get punching() { return this.punchHold; }

  // speed: horizontal m/s, grounded: bool, aiming: bool, dying: 0..1 fall progress
  update(dt, { speed = 0, grounded = true, aiming = false, dying = 0, vy = 0, reload = -1, pitch = 0 } = {}) {
    const h = this.human;
    this.t += dt;
    h.model.position.y = surfaceY(this.root.position.x, this.root.position.z);   // feet on the slab / road, not inside it
    if (dying > 0) {
      if (h.currentName !== 'death') h.play('death', { fade: 0.1, restart: true });
      h.aimW = 0; h.update(dt);
      return;
    }
    if (h.currentName === 'death') h.play('idle', { fade: 0, restart: true });
    this.speedBlend += (speed - this.speedBlend) * (1 - Math.exp(-10 * dt));
    if (this.punchHold && h.clipDone) { this.punchHold = false; h.currentName = ''; }
    const air = !grounded;
    this.airT = air ? this.airT + dt : 0;
    if (!this.punchHold) {
      const sp = this.speedBlend;
      if (air && this.airT > 0.12) h.play('jump', { fade: 0.1 });
      else if (sp > 2.6) h.play('run', { fade: 0.2, speed: Math.min(2.2, Math.max(0.7, sp / RUN_REF)) });
      else if (sp > 0.4) h.play('walk', { fade: 0.2, speed: Math.min(1.8, Math.max(0.6, sp / WALK_REF)) });
      else h.play('idle', { fade: 0.25 });
    }
    // arms: raised while aiming / pointing a gun, lowered a bit for the reload
    const want = (aiming || this.pose === 'aim') && !this.punchHold && !air ? 1 : 0;
    h.aimW += (want - h.aimW) * (1 - Math.exp(-14 * dt));
    h.aimPitch = pitch;
    h.update(dt);
  }
}
