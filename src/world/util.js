import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

// Geometry builder: non-indexed triangle soup with per-vertex color/uv; winding is auto-fixed
// to face away from a reference "center" point so callers never need to care about orientation.
export class GB {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }

  tri(a, b, c, ua, ub, uc, col, ctr) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ctr && nx * (a[0] - ctr[0]) + ny * (a[1] - ctr[1]) + nz * (a[2] - ctr[2]) < 0) {
      [b, c] = [c, b]; [ub, uc] = [uc, ub]; nx = -nx; ny = -ny; nz = -nz;
    }
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(u[0], u[1]);
      this.col.push(col[0], col[1], col[2]);
    }
  }

  quad(p0, p1, p2, p3, uvs, col, ctr) {
    this.tri(p0, p1, p2, uvs[0], uvs[1], uvs[2], col, ctr);
    this.tri(p0, p2, p3, uvs[0], uvs[2], uvs[3], col, ctr);
  }

  // Horizontal quad at height y. uv = world coords * s.
  flat(x0, z0, x1, z1, y, col, s = 0.25) {
    const ctr = [(x0 + x1) / 2, y - 1, (z0 + z1) / 2];
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1],
      [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], col, ctr);
  }

  // mode 'facade': side uv u = horizontal/24 + uoff, v = (y-0.18)/12 ; 'world': everything /4
  box(x0, y0, z0, x1, y1, z1, col, o = {}) {
    const ctr = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const fac = o.mode === 'facade';
    const fu = fac ? 1 / 24 : 0.25, fv = fac ? 1 / 12 : 0.25, uo = o.uoff || 0, vo = fac ? 0.18 : 0;
    if (o.sides !== false) {
      const v0 = (y0 - vo) * fv, v1 = (y1 - vo) * fv;
      // -z / +z faces (span x)
      for (const z of [z0, z1]) {
        this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z],
          [[x0 * fu + uo, v0], [x1 * fu + uo, v0], [x1 * fu + uo, v1], [x0 * fu + uo, v1]], col, ctr);
      }
      for (const x of [x0, x1]) {
        this.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0],
          [[z0 * fu + uo, v0], [z1 * fu + uo, v0], [z1 * fu + uo, v1], [z0 * fu + uo, v1]], col, ctr);
      }
    }
    if (o.top !== false) {
      const s = 0.25;
      this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
        [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], col, ctr);
    }
  }

  // Disc / ellipse on the ground.
  disc(cx, cz, rx, rz, y, col, seg = 20) {
    const ctr = [cx, y - 1, cz];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [cx, y, cz], p1 = [cx + Math.cos(a0) * rx, y, cz + Math.sin(a0) * rz], p2 = [cx + Math.cos(a1) * rx, y, cz + Math.sin(a1) * rz];
      this.tri(p0, p1, p2, [cx * .25, cz * .25], [p1[0] * .25, p1[2] * .25], [p2[0] * .25, p2[2] * .25], col, ctr);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  get empty() { return this.pos.length === 0; }
}

export const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export function tint(hex, rnd, amt = 0.08) {
  const c = new THREE.Color(hex);
  const k = 1 + (rnd() - 0.5) * 2 * amt;
  return [Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)];
}
