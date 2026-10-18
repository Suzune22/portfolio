import * as THREE from 'three';
import { Batch } from './geo.js';
import { clamp, wrapAngle, pick, weighted, rand } from './util.js';
import { districtAt } from './world.js';

export const VTYPES = {
  sedan: { name: 'Berline', len: 4.4, wid: 1.8, h: 1.45, max: 40, acc: 11, hp: 100, mass: 1.2, colors: ['#c0c0c0', '#2c3e50', '#8e1b1b', '#f5f5f5', '#1f5f8b', '#3b3b3b', '#6b8e23', '#7d5a3c'] },
  taxi: { name: 'Taxi compteur', len: 4.4, wid: 1.8, h: 1.45, max: 38, acc: 10, hp: 100, mass: 1.2, colors: ['#ff6a00'] },
  woro: { name: 'Woro-woro', len: 4.3, wid: 1.8, h: 1.45, max: 37, acc: 10, hp: 100, mass: 1.2, colors: ['#f1c40f', '#27ae60', '#2e86de'] },
  gbaka: { name: 'Gbaka', len: 5.4, wid: 2.0, h: 2.3, max: 31, acc: 7.5, hp: 150, mass: 2.0, colors: ['#1e8449', '#f4d03f', '#2471a3', '#d35400'] },
  suv: { name: '4x4', len: 4.8, wid: 2.0, h: 1.85, max: 42, acc: 11.5, hp: 150, mass: 1.8, colors: ['#111111', '#f5f5f5', '#7f8c8d', '#5d4037'] },
  sport: { name: 'Sportive', len: 4.4, wid: 1.9, h: 1.2, max: 57, acc: 18, hp: 90, mass: 1.1, colors: ['#d4ac0d', '#c0392b', '#111111', '#f5f5f5'] },
  police: { name: 'Police', len: 4.6, wid: 1.85, h: 1.5, max: 49, acc: 15, hp: 140, mass: 1.5, colors: ['#f5f5f5'] },
  fourgon: { name: 'Fourgon blindé', len: 6.4, wid: 2.4, h: 2.9, max: 29, acc: 7, hp: 480, mass: 4, colors: ['#5d6d7e'] },
};

const TRAFFIC_MIX = {
  adjame: { gbaka: 30, woro: 25, taxi: 15, sedan: 25, suv: 5 },
  plateau: { sedan: 40, taxi: 22, suv: 20, woro: 6, sport: 8, gbaka: 4 },
  cocody: { sedan: 34, suv: 30, sport: 10, woro: 16, taxi: 10 },
  banco: { sedan: 50, gbaka: 30, suv: 20 },
};
const CRUISE = { adjame: 10, plateau: 13, cocody: 15, banco: 12 };

const geoCache = new Map();
const vMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const wreckMat = new THREE.MeshLambertMaterial({ color: '#1e1c1b' });
const redLight = new THREE.MeshBasicMaterial({ color: '#ff2020' });
const blueLight = new THREE.MeshBasicMaterial({ color: '#2060ff' });
const offLight = new THREE.MeshBasicMaterial({ color: '#333' });

