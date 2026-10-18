import * as THREE from 'three';
import { puffTexture } from './textures.js';

// Particules (sprites recyclés), traçantes de balles et boules d'explosion.
const TYPES = {
  smoke: { color: '#555555', life: 2.2, size: [1.2, 4], vy: 1.6, spread: 0.6, blend: THREE.NormalBlending, op: 0.55 },
  fire: { color: '#ff7a1a', life: 0.6, size: [1.2, 0.3], vy: 2.5, spread: 0.8, blend: THREE.AdditiveBlending, op: 0.9 },
  spark: { color: '#ffd966', life: 0.35, size: [0.25, 0.05], vy: 3, spread: 4, blend: THREE.AdditiveBlending, op: 1 },
  dust: { color: '#b49a7a', life: 1.0, size: [0.6, 2.0], vy: 0.5, spread: 0.8, blend: THREE.NormalBlending, op: 0.4 },
  blood: { color: '#7a0d0d', life: 0.5, size: [0.3, 0.6], vy: 0.5, spread: 1.5, blend: THREE.NormalBlending, op: 0.9 },
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.live = [];
    this.tracers = [];
    this.blasts = [];
    const tex = puffTexture();
    for (let i = 0; i < 260; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.pool.push(s);
    }
    this.tracerMat = new THREE.LineBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.9 });
    this.blastGeo = new THREE.SphereGeometry(1, 16, 10);
  }

  emit(type, x, y, z, n = 1) {
    const T = TYPES[type];
    for (let i = 0; i < n; i++) {
      const s = this.pool.pop();
      if (!s) return;
      s.visible = true;
      s.material.color.set(T.color);
      s.material.blending = T.blend;
      s.material.opacity = T.op;
      s.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
      this.live.push({
        s, T, age: 0, life: T.life * (0.7 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * T.spread, vy: T.vy * (0.6 + Math.random() * 0.8), vz: (Math.random() - 0.5) * T.spread,
      });
    }
  }

  tracer(ax, ay, az, bx, by, bz) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    const l = new THREE.Line(g, this.tracerMat);
    this.scene.add(l);
    this.tracers.push({ l, t: 0.06 });
  }

  explosion(x, y, z) {
    const m = new THREE.Mesh(this.blastGeo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.95 }));
    m.position.set(x, y, z);
    this.scene.add(m);
    this.blasts.push({ m, t: 0 });
    this.emit('fire', x, y, z, 30);
    this.emit('spark', x, y, z, 20);
    this.emit('smoke', x, y + 1, z, 14);
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.s.visible = false;
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const sz = p.T.size[0] + (p.T.size[1] - p.T.size[0]) * k;
      p.s.scale.set(sz, sz, sz);
      p.s.material.opacity = p.T.op * (1 - k);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      if ((t.t -= dt) <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      const k = b.t / 0.55;
      if (k >= 1) { this.scene.remove(b.m); b.m.material.dispose(); this.blasts.splice(i, 1); continue; }
      b.m.scale.setScalar(1 + k * 7);
      b.m.material.opacity = 0.95 * (1 - k);
    }
  }
}
