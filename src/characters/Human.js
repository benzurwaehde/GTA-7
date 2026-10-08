// Skinned human built from a GLB in public/models/human_*.glb (all variants share one 31-bone rig and clip set).
// Wraps clone + rebind, AnimationMixer with cross-fades, procedural hit flinch and arm aiming.
import * as THREE from 'three';
import { getModel, getModelAnimations, hasModel } from '../core/assets.js';
import { outfitMaterial } from './humanMaterial.js';

// GLTFLoader strips dots from node names: 'UpperArm.R' -> 'UpperArmR'.
export const BONE = {
  hips: 'Hips', abdomen: 'Abdomen', torso: 'Torso', neck: 'Neck', head: 'Head',
  uArmL: 'UpperArmL', lArmL: 'LowerArmL', palmL: 'PalmL', uArmR: 'UpperArmR', lArmR: 'LowerArmR', palmR: 'PalmR',
  uLegL: 'UpperLegL', lLegL: 'LowerLegL', footL: 'FootL', uLegR: 'UpperLegR', lLegR: 'LowerLegR', footR: 'FootR',
};
// clip names end in e.g. 'Man_Idle' / 'Female_Idle'
const CLIPS = { idle: '_Idle', walk: '_Walk', run: '_Run', jump: '_Jump', punch: '_Punch', death: '_Death' };
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _axis = new THREE.Vector3(), _zero = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export function humanAvailable(name) { return hasModel(name); }

// Cloned SkinnedMesh trees keep pointing at the original skeleton; rebuild it from the cloned bones.
function rebind(root) {
  const byName = {};
  root.traverse(n => { if (n.isBone) byName[n.name] = n; });
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const orig = o.skeleton;
    o.bind(new THREE.Skeleton(orig.bones.map(b => byName[b.name]), orig.boneInverses), o.bindMatrix);
  });
  return byName;
}

export class Human {
  // look: { shirt, pants, hair, skin } hex colours
  constructor(modelName, look) {
    const scene = getModel(modelName);
    this.root = new THREE.Group();           // feet at origin, faces +Z
    this.model = scene;
    this.root.add(scene);
    this.bones = rebind(scene);
    this.mesh = null;
    scene.traverse(o => {
      if (o.isSkinnedMesh) { this.mesh = o; o.material = outfitMaterial(look); o.frustumCulled = true; o.castShadow = false; }
    });
    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    const clips = getModelAnimations(modelName);
    for (const [k, n] of Object.entries(CLIPS)) {
      const c = clips.find(c => c.name.endsWith(n));
      if (c) this.actions[k] = this.mixer.clipAction(c);
    }
    for (const k of ['punch', 'death', 'jump']) if (this.actions[k]) { this.actions[k].setLoop(THREE.LoopOnce, 1); this.actions[k].clampWhenFinished = true; }
    this.current = null; this.currentName = '';
    this.flinchT = 0; this.flinchAxis = new THREE.Vector3(1, 0, 0); this.flinchAmp = 0;
    this.aimW = 0; this.aimPitch = 0; this.twoHanded = false;
    this.rightHand = null; this.leftHand = null;
    this.accum = 0;
  }

  bone(k) { return this.bones[BONE[k]]; }

  // Cross-fade to a named clip. opts: fade, speed (timeScale), restart
  play(name, { fade = 0.2, speed = 1, restart = false } = {}) {
    const a = this.actions[name];
    if (!a) return null;
    a.timeScale = speed;
    if (this.current === a && !restart) return a;
    a.reset().play();
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    else a.fadeIn(fade);
    this.current = a; this.currentName = name;
    return a;
  }
  get clipDone() { const a = this.current; return !a || (a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - 0.02); }

  // Short staggering reaction. dir = world hit direction (x,z) the bullet travels.
  flinch(dx, dz, amp = 1) {
    this.flinchT = 0.35; this.flinchAmp = amp;
    // rotate the upper body about the axis perpendicular to the hit direction (push away from the shot)
    this.flinchAxis.set(dz, 0, -dx).normalize();
  }

  // World-space rotation delta applied to a bone on top of the current animation pose.
  _rotateWorld(bone, dq) {
    bone.parent.getWorldQuaternion(_q);
    _q2.copy(_q).invert().multiply(dq).multiply(_q);
    bone.quaternion.premultiply(_q2);
  }

