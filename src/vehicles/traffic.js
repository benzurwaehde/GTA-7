// Lane maths + traffic AI. Road grid comes from core/config.js (ROAD_LINES, right-hand traffic).
// Lane state: axis 0 = driving along Z on the N-S road at x = ROAD_LINES[ri]; axis 1 = along X on the E-W road at z = ROAD_LINES[ri].
import { CITY, ROAD_LINES } from '../core/config.js';

const N = ROAD_LINES.length;
export const LANE = CITY.roadWidth / 4;          // lane center offset from road center
const CURB = CITY.roadWidth / 2 - 1.3;           // parked-car lateral offset
const EDGE = CITY.half - 12;
const rnd = (a, b) => a + Math.random() * (b - a);
const _ctl = { throttle: 0, steer: 0, brake: 0, handbrake: false };   // reused control object (no allocation per car per frame)
const YIELD_RANGE = 55, YIELD_HOLD = 2.5;

export const laneOffset = (axis, dir) => (axis === 0 ? -dir * LANE : dir * LANE);
export const headingOf = (axis, dir) => (axis === 0 ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
export const lanePoint = (axis, dir, ri, along) => {
  const lat = ROAD_LINES[ri] + laneOffset(axis, dir);
  return axis === 0 ? { x: lat, z: along } : { x: along, z: lat };
};
export function nextIndex(along, dir) {
  if (dir > 0) { for (let k = 0; k < N; k++) if (ROAD_LINES[k] > along + 0.5) return k; return -1; }
  for (let k = N - 1; k >= 0; k--) if (ROAD_LINES[k] < along - 0.5) return k;
  return -1;
}
function nearestIdx(v) {
  let b = 0;
  for (let k = 1; k < N; k++) if (Math.abs(ROAD_LINES[k] - v) < Math.abs(ROAD_LINES[b] - v)) b = k;
  return b;
}
export function laneState(axis, dir, ri, along) {
  let next = nextIndex(along, dir);
  if (next < 0) { dir = -dir; next = nextIndex(along, dir); }
  return { axis, dir, ri, next };
}
// Derive lane state from a pose (used for points given by the world / hijacked cars).
export function laneFromPose(x, z, h) {
  const sx = Math.sin(h), cz = Math.cos(h);
  const axis = Math.abs(sx) > Math.abs(cz) ? 1 : 0;
  const dir = (axis === 1 ? sx : cz) >= 0 ? 1 : -1;
  const lat = axis === 0 ? x : z, along = axis === 0 ? z : x;
  const ri = nearestIdx(lat - laneOffset(axis, dir));
  return { st: laneState(axis, dir, ri, along), along };
}

// --- spawn point pickers ---
export function pickLanePoint(game, px, pz, minD, maxD) {
  for (let t = 0; t < 12; t++) {
    let axis, dir, ri, along;
    const w = t < 3 ? game.world?.randomRoadPoint : null;
    let p = null;
    if (typeof w === 'function') { try { p = w.call(game.world, px, pz, maxD); } catch (e) { p = null; } }
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.heading)) {
      const r = laneFromPose(p.x, p.z, p.heading);
      ({ axis, dir, ri } = r.st); along = r.along;
    } else {
      axis = Math.random() < 0.5 ? 0 : 1; dir = Math.random() < 0.5 ? 1 : -1; ri = (Math.random() * N) | 0;
      const c = axis === 0 ? pz : px;
      along = Math.max(-EDGE, Math.min(EDGE, c + rnd(-maxD, maxD)));
    }
    const st = laneState(axis, dir, ri, along);
    const pt = lanePoint(st.axis, st.dir, st.ri, along);
    const d = Math.hypot(pt.x - px, pt.z - pz);
    if (d < minD || d > maxD) continue;
    return { ...pt, heading: headingOf(st.axis, st.dir), st, along };
  }
  return null;
}

