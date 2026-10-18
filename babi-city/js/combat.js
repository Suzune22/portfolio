import * as THREE from 'three';

// Tirs, explosions et objets à ramasser.
export class Combat {
  constructor(G) { this.G = G; }

  // Rayon de tir : renvoie la cible touchée la plus proche (piéton, véhicule ou mur).
  ray(ox, oy, oz, dx, dy, dz, maxT, ignoreVeh = null) {
    const G = this.G;
    let best = G.world.rayCast(ox, oy, oz, dx, dy, dz, maxT), hit = null;
    for (const p of G.peds.list) {
      if (p.mode === 'dead' || p.attached) continue;
      const cx = p.x - ox, cy = p.y + 1.1 - oy, cz = p.z - oz;
      const t = cx * dx + cy * dy + cz * dz;
      if (t < 0 || t > best) continue;
      const px = cx - dx * t, py = cy - dy * t, pz = cz - dz * t;
      if (px * px + (py * py) * 0.35 + pz * pz < 0.2) { best = t; hit = { kind: 'ped', p }; }
    }
    for (const v of G.traffic.list) {
      if (v === ignoreVeh) continue;
      const lo = v.local(ox, oz);
      const s = Math.sin(v.h), c = Math.cos(v.h);
      const ldx = dx * c - dz * s, ldz = dx * s + dz * c;
      let t0 = 0, t1 = best, ok = true;
      const slab = (o, d, lo2, hi) => {
        if (Math.abs(d) < 1e-9) { if (o < lo2 || o > hi) ok = false; return; }
        let a = (lo2 - o) / d, b = (hi - o) / d;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) ok = false;
      };
      slab(lo.lx, ldx, -v.spec.wid / 2, v.spec.wid / 2);
      if (ok) slab(lo.lz, ldz, -v.spec.len / 2, v.spec.len / 2);
      if (ok) slab(oy, dy, 0, v.spec.h);
      if (ok && t0 < best) { best = t0; hit = { kind: 'veh', v }; }
    }
    return { t: best, hit };
  }

  blast(x, z, r, byPlayer, source) {
    const G = this.G;
    G.peds.panic(x, z, 60);
    G.camera.shake = Math.max(G.camera.shake, 0.8 * Math.max(0, 1 - Math.hypot(G.player.x - x, G.player.z - z) / 60));
    for (const p of G.peds.list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < r && p.mode !== 'dead') G.peds.kill(p, (p.x - x) / (d || 1) * 8, (p.z - z) / (d || 1) * 8, byPlayer);
    }
    for (const v of G.traffic.list) {
      if (v === source) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < r) {
        v.damage(120 * (1 - d / r), byPlayer);
        v.vx += (v.x - x) / (d || 1) * 6; v.vz += (v.z - z) / (d || 1) * 6;
      }
    }
    const pl = G.player;
    const d = Math.hypot(pl.x - x, pl.z - z);
    if (pl.vehicle === source) pl.hurt(250, 'explosion');
    else if (d < r) pl.hurt(90 * (1 - d / r), 'explosion');
  }
}

export class Pickups {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.cashGeo = new THREE.BoxGeometry(0.5, 0.25, 0.3);
    this.cashMat = new THREE.MeshLambertMaterial({ color: '#2ecc71', emissive: '#145a32' });
    this.hpMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#550000' });
    this.crossMat = new THREE.MeshBasicMaterial({ color: '#e74c3c' });
    this.armorMat = new THREE.MeshLambertMaterial({ color: '#2e86de', emissive: '#0b2545' });
  }

  add(kind, x, z, amount, respawn = 0) {
    let m;
    if (kind === 'cash') m = new THREE.Mesh(this.cashGeo, this.cashMat);
    else if (kind === 'health') {
      m = new THREE.Group();
      m.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), this.hpMat));
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.4), this.crossMat);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.15), this.crossMat);
      m.add(c1, c2);
    } else m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), this.armorMat);
    m.position.set(x, 0.6, z);
    this.G.scene.add(m);
    const p = { kind, x, z, amount, m, respawn, wait: 0 };
    this.list.push(p);
    return p;
  }

  cash(x, z, amount) { const p = this.add('cash', x, z, amount); p.ttl = 30; }

  update(dt) {
    const G = this.G, pl = G.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.wait > 0) { p.wait -= dt; p.m.visible = p.wait <= 0; continue; }
      p.m.rotation.y += dt * 2;
      p.m.position.y = 0.6 + Math.sin(G.time * 3 + i) * 0.1;
      if (p.ttl !== undefined && (p.ttl -= dt) <= 0) { G.scene.remove(p.m); this.list.splice(i, 1); continue; }
      if (pl.dead || pl.vehicle) continue;
      if ((pl.x - p.x) ** 2 + (pl.z - p.z) ** 2 < 1.6) {
        if (p.kind === 'cash') { pl.addMoney(p.amount); G.hud.toast(`+${p.amount} FCFA`); }
        else if (p.kind === 'health') { if (pl.health >= 100) continue; pl.health = 100; G.hud.toast('Santé restaurée'); }
        else { if (pl.armor >= 100) continue; pl.armor = 100; G.hud.toast('Gilet pare-balles'); }
        G.audio.pickup();
        if (p.respawn) { p.wait = p.respawn; p.m.visible = false; }
        else { G.scene.remove(p.m); this.list.splice(i, 1); }
      }
    }
  }
}
