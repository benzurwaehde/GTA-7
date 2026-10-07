import * as THREE from 'three';
const _v = new THREE.Vector3();
// True if the ground point (x,z) is (roughly) inside the camera frustum.
export function inView(game, x, z, margin = 1.2) {
  const c = game.camera;
  if (!c) return false;
  _v.set(x, 1, z).project(c);
  return _v.z < 1 && Math.abs(_v.x) < margin && Math.abs(_v.y) < margin;
}
export function playerPos(game) {
  const p = game.player?.position;
  if (p && Number.isFinite(p.x)) return p;
  return { x: 0, y: 0, z: 0 };
}
export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