  // Turn `bone` so that the vector bone->child points along world direction `dir` (blend weight w).
  _aimBone(bone, child, dir, w) {
    bone.getWorldPosition(_v); child.getWorldPosition(_v2);
    _v2.sub(_v).normalize();
    bone.getWorldQuaternion(_q2);
    _q.setFromUnitVectors(_v2, dir).multiply(_q2);               // new world rotation
    bone.parent.getWorldQuaternion(_q2);
    _q.premultiply(_q2.invert());                                 // to parent space
    bone.quaternion.slerp(_q, w);
    bone.updateMatrixWorld(true);
  }

  // Two-bone IK: bring `wrist` to world point `target`; `pole` = world direction the elbow bends towards.
  _ikArm(upper, lower, wrist, target, pole, w) {
    upper.getWorldPosition(_t3); lower.getWorldPosition(_v); wrist.getWorldPosition(_v2);
    const l1 = _v.distanceTo(_t3), l2 = _v2.distanceTo(_v);
    _v2.copy(target).sub(_t3);
    const d = Math.min(Math.max(_v2.length(), 0.05), l1 + l2 - 1e-3);
    _v2.normalize();
    const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    _t2.copy(pole).addScaledVector(_v2, -pole.dot(_v2)).normalize();
    _v.copy(_t3).addScaledVector(_v2, l1 * cosA).addScaledVector(_t2, l1 * Math.sqrt(1 - cosA * cosA));   // elbow
    _v3.copy(_v).sub(_t3).normalize();
    this._aimBone(upper, lower, _v3, w);
    lower.getWorldPosition(_v);
    _v3.copy(target).sub(_v).normalize();
    this._aimBone(lower, wrist, _v3, w);
  }

  // pose overrides, called after the mixer
  _post(dt) {
    if (this.flinchT > 0 && this.bones[BONE.abdomen]) {
      this.flinchT = Math.max(0, this.flinchT - dt);
      const k = this.flinchT / 0.35, a = Math.sin(k * Math.PI) * 0.42 * this.flinchAmp;
      this.root.updateMatrixWorld(true);
      _q.setFromAxisAngle(this.flinchAxis.set(this.flinchAxis.x, 0, this.flinchAxis.z), -a);
      this._rotateWorld(this.bone('abdomen'), _q);
      this.bone('abdomen').updateMatrixWorld(true);
      _q.setFromAxisAngle(this.flinchAxis, a * 0.7);
      this._rotateWorld(this.bone('head'), _q);
    }
    if (this.aimW > 0.01) {
      this.root.updateMatrixWorld(true);
      // forward in world space (root faces +Z), pitched by aimPitch
      this.root.getWorldQuaternion(_q);
      const cp = Math.cos(this.aimPitch), sp = Math.sin(this.aimPitch);
      _axis.set(0, sp, cp).applyQuaternion(_q);
      this._aimBone(this.bone('uArmR'), this.bone('lArmR'), _axis, this.aimW);
      this._aimBone(this.bone('lArmR'), this.bone('palmR'), _axis, this.aimW);
      // left hand: grips the fore-end of a long gun (0.36 m ahead of the right hand) or supports the pistol grip from the side
      this.bone('palmR').getWorldPosition(_t1);
      if (this.twoHanded) { _t1.addScaledVector(_axis, 0.36); _t1.y -= 0.05; }
      else { _t1.addScaledVector(_axis, 0.04); _v.set(0.07, -0.02, 0).applyQuaternion(_q); _t1.add(_v); }
      _t2.set(0.5, -1, 0).applyQuaternion(_q);
      this._ikArm(this.bone('uArmL'), this.bone('lArmL'), this.bone('palmL'), _t1, _t2, this.aimW);
    }
  }

  // Right-hand proxy: unit-scale Object3D under root, +Z = forearm direction, +Y up-ish.
  makeRightHand() {
    if (!this.rightHand) { this.rightHand = new THREE.Object3D(); this.rightHand.name = 'rightHand'; this.root.add(this.rightHand); }
    return this.rightHand;
  }
  _syncHand() {
    const p = this.bone('palmR'), f = this.bone('lArmR');
    if (!p || !f) return;
    this.root.updateMatrixWorld(true);
    p.getWorldPosition(_v); f.getWorldPosition(_v2);
    _v3.copy(_v).sub(_v2).normalize().transformDirection(_m.copy(this.root.matrixWorld).invert());   // forearm dir, root space
    _m.lookAt(_zero, _v4.copy(_v3).negate(), _up);
    this.rightHand.quaternion.setFromRotationMatrix(_m);
    this.root.worldToLocal(_v);
    this.rightHand.position.copy(_v).addScaledVector(_v3, 0.05);
  }

  update(dt) {
    this.mixer.update(dt);
    this._post(dt);
    if (this.rightHand) this._syncHand();
  }
}
