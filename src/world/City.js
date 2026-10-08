import * as THREE from 'three';
import { CITY, ROAD_LINES, blockBounds } from '../core/config.js';
import { mulberry32, GB, rgb, tint, smoothstep, lerp } from './util.js';
import * as TX from './textures.js';
import { makeSkyDome, skyColors } from './sky.js';
import { treeGeo, palmGeo, lampPoleGeo, lampHeadGeo } from './props.js';
import { Signals } from './signals.js';
import { Shops } from './shops.js';
import { buildFurniture } from './furniture.js';
import { COAST, groundHeight } from './coast.js';
import { Sea } from './water.js';
import { Harbor } from './harbor.js';
import { Landmarks } from './landmarks.js';
import { buildRoofDetails } from './roofs.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const H = CITY.half;
const SW = CITY.sidewalk;
const SLAB = 0.18;
const LANE = CITY.roadWidth / 4; // lane-center offset from the road centerline

const POI_DEFS = [
  { type: 'hospital', name: 'Saint Marlow Hospital', i: 2, j: 2, side: 's', w: 44, d: 40, h: 27, color: 0xf0f3f6, style: 1, sign: ['HOSPITAL', '#f4f6f8', '#c62828', 'cross'], beam: 0xff4040 },
  { type: 'police', name: 'Vice Bay PD - Central', i: 5, j: 3, side: 'w', w: 40, d: 32, h: 18, color: 0x30508f, style: 2, sign: ['POLICE', '#14275a', '#ffffff', 'star'], beam: 0x4080ff },
  { type: 'garage', name: 'Redline Garage', i: 1, j: 5, side: 'e', w: 46, d: 28, h: 9, color: 0xd0742a, style: 2, sign: ['GARAGE', '#2a2a2e', '#ffb02e'], beam: 0xffa030 },
  { type: 'shop', name: 'NightOwl Mart', i: 4, j: 5, side: 'n', w: 32, d: 22, h: 7, color: 0x8a4fc0, style: 2, sign: ['NIGHTOWL 24H', '#2a1450', '#ff6ad5'], beam: 0xd060ff },
  { type: 'safehouse', name: 'Palm Loft Safehouse', i: 6, j: 1, side: 's', w: 22, d: 18, h: 12, color: 0x2f9d94, style: 1, sign: ['SAFEHOUSE', '#0e3d3a', '#7dffe8'], beam: 0x30ffd0 },
];
const SIDE_DIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

const PALETTES = {
  center: [0xdfe6ee, 0xbcd0e0, 0xa4bdd0, 0xd0d6dc, 0x8fa8b8, 0xe8e2d4, 0x9db0c0],
  north: [0xe8d9c0, 0xd9b8a0, 0xcfdcc4, 0xe6e0d8, 0xc8d0dc, 0xe0c8b0],
  south: [0xbfc3c7, 0xcbbd9f, 0xa3aeb8, 0xd6d0c4, 0xb4a894],
  east: [0xf4b6c2, 0xa6e4d4, 0xf7e2a4, 0xbcdaf2, 0xf2c6a0, 0xe2b8f0],
  west: [0xa4604c, 0x946e5c, 0xb07c64, 0x80808a, 0x9c8a78],
};
const ROOFS = [0x6d7075, 0x5e6368, 0x7a6f66, 0x4f5459];
const HOUSE_ROOFS = [0x9a4a38, 0x6c4a3a, 0x58606a, 0x7a3e2e];
// Extra wall colours for the outskirts (picked with a separate RNG, so the city layout stays the same)
const OUTSKIRT_COLORS = {
  north: [0xf2e6c8, 0xdcc4a0, 0xc9d8b8, 0xeed0c0, 0xb8cfd8, 0xe8dcc0],
  south: [0xd8d0b8, 0xb8c4cc, 0xcfc4ae, 0xb2b8a8, 0xc8b8a8],
  east: [0xff9fb4, 0x8fe0cc, 0xffe08a, 0x9fd0f4, 0xffb88a, 0xd8a0ee, 0xf4f0a0],
  west: [0xb86a50, 0x8a5a48, 0xc08a68, 0x6e747e, 0xa89480, 0x7a4a3c],
  center: [0xd8dce2],
};

export function districtKey(x, z) {
  if (Math.max(Math.abs(x), Math.abs(z)) < 115) return 'center';
  if (Math.abs(z) >= Math.abs(x)) return z < 0 ? 'north' : 'south';
  return x > 0 ? 'east' : 'west';
}
const DISTRICT_NAMES = {
  center: 'Meridian Central', north: 'Ashgrove Heights', south: 'Marlin Pier', east: 'Coral Flats', west: 'Foundry Quarter',
};

export class City {
  constructor(game) {
    this.game = game;
    this.colliders = [];
    this.pois = [];
    this.timeOfDay = 10;
    this.nightFactor = 0;
    this._rnd = mulberry32(7007);
    this._rnd2 = mulberry32(31337); // for additions that must not shift the original layout
    this._roofRects = [];
    this.group = new THREE.Group();
    this.group.name = 'world';
    game.scene.add(this.group);
    this._aniso = Math.min(8, game.renderer.capabilities.getMaxAnisotropy?.() || 4);
    game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    game.renderer.toneMappingExposure = 1.05;

    this._buildMaterials();
    this.landmarks = new Landmarks(this.group, this.colliders);
    this.group.children.forEach((m) => { m.userData.t3 = 'landmark'; });
    this._buildTerrainAndRoads();
    this._buildBlocks();
    this._buildProps();
    this._buildDetails();
    this._buildCoastDetails();
    this._buildBoundaries();
    this._buildSky();
    this._buildSea();
    this._finalizeMeshes();
    this._buildCollGrid();
    this._applyTime();
  }

  get isNight() { const t = this.timeOfDay; return t < 5.5 || t >= 19.5; }

