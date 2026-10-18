import * as THREE from 'three';
import { waxTexture } from './textures.js';
import { pick, clamp, wrapAngle } from './util.js';
import { SIDEWALK, districtAt } from './world.js';

export const SKINS = ['#3b2219', '#4a2c1d', '#5a3825', '#6b4430', '#2e1a12', '#7a4e35', '#553321'];
const BOX = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();

export function mat(key) {
  let m = matCache.get(key);
  if (!m) {
    m = key.startsWith('wax:')
      ? new THREE.MeshLambertMaterial({ map: waxTexture(+key.slice(4)) })
      : new THREE.MeshLambertMaterial({ color: key });
    matCache.set(key, m);
  }
  return m;
}

// Modèle humain stylisé (blocs). o : { skin, top, bottom, sleeve, dress, hat, hatColor, basin, scale, glasses, beard }
export function makeHuman(o) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(o.scale || 1);
  const part = (m, w, h, d, x, y, z, parent) => {
    const me = new THREE.Mesh(BOX, mat(m));
    me.scale.set(w, h, d);
    me.position.set(x, y, z);
    me.castShadow = true;
    parent.add(me);
    return me;
  };
  const hip = 0.92;
  const legL = new THREE.Group(); legL.position.set(0.11, hip, 0); body.add(legL);
  const legR = new THREE.Group(); legR.position.set(-0.11, hip, 0); body.add(legR);
  part(o.bottom, 0.18, 0.92, 0.21, 0, -0.46, 0, legL);
  part(o.bottom, 0.18, 0.92, 0.21, 0, -0.46, 0, legR);
  part(o.top, 0.46, 0.62, 0.26, 0, hip + 0.31, 0, body);
  if (o.dress) part(o.dress, 0.5, 0.62, 0.32, 0, hip - 0.2, 0, body);
  part(o.skin, 0.24, 0.27, 0.25, 0, hip + 0.78, 0, body);
  if (o.hat === 'cap') { part(o.hatColor || '#111', 0.27, 0.08, 0.28, 0, hip + 0.95, 0, body); part(o.hatColor || '#111', 0.22, 0.03, 0.12, 0, hip + 0.92, 0.18, body); }
  else if (o.hat === 'wrap') part(o.hatColor || 'wax:1', 0.3, 0.2, 0.3, 0, hip + 1.0, -0.01, body);
  else if (o.hat === 'hair') part('#141010', 0.25, 0.06, 0.26, 0, hip + 0.93, 0, body);
  if (o.basin) part('#d35400', 0.62, 0.12, 0.62, 0, hip + 1.14, 0, body);
  if (o.glasses) part('#0d0d0d', 0.25, 0.05, 0.03, 0, hip + 0.82, 0.13, body);
  if (o.beard) part('#3b3b3b', 0.24, 0.08, 0.05, 0, hip + 0.68, 0.12, body);
  const armL = new THREE.Group(); armL.position.set(0.3, hip + 0.58, 0); body.add(armL);
  const armR = new THREE.Group(); armR.position.set(-0.3, hip + 0.58, 0); body.add(armR);
  part(o.sleeve || o.skin, 0.13, 0.62, 0.14, 0, -0.3, 0, armL);
  part(o.sleeve || o.skin, 0.13, 0.62, 0.14, 0, -0.3, 0, armR);
  root.userData = { body, legL, legR, armL, armR };
  return root;
}

export function animHuman(m, phase, amt, aiming = false) {
  const u = m.userData;
  const a = Math.sin(phase) * amt;
  u.legL.rotation.x = a;
  u.legR.rotation.x = -a;
  u.armL.rotation.x = -a * 0.8;
  u.armR.rotation.x = aiming ? -1.5 : a * 0.8;
}

const JERSEYS = ['#ff7f00', '#ffffff', '#009e60', '#1f3a93', '#c0392b', '#2c3e50', '#f1c40f', '#7f8c8d', '#16a085'];
const PANTS = ['#2c3e50', '#1b2631', '#5d6d7e', '#7f6a50', '#34495e', '#1a237e', '#3e2723', '#d5c4a1'];