export function pickCurbPoint(game, px, pz, minD, maxD) {
  for (let t = 0; t < 20; t++) {
    const axis = Math.random() < 0.5 ? 0 : 1, ri = (Math.random() * N) | 0, side = Math.random() < 0.5 ? 1 : -1;
    const seg = (Math.random() * (N - 1)) | 0;
    const along = rnd(ROAD_LINES[seg] + 12, ROAD_LINES[seg + 1] - 12);
    const lat = ROAD_LINES[ri] + side * CURB;
    const x = axis === 0 ? lat : along, z = axis === 0 ? along : lat;
    const d = Math.hypot(x - px, z - pz);
    if (d < minD || d > maxD) continue;
    const dir = axis === 0 ? -side : side;
    return { x, z, heading: headingOf(axis, dir) };
  }
  return null;
}

// --- AI ---
export function initAI(v) {
  const r = laneFromPose(v.position.x, v.position.z, v.heading);
  v.ai = { ...r.st, wb: v.spec.wb, action: null, stuck: 0, blockT: 0, honkCd: Math.random() * 3, factor: rnd(0.85, 1.15), remove: false, reverseT: 0, yieldT: 0, ys: 0 };
}

function chooseAction(ai) {
  const c = ROAD_LINES[ai.next];
  const opts = [];
  const mk = (type, axis, dir, w) => {
    const ni = axis === ai.axis ? ai.next + dir : ai.ri + dir;
    if (ni < 0 || ni >= N) return;
    const off = laneOffset(axis, dir);
    const lead = type === 'right' ? ai.wb * 1.6 : type === 'left' ? ai.wb * 2.4 : 0;
    const swAlong = (type === 'straight' ? c : c + off) - ai.dir * lead;
    opts.push({ type, axis, dir, w, switchAlong: swAlong });
  };
  mk('straight', ai.axis, ai.dir, 0.55);
  // right = (-fz, fx); axis0: f=(0,d) right dir along x = -d; axis1: f=(d,0) right along z = +d
  const rd = ai.axis === 0 ? -ai.dir : ai.dir;
  mk('right', 1 - ai.axis, rd, 0.22);
  mk('left', 1 - ai.axis, -rd, 0.23);
  if (!opts.length) return { type: 'uturn', axis: ai.axis, dir: -ai.dir, switchAlong: c };
  let sum = 0; for (const o of opts) sum += o.w;
  let r = Math.random() * sum;
  for (const o of opts) { r -= o.w; if (r <= 0) return o; }
  return opts[0];
}

