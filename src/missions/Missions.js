import * as THREE from 'three';
import { MISSIONS } from './missionDefs.js';

const STORE_KEY = 'gta7.missions.completed';
const START_RADIUS = 2.5;

function glowMat(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
}

// A glowing ring + cylinder + beam.
function makeMarker(color, radius, beamH, beamR) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 8, 40), glowMat(color, 0.95));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 5, 32, 1, true), glowMat(color, 0.22));
  cyl.position.y = 2.5; g.add(cyl);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(beamR, beamR, beamH, 12, 1, true), glowMat(color, 0.16));
  beam.position.y = beamH / 2; g.add(beam);
  g.userData = { ring, cyl, beam };
  g.renderOrder = 10;
  return g;
}

export class Missions {
  constructor(game) {
    this.game = game;
    this.defs = MISSIONS;
    this.active = null;
    this.completed = this.load();
    this.cooldown = 1;
    this.t = 0;
    this.starts = [];
    this.group = new THREE.Group(); this.group.name = 'missions';
    game.scene.add(this.group);

    for (const def of this.defs) this.addStart(def);

    this.objMarker = makeMarker(0xffd24a, 3.2, 120, 0.7); this.objMarker.visible = false; this.group.add(this.objMarker);
    this.nextMarker = makeMarker(0x19e3ff, 2.2, 30, 0.3); this.nextMarker.visible = false; this.group.add(this.nextMarker);
    this.objective = null;

    game.events.on('player:busted', () => { if (this.active) this.fail('Busted'); });
    game.events.on('player:died', () => { if (this.active) this.fail('Wasted'); });
  }

  // -- public API (see ARCHITECTURE.md) -----------------------------------------
  getObjectiveMarker() { return this.active ? this.objective : null; }
  getBlips() {
    if (this.active) return [];
    return this.starts.map(s => ({ x: s.pos.x, z: s.pos.z, color: '#' + s.def.color.toString(16).padStart(6, '0'), letter: s.def.letter || 'M', label: s.def.name }));
  }
  /** Start a mission by id (also used by tests / debug: game.missions.start('rush')). */
  start(id) {
    const def = this.defs.find(d => d.id === id);
    if (def && !this.active) this.begin(def);
  }

  // -- internals ----------------------------------------------------------------
  addStart(def) {
    const pos = def.start(this.game);
    const marker = makeMarker(def.color, START_RADIUS, 45, 0.5);
    marker.position.set(pos.x, 0, pos.z);
    this.group.add(marker);
    this.starts.push({ def, pos, marker });
  }

  load() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; } }
  save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.completed)); } catch (e) { /* ignore */ } }
  say(text, duration = 4) { this.game.events.emit('hud:message', { text, duration }); }

  begin(def) {
    const self = this;
    const m = this.active = {
      def, name: def.name, game: this.game, data: {}, stage: -1, timeLeft: null, progress: '', objectiveText: '', reward: def.reward,
      done: false,
      setTimer(s) { this.timeLeft = s; },
      addTime(s) { if (this.timeLeft != null) this.timeLeft += s; },
      fail(reason) { if (!this.done) self.fail(reason); },
      complete() { if (!this.done) self.complete(); },
    };
    this.say(`MISSION: ${def.name} - ${def.intro}`, 6);
    this.game.audio?.play?.('mission');
    this.game.events.emit('mission:started', { mission: def });
    this.enterStage(0);
  }

  enterStage(i) {
    const m = this.active, st = m.def.stages[i];
    m.stage = i; m.objectiveText = st.text;
    st.enter?.(m);
    if (this.active !== m) return;
    this.objective = this.computeMarker(m);
    this.say(m.objectiveText, 4);
  }

  computeMarker(m) {
    const st = m.def.stages[m.stage];
    return st?.marker?.(m) || null;
  }

  finish() { this.active = null; this.objective = null; this.cooldown = 8; this.objMarker.visible = false; this.nextMarker.visible = false; }

  fail(reason) {
    const m = this.active; if (!m) return;
    m.done = true;
    const def = m.def;
    this.finish();
    this.say(`Mission failed: ${reason}`, 4);
    if (reason !== 'Busted' && reason !== 'Wasted') this.game.events.emit('hud:bigtext', { text: 'MISSION FAILED', color: '#ff3355', duration: 3 });
    this.game.events.emit('mission:failed', { mission: def, reason });
  }

  complete() {
    const m = this.active; if (!m) return;
    m.done = true;
    const g = this.game, def = m.def;
    g.state.money += m.reward;
    g.events.emit('money:changed', { money: g.state.money, delta: m.reward });
    if (!this.completed.includes(def.id)) { this.completed.push(def.id); this.save(); }
    this.finish();
    g.events.emit('hud:bigtext', { text: 'MISSION PASSED', color: '#ffd24a', duration: 4 });
    this.say(`${def.name} complete! Reward: $${m.reward}`, 5);
    g.audio?.play?.('mission');
    g.events.emit('mission:completed', { mission: def });
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    this.cooldown -= dt;
    const pos = p?.position;

    // animate start markers
    for (const s of this.starts) {
      const u = s.marker.userData, k = 1 + Math.sin(this.t * 3 + s.pos.x) * 0.08;
      s.marker.visible = !this.active;
      u.ring.scale.set(k, k, k); u.ring.position.y = 0.4 + Math.sin(this.t * 2 + s.pos.z) * 0.25;
      s.marker.rotation.y = this.t * 0.8;
      const done = this.completed.includes(s.def.id);
      u.beam.material.opacity = done ? 0.09 : 0.16 + Math.sin(this.t * 4) * 0.04;
    }

    if (!this.active) {
      if (pos && this.cooldown <= 0 && !p.vehicle && p.alive !== false) {
        for (const s of this.starts) {
          if (Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z) < START_RADIUS) { this.begin(s.def); break; }
        }
      }
      return;
    }

    const m = this.active;
    if (p && (p.alive === false || p.health <= 0)) return this.fail('Wasted');
    // timer
    if (m.timeLeft != null) {
      m.timeLeft -= dt;
      if (m.timeLeft <= 0) return this.fail('Out of time');
    }
    const st = m.def.stages[m.stage];
    const r = st.update?.(m, dt);
    if (this.active !== m) return;
    if (r === 'next') {
      if (m.stage + 1 >= m.def.stages.length) return this.complete();
      this.enterStage(m.stage + 1);
    }
    if (this.active !== m) return;

    // objective marker (world beam + minimap)
    this.objective = this.computeMarker(m);
    const o = this.objective, om = this.objMarker;
    om.visible = !!o;
    if (o) {
      om.position.set(o.x, 0, o.z); om.rotation.y = this.t * 1.5;
      const k = 1 + Math.sin(this.t * 5) * 0.1; om.userData.ring.scale.set(k, k, k);
    }
    const n2 = st.marker2?.(m);
    this.nextMarker.visible = !!n2;
    if (n2) this.nextMarker.position.set(n2.x, 0, n2.z);
  }
}