function buildGeo(type, color) {
  const key = type + color;
  if (geoCache.has(key)) return geoCache.get(key);
  const s = VTYPES[type], b = new Batch(), L = s.len / 2, W = s.wid / 2;
  const glass = '#1d2a35', dark = '#151515', light = '#fff6d5', tail = '#c0141c';
  const wheels = (zf, r = 0.33) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const xc = sx * (W - 0.14), zc = sz * zf;
      b.box(xc - 0.16, 0, zc - r, xc + 0.16, r * 2, zc + r, dark);
    }
  };
  const lights = (y0, y1) => {
    b.box(-W + 0.12, y0, L, -W + 0.55, y1, L + 0.04, light); b.box(W - 0.55, y0, L, W - 0.12, y1, L + 0.04, light);
    b.box(-W + 0.12, y0, -L - 0.04, -W + 0.5, y1, -L, tail); b.box(W - 0.5, y0, -L - 0.04, W - 0.12, y1, -L, tail);
  };
  if (['sedan', 'taxi', 'woro', 'police', 'sport'].includes(type)) {
    const sp = type === 'sport';
    const y0 = sp ? 0.28 : 0.34, y1 = sp ? 0.78 : 0.92;
    b.box(-W, y0, -L, W, y1, L, color);
    b.hexa([
      [-W + 0.06, y1, -L * 0.55], [W - 0.06, y1, -L * 0.55], [W - 0.06, y1, L * 0.25], [-W + 0.06, y1, L * 0.25],
      [-W + 0.22, s.h, -L * 0.42], [W - 0.22, s.h, -L * 0.42], [W - 0.22, s.h, L * 0.02], [-W + 0.22, s.h, L * 0.02],
    ], glass, { topColor: color });
    b.box(-W, y0 - 0.06, L - 0.05, W, y0 + 0.2, L + 0.08, dark);
    b.box(-W, y0 - 0.06, -L - 0.08, W, y0 + 0.2, -L + 0.05, dark);
    lights(y1 - 0.24, y1 - 0.08);
    wheels(L * 0.64);
    if (type === 'taxi') { b.box(-0.35, s.h, -0.25, 0.35, s.h + 0.24, 0.05, '#ffffff'); b.box(-W - 0.01, 0.6, -L + 0.4, W + 0.01, 0.68, L - 0.4, '#111'); }
    if (type === 'woro') b.box(-W - 0.01, 0.58, -L + 0.3, W + 0.01, 0.7, L - 0.3, '#ffffff');
    if (type === 'police') {
      b.box(-W - 0.01, 0.45, -L * 0.5, W + 0.01, 0.8, L * 0.35, '#1f4e9c');
      b.box(-0.55, s.h, -0.35, 0.55, s.h + 0.08, -0.1, '#222');
    }
    if (sp) b.box(-W + 0.1, y1, -L, W - 0.1, y1 + 0.18, -L + 0.25, dark);
  } else if (type === 'suv') {
    b.box(-W, 0.45, -L, W, 1.15, L, color);
    b.hexa([
      [-W + 0.05, 1.15, -L * 0.8], [W - 0.05, 1.15, -L * 0.8], [W - 0.05, 1.15, L * 0.3], [-W + 0.05, 1.15, L * 0.3],
      [-W + 0.12, s.h, -L * 0.78], [W - 0.12, s.h, -L * 0.78], [W - 0.12, s.h, L * 0.1], [-W + 0.12, s.h, L * 0.1],
    ], glass, { topColor: color });
    b.box(-W, 0.35, L - 0.05, W, 0.6, L + 0.1, dark);
    b.box(-0.35, 0.6, -L - 0.25, 0.35, 1.2, -L, dark);
    lights(0.85, 1.02);
    wheels(L * 0.62, 0.4);
  } else if (type === 'gbaka') {
    b.box(-W, 0.4, -L, W, s.h, L, color);
    b.box(-W - 0.02, 1.35, -L + 0.4, W + 0.02, 1.95, L - 0.9, glass);
    b.box(-W + 0.1, 1.2, L - 0.02, W - 0.1, 2.05, L + 0.03, glass);
    const stripe = color === '#f4d03f' ? '#1e8449' : '#f4d03f';
    b.box(-W - 0.03, 0.85, -L, W + 0.03, 1.05, L, stripe);
    b.box(-W + 0.1, s.h, -L + 0.5, W - 0.1, s.h + 0.08, L - 0.8, '#333');
    b.box(-0.8, s.h + 0.08, -L + 0.7, 0.2, s.h + 0.6, -L + 1.7, '#6e2c00');
    b.box(-0.1, s.h + 0.08, -0.6, 0.8, s.h + 0.45, 0.6, '#1f618d');
    b.box(-0.7, s.h + 0.08, 0.8, 0.5, s.h + 0.35, 1.5, '#7d3c98');
    lights(0.6, 0.85);
    wheels(L * 0.66, 0.38);
  } else if (type === 'fourgon') {
    b.box(-W, 0.45, L - 1.9, W, 2.3, L, color);
    b.box(-W + 0.1, 1.4, L - 0.02, W - 0.1, 2.1, L + 0.03, glass);
    b.box(-W - 0.02, 1.4, L - 1.6, W + 0.02, 2.0, L - 0.5, glass);
    b.box(-W, 0.5, -L, W, s.h, L - 2.0, '#8b9aa7');
    b.box(-W - 0.02, 1.2, -L, W + 0.02, 1.5, L - 2.0, '#f1c40f');
    lights(0.7, 0.95);
    wheels(L * 0.66, 0.45);
  }
  const g = b.build();
  geoCache.set(key, g);
  return g;
}