export function randomLook(district, r = Math.random) {
  const skin = pick(SKINS, r);
  if (r() < 0.45) {
    const w = 'wax:' + Math.floor(r() * 8);
    const top = r() < 0.7 ? w : pick(['#e74c3c', '#f1c40f', '#ffffff', '#9b59b6', '#1abc9c'], r);
    return {
      skin, top, dress: r() < 0.75 ? top : 'wax:' + Math.floor(r() * 8), bottom: skin,
      hat: r() < 0.6 ? 'wrap' : 'hair', hatColor: 'wax:' + Math.floor(r() * 8),
      basin: district === 'adjame' && r() < 0.25, scale: 0.9 + r() * 0.1,
    };
  }
  const top = r() < 0.25 ? 'wax:' + Math.floor(r() * 8) : pick(JERSEYS, r);
  return {
    skin, top, bottom: pick(PANTS, r), sleeve: r() < 0.3 ? top : null,
    hat: r() < 0.3 ? 'cap' : 'hair', hatColor: pick(['#111', '#c0392b', '#f1c40f', '#ffffff', '#2980b9'], r),
    scale: 0.94 + r() * 0.12,
  };
}

// ---------------------------------------------------------------------------
// Piétons
// ---------------------------------------------------------------------------
export class Peds {
  constructor(G) {
    this.G = G;
    this.list = [];
  }

  spawnAt(x, z, look, extra = {}) {
    const model = makeHuman(look);
    this.G.scene.add(model);
    const p = Object.assign({
      model, x, z, h: Math.random() * 6.28, mode: 'idle', speed: 1.3 + Math.random() * 0.4, phase: Math.random() * 6,
      health: 100, t: 2 + Math.random() * 4, edge: null, toNode: null, side: 1, tx: x, tz: z, fx: 0, fz: 0,
      mission: false, vy: 0, y: 0, kvx: 0, kvz: 0,
    }, extra);
    this.list.push(p);
    this.sync(p);
    return p;
  }

