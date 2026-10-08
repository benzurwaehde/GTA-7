import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHOP_NAME } from './catalog.js';

const W = 12, D = 8, H = 5.8; // footprint (width, depth) and height of the shop building

function colored(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}

function signTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a0d12'; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#ff2d4a'; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 236);
  // bullseye logo with an arrow
  const cx = 150, cy = 128;
  for (const [r, col] of [[96, '#f4f0e8'], [76, '#d8202f'], [56, '#f4f0e8'], [36, '#d8202f'], [16, '#f4f0e8']]) {
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = col; g.fill();
  }
  g.strokeStyle = '#ffd24a'; g.lineWidth = 9; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 78, cy - 78); g.stroke();
  g.fillStyle = '#ffd24a'; g.fillRect(cx + 60, cy - 100, 34, 22);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = 'bold 118px Impact, "Arial Black", sans-serif';
  g.shadowColor = '#ff2d4a'; g.shadowBlur = 22; g.fillStyle = '#fff4e0';
  g.fillText('BULLSEYE', 280, 100);
  g.shadowBlur = 0; g.fillStyle = '#ffd24a'; g.font = 'bold 74px Impact, "Arial Black", sans-serif';
  g.fillText('ARMS', 280, 196);
  g.font = 'bold 28px Arial, sans-serif'; g.fillStyle = '#ff6a7a'; g.fillText('GUNS  AMMO  ARMOR', 540, 196);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.85)'); r.addColorStop(0.55, 'rgba(255,255,255,0.3)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The shop building: local space, front face on z = 0 looking towards +Z, body extends to z = -D, door at x = 0.
// Five draw calls: body (vertex colours), glass, sign, entrance marker ring, light beam.
export function buildStorefront() {
  const root = new THREE.Group(); root.name = 'bullseyeArms';
  const body = mergeGeometries([
    colored(W, H, D, 0, H / 2, -D / 2, 0x9a6a64),                 // walls
    colored(W + 0.5, 0.35, D + 0.5, 0, H + 0.17, -D / 2, 0x2a2a30), // roof slab
    colored(W + 0.1, 0.5, 0.2, 0, 0.25, 0.0, 0x24242a),           // plinth
    colored(1.5, 2.3, 0.12, 0, 1.15, 0.06, 0x1a1a20),             // door
    colored(1.7, 0.16, 0.2, 0, 2.38, 0.1, 0x8a1c26),              // door header
    colored(3.7, 1.9, 0.1, -3.9, 1.55, 0.02, 0x16161c), colored(3.7, 1.9, 0.1, 3.9, 1.55, 0.02, 0x16161c), // window frames
    colored(W - 0.8, 0.12, 1.7, 0, 2.95, 0.85, 0xb01e2c),          // awning
    colored(W - 0.8, 0.4, 0.1, 0, 2.75, 1.68, 0x7a1620),            // awning valance
    colored(0.9, 0.3, 0.5, W / 2 - 1.2, H + 0.5, -D / 2, 0x55595e), // roof unit
  ]);
  const bodyMesh = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; root.add(bodyMesh);

  // shop windows with a warm interior glow (shared emissive glass)
  const glass = mergeGeometries([
    new THREE.BoxGeometry(3.3, 1.5, 0.08).translate(-3.9, 1.55, 0.09),
    new THREE.BoxGeometry(3.3, 1.5, 0.08).translate(3.9, 1.55, 0.09),
    new THREE.BoxGeometry(1.2, 1.9, 0.06).translate(0, 1.1, 0.13),
  ]);
  root.add(new THREE.Mesh(glass, new THREE.MeshStandardMaterial({ color: 0x1c1610, emissive: 0xffb24a, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.2 })));

  // sign board above the awning
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture(), emissive: 0xffffff, roughness: 0.6 });
  signMat.emissiveMap = signMat.map; signMat.emissiveIntensity = 0.7;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), signMat);
  sign.position.set(0, 4.6, 0.12); root.add(sign);
  sign.name = SHOP_NAME + ' sign';

  // entrance marker: pulsing ring on the sidewalk + light beam (animated by the Shop system)
  const ringG = new THREE.RingGeometry(1.05, 1.6, 40); ringG.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xff2d4a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.set(0, 0.06, 2.4); root.add(ring);
  const beamG = new THREE.CylinderGeometry(1.15, 1.15, 5, 24, 1, true); beamG.translate(0, 2.5, 0);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff3a55, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.set(0, 0.05, 2.4); root.add(beam);

  return { root, ring, beam, W, D, H, markerLocal: new THREE.Vector3(0, 0, 2.4) };
}
