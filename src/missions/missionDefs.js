import { CITY, ROAD_LINES, blockBounds } from '../core/config.js';

// ---- helpers ---------------------------------------------------------------
const d2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const pp = g => g.player?.position;
const pick = a => a[Math.floor(Math.random() * a.length)];
const poiNearest = (g, type, x, z) => {
  const l = (g.world?.pois || []).filter(p => p.type === type);
  l.sort((a, b) => d2(a.x, a.z, x, z) - d2(b.x, b.z, x, z));
  return l[0] || null;
};

// "get into a car" stage shared by several missions
function carStage(text, { type, spawnTaxi } = {}) {
  return {
    text,
    enter(m) {
      const g = m.game;
      if (spawnTaxi && !g.vehicles?.list?.some(v => v.type === 'taxi' && !v.driver && !v.destroyed) && g.vehicles?.spawn && g.world?.randomRoadPoint) {
        const p = pp(g), r = g.world.randomRoadPoint(p.x, p.z, 70);
        if (r) g.vehicles.spawn('taxi', r.x, r.z, r.heading ?? 0);
      }
    },
    marker(m) {
      const g = m.game, p = pp(g);
      m.data._t = (m.data._t || 0);
      if (!m.data._tgt || m.data._tgt.destroyed || m.data._tgt.driver) {
        m.data._tgt = g.vehicles?.getNearest?.(p.x, p.z, 400, v => !v.destroyed && !v.driver && !v.isPolice && (!type || v.type === type)) || null;
      }
      const v = m.data._tgt;
      return v ? { x: v.position.x, z: v.position.z, label: type === 'taxi' ? 'Taxi' : 'Car' } : null;
    },
    update(m) {
      const v = m.game.player?.vehicle;
      if (v && (!type || v.type === type)) { m.data.car = v; return 'next'; }
    },
  };
}

// guards that apply while a car is the mission's centerpiece
function carAlive(m, msg = 'The car was destroyed') {
  const c = m.data.car;
  if (c && (c.destroyed || c.health <= 0)) m.fail(msg);
}

// pick a chain of road intersections
function buildRoute(sx, sz, n) {
  const pts = []; let cx = sx, cz = sz;
  for (let k = 0; k < n; k++) {
    let best = null;
    for (let tries = 0; tries < 40; tries++) {
      const x = pick(ROAD_LINES), z = pick(ROAD_LINES), d = d2(x, z, cx, cz);
      if (d > 90 && d < 280 && (!pts.length || d2(x, z, pts[pts.length - 1].x, pts[pts.length - 1].z) > 1)) { best = { x, z }; break; }
    }
    if (!best) best = { x: pick(ROAD_LINES), z: pick(ROAD_LINES) };
    pts.push(best); cx = best.x; cz = best.z;
  }
  return pts;
}

// random sidewalk point at a distance of [dmin, dmax] from `from` (falls back to a plain offset)
function sidewalkAt(g, from, dmin, dmax) {
  for (let k = 0; k < 25; k++) {
    const c = g.world?.randomSidewalkPoint?.(from.x, from.z, dmax);
    if (c) { const d = d2(c.x, c.z, from.x, from.z); if (d >= dmin && d <= dmax) return { x: c.x, z: c.z }; }
  }
  const lim = CITY.half - 20, a = Math.random() * Math.PI * 2, d = (dmin + dmax) / 2;
  return { x: Math.max(-lim, Math.min(lim, from.x + Math.cos(a) * d)), z: Math.max(-lim, Math.min(lim, from.z + Math.sin(a) * d)) };
}

// fugitive for the chase: fast npc driver, exempt from auto-despawn while the mission runs
function spawnThief(g, x, z, h, speed) {
  const v = g.vehicles?.spawn?.('sports', x, z, h, { driver: 'npc', speed });
  if (v) { v.owned = true; if (v.ai) v.ai.factor = 1.8; }
  return v;
}

