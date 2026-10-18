// Clavier (codes physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris et commandes tactiles.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false };
    this.locked = false;
    this.touchMove = { x: 0, y: 0 };
    this.dragging = null;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (!this.locked) { canvas.requestPointerLock?.(); }
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    if (this.touch) this.setupTouch();
  }

  setupTouch() {
    const root = document.getElementById('touch');
    root.classList.add('show');
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let stickId = null, sx = 0, sy = 0;
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      sx = r.left + r.width / 2; sy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    const moveStick = (t) => {
      let dx = (t.clientX - sx) / 50, dy = (t.clientY - sy) / 50;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.touchMove.x = dx; this.touchMove.y = -dy;
      knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) moveStick(t);
        else if (this.dragging && t.identifier === this.dragging.id) {
          this.mouse.dx += (t.clientX - this.dragging.x) * 1.6;
          this.mouse.dy += (t.clientY - this.dragging.y) * 1.6;
          this.dragging.x = t.clientX; this.dragging.y = t.clientY;
        }
      }
    }, { passive: true });
    addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; this.touchMove.x = this.touchMove.y = 0; knob.style.transform = ''; }
        if (this.dragging && t.identifier === this.dragging.id) this.dragging = null;
      }
    });
    this.canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      if (t.clientX > innerWidth * 0.35) this.dragging = { id: t.identifier, x: t.clientX, y: t.clientY };
    }, { passive: true });
    for (const b of root.querySelectorAll('[data-key]')) {
      const key = b.dataset.key;
      const down = (e) => {
        e.preventDefault();
        if (key === 'Mouse0') { this.mouse.left = true; this.mouse.leftPressed = true; this.mouse.right = true; }
        else { this.keys.add(key); this.pressed.add(key); }
        b.classList.add('on');
      };
      const up = () => {
        if (key === 'Mouse0') { this.mouse.left = false; this.mouse.right = false; }
        else this.keys.delete(key);
        b.classList.remove('on');
      };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up);
      b.addEventListener('touchcancel', up);
    }
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  axisX() {
    let x = 0;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    return x || this.touchMove.x;
  }
  axisY() {
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return y || this.touchMove.y;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.leftPressed = false;
  }
}