let uid = 0;

export class Vehicle {
  constructor(G, type, color, x, z, h) {
    this.G = G; this.id = ++uid;
    this.type = type; this.spec = VTYPES[type];
    this.color = color || pick(this.spec.colors);
    this.mesh = new THREE.Group();
    this.body = new THREE.Mesh(buildGeo(type, this.color), vMat);
    this.body.castShadow = true;
    this.mesh.add(this.body);
    if (type === 'police') {
      const g = new THREE.BoxGeometry(0.42, 0.16, 0.22);
      this.lR = new THREE.Mesh(g, offLight); this.lR.position.set(0.27, this.spec.h + 0.16, -0.22);
      this.lB = new THREE.Mesh(g, offLight); this.lB.position.set(-0.27, this.spec.h + 0.16, -0.22);
      this.mesh.add(this.lR, this.lB);
    }
    G.scene.add(this.mesh);
    this.x = x; this.z = z; this.h = h; this.vx = 0; this.vz = 0;
    this.hp = this.spec.hp; this.state = 'ok';
    this.driver = null; this.ai = null;
    this.throttle = 0; this.steer = 0; this.handbrake = false;
    this.stuckT = 0; this.revT = 0; this.burnT = 0; this.wreckT = 0; this.fxT = 0; this.hornT = 0;
    this.mission = false; this.persistent = false; this.siren = false; this.isCop = type === 'police';
    this.lastHitByPlayer = false;
    this.sync();
  }

  sync() { this.mesh.position.set(this.x, 0, this.z); this.mesh.rotation.y = this.h; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwdSpeed() { return this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h); }
  get dead() { return this.state !== 'ok'; }
  get crippled() { return this.hp < this.spec.hp * 0.25; }

  dispose() { this.G.scene.remove(this.mesh); }

  // Coordonnées locales d'un point (lx : vers la gauche, lz : vers l'avant)
  local(x, z) {
    const dx = x - this.x, dz = z - this.z, s = Math.sin(this.h), c = Math.cos(this.h);
    return { lx: dx * c - dz * s, lz: dx * s + dz * c };
  }

