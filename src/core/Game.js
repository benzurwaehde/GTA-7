import * as THREE from 'three';
import { EventBus } from './EventBus.js';
import { Input } from './Input.js';

// The Game owns renderer, scene, camera, input, events and the list of systems.
// Systems are plain objects with optional update(dt) and are reachable as game.<name>.
export class Game {
  constructor(container, uiRoot) {
    this.container = container;
    this.ui = uiRoot;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 2000);
    this.camera.position.set(0, 10, 20);

    this.events = new EventBus();
    this.input = new Input(this.renderer.domElement);
    this.clock = new THREE.Clock();
    this.time = 0;          // seconds since start (game time, pauses when paused)
    this.paused = false;
    this.systems = [];      // [{ name, system }]
    this.state = { money: 0, wanted: 0 };

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  add(name, system) {
    this[name] = system;
    this.systems.push({ name, system });
    return system;
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 1 / 20);
      this.step(dt);
    };
    loop();
  }

  step(dt) {
    if (!this.paused) {
      this.time += dt;
      for (const { name, system } of this.systems) {
        try { system.update?.(dt); }
        catch (err) { console.error(`[${name}] update failed`, err); }
      }
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}