  remove(p) {
    this.G.scene.remove(p.model);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  sync(p) {
    p.model.position.set(p.x, p.y, p.z);
    p.model.rotation.y = p.h;
  }

  // Choisit un trottoir et un bout de rue vers lequel marcher.
  routeFrom(p, node, prevEdge) {
    let opts = node.adj.filter((a) => a.e !== prevEdge);
    if (!opts.length) opts = node.adj;
    const o = pick(opts);
    const e = o.e, to = o.n;
    const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len;
    const off = e.w / 2 + SIDEWALK / 2;
    let best = 1, bd = Infinity;
    for (const s of [-1, 1]) {
      const sx = node.x - dz * off * s, sz = node.z + dx * off * s;
      const d = (sx - p.x) ** 2 + (sz - p.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    p.edge = e; p.toNode = to; p.side = best;
    const back = to.hw + 1.5, sgn = to === e.b ? 1 : -1;
    p.tx = to.x - dx * back * sgn - dz * off * best;
    p.tz = to.z - dz * back * sgn + dx * off * best;
    p.mode = 'walk';
  }

  startWalking(p) {
    const ep = this.G.world.nearestEdgePoint(p.x, p.z);
    const e = ep.e;
    const node = (p.x - e.a.x) ** 2 + (p.z - e.a.z) ** 2 < (p.x - e.b.x) ** 2 + (p.z - e.b.z) ** 2 ? e.b : e.a;
    const from = node === e.a ? e.b : e.a;
    p.edge = e;
    // Direction : on continue vers le nœud opposé à la menace ou au hasard.
    const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len;
    const off = e.w / 2 + SIDEWALK / 2;
    const s = Math.sign((p.x - ep.x) * -dz + (p.z - ep.z) * dx) || 1;
    const to = Math.random() < 0.5 ? node : from;
    const sgn = to === e.b ? 1 : -1, back = to.hw + 1.5;
    p.toNode = to; p.side = s;
    p.tx = to.x - dx * back * sgn - dz * off * s;
    p.tz = to.z - dz * back * sgn + dx * off * s;
    p.mode = 'walk';
  }

  spawnRandom() {
    const G = this.G, W = G.world, P = G.player.pos();
    for (let k = 0; k < 10; k++) {
      const e = W.edges[Math.floor(Math.random() * W.edges.length)];
      const t = e.a.hw + 2 + Math.random() * Math.max(1, e.len - e.a.hw - e.b.hw - 4);
      const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len;
      const s = Math.random() < 0.5 ? -1 : 1, off = e.w / 2 + SIDEWALK / 2;
      const x = e.a.x + dx * t - dz * off * s, z = e.a.z + dz * t + dx * off * s;
      const d = Math.hypot(x - P.x, z - P.z);
      if (d < 40 || d > 115) continue;
      const district = districtAt(x, z);
      if (district === 'banco') continue;
      const p = this.spawnAt(x, z, randomLook(district));
      if (Math.random() < 0.15) { p.mode = 'idle'; p.t = 5 + Math.random() * 15; }
      else this.startWalking(p);
      return p;
    }
    return null;
  }

  panic(x, z, radius) {
    for (const p of this.list) {
      if (p.mode === 'dead' || p.mission) continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < radius * radius) {
        p.mode = 'flee'; p.fx = x; p.fz = z; p.t = 7 + Math.random() * 5;
      }
    }
  }

  kill(p, kx = 0, kz = 0, byPlayer = true) {
    if (p.mode === 'dead') return;
    p.mode = 'dead'; p.health = 0; p.t = 25;
    p.kvx = kx; p.kvz = kz; p.vy = Math.hypot(kx, kz) > 4 ? 4 : 0;
    const u = p.model.userData;
    u.body.rotation.x = -Math.PI / 2;
    u.body.position.y = 0.15;
    if (byPlayer && !p.mission) {
      const G = this.G;
      G.police.crime(0.34, p.x, p.z, true);
      if (Math.random() < 0.4) G.pickups.cash(p.x, p.z, 50 + Math.floor(Math.random() * 450));
      G.stats.kills++;
    }
    this.panic(p.x, p.z, 30);
  }

  damage(p, amount, fromX, fromZ, byPlayer = true) {
    if (p.mode === 'dead') return;
    p.health -= amount;
    if (p.health <= 0) {
      const dx = p.x - fromX, dz = p.z - fromZ, l = Math.hypot(dx, dz) || 1;
      this.kill(p, (dx / l) * 2, (dz / l) * 2, byPlayer);
    } else {
      p.mode = 'flee'; p.fx = fromX; p.fz = fromZ; p.t = 10;
      if (byPlayer) this.G.police.crime(0.15, p.x, p.z, false);
    }
  }

  update(dt) {
    const G = this.G, W = G.world, P = G.player.pos();
    const district = districtAt(P.x, P.z);
    const night = G.sky.night;
    let target = { adjame: 46, plateau: 30, cocody: 18, banco: 2 }[district] || 20;
    target = Math.round(target * (1 - 0.5 * night));
    const alive = this.list.filter((p) => !p.mission).length;
    if (alive < target) for (let i = 0; i < 2; i++) this.spawnRandom();

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const d2 = (p.x - P.x) ** 2 + (p.z - P.z) ** 2;
      if (!p.mission && (d2 > 150 * 150 || (p.mode === 'dead' && (p.t -= dt) <= 0))) { this.remove(p); continue; }
      if (p.attached) continue;
      if (p.mode === 'dead') {
        if (p.kvx || p.kvz) {
          p.x += p.kvx * dt; p.z += p.kvz * dt;
          p.kvx *= 1 - 3 * dt; p.kvz *= 1 - 3 * dt;
          const res = W.pushCircle(p.x, p.z, 0.3);
          if (res) { p.x += res.dx; p.z += res.dz; p.kvx = p.kvz = 0; }
          if (Math.abs(p.kvx) + Math.abs(p.kvz) < 0.1) p.kvx = p.kvz = 0;
          this.sync(p);
        }
        continue;
      }
      let speed = 0;
      if (p.mode === 'idle') {
        p.t -= dt;
        if (p.t <= 0 && !p.mission) this.startWalking(p);
      } else if (p.mode === 'walk') {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.8) this.routeFrom(p, p.toNode, p.edge);
        else {
          speed = p.speed;
          p.h += wrapAngle(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 6);
        }
      } else if (p.mode === 'flee') {
        p.t -= dt;
        const dx = p.x - p.fx, dz = p.z - p.fz;
        p.h += wrapAngle(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 5);
        speed = 4.6;
        if (p.t <= 0) this.startWalking(p);
      } else if (p.mode === 'goto') {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { p.mode = 'idle'; p.t = 1e9; }
        else { speed = p.run ? 4.5 : 1.6; p.h += wrapAngle(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 6); }
      }
      if (speed > 0) {
        const nx = p.x + Math.sin(p.h) * speed * dt, nz = p.z + Math.cos(p.h) * speed * dt;
        if (W.isWalkable(nx, nz)) { p.x = nx; p.z = nz; }
        else if (p.mode === 'flee') p.h += 1.5;
        const res = W.pushCircle(p.x, p.z, 0.3);
        if (res) {
          p.x += res.dx; p.z += res.dz;
          if (p.mode === 'flee') p.h += 0.8 * dt * 10;
        }
        p.phase += dt * speed * 3.2;
      }
      if (d2 < 100 * 100) animHuman(p.model, p.phase, speed > 0 ? clamp(speed * 0.25, 0.3, 0.9) : 0);
      this.sync(p);
    }
  }
}