const angDiff = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function driveNPC(v, dt, game, list, playerPos) {
  const ai = v.ai, s = v.spec, pos = v.position;
  if (!ai) { initAI(v); return; }
  const along = ai.axis === 0 ? pos.z : pos.x;

  // intersection planning
  const toNext = (ROAD_LINES[ai.next] - along) * ai.dir;
  if (!ai.action && toNext < 32) ai.action = chooseAction(ai);
  let slow = false;
  if (ai.action) {
    const a = ai.action;
    const dSw = (a.switchAlong - along) * ai.dir;
    if (a.type !== 'straight' && dSw < 28) slow = true;
    if (dSw <= 0) {
      if (a.type === 'straight') ai.next += ai.dir;
      else if (a.type === 'uturn') { ai.dir = -ai.dir; const nx = nextIndex(along, ai.dir); ai.next = nx < 0 ? ai.next : nx; }
      else {
        const oldRi = ai.ri;
        ai.ri = ai.next; ai.axis = a.axis; ai.dir = a.dir; ai.next = oldRi + a.dir;
      }
      ai.action = null;
    }
  }
  // out-of-range safety (e.g. after collisions)
  if (ai.next < 0 || ai.next >= N) { const nx = nextIndex(ai.axis === 0 ? pos.z : pos.x, ai.dir); if (nx < 0) ai.dir = -ai.dir; ai.next = Math.max(0, nextIndex(ai.axis === 0 ? pos.z : pos.x, ai.dir)); ai.action = null; }

  // pure pursuit steering
  const al = ai.axis === 0 ? pos.z : pos.x;
  const la = Math.max(5, Math.min(13, 4 + Math.abs(v.speed) * 0.5));
  // Emergency vehicles: while a police car with siren comes up from behind in our direction, ease towards the kerb
  // and stop (but never stop inside a junction: roll through first). Holds a moment after the siren has passed.
  let yielding = false;
  const sirens = game.vehicles?.sirens;
  if (sirens && sirens.length) {
    const hx = Math.sin(v.heading), hz = Math.cos(v.heading);
    for (let i = 0; i < sirens.length; i++) {
      const o = sirens[i];
      if (o === v) continue;
      const dx = pos.x - o.position.x, dz = pos.z - o.position.z;
      if (dx * dx + dz * dz > YIELD_RANGE * YIELD_RANGE) continue;
      const ofx = Math.sin(o.heading), ofz = Math.cos(o.heading);
      const ahead = dx * ofx + dz * ofz;                          // we are this far in front of the siren car
      if (ahead < 1 || Math.abs(dx * -ofz + dz * ofx) > 9) continue;
      if (ofx * hx + ofz * hz < 0.4) continue;                    // same direction of travel only
      ai.yieldT = YIELD_HOLD; break;
    }
  }
  if (ai.yieldT > 0) { ai.yieldT -= dt; yielding = true; }
  ai.ys += ((yielding ? 1 : 0) - ai.ys) * Math.min(1, dt * 1.5);
  const tl = ROAD_LINES[ai.ri] + laneOffset(ai.axis, ai.dir) * (1 + 0.16 * ai.ys);   // a little further right
  const tAlong = al + ai.dir * la;
  const tx = ai.axis === 0 ? tl : tAlong, tz = ai.axis === 0 ? tAlong : tl;
  const want = Math.atan2(tx - pos.x, tz - pos.z);
  const err = angDiff(want - v.heading);
  let steer = Math.max(-1, Math.min(1, -err * 1.8));

  // target speed
  let target = s.top * s.cruise * ai.factor;
  if (ai.fleeT > 0) { ai.fleeT -= dt; target *= 1.75; }
  if (ai.hitHonkCd > 0) ai.hitHonkCd -= dt;
  if (slow) target = Math.min(target, 7);
  if (Math.abs(err) > 0.6) target = Math.min(target, 6);
  if (Math.abs(err) > 1.4) target = Math.min(target, 3.5);

  if (yielding) {
    const pi = ai.next - ai.dir, behind = pi >= 0 && pi < N ? Math.abs(al - ROAD_LINES[pi]) : 99;
    const inJunction = toNext < 22 || behind < CITY.roadWidth / 2 + s.L / 2 + 3;
    target = Math.min(target, inJunction ? 9 : 0);
  }

  // traffic light: stop at the stop line on red/yellow; cars already past the line keep going.
  // game.world.signalAt may be missing (then old behaviour), and fleeing cars ignore lights.
  if (!(ai.fleeT > 0) && toNext < 70 && game.world?.signalAt) {
    const ix = ai.axis === 0 ? ROAD_LINES[ai.ri] : ROAD_LINES[ai.next], iz = ai.axis === 0 ? ROAD_LINES[ai.next] : ROAD_LINES[ai.ri];
    const sig = game.world.signalAt(ix, iz, ai.axis === 0 ? 'ns' : 'ew');
    if (sig === 'red' || sig === 'yellow') {
      const stopD = toNext - CITY.roadWidth / 2 - 1.2 - s.L / 2;      // distance from our nose to the stop line
      const brakeD = v.speed * v.speed / (2 * 5.5);
      if (stopD > -0.8 && !(sig === 'yellow' && stopD < brakeD)) {    // yellow: only stop if we still can
        const stop = Math.max(0, stopD - 0.3);
        target = Math.min(target, Math.sqrt(2 * 3.2 * stop) + (stop < 0.6 ? 0 : 0.3));
        if (stopD < 2.5) target = Math.min(target, 0);
      }
    }
  }

  // intersection occupied by crossing traffic -> wait before the box
  if (toNext > 4 && toNext < 15) {
    const ix = ai.axis === 0 ? ROAD_LINES[ai.ri] : ROAD_LINES[ai.next], iz = ai.axis === 0 ? ROAD_LINES[ai.next] : ROAD_LINES[ai.ri];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === v || Math.abs(o.speed) < 0.3 && o.driver === null) continue;
      if (Math.abs(o.position.x - ix) < 8 && Math.abs(o.position.z - iz) < 8) {
        const same = Math.abs(Math.sin(o.heading) * Math.sin(v.heading) + Math.cos(o.heading) * Math.cos(v.heading)) > 0.7;
        if (!same) { target = Math.min(target, Math.max(0, (toNext - 4) * 0.8)); break; }
      }
    }
  }

  // obstacles ahead (cars + peds)
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading), rx = -fz, rz = fx;
  const dl = 6 + Math.abs(v.speed) * 1.5;
  let blocked = false, blockedByCar = null, pedAhead = false;
  const half = s.L / 2, hw = s.W / 2;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o === v) continue;
    const dx = o.position.x - pos.x, dz = o.position.z - pos.z;
    const fwd = dx * fx + dz * fz;
    if (fwd < 0.5 || fwd > dl + o.radius) continue;
    const l = Math.abs(dx * rx + dz * rz);
    if (l > hw + o.spec.W * 0.28 + 0.2 + (Math.abs(err) > 0.3 ? 0.4 : 0)) continue;
    const gap = fwd - half - o.spec.L * 0.5;
    let t = (o.speed > 0 && o.driver !== null ? o.speed * 0.9 : 0) + (gap - 4) * 0.9;
    if (gap < 3.5) t = Math.min(t, 0);
    target = Math.min(target, Math.max(0, t));
    blocked = true; blockedByCar = o;
  }
  const peds = game.peds?.list;
  if (peds) {
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i];
      if (!p.position || p.state === 'dead') continue;
      const dx = p.position.x - pos.x, dz = p.position.z - pos.z;
      const fwd = dx * fx + dz * fz;
      if (fwd < 0.5 || fwd > dl) continue;
      if (Math.abs(dx * rx + dz * rz) > hw + (p.radius || 0.4) + 0.6) continue;
      const gap = fwd - half;
      target = Math.min(target, Math.max(0, (gap - 3) * 1.1));
      blocked = true; pedAhead = true;
    }
  }

  // throttle / brake
  let throttle = 0, brake = 0;
  const e = target - v.speed;
  if (e > 0.3) throttle = Math.min(1, e * 0.5);
  else if (e < -0.5) brake = Math.min(1, -e * 0.25);
  if (target < 0.2 && v.speed > 0.2) brake = 1;

  // stuck handling
  if (target > 3 && Math.abs(v.speed) < 0.6) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt * 2);
  if (ai.reverseT > 0) { ai.reverseT -= dt; throttle = -0.8; brake = 0; steer = -steer; }
  else if (ai.stuck > 4) { ai.reverseT = 1.3; ai.stuck = 2; }
  ai.idle = Math.abs(v.speed) < 0.5 ? (ai.idle || 0) + dt : 0;   // manager despawns long-idle traffic

  // honking
  ai.honkCd -= dt;
  if (blocked && blockedByCar && Math.abs(blockedByCar.speed) < 0.5 && Math.abs(v.speed) < 0.5) ai.blockT += dt; else ai.blockT = 0;
  if (ai.honkCd <= 0 && (ai.blockT > 2.5 || (pedAhead && v.speed > 2 && Math.random() < 0.3) || Math.random() < 0.0015)) {
    ai.honkCd = 4 + Math.random() * 5;
    const d = playerPos ? Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z) : 0;
    if (d < 70) game.audio?.play?.('horn', { x: pos.x, z: pos.z });
  }
  _ctl.throttle = throttle; _ctl.steer = steer; _ctl.brake = brake; _ctl.handbrake = false;
  v.setControls(_ctl);
}