// ---- mission definitions (add more here) -----------------------------------
// start: world position of the start marker (sidewalk). stages: run in order; a stage returns 'next' from update to advance.
// m API: m.game, m.data, m.fail(reason), m.setTimer(sec), m.addTime(sec), m.progress, m.reward (mutable)
export const MISSIONS = [
  {
    id: 'hotwheels', name: 'Hot Wheels', color: 0xff2d95, letter: 'H', reward: 1500,
    intro: 'Boost a ride and drop it at the garage before time runs out. Do not wreck it!',
    start: () => ({ x: blockBounds(4, 3).minX + 1.5, z: blockBounds(4, 3).minZ + 30 }),
    stages: [
      carStage('Get into any car'),
      {
        text: 'Deliver the car to the garage',
        enter(m) {
          const g = m.game, p = pp(g);
          m.data.garage = poiNearest(g, 'garage', p.x, p.z) || { x: blockBounds(1, 1).minX + 1.5, z: blockBounds(1, 1).minZ + 30, name: 'Garage' };
          m.setTimer(d2(p.x, p.z, m.data.garage.x, m.data.garage.z) / 9 + 40);
          m.data.out = 0;
        },
        marker: m => ({ x: m.data.garage.x, z: m.data.garage.z, label: 'Garage' }),
        update(m, dt) {
          carAlive(m);
          const g = m.game, c = m.data.car, gr = m.data.garage;
          if (g.player.vehicle !== c) { m.data.out += dt; if (m.data.out > 10) m.fail('You left the car behind'); } else m.data.out = 0;
          if (d2(c.position.x, c.position.z, gr.x, gr.z) < 9) m.complete();
        },
      },
    ],
  },
  {
    id: 'rush', name: 'Checkpoint Rush', color: 0x19e3ff, letter: 'R', reward: 2500,
    intro: 'Street race! Hit all 8 checkpoints. Every checkpoint adds a little time.',
    start: () => ({ x: blockBounds(3, 4).minX + 30, z: blockBounds(3, 4).minZ + 1.5 }),
    stages: [
      carStage('Get into a car for the race'),
      {
        text: 'Race through the checkpoints',
        enter(m) {
          const p = pp(m.game);
          m.data.cps = buildRoute(p.x, p.z, 8); m.data.i = 0;
          let len = 0, cx = p.x, cz = p.z;
          for (const c of m.data.cps) { len += d2(cx, cz, c.x, c.z); cx = c.x; cz = c.z; }
          m.setTimer(len / 13 + 20);
          m.progress = 'Checkpoint 1/8';
        },
        marker: m => { const c = m.data.cps[m.data.i]; return { x: c.x, z: c.z, label: `CP ${m.data.i + 1}` }; },
        marker2: m => m.data.cps[m.data.i + 1] || null,
        update(m) {
          carAlive(m);
          const p = pp(m.game), c = m.data.cps[m.data.i];
          if (d2(p.x, p.z, c.x, c.z) < 11) {
            m.data.i++;
            m.game.audio?.play?.('pickup');
            if (m.data.i >= m.data.cps.length) return m.complete();
            m.addTime(8); m.progress = `Checkpoint ${m.data.i + 1}/${m.data.cps.length}`;
          }
        },
      },
    ],
  },
  {
    id: 'getaway', name: 'Clean Getaway', color: 0xffd24a, letter: 'C', reward: 3000,
    intro: 'You just robbed a store. 3 stars! Lose the cops and stay alive.',
    start: () => ({ x: blockBounds(5, 4).minX + 1.5, z: blockBounds(5, 4).minZ + 30 }),
    stages: [{
      text: 'Lose the cops',
      enter(m) {
        const g = m.game; m.data.t = 0;
        if (g.police?.setWanted) g.police.setWanted(3); else g.state.wanted = 3;
        g.events.emit('hud:message', { text: 'Wanted level 3! Break line of sight and hide.', duration: 4 });
      },
      marker(m) { const p = pp(m.game), s = poiNearest(m.game, 'safehouse', p.x, p.z); return s ? { x: s.x, z: s.z, label: 'Safehouse' } : null; },
      update(m, dt) {
        m.data.t += dt;
        const g = m.game;
        m.progress = g.state.wanted > 0 ? 'Wanted: ' + '★'.repeat(g.state.wanted) : 'Almost clear...';
        if (!g.police) { if (m.data.t > 20) { g.state.wanted = 0; m.complete(); } return; }
        if (m.data.t > 3 && g.state.wanted === 0) m.complete();
      },
    }],
  },
  {
    id: 'taxi', name: 'Taxi Driver', color: 0xffe14a, letter: 'T', reward: 2000,
    intro: 'Pick up 3 fares and get them to their destinations on time.',
    start: () => ({ x: blockBounds(2, 3).minX + 30, z: blockBounds(2, 3).maxZ - 1.5 }),
    stages: [
      carStage('Get into a taxi', { type: 'taxi', spawnTaxi: true }),
      {
        text: 'Pick up your passenger',
        enter(m) { m.data.fare = 0; m.data.picked = false; this.newPickup(m); },
        newPickup(m) {
          const g = m.game, p = pp(g);
          const s = g.world?.randomSidewalkPoint?.(p.x, p.z, 160) || { x: p.x + 60, z: p.z + 60 };
          m.data.spot = { x: s.x, z: s.z }; m.data.picked = false;
          m.objectiveText = 'Pick up your passenger'; m.progress = `Fare ${m.data.fare + 1}/3`;
          m.setTimer(null);
        },
        marker: m => ({ x: m.data.spot.x, z: m.data.spot.z, label: m.data.picked ? 'Drop-off' : 'Passenger' }),
        update(m) {
          carAlive(m, 'Your taxi was destroyed');
          const g = m.game, c = m.data.car;
          if (g.player.vehicle !== c) return;
          const s = m.data.spot;
          if (d2(c.position.x, c.position.z, s.x, s.z) < 8 && Math.abs(c.speed) < 5) {
            if (!m.data.picked) {
              m.data.picked = true; m.objectiveText = 'Take the passenger to the drop-off';
              const p = pp(g), t = g.world?.randomSidewalkPoint?.(p.x, p.z, 260) || { x: p.x - 150, z: p.z + 80 };
              m.data.spot = { x: t.x, z: t.z };
              m.setTimer(d2(p.x, p.z, t.x, t.z) / 8 + 25);
              g.events.emit('hud:message', { text: '"Step on it, buddy!"', duration: 2.5 });
              g.audio?.play?.('pickup');
            } else {
              m.data.fare++;
              g.state.money += 250; g.events.emit('money:changed', { money: g.state.money, delta: 250 }); // paid per fare
              g.events.emit('hud:message', { text: 'Fare delivered! +$250', duration: 2.5 });
              if (m.data.fare >= 3) return m.complete();
              this.newPickup(m);
            }
          }
        },
      },
    ],
  },
  {
    id: 'chase', name: 'Run Down', color: 0xff6a2d, letter: 'D', reward: 3500,
    intro: 'A thief is getting away in a fast car. Wreck it or force it to a halt!',
    start: () => ({ x: blockBounds(6, 1).minX + 1.5, z: blockBounds(6, 1).minZ + 30 }),
    stages: [
      carStage('Get into a car'),
      {
        text: 'Catch the getaway car',
        enter(m) {
          const g = m.game, p = pp(g);
          let r = null;
          for (let k = 0; k < 12 && g.world?.randomRoadPoint; k++) {
            const c = g.world.randomRoadPoint(p.x, p.z, 130);
            if (c && d2(c.x, c.z, p.x, p.z) > 60) { r = c; break; }
          }
          if (!r) r = { x: p.x + 70, z: p.z, heading: 0 };
          const v = m.data.target = spawnThief(g, r.x, r.z, r.heading ?? 0, 0);
          m.data.last = { x: r.x, z: r.z, h: r.heading ?? 0, s: 0 };
          m.data.still = 0; m.data.t = 0; m.data.far = 0;
          m.setTimer(150);
          m.progress = 'Thief: sports car';
        },
        marker(m) { const v = m.data.target; return v ? { x: v.position.x, z: v.position.z, label: 'Thief' } : null; },
        update(m, dt) {
          const g = m.game, p = pp(g);
          let v = m.data.target;
          if (!v) return m.fail('No target found');
          if (v.destroyed || v.health <= 0) return m.complete();
          const L = m.data.last;
          if (!g.vehicles?.list?.includes(v)) {
            // the traffic manager despawned the thief (it ignores `owned` for npc drivers): put it back where it was
            v = m.data.target = spawnThief(g, L.x, L.z, L.h, L.s);
            if (v.health != null && m.data.hp != null) v.health = m.data.hp;
          } else { L.x = v.position.x; L.z = v.position.z; L.h = v.heading; L.s = v.speed; m.data.hp = v.health; if (v.ai) v.ai.idle = 0; v.owned = true; }
          m.data.t += dt;
          const d = d2(L.x, L.z, p.x, p.z);
          m.progress = `Distance ${Math.round(d)} m`;
          // give up only when the player is really far behind for a while
          m.data.far = d > 300 ? m.data.far + dt : 0;
          if (m.data.far > 5) return m.fail('The thief got away');
          if (v.health < 100 && v.ai) v.ai.factor = 2.1;
          // stopped next to the player for a moment (rammed into a halt) counts as caught
          if (Math.abs(v.speed) < 1.5 && d < 14 && m.data.t > 8) m.data.still += dt; else m.data.still = 0;
          if (m.data.still > 2) {
            g.events.emit('hud:message', { text: 'The thief gave up!', duration: 3 });
            m.complete();
          }
        },
        leave(m) { if (m.data.target) m.data.target.owned = false; },
      },
    ],
  },
  {
    id: 'delivery', name: 'Special Delivery', color: 0x8cff3d, letter: 'L', reward: 3000,
    intro: 'Rush a package across town: run it to the first drop on foot, then finish by car. Watch the clock!',
    start: () => ({ x: blockBounds(1, 5).minX + 1.5, z: blockBounds(1, 5).minZ + 30 }),
    stages: [
      {
        text: 'Pick up the package',
        enter(m) {
          const g = m.game, p = pp(g);
          m.data.pick = sidewalkAt(g, p, 30, 60);
          m.data.drop1 = sidewalkAt(g, m.data.pick, 90, 140);
          m.data.drop2 = sidewalkAt(g, m.data.drop1, 220, 320);
          const len = d2(p.x, p.z, m.data.pick.x, m.data.pick.z) + d2(m.data.pick.x, m.data.pick.z, m.data.drop1.x, m.data.drop1.z);
          m.setTimer(len / 4.5 + 25);
          m.progress = 'Leg 1/2 on foot';
        },
        marker: m => ({ x: m.data.pick.x, z: m.data.pick.z, label: 'Package' }),
        update(m) {
          const p = pp(m.game), s = m.data.pick;
          if (d2(p.x, p.z, s.x, s.z) < 3) { m.game.audio?.play?.('pickup'); return 'next'; }
        },
      },
      {
        text: 'Run the package to the first drop',
        marker: m => ({ x: m.data.drop1.x, z: m.data.drop1.z, label: 'Drop 1' }),
        update(m) {
          const g = m.game, p = pp(g), s = m.data.drop1;
          if (g.player.vehicle) { m.fail('Leg 1 was meant to be done on foot'); return; }
          if (d2(p.x, p.z, s.x, s.z) < 3) {
            g.state.money += 300; g.events.emit('money:changed', { money: g.state.money, delta: 300 });
            g.events.emit('hud:message', { text: 'First drop done! +$300', duration: 3 });
            g.audio?.play?.('pickup');
            return 'next';
          }
        },
      },
      {
        ...carStage('Grab a car for the second leg'),
        enter(m) {
          m.progress = 'Leg 2/2 by car';
          const p = pp(m.game), s = m.data.drop2;
          m.addTime(d2(p.x, p.z, s.x, s.z) / 8 + 30);   // budget for the drive
        },
      },
      {
        text: 'Deliver the rest by car',
        marker: m => ({ x: m.data.drop2.x, z: m.data.drop2.z, label: 'Drop 2' }),
        update(m) {
          carAlive(m, 'The delivery car was destroyed');
          const g = m.game, s = m.data.drop2;
          if (d2(g.player.position.x, g.player.position.z, s.x, s.z) < 9) m.complete();
        },
      },
    ],
  },
];
