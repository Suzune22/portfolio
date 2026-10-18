import { Vehicle } from './vehicles.js';

// Niveau de recherche (0 à 5 étoiles), patrouilles de poursuite, arrestation.
const UNITS = [0, 2, 3, 4, 6, 7];

export class Police {
  constructor(G) {
    this.G = G;
    this.heat = 0;
    this.units = [];
    this.lastSeen = { x: 0, z: 0 };
    this.seen = false;
    this.unseenT = 0;
    this.bustT = 0;
    this.spawnT = 0;
  }

  get level() { return Math.floor(this.heat); }
  get searchRadius() { return 90 + 30 * this.level; }

  copNear(x, z, r) {
    for (const v of this.G.traffic.list) {
      if (v.isCop && !v.dead && (v.x - x) ** 2 + (v.z - z) ** 2 < r * r) return true;
    }
    return false;
  }

  // Un délit : signalé d'office (always) ou seulement si un policier est témoin.
  crime(amount, x, z, always = false) {
    const G = this.G;
    if (G.cutscene || G.player.dead) return;
    if (!always && !this.copNear(x, z, 65)) return;
    const before = this.level;
    this.heat = before === 0 ? Math.max(1, amount * 2) : this.heat + amount;
    this.heat = Math.min(5.99, this.heat);
    this.seen = true;
    this.unseenT = 0;
    this.lastSeen = G.player.pos();
    if (this.level > before) G.hud.flashStars();
  }

  set(level) {
    this.heat = Math.max(this.heat, level + 0.01);
    this.seen = true; this.unseenT = 0;
    this.lastSeen = this.G.player.pos();
    this.G.hud.flashStars();
  }

  clear() {
    this.heat = 0;
    this.bustT = 0;
    for (const v of this.units) {
      v.siren = false;
      if (!v.dead) v.setTraffic(12);
    }
    this.units = [];
  }

  spawnUnit() {
    const G = this.G, W = G.world, P = G.player.pos();
    for (let k = 0; k < 10; k++) {
      const e = W.edges[Math.floor(Math.random() * W.edges.length)];
      const t = Math.random() * e.len;
      const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len;
      const x = e.a.x + dx * t - dz * e.w / 4, z = e.a.z + dz * t + dx * e.w / 4;
      const d = Math.hypot(x - P.x, z - P.z);
      if (d < 100 || d > 190) continue;
      if (G.traffic.list.some((v) => Math.abs(v.x - x) < 8 && Math.abs(v.z - z) < 8)) continue;
      const v = G.traffic.add(new Vehicle(G, 'police', null, x, z, Math.atan2(P.x - x, P.z - z)));
      v.driver = 'ai';
      v.ai = { mode: 'chase' };
      v.siren = true;
      this.units.push(v);
      return v;
    }
    return null;
  }

  update(dt) {
    const G = this.G, pl = G.player;
    this.units = this.units.filter((v) => G.traffic.list.includes(v));
    const L = this.level;
    if (L === 0) {
      if (this.units.length) this.clear();
      G.audio.siren(0);
      return;
    }
    const P = pl.pos();
    // Vu par la police ?
    const R = 55 + 15 * L;
    this.seen = false;
    let nearest = Infinity;
    for (const v of this.units) {
      if (v.dead) continue;
      const d = Math.hypot(v.x - P.x, v.z - P.z);
      nearest = Math.min(nearest, d);
      if (d < R) this.seen = true;
    }
    if (this.seen) { this.lastSeen = P; this.unseenT = 0; }
    else {
      const out = Math.hypot(P.x - this.lastSeen.x, P.z - this.lastSeen.z) > this.searchRadius;
      this.unseenT += dt * (out ? 1.6 : 0.6);
      if (this.unseenT > 8 + 2 * L) {
        this.clear();
        G.hud.toast('Tu as semé la police');
        G.audio.siren(0);
        return;
      }
    }
    // Renforts
    this.spawnT -= dt;
    const alive = this.units.filter((v) => !v.dead).length;
    if (alive < UNITS[L] && this.spawnT <= 0) { this.spawnUnit(); this.spawnT = 1.2; }
    // Tirs à partir de 2 étoiles
    if (L >= 2 && !pl.dead) {
      for (const v of this.units) {
        if (v.dead || v.crippled) continue;
        const d = Math.hypot(v.x - P.x, v.z - P.z);
        if (d > 38) continue;
        v.shootT = (v.shootT ?? Math.random()) - dt;
        if (v.shootT > 0) continue;
        v.shootT = 1.4 - L * 0.12 + Math.random() * 0.6;
        if (G.world.rayCast(v.x, 1.3, v.z, (P.x - v.x) / d, 0, (P.z - v.z) / d, d) < d - 1) continue;
        const hit = Math.random() < 0.22 + 0.05 * L - (pl.vehicle ? 0.08 : 0);
        const ox = hit ? 0 : (Math.random() - 0.5) * 3, oz = hit ? 0 : (Math.random() - 0.5) * 3;
        G.effects.tracer(v.x, 1.4, v.z, P.x + ox, 1.2, P.z + oz);
        G.audio.gunshot(v.x, v.z, 0.7);
        if (hit) {
          if (pl.vehicle) pl.vehicle.damage(6, false);
          pl.hurt(pl.vehicle ? 3 : 6, 'police');
        }
      }
    }
    // Arrestation : à pied, peu d'étoiles, une voiture de police à l'arrêt tout près
    let busting = false;
    if (!pl.vehicle && !pl.dead && L <= 2) {
      for (const v of this.units) {
        if (!v.dead && v.speed < 3 && Math.hypot(v.x - P.x, v.z - P.z) < 8) busting = true;
      }
    }
    this.bustT = busting ? this.bustT + dt : Math.max(0, this.bustT - dt);
    if (this.bustT > 2.6) { this.bustT = 0; G.busted(); }
    G.audio.siren(nearest < 250 ? 1 - nearest / 250 : 0);
  }
}