  damage(amount, byPlayer = false) {
    if (this.state !== 'ok') return;
    this.hp -= amount;
    if (byPlayer) this.lastHitByPlayer = true;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'burning';
      this.burnT = 3.5;
      if (this.lastHitByPlayer && !this.mission) this.G.police.crime(this.isCop ? 1 : 0.34, this.x, this.z, this.isCop);
    }
  }

  explode() {
    const G = this.G;
    this.state = 'wreck';
    this.body.material = wreckMat;
    if (this.lR) { this.lR.material = offLight; this.lB.material = offLight; }
    this.siren = false;
    this.vx *= 0.3; this.vz *= 0.3;
    G.effects.explosion(this.x, 1.2, this.z);
    G.audio.explosion(this.x, this.z);
    G.combat.blast(this.x, this.z, 8, this.lastHitByPlayer, this);
    if (this.driver === 'ai' && this.isCop) G.stats.copsDown++;
    if (this.driver === 'ai') this.driver = null;
  }

  physics(dt) {
    const s = this.spec;
    const sh = Math.sin(this.h), ch = Math.cos(this.h);
    let fwd = this.vx * sh + this.vz * ch;
    let lat = -this.vx * ch + this.vz * sh;
    let t = this.state === 'ok' ? this.throttle : 0;
    if (this.state === 'ok' && this.crippled && this.driver === 'player') t *= 0.5;
    if (t > 0) {
      if (fwd < -0.5) fwd += s.acc * 2 * t * dt;
      else fwd += s.acc * t * dt * Math.max(0, 1 - Math.max(0, fwd) / s.max);
    } else if (t < 0) {
      if (fwd > 0.5) fwd += s.acc * 2.2 * t * dt;
      else fwd += s.acc * 0.7 * t * dt * Math.max(0, 1 + Math.min(0, fwd) / (s.max * 0.35));
    }
    const roll = (t === 0 ? 2.5 : 0.6) + (this.state !== 'ok' ? 4 : 0);
    fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), roll * dt);
    fwd -= fwd * 0.08 * dt;
    if (this.handbrake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 9 * dt);
    const grip = this.handbrake ? 1.6 : 9;
    lat *= Math.exp(-grip * dt);
    if (this.state === 'ok') {
      const sf = clamp(fwd / 6, -1, 1);
      const hi = 1 / (1 + Math.abs(fwd) / 26);
      this.h += this.steer * 2.3 * sf * hi * (this.handbrake ? 1.45 : 1) * dt;
    }
    const sh2 = Math.sin(this.h), ch2 = Math.cos(this.h);
    this.vx = sh2 * fwd - ch2 * lat;
    this.vz = ch2 * fwd + sh2 * lat;
  }

  move(dt) {
    const W = this.G.world;
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const sh = Math.sin(this.h), ch = Math.cos(this.h), hl = this.spec.len / 2;
    const ok = W.isWalkable(nx, nz) && W.isWalkable(nx + sh * hl, nz + ch * hl) && W.isWalkable(nx - sh * hl, nz - ch * hl);
    if (ok) { this.x = nx; this.z = nz; }
    else {
      const sp = this.speed;
      this.vx *= -0.3; this.vz *= -0.3;
      if (sp > 8) this.damage((sp - 8) * 3, this.driver === 'player');
    }
    const r = this.spec.wid / 2, off = hl - r;
    let hx = 0, hz = 0, hit = false;
    for (const k of [-1, 0, 1]) {
      const res = W.pushCircle(this.x + sh * off * k, this.z + ch * off * k, r);
      if (res) { this.x += res.dx; this.z += res.dz; hx += res.dx; hz += res.dz; hit = true; }
    }
    if (hit) {
      const l = Math.hypot(hx, hz) || 1, nX = hx / l, nZ = hz / l;
      const vn = this.vx * nX + this.vz * nZ;
      if (vn < 0) {
        this.vx -= 1.35 * vn * nX; this.vz -= 1.35 * vn * nZ;
        const imp = -vn;
        if (imp > 6) { this.damage((imp - 6) * 3.5, this.driver === 'player'); this.G.audio.impact(imp, this.x, this.z); }
      }
    }
    this.sync();
  }

  update(dt) {
    const G = this.G;
    if (this.state === 'burning') {
      this.burnT -= dt;
      if ((this.fxT -= dt) <= 0) { this.fxT = 0.06; G.effects.emit('fire', this.x, 1.2, this.z, 2); }
      if (this.burnT <= 0) this.explode();
    } else if (this.state === 'wreck') {
      this.wreckT += dt;
      if (this.wreckT < 20 && (this.fxT -= dt) <= 0) { this.fxT = 0.25; G.effects.emit('smoke', this.x, 1.5, this.z, 1); }
    } else if (this.hp < this.spec.hp * 0.4 && (this.fxT -= dt) <= 0) {
      const sh = Math.sin(this.h), ch = Math.cos(this.h), hl = this.spec.len / 2 - 0.6;
      this.fxT = 0.18;
      G.effects.emit('smoke', this.x + sh * hl, 1.3, this.z + ch * hl, 1);
    }
    if (this.driver === 'ai' && this.ai && this.state === 'ok') this.aiUpdate(dt);
    else if (this.driver !== 'player') { this.throttle = 0; this.steer = 0; this.handbrake = true; }
    if (this.hornT > 0) this.hornT -= dt;
    if (this.speed > 0.01 || this.throttle !== 0) {
      this.physics(dt);
      this.move(dt);
    }
    if (this.lR) {
      const on = this.siren && Math.floor(G.time * 6) % 2 === 0;
      this.lR.material = this.siren ? (on ? redLight : offLight) : offLight;
      this.lB.material = this.siren ? (on ? offLight : blueLight) : offLight;
    }
  }

  // ------------------------------------------------------------ IA
  setTraffic(cruise) {
    const W = this.G.world;
    const p = W.nearestEdgePoint(this.x, this.z);
    const e = p.e;
    const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z;
    const forward = dx * Math.sin(this.h) + dz * Math.cos(this.h) > 0;
    this.ai = { mode: 'traffic', from: forward ? e.a : e.b, to: forward ? e.b : e.a, edge: e, next: null, cruise, blockT: 0, ignoreT: 0 };
    this.driver = 'ai';
  }

  chooseNext(from, to, mode) {
    let opts = to.adj.filter((a) => a.n !== from);
    if (!opts.length) return { n: from, e: to.adj[0].e };
    if (mode === 'flee') {
      const P = this.G.player.pos();
      opts.sort((a, b) => ((b.n.x - P.x) ** 2 + (b.n.z - P.z) ** 2) - ((a.n.x - P.x) ** 2 + (a.n.z - P.z) ** 2));
      return Math.random() < 0.8 ? opts[0] : pick(opts);
    }
    if (mode === 'route' && this.ai.route && this.ai.route.length) {
      const want = this.ai.route[0];
      const o = to.adj.find((a) => a.n === want);
      if (o) return o;
    }
    return pick(opts);
  }

  // Suivi de voie (circulation à droite) le long du graphe routier.
  laneTarget(dt) {
    const a = this.ai;
    let e = a.edge;
    for (let guard = 0; guard < 3; guard++) {
      const dx = (a.to.x - a.from.x) / e.len, dz = (a.to.z - a.from.z) / e.len;
      const along = (this.x - a.from.x) * dx + (this.z - a.from.z) * dz;
      if (!a.next) a.next = this.chooseNext(a.from, a.to, a.mode);
      if (e.len - along < a.to.hw + 1.5) {
        if (a.mode === 'route' && a.route && a.route[0] === a.next.n) a.route.shift();
        if (a.mode === 'route' && a.route && !a.route.length) a.mode = 'traffic';
        a.from = a.to; a.to = a.next.n; a.edge = e = a.next.e; a.next = null;
        continue;
      }
      const off = e.w / 4;
      const la = along + 7 + Math.abs(this.fwdSpeed) * 0.45;
      const n = a.next, e2 = n.e;
      const d2x = (n.n.x - a.to.x) / e2.len, d2z = (n.n.z - a.to.z) / e2.len;
      let tx, tz;
      if (la < e.len) { tx = a.from.x + dx * la - dz * off; tz = a.from.z + dz * la + dx * off; }
      else {
        const over = la - e.len, off2 = e2.w / 4;
        tx = a.to.x + d2x * over - d2z * off2; tz = a.to.z + d2z * over + d2x * off2;
      }
      const turn = dx * d2x + dz * d2z;
      let ts = a.cruise;
      if (turn < 0.7 && e.len - along < 28) ts = Math.min(ts, turn < -0.5 ? 4 : 7.5);
      return { tx, tz, ts };
    }
    return { tx: this.x, tz: this.z, ts: 0 };
  }

  obstacleAhead() {
    const G = this.G, sh = Math.sin(this.h), ch = Math.cos(this.h);
    const reach = this.spec.len / 2 + 4 + Math.abs(this.fwdSpeed) * 0.9;
    const test = (x, z, w) => {
      const dx = x - this.x, dz = z - this.z;
      const lz = dx * sh + dz * ch;
      if (lz <= 0 || lz > reach) return false;
      const lx = dx * ch - dz * sh;
      return Math.abs(lx) < 1.3 + w;
    };
    for (const v of G.traffic.list) {
      if (v === this) continue;
      if (Math.abs(v.x - this.x) > 25 || Math.abs(v.z - this.z) > 25) continue;
      if (test(v.x, v.z, v.spec.wid / 2)) return true;
    }
    for (const p of G.peds.list) {
      if (p.mode === 'dead' || p.attached) continue;
      if (Math.abs(p.x - this.x) > 20 || Math.abs(p.z - this.z) > 20) continue;
      if (test(p.x, p.z, 0.3)) return true;
    }
    const pl = G.player;
    if (!pl.vehicle && test(pl.x, pl.z, 0.4)) return true;
    return false;
  }

  aiUpdate(dt) {
    const G = this.G, a = this.ai;
    if (a.mode === 'parked') { this.throttle = 0; this.handbrake = true; return; }
    if (this.crippled) { this.throttle = 0; this.handbrake = true; this.steer = 0; this.siren = false; return; }
    let tx, tz, ts;
    const P = G.player.pos();
    if (a.mode === 'chase') {
      const pv = G.player.vehicle;
      const d = Math.hypot(P.x - this.x, P.z - this.z);
      if (d < 45) {
        tx = P.x + (pv ? pv.vx * 0.6 : 0); tz = P.z + (pv ? pv.vz * 0.6 : 0);
        ts = !pv && d < 12 ? 0 : this.spec.max;
      } else {
        a.repath = (a.repath || 0) - dt;
        if (a.repath <= 0 || !a.path) {
          const W = G.world;
          a.path = W.path(W.nearestNode(this.x, this.z), W.nearestNode(P.x, P.z));
          a.pi = 0; a.repath = 1.5;
        }
        let wp = a.path[a.pi];
        while (wp && a.pi < a.path.length - 1 && Math.hypot(wp.x - this.x, wp.z - this.z) < 9) wp = a.path[++a.pi];
        tx = wp.x; tz = wp.z; ts = this.spec.max * 0.9;
        const nx = a.path[a.pi + 1];
        if (nx) {
          const d1x = wp.x - this.x, d1z = wp.z - this.z, l1 = Math.hypot(d1x, d1z) || 1;
          const d2x = nx.x - wp.x, d2z = nx.z - wp.z, l2 = Math.hypot(d2x, d2z) || 1;
          if ((d1x * d2x + d1z * d2z) / (l1 * l2) < 0.6 && l1 < 30) ts = 11;
        }
      }
    } else {
      const lt = this.laneTarget(dt);
      tx = lt.tx; tz = lt.tz; ts = lt.ts;
    }
    if (this.revT > 0) {
      this.revT -= dt;
      this.throttle = -0.8;
      this.steer = -this.revSteer;
      this.handbrake = false;
      return;
    }
    const desired = Math.atan2(tx - this.x, tz - this.z);
    const diff = wrapAngle(desired - this.h);
    this.steer = clamp(diff * 2.4, -1, 1);
    if (Math.abs(diff) > 0.6) ts = Math.min(ts, a.mode === 'chase' ? 14 : 8);
    if (a.mode === 'traffic' || a.mode === 'route') {
      if (a.ignoreT > 0) a.ignoreT -= dt;
      else if (this.obstacleAhead()) {
        ts = 0; a.blockT += dt;
        if (a.blockT > 3.5 && this.hornT <= 0) { this.hornT = 3; G.audio.horn(this.x, this.z); }
        if (a.blockT > 7) { a.ignoreT = 2.5; a.blockT = 0; }
      } else a.blockT = 0;
    }
    const fwd = this.fwdSpeed;
    this.throttle = clamp((ts - fwd) * 0.45, -1, 1);
    this.handbrake = false;
    if (Math.abs(fwd) < 0.8 && this.throttle > 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 1.4) { this.revT = 1.2; this.revSteer = Math.sign(diff) || 1; this.stuckT = 0; }
    } else this.stuckT = 0;
  }
}

