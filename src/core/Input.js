// Keyboard + mouse state. Use isDown(code) for held keys, pressed(code) for one-shot (true for exactly one frame).
export class Input {
  constructor(dom) {
    this.down = new Set();
    this.justPressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, leftPressed: false, locked: false };
    addEventListener('keydown', e => {
      if (!this.down.has(e.code)) this.justPressed.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    dom.addEventListener('click', () => { if (!this.mouse.locked) dom.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => { this.mouse.locked = document.pointerLockElement === dom; });
    addEventListener('mousemove', e => { if (this.mouse.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    addEventListener('mousedown', e => { if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; } });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.left = false; });
  }
  isDown(code) { return this.down.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  // Called by Game at the end of each frame.
  endFrame() { this.justPressed.clear(); this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.leftPressed = false; }
}