  // ---------------------------------------------------------------- materials
  _buildMaterials() {
    const r = mulberry32(99), a = this._aniso;
    const road = TX.makeRoad(r, a), asph = TX.makeAsphalt(r, a), walk = TX.makeSidewalk(r, a), terr = TX.makeTerrain(r, a);
    const std = (p) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...p });
    this.mat = {
      road: std({ map: road, roughness: 0.85 }),
      asphalt: std({ map: asph, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      marks: std({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      walk: std({ map: walk, vertexColors: true }),
      terrain: std({ map: terr, vertexColors: true }),
      roof: std({ vertexColors: true, roughness: 0.9 }),
      facade: Array.from({ length: TX.FACADE_STYLES }, (_, s) => {
        const f = TX.makeFacade(s, mulberry32(500 + s), a);
        return new THREE.MeshStandardMaterial({
          map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0,
          vertexColors: true, roughness: s === 0 ? 0.45 : s === 3 ? 0.7 : 0.85, metalness: s === 0 ? 0.15 : s === 3 ? 0.08 : 0,
        });
      }),
      foliage: std({ vertexColors: true, roughness: 0.9 }),
      lamp: std({ vertexColors: false, color: 0x3a3f46, roughness: 0.6, metalness: 0.4 }),
      lampHead: new THREE.MeshBasicMaterial({ color: 0x777066 }),
      glow: new THREE.MeshBasicMaterial({
        map: TX.makeGlow(), color: 0xffd596, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: true,
      }),
    };
    this._waterNormal = TX.makeWaterNormal(r, a);
  }

  // ---------------------------------------------------------------- terrain + roads
  _buildTerrainAndRoads() {
    const terrain = this._terrainGB = new GB();
    // Ground: city plate, grass / sand ring and a beach that slopes under the sea (profile in coast.js).
    // Breakpoints are mirrored, so the grid has a cell edge at every change of slope or colour.
    const R = [H + 90, H + 60, H + 36, H + 31, H + 27, H + 20, H + 12];
    const xs = [...R.map((v) => -v), ...R.slice().reverse()];
    const hgt = (x, z) => groundHeight(Math.max(Math.abs(x), Math.abs(z)));
    const grass = rgb(0x5b9a45), sand = rgb(0xe3d29a), wet = rgb(0xb9a878), bed = rgb(0x9c9468), deep = rgb(0x6f7a68);
    for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < xs.length - 1; b++) {
      const x0 = xs[a], x1 = xs[a + 1], z0 = xs[b], z1 = xs[b + 1];
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const dc = Math.max(Math.abs(cx), Math.abs(cz));
      const isSand = cx > H + 12 || cz > H + 12 || dc > H + 20;
      const col = dc > H + 60 ? deep : dc > H + 31 ? bed : dc > H + 27 ? wet : isSand ? sand : grass;
      const P = (x, z) => [x, hgt(x, z), z];
      terrain.quad(P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1),
        [[x0 / 10, z0 / 10], [x1 / 10, z0 / 10], [x1 / 10, z1 / 10], [x0 / 10, z1 / 10]], col, [cx, -5, cz]);
    }

    // roads
    const asphGB = this._asphGB = new GB(), marks = this._marksGB = new GB();
    const white = rgb(0xe8e8e8), RW = CITY.roadWidth, hw = RW / 2;
    const asphCol = [1, 1, 1];
    for (let a = 0; a < ROAD_LINES.length; a++) for (let b = 0; b < ROAD_LINES.length; b++) {
      const x = ROAD_LINES[a], z = ROAD_LINES[b];
      asphGB.flat(x - hw, z - hw, x + hw, z + hw, 0.06, asphCol, 1 / 14);
      // crosswalks + stop lines on each existing leg
      const legs = [
        { ok: b > 0, dx: 0, dz: -1 }, { ok: b < ROAD_LINES.length - 1, dx: 0, dz: 1 },
        { ok: a > 0, dx: -1, dz: 0 }, { ok: a < ROAD_LINES.length - 1, dx: 1, dz: 0 },
      ];
      for (const L of legs) {
        if (!L.ok) continue;
        const y = 0.09;
        if (L.dz !== 0) { // crosswalk across N-S road: stripes along z, spread over x
          const zNear = z + L.dz * hw, zFar = z + L.dz * (hw + 3.2);
          const zl = Math.min(zNear, zFar), zh = Math.max(zNear, zFar);
          for (let k = 0; k < 8; k++) { const sx = x - hw + 0.9 + k * 1.65; marks.flat(sx, zl, sx + 0.8, zh, y, white); }
          // stop line (incoming lane = side whose traffic moves toward intersection)
          const zs = z + L.dz * (hw + 4.4);
          const lane = L.dz > 0 ? 1 : -1; // traffic from +z leg heads -z, driving on its right: x = r + LANE
          const xa = lane > 0 ? x : x - hw; marks.flat(xa + 0.2, zs, xa + hw - 0.2, zs + 0.45, y, white);
        } else {
          const xNear = x + L.dx * hw, xFar = x + L.dx * (hw + 3.2);
          const xl = Math.min(xNear, xFar), xh = Math.max(xNear, xFar);
          for (let k = 0; k < 8; k++) { const sz = z - hw + 0.9 + k * 1.65; marks.flat(xl, sz, xh, sz + 0.8, y, white); }
          const xs2 = x + L.dx * (hw + 4.4);
          const lane = L.dx > 0 ? -1 : 1;
          const za = lane > 0 ? z : z - hw; marks.flat(xs2, za + 0.2, xs2 + 0.45, za + hw - 0.2, y, white);
        }
      }
    }
  }

  // ---------------------------------------------------------------- blocks / buildings
  _buildBlocks() {
    const rnd = this._rnd;
    const walkGB = this._walkGB = new GB();
    const facades = this._facadeGB = Array.from({ length: TX.FACADE_STYLES }, () => new GB());
    const roofGB = this._roofGB = new GB();
    const terrain = this._terrainGB, asph = this._asphGB, marks = this._marksGB;
    this._parks = []; this._yardSpots = []; this._lotsForTrees = []; this._shopSpecs = [];
    const poiAt = new Map(POI_DEFS.map((p) => [p.i + ',' + p.j, p]));
    const pick = (arr) => arr[(rnd() * arr.length) | 0];
    const rr = (a, b) => a + rnd() * (b - a);
    const walkCol = [1, 1, 1];

    for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
      const b = blockBounds(i, j);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const dist = Math.max(Math.abs(cx), Math.abs(cz)) / H;
      const dk = districtKey(cx, cz);
      const pal = PALETTES[dk];
      walkGB.box(b.minX, 0, b.minZ, b.maxX, SLAB, b.maxZ, tint(0xcfcdc6, rnd, 0.05), { mode: 'world' });
      const ix0 = b.minX + SW, ix1 = b.maxX - SW, iz0 = b.minZ + SW, iz1 = b.maxZ - SW;

      const poi = poiAt.get(i + ',' + j);
      if (poi) { this._buildPoi(poi, b, cx, cz); continue; }

      // block type
      const roll = rnd();
      const centerBlock = i >= 3 && i <= 4 && j >= 3 && j <= 4;
      let type = 'city';
      if (!centerBlock && roll < (dk === 'north' ? 0.28 : 0.13)) type = 'park';
      else if (!centerBlock && roll < (dk === 'north' ? 0.28 : 0.13) + (dk === 'south' ? 0.18 : 0.08)) type = 'parking';
      else if (i === 3 && j === 4) type = 'park'; // central plaza park, keeps downtown from being solid

      if (type === 'park') { this._buildPark(ix0, iz0, ix1, iz1, cx, cz, rnd); continue; }
      if (type === 'parking') { this._buildParking(ix0, iz0, ix1, iz1, cx, cz); continue; }

      // lots
      const tier = dist < 0.27 ? 0 : dist < 0.5 ? 1 : dist < 0.75 ? 2 : 3;
      const nx = tier === 0 ? (rnd() < 0.6 ? 1 : 2) : tier === 1 ? (rnd() < 0.5 ? 2 : 1) : 2 + ((rnd() * 2) | 0);
      const nz = tier === 0 ? (rnd() < 0.6 ? 1 : 2) : tier === 1 ? (rnd() < 0.5 ? 2 : 1) : 2 + ((rnd() * 2) | 0);
      const lw = (ix1 - ix0) / nx, ld = (iz1 - iz0) / nz;
      for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
        const lx0 = ix0 + a * lw, lz0 = iz0 + c * ld, lx1 = lx0 + lw, lz1 = lz0 + ld;
        if (rnd() < 0.05 && tier > 1) { this._lotsForTrees.push([lx0, lz0, lx1, lz1, null]); continue; }
        this._buildLot(lx0, lz0, lx1, lz1, tier, dk, pal, rnd, { nx0: a === 0, nx1: a === nx - 1, nz0: c === 0, nz1: c === nz - 1 });
      }
    }
  }

  _buildLot(lx0, lz0, lx1, lz1, tier, dk, pal, rnd, edges) {
    const rr = (a, b) => a + rnd() * (b - a);
    const house = tier === 3 || (tier === 2 && rnd() < 0.35);
    let x0, z0, x1, z1, floors;
    if (house) {
      const w = Math.min(lx1 - lx0 - 5, rr(10, 17)), d = Math.min(lz1 - lz0 - 5, rr(9, 15));
      x0 = rr(lx0 + 2, lx1 - 2 - w); z0 = rr(lz0 + 2, lz1 - 2 - d); x1 = x0 + w; z1 = z0 + d;
      floors = rnd() < 0.5 ? 1 : 2;
    } else {
      const m = tier === 0 ? rr(0.8, 1.6) : rr(1, 2.6);
      x0 = lx0 + m; z0 = lz0 + m; x1 = lx1 - m; z1 = lz1 - m;
      floors = tier === 0 ? 14 + ((rnd() * 22) | 0) : tier === 1 ? 8 + ((rnd() * 9) | 0) : 4 + ((rnd() * 5) | 0);
      if (tier === 0 && Math.abs((x0 + x1) / 2) < 70 && Math.abs((z0 + z1) / 2) < 70) floors += 6 + ((rnd() * 8) | 0);
      if (dk === 'south' && tier >= 2) floors = Math.min(floors, 4);
    }
    let style = house ? 1 : tier === 0 ? (rnd() < 0.75 ? 0 : 2) : tier === 1 ? [0, 1, 2][(rnd() * 3) | 0] : (dk === 'south' || dk === 'west' ? 2 : 1);
    let wallCol = tint(pal[(rnd() * pal.length) | 0], rnd, 0.06);
    const uoff = rnd();
    // outskirts variety (separate RNG, so the layout above stays identical): industrial ribbon-window facades in the
    // south and west, narrow-window apartment blocks elsewhere, and a wider colour range
    if (tier >= 2) {
      const r2 = this._rnd2, v = r2();
      if (!house && v < 0.5) style = (dk === 'south' || dk === 'west') ? 3 : 4;
      else if (house && v < 0.25) style = 4;
      if (r2() < 0.6) { const oc = OUTSKIRT_COLORS[dk]; wallCol = tint(oc[(r2() * oc.length) | 0], r2, 0.05); }
    }
    const h = floors * 3;
    const F = this._facadeGB[style];
    F.box(x0, SLAB, z0, x1, SLAB + h, z1, wallCol, { mode: 'facade', uoff, top: false });
    this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY: SLAB + h, type: 'building' });
    if (!house && tier <= 1) this._shopSpecs.push({ x0, z0, x1, z1, floors, tier, edges, wallCol }); // shopfronts (see shops.js)
    const R = this._roofGB;
    const top = SLAB + h;
    if (house) {
      const rc = rgb(HOUSE_ROOFS[(rnd() * HOUSE_ROOFS.length) | 0]);
      const o = 0.5, alongX = (x1 - x0) >= (z1 - z0), rh = 2 + rnd() * 1.4;
      this._gable(F, R, x0 - o, z0 - o, x1 + o, z1 + o, top, rh, alongX, rc, wallCol, uoff);
      this._lotsForTrees.push([lx0, lz0, lx1, lz1, [x0 - 1.5, z0 - 1.5, x1 + 1.5, z1 + 1.5]]);
    } else {
      const rc = tint(ROOFS[(rnd() * ROOFS.length) | 0], rnd, 0.1);
      R.box(x0 - 0.15, top, z0 - 0.15, x1 + 0.15, top + 0.4, z1 + 0.15, rc, { mode: 'world' });
      this._parapet(R, x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, top + 0.4, rc);
      const roof = [x0, z0, x1, z1, top + 0.4]; // updated below when the building has setback tiers
      this._roofRects.push(roof);
      // roof clutter
      const nUnits = (rnd() * 4) | 0;
      for (let k = 0; k < nUnits; k++) {
        const w = rr(1.5, 4), d = rr(1.5, 4);
        if (x1 - x0 < w + 3 || z1 - z0 < d + 3) continue;
        const ux = rr(x0 + 1, x1 - 1 - w), uz = rr(z0 + 1, z1 - 1 - d), uh = rr(0.8, 2.4);
        R.box(ux, top + 0.4, uz, ux + w, top + 0.4 + uh, uz + d, tint(0x8a8f94, rnd, 0.15), { mode: 'world' });
      }
      // setback tiers + antenna for towers
      if (floors >= 14) {
        let tx0 = x0, tz0 = z0, tx1 = x1, tz1 = z1, ty = top, tf = floors;
        const tiers = 1 + ((rnd() * 2) | 0);
        for (let t = 0; t < tiers; t++) {
          const ins = rr(3, 6);
          if (tx1 - tx0 < ins * 2 + 8 || tz1 - tz0 < ins * 2 + 8) break;
          tx0 += ins; tz0 += ins; tx1 -= ins; tz1 -= ins;
          const hh = (3 + ((rnd() * 6) | 0)) * 3;
          F.box(tx0, ty, tz0, tx1, ty + hh, tz1, wallCol, { mode: 'facade', uoff, top: false });
          // base cap hides the tier seam
          ty += hh;
          R.box(tx0 - 0.15, ty, tz0 - 0.15, tx1 + 0.15, ty + 0.4, tz1 + 0.15, rc, { mode: 'world' });
          this._parapet(R, tx0 - 0.15, tz0 - 0.15, tx1 + 0.15, tz1 + 0.15, ty + 0.4, rc);
          roof[0] = tx0; roof[1] = tz0; roof[2] = tx1; roof[3] = tz1; roof[4] = ty + 0.4;
          if (this.colliders.length) this.colliders[this.colliders.length - 1].maxY = ty;
        }
        const ax = (tx0 + tx1) / 2, az = (tz0 + tz1) / 2, ah = rr(8, 24);
        R.box(ax - 0.25, ty + 0.4, az - 0.25, ax + 0.25, ty + 0.4 + ah, az + 0.25, rgb(0x9aa0a6), { mode: 'world' });
        R.box(ax - 0.3, ty + 0.4 + ah, az - 0.3, ax + 0.3, ty + 0.4 + ah + 0.6, az + 0.3, rgb(0xff3030), { mode: 'world' });
        this._beacons = this._beacons || []; this._beacons.push([ax, ty + 0.4 + ah + 0.3, az]);
      }
    }
  }

  // Low rim around a flat roof (four thin boxes, merged into the roof mesh).
  _parapet(R, x0, z0, x1, z1, y, base) {
    const c = [Math.min(1, base[0] * 1.25 + 0.04), Math.min(1, base[1] * 1.25 + 0.04), Math.min(1, base[2] * 1.25 + 0.04)];
    const t = 0.32, h = y + 0.75, o = { mode: 'world' };
    R.box(x0, y, z0, x1, h, z0 + t, c, o); R.box(x0, y, z1 - t, x1, h, z1, c, o);
    R.box(x0, y, z0 + t, x0 + t, h, z1 - t, c, o); R.box(x1 - t, y, z0 + t, x1, h, z1 - t, c, o);
  }

  _gable(F, R, x0, z0, x1, z1, y, rh, alongX, rc, wallCol, uoff) {
    const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1];
    const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, ctr = [xc, y + rh * 0.3, zc];
    const uv = [0, 0];
    if (alongX) {
      const R1 = [x0, y + rh, zc], R2 = [x1, y + rh, zc];
      R.quad(A, B, R2, R1, [uv, uv, uv, uv], rc, ctr); R.quad(D, C, R2, R1, [uv, uv, uv, uv], rc, ctr);
      R.tri(A, D, R1, uv, uv, uv, rc, ctr); R.tri(B, C, R2, uv, uv, uv, rc, ctr);
    } else {
      const R1 = [xc, y + rh, z0], R2 = [xc, y + rh, z1];
      R.quad(A, D, R2, R1, [uv, uv, uv, uv], rc, ctr); R.quad(B, C, R2, R1, [uv, uv, uv, uv], rc, ctr);
      R.tri(A, B, R1, uv, uv, uv, rc, ctr); R.tri(D, C, R2, uv, uv, uv, rc, ctr);
    }
  }

  _buildPark(ix0, iz0, ix1, iz1, cx, cz, rnd) {
    const T = this._terrainGB, y = SLAB + 0.02;
    const g = tint(0x4f9a3e, rnd, 0.05);
    T.flat(ix0, iz0, ix1, iz1, y, g, 0.1);
    const pond = rnd() < 0.35;
    if (pond) T.disc(cx, cz, 9, 7, y + 0.02, rgb(0x3a86b8), 24);
    else {
      const p = rgb(0xd8c79a);
      T.flat(cx - 1.5, iz0, cx + 1.5, iz1, y + 0.02, p, 0.2); T.flat(ix0, cz - 1.5, ix1, cz + 1.5, y + 0.02, p, 0.2);
      T.disc(cx, cz, 5, 5, y + 0.03, rgb(0xcdbb8c), 20);
    }
    const trees = [];
    for (let n = 0; n < 60 && trees.length < 15; n++) {
      const x = ix0 + 2 + rnd() * (ix1 - ix0 - 4), z = iz0 + 2 + rnd() * (iz1 - iz0 - 4);
      if (!pond && (Math.abs(x - cx) < 3.2 || Math.abs(z - cz) < 3.2)) continue;
      if (pond && Math.hypot((x - cx) / 11, (z - cz) / 9) < 1) continue;
      if (!pond && Math.hypot(x - cx, z - cz) < 7) continue;
      if (trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 5)) continue;
      trees.push([x, z]);
    }
    this._treeSpots = this._treeSpots || []; this._palmSpots = this._palmSpots || [];
    // landmarks (fixed placement, no RNG): Meridian Tower in the central plaza park, pavilion in the first pond-free north park
    const tower = Math.abs(cx + 37) < 1 && Math.abs(cz - 37) < 1;
    const pav = !tower && !pond && !this._pavilion && districtKey(cx, cz) === 'north';
    if (tower) this._walkGB.flat(cx - 14, cz - 14, cx + 14, cz + 14, SLAB + 0.06, [0.78, 0.78, 0.75], 0.25); // stone plaza hides park paths under the tower
    if (tower) this._towerBeacon = this.landmarks.buildTower(this._facadeGB[0], this._roofGB, cx, cz);
    if (pav) { this._pavilion = true; this.landmarks.addPavilion(cx, cz); }
    for (const [x, z] of trees) {
      const palm = rnd() < 0.2; // keep the RNG sequence identical to the original layout
      if (tower && Math.abs(x - cx) < 15 && Math.abs(z - cz) < 15) continue;
      if (pav && Math.hypot(x - cx, z - cz) < 8) continue;
      (palm ? this._palmSpots : this._treeSpots).push([x, z]);
    }
  }

  _buildParking(ix0, iz0, ix1, iz1, cx, cz) {
    const A = this._asphGB, M = this._marksGB, y = SLAB + 0.03, ym = SLAB + 0.05;
    A.flat(ix0 + 1, iz0 + 1, ix1 - 1, iz1 - 1, y, [1, 1, 1], 1 / 14);
    const w = rgb(0xdcdcdc);
    for (const rowZ of [cz - 17, cz + 12]) {
      for (let x = ix0 + 3; x <= ix1 - 3; x += 2.8) M.flat(x, rowZ, x + 0.12, rowZ + 5, ym, w);
      M.flat(ix0 + 3, rowZ + (rowZ < cz ? 0 : 5), ix1 - 3, rowZ + (rowZ < cz ? 0 : 5) + 0.12, ym, w);
    }
    // arrows / aisle line
    M.flat(ix0 + 3, cz - 0.1, ix1 - 3, cz + 0.1, ym, rgb(0xe8c020));
  }

  _buildPoi(p, b, cx, cz) {
    const [dx, dz] = SIDE_DIR[p.side];
    // face plane sits 6m inside the block edge (3m sidewalk + 3m forecourt)
    const faceDist = CITY.blockSize / 2 - 6;
    const ccx = cx + dx * (faceDist - p.d / 2), ccz = cz + dz * (faceDist - p.d / 2);
    const sx = dx !== 0 ? p.d : p.w, sz = dz !== 0 ? p.d : p.w;
    const x0 = ccx - sx / 2, x1 = ccx + sx / 2, z0 = ccz - sz / 2, z1 = ccz + sz / 2;
    const F = this._facadeGB[p.style], R = this._roofGB, top = SLAB + p.h;
    F.box(x0, SLAB, z0, x1, top, z1, rgb(p.color), { mode: 'facade', uoff: 0.1, top: false });
    R.box(x0 - 0.2, top, z0 - 0.2, x1 + 0.2, top + 0.5, z1 + 0.2, rgb(0x5a5f64), { mode: 'world' });
    this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY: top, type: 'building', poi: p.type });
    // door position on sidewalk
    const door = { x: cx + dx * (CITY.blockSize / 2 - 1.5), z: cz + dz * (CITY.blockSize / 2 - 1.5) };
    this.pois.push({ type: p.type, name: p.name, x: door.x, z: door.z });
    // sign on facade
    const sw = Math.min(p.w * 0.7, 20), sh = 4.2;
    const mat = new THREE.MeshStandardMaterial({
      map: TX.makeSign(...p.sign), emissiveMap: null, emissive: 0xffffff, roughness: 0.6,
    });
    mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.55;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    const fx = ccx + dx * (p.d / 2 + 0.08), fz = ccz + dz * (p.d / 2 + 0.08);
    sign.position.set(fx, Math.min(p.h - 3, 9) , fz);
    sign.rotation.y = Math.atan2(dx, dz);
    sign.castShadow = false;
    this.group.add(sign);
    (this._signs = this._signs || []).push(sign);
    // beacon column
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: p.beam, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(ccx, top + 30, ccz);
    this.group.add(beam);
    this._beams = this._beams || []; this._beams.push(beam);
    this._terrainGB.flat(b.minX + SW, b.minZ + SW, b.maxX - SW, b.maxZ - SW, SLAB + 0.02, tint(0x5a9a46, this._rnd, 0.05), 0.1);
    // forecourt trees
    this._lotsForTrees.push([b.minX + SW, b.minZ + SW, b.maxX - SW, b.maxZ - SW, [x0 - 3, z0 - 3, x1 + 3, z1 + 3], true]);
  }

  // ---------------------------------------------------------------- props (lamps, trees, palms)
  _buildProps() {
    const rnd = this._rnd;
    this._treeSpots = this._treeSpots || []; this._palmSpots = this._palmSpots || [];
    // yard trees
    for (const [lx0, lz0, lx1, lz1, avoid, poiLot] of this._lotsForTrees) {
      const n = avoid ? (poiLot ? 5 : 1 + ((rnd() * 3) | 0)) : 6;
      for (let t = 0; t < n; t++) for (let tries = 0; tries < 12; tries++) {
        const x = lx0 + 1.5 + rnd() * (lx1 - lx0 - 3), z = lz0 + 1.5 + rnd() * (lz1 - lz0 - 3);
        if (avoid && x > avoid[0] && x < avoid[2] && z > avoid[1] && z < avoid[3]) continue;
        (rnd() < 0.25 ? this._palmSpots : this._treeSpots).push([x, z]); break;
      }
    }
    // beach palms
    for (let n = 0; n < 90; n++) {
      const east = rnd() < 0.5, along = (rnd() * 2 - 1) * (H + 40), out = H + 16 + rnd() * 30;
      const x = east ? out : along, z = east ? along : out;
      if (Math.abs(x) > H + 25 || Math.abs(z) > H + 25) continue; // the beach ends at the sea (see coast.js)
      if (this._beachBlocked(x, z)) continue;
      this._palmSpots.push([x, z]);
    }
    // city-edge trees
    for (let n = 0; n < 60; n++) {
      const side = (rnd() * 4) | 0, along = (rnd() * 2 - 1) * (H + 10), out = H + 5 + rnd() * 25;
      const x = side < 2 ? (side ? out : -out) : along, z = side < 2 ? along : (side === 2 ? out : -out);
      if (z > H + 14 || x > H + 14 || out > H + 22) continue;
      this._treeSpots.push([x, z]);
    }
    const mk = (geo, spots, scaleMin, scaleMax, colliderR) => {
      if (!spots.length) return;
      const m = new THREE.InstancedMesh(geo, this.mat.foliage, spots.length);
      const dummy = new THREE.Object3D(), c = new THREE.Color();
      spots.forEach(([x, z], k) => {
        const s = scaleMin + rnd() * (scaleMax - scaleMin);
        dummy.position.set(x, SLAB * (Math.abs(x) < H && Math.abs(z) < H ? 1 : 0), z);
        dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.set(s, s * (0.9 + rnd() * 0.3), s);
        dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
        { const k2 = 1.5 + rnd() * 0.7; c.setRGB(k2 * (0.9 + rnd() * 0.2), k2, k2 * (0.8 + rnd() * 0.2)); m.setColorAt(k, c); }
        this.colliders.push({ minX: x - colliderR, maxX: x + colliderR, minZ: z - colliderR, maxZ: z + colliderR, maxY: 6, type: 'tree' });
      });
      m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
      this.group.add(m);
    };
    mk(treeGeo(), this._treeSpots, 0.85, 1.35, 0.4);
    mk(palmGeo(), this._palmSpots, 0.9, 1.3, 0.3);

    // street lamps along every block edge
    const lamps = [];
    for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
      const b = blockBounds(i, j);
      for (const t of [14, 46]) {
        lamps.push([b.minX + t, b.minZ + 0.8, 0, -1]); lamps.push([b.minX + t, b.maxZ - 0.8, 0, 1]);
        lamps.push([b.minX + 0.8, b.minZ + t, -1, 0]); lamps.push([b.maxX - 0.8, b.minZ + t, 1, 0]);
      }
    }
    const n = lamps.length;
    const poles = new THREE.InstancedMesh(lampPoleGeo(), this.mat.lamp, n);
    const heads = new THREE.InstancedMesh(lampHeadGeo(), this.mat.lampHead, n);
    const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), this.mat.glow, n);
    const d = new THREE.Object3D();
    lamps.forEach(([x, z, dx, dz], k) => {
      // small collider per pole (low, so the camera and the police line-of-sight ignore it)
      this.colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2, maxY: 1.9, type: 'lamp' });
      d.position.set(x, SLAB, z); d.rotation.set(0, Math.atan2(-dz, dx), 0); d.scale.set(1, 1, 1); d.updateMatrix();
      poles.setMatrixAt(k, d.matrix); heads.setMatrixAt(k, d.matrix);
      d.position.set(x + dx * 1.3, SLAB + 0.05, z + dz * 1.3); d.rotation.set(0, 0, 0); d.updateMatrix();
      glows.setMatrixAt(k, d.matrix);
    });
    poles.castShadow = true; poles.frustumCulled = false; heads.frustumCulled = false; glows.frustumCulled = false;
    glows.renderOrder = 5;
    this.group.add(poles, heads, glows);
    this._glows = glows;
  }

  // traffic signals, shopfronts + neon, street furniture (T3)
  _buildDetails() {
    this.signals = new Signals(this.game, this.group);
    this.shops = new Shops(this.group, this._shopSpecs);
    this._furnitureCount = buildFurniture(this.group);
  }

  // Traffic light contract: 'green' | 'yellow' | 'red' | null (no signal within 25 m). axis 'ns' = along Z, 'ew' = along X.
  signalAt(x, z, axis) { return this.signals.signalAt(x, z, axis); }

  // True where a beach palm would stand on the pier, boardwalk, quay or a landmark (south coast).
  _beachBlocked(x, z) {
    if (z <= H + 7) return false;
    return Math.abs(x) < 8 || (z > H + 19 && x < 156) || Math.abs(x + 48) < 14 || Math.abs(x - 205) < 14;
  }

  // Harbour (pier, boardwalk, quay, cranes, ship, boats) and the landmarks that need the finished geometry.
  _buildCoastDetails() {
    const before = this.group.children.length;
    this.harbor = new Harbor(this.group, this.colliders);
    this.group.children.slice(before).forEach((m) => { m.userData.t3 = 'harbor'; }); // tag for draw-call accounting in tests
  }

  // Invisible walls just inside the water line. The south wall has gaps for the pier channel and the quay.
  _buildBoundaries() {
    const e = COAST.wall, t = 30, big = e + t + 50;
    const add = (minX, maxX, minZ, maxZ) => this.colliders.push({ minX, maxX, minZ, maxZ, maxY: 100, type: 'boundary', invisible: true });
    add(-big, big, -e - t, -e); add(-e - t, -e, -big, big); add(e, e + t, -big, big);
    const s = 4;                      // thickness of the south wall pieces (walkers and cars are slow enough)
    add(-big, -4.6, e, e + s);         // west of the pier channel
    add(4.6, 36, e, e + s);            // between the pier and the quay
    add(152, big, e, e + s);           // east of the quay
  }

  _buildSea() {
    this.sea = new Sea(this._waterNormal);
    this.group.add(this.sea.mesh);
  }

  _buildSky() {
    this.dome = makeSkyDome();
    this.group.add(this.dome);
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x3a3a30, 1);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera, R = 85;
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = 500;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.06;
    this.group.add(this.hemi, this.sun, this.sun.target);
    this.game.scene.fog = new THREE.Fog(0xaad0f0, 140, 780);
    this._top = new THREE.Color(); this._hor = new THREE.Color();
    this._moonDir = new THREE.Vector3();
    this._c = { sunLo: new THREE.Color(0xff9a55), sunHi: new THREE.Color(0xfff1dc), white: new THREE.Color(0xffffff), nightSky: new THREE.Color(0x6a80c8), gDay: new THREE.Color(0x3a3a30), gNight: new THREE.Color(0x2a3044), lampOff: new THREE.Color(0x777066), lampOn: new THREE.Color(0xfff0c8), moon: new THREE.Color(0xa4bcff) };
    this._sunDir = new THREE.Vector3();
  }

  // ---------------------------------------------------------------- finalize merged meshes
  _finalizeMeshes() {
    const add = (gb, mat, cast, recv) => {
      if (gb.empty) return null;
      const m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast; m.receiveShadow = recv; m.frustumCulled = false;
      this.group.add(m); return m;
    };
    // roads: plain road texture, no vertex colors
    const roadGB = new GB(); // rebuild road strips here to keep them out of the vertex-color path
    const RW = CITY.roadWidth, hw = RW / 2, col = [1, 1, 1];
    for (const r of ROAD_LINES) {
      roadGB.quad([r - hw, 0.03, -H], [r + hw, 0.03, -H], [r + hw, 0.03, H], [r - hw, 0.03, H],
        [[0, -H / RW], [1, -H / RW], [1, H / RW], [0, H / RW]], col, [r, -1, 0]);
      roadGB.quad([-H, 0.03, r - hw], [-H, 0.03, r + hw], [H, 0.03, r + hw], [H, 0.03, r - hw],
        [[0, -H / RW], [1, -H / RW], [1, H / RW], [0, H / RW]], col, [0, -1, r]);
    }
    add(roadGB, this.mat.road, false, true);
    add(this._asphGB, this.mat.asphalt, false, true);
    add(this._marksGB, this.mat.marks, false, true);
    add(this._terrainGB, this.mat.terrain, false, true);
    add(this._walkGB, this.mat.walk, false, true);
    this._facadeGB.forEach((gb, s) => add(gb, this.mat.facade[s], true, true));
    // roof mesh = parapets / clutter / tiers + instanced-style roof details (AC units, tanks, antennas), one draw call
    if (!this._roofGB.empty) {
      const extra = buildRoofDetails(this._roofRects), base = this._roofGB.build();
      const m = new THREE.Mesh(extra ? mergeGeometries([base, extra]) : base, this.mat.roof);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m);
    }
  }

  // ---------------------------------------------------------------- lighting / time
  _applyTime() {
    const t = this.timeOfDay;
    const a = ((t - 6) / 12) * Math.PI;
    const sd = this._sunDir.set(Math.cos(a), Math.sin(a), 0.38).normalize();
    const elev = sd.y;
    const night = this.nightFactor = smoothstep(0.1, -0.12, elev);
    const dayF = smoothstep(-0.08, 0.3, elev);
    skyColors(t, this._top, this._hor);
    const u = this.dome.material.uniforms;
    u.uTop.value.copy(this._top); u.uHor.value.copy(this._hor); u.uSun.value.copy(sd); u.uNight.value = night; u.uTime.value = this.game.time || 0;
    const fog = this.game.scene.fog;
    fog.color.copy(this._hor).lerp(this._top, 0.12).multiplyScalar(0.92);
    // light source: sun by day, moon by night (swap happens while intensity ~0)
    const above = elev > 0;
    const dir = above ? sd : this._moonDir.copy(sd).negate();
    const target = this.sun.target.position;
    const p = this.game.player?.position;
    const tx = p ? p.x : this._spawn?.x ?? 0, tz = p ? p.z : this._spawn?.z ?? 0;
    const texel = 170 / 2048;
    target.set(Math.round(tx / texel) * texel, 0, Math.round(tz / texel) * texel);
    this.sun.position.copy(target).addScaledVector(dir, 220);
    if (above) {
      this.sun.intensity = smoothstep(0, 0.22, elev) * 3.2;
      this.sun.color.copy(this._c.sunLo).lerp(this._c.sunHi, smoothstep(0.05, 0.5, elev));
    } else {
      this.sun.intensity = smoothstep(0, 0.22, -elev) * 1.15; // moonlight
      this.sun.color.copy(this._c.moon);
    }
    this.hemi.intensity = lerp(1.1, 1.7, dayF) + night * 1.2;
    this.hemi.color.copy(this._top).lerp(this._c.white, 0.45 * (1 - night)).lerp(this._c.nightSky, night * 0.7);
    this.hemi.groundColor.copy(this._c.gDay).lerp(this._c.gNight, night);
    this.game.renderer.toneMappingExposure = 1.05 + night * 0.3;
    // night emissive
    const e = night * 0.62 + (1 - dayF) * 0.08;
    for (const m of this.mat.facade) m.emissiveIntensity = e;
    this.mat.lampHead.color.copy(this._c.lampOff).lerp(this._c.lampOn, night);
    this.mat.glow.opacity = night * 1.0; this._glows.visible = night > 0.02;
    for (const s of this._signs || []) s.material.emissiveIntensity = 0.35 + night * 0.9;
    for (const bm of this._beams || []) bm.material.opacity = 0.14 + night * 0.18;
    this.shops?.update(night);
    this.sea.setEnv({ top: this._top, hor: this._hor, sun: sd, night, light: Math.max(dayF, night * 0.18) });
  }

  update(dt) {
    this.timeOfDay = (this.timeOfDay + dt / 60) % 24;
    this.sea.update(dt, this.game.camera?.position);
    this._applyTime();
    this.harbor.update(dt, this.nightFactor);
    this.landmarks.update(dt, this.nightFactor);
    this.signals.update(dt, this.nightFactor);
  }

  // ---------------------------------------------------------------- queries
  // ---- walking limits and ground height (coast, pier, quay)
  // playLimit: max |x| / |z| for walking on land (beach ends here, a bit before the water line).
  get playLimit() { return COAST.shore - 0.5; }
  // isWalkable(x, z): true on land inside playLimit and on the pier / T-head / quay (they reach into the sea).
  isWalkable(x, z) {
    return Math.max(Math.abs(x), Math.abs(z)) <= this.playLimit || !!this.harbor?.deckHeightAt(x, z, true);
  }
  // groundAt(x, z): ground height in metres. Land and beach: slope profile (0 on flat ground, down to about -0.5 at the
  // play limit). Pier deck 0.06, quay deck 0.03. Anywhere else past the play limit (water): null (cannot stand there).
  groundAt(x, z) {
    const deck = this.harbor?.deckHeightAt(x, z);
    if (deck !== null && deck !== undefined) return deck;
    const d = Math.max(Math.abs(x), Math.abs(z));
    return d <= this.playLimit ? groundHeight(d) : null;
  }

  getSpawnPoint() { return { x: 8.5, z: 20 }; }

  districtAt(x, z) {
    if (Math.max(Math.abs(x), Math.abs(z)) > H + 8) return 'Vice Bay Shore';
    return DISTRICT_NAMES[districtKey(x, z)];
  }

  randomSidewalkPoint(nearX, nearZ, radius = 60) {
    const rnd = Math.random, hasNear = nearX !== undefined && nearX !== null;
    for (let tries = 0; tries < 60; tries++) {
      let i, j;
      if (hasNear) {
        const bx = Math.round((nearX - ROAD_LINES[0] - CITY.roadWidth / 2 - CITY.blockSize / 2) / CITY.cell + (rnd() - 0.5) * (radius / CITY.cell * 2 + 1));
        const bz = Math.round((nearZ - ROAD_LINES[0] - CITY.roadWidth / 2 - CITY.blockSize / 2) / CITY.cell + (rnd() - 0.5) * (radius / CITY.cell * 2 + 1));
        i = Math.min(CITY.blocks - 1, Math.max(0, bx)); j = Math.min(CITY.blocks - 1, Math.max(0, bz));
      } else { i = (rnd() * CITY.blocks) | 0; j = (rnd() * CITY.blocks) | 0; }
      const b = blockBounds(i, j), side = (rnd() * 4) | 0, off = 0.7 + rnd() * (SW - 1.4), t = rnd() * CITY.blockSize;
      const x = side === 0 ? b.minX + t : side === 1 ? b.minX + t : side === 2 ? b.minX + off : b.maxX - off;
      const z = side === 0 ? b.minZ + off : side === 1 ? b.maxZ - off : b.minZ + t;
      if (hasNear && Math.hypot(x - nearX, z - nearZ) > radius) continue;
      return { x, z };
    }
    return this.getSpawnPoint();
  }

  randomRoadPoint(nearX, nearZ, radius = 100) {
    const rnd = Math.random, hasNear = nearX !== undefined && nearX !== null;
    const hw = CITY.roadWidth / 2 + 3;
    for (let tries = 0; tries < 80; tries++) {
      const alongZ = rnd() < 0.5; // road runs along z (N-S) at x=r
      const r = ROAD_LINES[(rnd() * ROAD_LINES.length) | 0];
      let s = (rnd() * 2 - 1) * (H - 10);
      if (hasNear) {
        const cr = alongZ ? nearX : nearZ, cs = alongZ ? nearZ : nearX;
        if (Math.abs(r - cr) > radius) continue;
        const span = Math.sqrt(Math.max(0, radius * radius - (r - cr) ** 2));
        s = cs + (rnd() * 2 - 1) * span;
        if (Math.abs(s) > H - 8) continue;
      }
      if (ROAD_LINES.some((q) => Math.abs(s - q) < hw)) continue; // keep clear of intersections
      const dirPos = rnd() < 0.5; // travel toward +axis
      let x, z, heading;
      if (alongZ) { x = r + (dirPos ? -LANE : LANE); z = s; heading = dirPos ? 0 : Math.PI; }
      else { z = r + (dirPos ? LANE : -LANE); x = s; heading = dirPos ? Math.PI / 2 : -Math.PI / 2; }
      return { x, z, heading };
    }
    return { x: ROAD_LINES[4] - LANE, z: -40, heading: 0 };
  }

  // ---------------------------------------------------------------- collider grid helper (optional, extra)
  _buildCollGrid() {
    this._cs = 40; this._grid = new Map();
    for (const b of this.colliders) {
      if (b.invisible) continue;
      for (let gx = Math.floor(b.minX / 40); gx <= Math.floor(b.maxX / 40); gx++)
        for (let gz = Math.floor(b.minZ / 40); gz <= Math.floor(b.maxZ / 40); gz++) {
          const k = gx + ',' + gz; let a = this._grid.get(k); if (!a) this._grid.set(k, a = []); a.push(b);
        }
    }
  }
  // Colliders overlapping the square [x-r,x+r] x [z-r,z+r] (boundary walls always included).
  collidersNear(x, z, r = 4) {
    const out = new Set();
    for (let gx = Math.floor((x - r) / 40); gx <= Math.floor((x + r) / 40); gx++)
      for (let gz = Math.floor((z - r) / 40); gz <= Math.floor((z + r) / 40); gz++) {
        const a = this._grid.get(gx + ',' + gz); if (a) for (const b of a) out.add(b);
      }
    if (Math.max(Math.abs(x), Math.abs(z)) > H + 30) for (const b of this.colliders) if (b.invisible) out.add(b);
    return [...out];
  }
}