// ---------------------------------------------------------------------------
// Gestion de la circulation et des collisions entre véhicules
// ---------------------------------------------------------------------------
export class Traffic {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.hitCd = 0;
  }

  add(v) { this.list.push(v); return v; }

  remove(v) {
    v.dispose();
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
  }

  spawnParked() {
    for (const s of this.G.world.parkedSpots) {
      const v = this.add(new Vehicle(this.G, s.type, null, s.x, s.z, s.h));
      v.persistent = true;
      v.ai = { mode: 'parked' };
    }
  }

  spawnTraffic(near = false) {
    const G = this.G, W = G.world, P = G.player.pos();
    for (let k = 0; k < 8; k++) {
      const e = W.edges[Math.floor(Math.random() * W.edges.length)];
      const usable = e.len - e.a.hw - e.b.hw - 12;
      if (usable < 6) continue;
      const t = e.a.hw + 6 + Math.random() * usable;
      const fwd = Math.random() < 0.5;
      const from = fwd ? e.a : e.b, to = fwd ? e.b : e.a;
      const dx = (to.x - from.x) / e.len, dz = (to.z - from.z) / e.len;
      const tt = fwd ? t : e.len - t, off = e.w / 4;
      const x = from.x + dx * tt - dz * off, z = from.z + dz * tt + dx * off;
      const d = Math.hypot(x - P.x, z - P.z);
      if (near ? d < 40 || d > 200 : d < 110 || d > 260) continue;
      if (this.list.some((v) => Math.abs(v.x - x) < 10 && Math.abs(v.z - z) < 10)) continue;
      const district = districtAt(x, z);
      const type = weighted(TRAFFIC_MIX[district]);
      const v = this.add(new Vehicle(G, type, null, x, z, Math.atan2(dx, dz)));
      const cruise = CRUISE[district] * rand(0.85, 1.2);
      v.ai = { mode: 'traffic', from, to, edge: e, next: null, cruise, blockT: 0, ignoreT: 0 };
      v.driver = 'ai';
      v.vx = dx * cruise * 0.7; v.vz = dz * cruise * 0.7;
      return v;
    }
    return null;
  }

  update(dt) {
    const G = this.G, P = G.player.pos();
    const district = districtAt(P.x, P.z);
    const target = Math.round(({ adjame: 26, plateau: 24, cocody: 18, banco: 8 }[district] || 18) * (1 - 0.35 * G.sky.night));
    let n = 0;
    for (const v of this.list) if (v.ai && v.ai.mode === 'traffic' && !v.mission && !v.persistent) n++;
    if (n < target) this.spawnTraffic();

    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      const d = Math.hypot(v.x - P.x, v.z - P.z);
      const keep = v.mission || v.persistent || v.driver === 'player' || v === G.player.vehicle;
      if (!keep && (d > 330 || (v.state === 'wreck' && d > 160 && v.wreckT > 5))) { this.remove(v); continue; }
      v.mesh.visible = d < 520;
      v.update(dt);
    }
    this.collide(dt);
  }

  collide(dt) {
    const G = this.G, L = this.list;
    this.hitCd -= dt;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (Math.abs(a.x - b.x) > 9 || Math.abs(a.z - b.z) > 9) continue;
        const ra = a.spec.wid / 2, rb = b.spec.wid / 2;
        const oa = a.spec.len / 2 - ra, ob = b.spec.len / 2 - rb;
        const sa = Math.sin(a.h), ca = Math.cos(a.h), sb = Math.sin(b.h), cb = Math.cos(b.h);
        for (const ka of [-1, 1]) for (const kb of [-1, 1]) {
          const ax = a.x + sa * oa * ka, az = a.z + ca * oa * ka, bx = b.x + sb * ob * kb, bz = b.z + cb * ob * kb;
          let dx = bx - ax, dz = bz - az;
          const d = Math.hypot(dx, dz), min = ra + rb;
          if (d >= min || d < 1e-6) continue;
          dx /= d; dz /= d;
          const ma = a.spec.mass, mb = b.spec.mass, pen = min - d;
          a.x -= dx * pen * mb / (ma + mb); a.z -= dz * pen * mb / (ma + mb);
          b.x += dx * pen * ma / (ma + mb); b.z += dz * pen * ma / (ma + mb);
          const vn = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
          if (vn < 0) {
            const jimp = (-1.3 * vn) / (1 / ma + 1 / mb);
            a.vx -= (jimp / ma) * dx; a.vz -= (jimp / ma) * dz;
            b.vx += (jimp / mb) * dx; b.vz += (jimp / mb) * dz;
            const imp = -vn;
            if (imp > 5) {
              const byP = a.driver === 'player' || b.driver === 'player';
              a.damage((imp - 5) * 3 * (mb / ma), byP && b.driver === 'player');
              b.damage((imp - 5) * 3 * (ma / mb), byP && a.driver === 'player');
              G.audio.impact(imp, a.x, a.z);
              if (byP && this.hitCd <= 0) {
                this.hitCd = 1;
                const other = a.driver === 'player' ? b : a;
                if (other.isCop) G.police.crime(0.5, other.x, other.z, true);
                else if (other.driver === 'ai' && imp > 9) G.police.crime(0.2, other.x, other.z, false);
              }
            }
          }
          a.sync(); b.sync();
        }
      }
    }
    // Véhicules contre piétons
    for (const v of L) {
      const sp = v.speed;
      if (sp < 4) continue;
      for (const p of G.peds.list) {
        if (p.mode === 'dead' || p.attached) continue;
        if (Math.abs(p.x - v.x) > 6 || Math.abs(p.z - v.z) > 6) continue;
        const { lx, lz } = v.local(p.x, p.z);
        if (Math.abs(lx) < v.spec.wid / 2 + 0.35 && Math.abs(lz) < v.spec.len / 2 + 0.35) {
          if (p.mission && p.protect) { p.x += v.vx * 0.05; p.z += v.vz * 0.05; continue; }
          G.peds.kill(p, v.vx * 0.8, v.vz * 0.8, v.driver === 'player');
          G.audio.impact(sp, p.x, p.z);
          v.vx *= 0.92; v.vz *= 0.92;
        }
      }
    }
  }
}
