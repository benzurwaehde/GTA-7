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
];
