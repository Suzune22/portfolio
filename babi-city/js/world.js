import * as THREE from 'three';
import { Batch } from './geo.js';
import { rng, pointInPoly } from './util.js';
import { facade, FACADE_TILE, signTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Carte : x vers l'est, z vers le sud (le nord est en haut de la minimap).
// Adjamé au nord-ouest, le Plateau au sud-ouest (presqu'île), Cocody à l'est,
// séparés par la baie de Cocody et bordés par la lagune Ébrié.
// ---------------------------------------------------------------------------
export const BOUNDS = { x0: -700, x1: 800, z0: -750, z1: 620 };

export const COAST = [
  [-700, -750], [800, -750], [800, 560], [230, 560], [225, 300], [215, 100], [230, -40],
  [150, -80], [60, -60], [45, 100], [40, 300], [-20, 370], [-200, 380], [-380, 340],
  [-430, 200], [-430, -60], [-470, -120], [-700, -180],
];

// Routes est-ouest (rows) et nord-sud (cols). w = largeur de la chaussée.
export const ROWS = [
  { z: -670, x0: -380, x1: 700, w: 14 },
  { z: -580, x0: -380, x1: 70, w: 12 },
  { z: -490, x0: -380, x1: 700, w: 14 },
  { z: -400, x0: -380, x1: 70, w: 12 },
  { z: -310, x0: -560, x1: 700, w: 14 },
  { z: -220, x0: -380, x1: 70, w: 12 },
  { z: -120, x0: -380, x1: 700, w: 18 },
  { z: -30, x0: -380, x1: -20, w: 12 },
  { z: 20, x0: 280, x1: 700, w: 12 },
  { z: 60, x0: -380, x1: -20, w: 12 },
  { z: 150, x0: -380, x1: 700, w: 16 },
  { z: 240, x0: -380, x1: -20, w: 12 },
  { z: 300, x0: 280, x1: 700, w: 12 },
  { z: 320, x0: -380, x1: -20, w: 12 },
  { z: 450, x0: 280, x1: 700, w: 12 },
];
export const COLS = [
  { x: -380, z0: -670, z1: 320, w: 12 },
  { x: -290, z0: -670, z1: 320, w: 12 },
  { x: -200, z0: -670, z1: 590, w: 18 },
  { x: -110, z0: -670, z1: 320, w: 12 },
  { x: -20, z0: -670, z1: 320, w: 14 },
  { x: 70, z0: -670, z1: -120, w: 12 },
  { x: 280, z0: -670, z1: 450, w: 14 },
  { x: 420, z0: -670, z1: 450, w: 12 },
  { x: 560, z0: -670, z1: 450, w: 12 },
  { x: 700, z0: -670, z1: 450, w: 12 },
];

export const SIDEWALK = 3.5;
const CELL = 24;

export const DISTRICT_NAMES = {
  adjame: 'Adjamé', plateau: 'Le Plateau', cocody: 'Cocody', banco: 'Forêt du Banco', lagune: 'Lagune Ébrié',
};

export function districtAt(x, z) {
  if (x < -395 && z < -190) return 'banco';
  if (x >= 120) return 'cocody';
  if (z < -165) return 'adjame';
  return 'plateau';
}

const ROOF = (hex, k = 0.72) => new THREE.Color(hex).multiplyScalar(k);

export class World {
  constructor(scene) {
    this.scene = scene;
    this.r = rng(20261018);
    this.boxes = [];
    this.cells = new Map();
    this.stamp = 0;
    this.noBuild = [];
    this.labels = [];
    this.places = {};
    this.parkedSpots = [];
    this.windowMats = [];
    this.B = { glass: new Batch(), office: new Batch(), block: new Batch(), villa: new Batch(), plain: new Batch() };

    this.buildGraph();
    this.buildWalkGrid();
    this.buildGround();
    this.buildWater();
    this.buildRoads();
    this.buildLandmarks();
    this.buildBuildings();
    this.buildTrees();
    this.buildProps();
    this.flushBatches();
    this.buildMinimapCanvas();
  }

  // ------------------------------------------------------------ graphe routier
  buildGraph() {
    const nodes = [], map = new Map(), edges = [];
    const node = (x, z) => {
      const k = x + ',' + z;
      let n = map.get(k);
      if (!n) { n = { id: nodes.length, x, z, adj: [] }; nodes.push(n); map.set(k, n); }
      return n;
    };
    const link = (a, b, w) => {
      if (a === b) return;
      const e = { id: edges.length, a, b, w, len: Math.hypot(b.x - a.x, b.z - a.z), horiz: a.z === b.z };
      edges.push(e);
      a.adj.push({ e, n: b });
      b.adj.push({ e, n: a });
    };
    for (const r of ROWS) {
      const xs = new Set([r.x0, r.x1]);
      for (const c of COLS) if (c.x >= r.x0 && c.x <= r.x1 && r.z >= c.z0 && r.z <= c.z1) xs.add(c.x);
      const arr = [...xs].sort((a, b) => a - b);
      for (let i = 0; i < arr.length - 1; i++) link(node(arr[i], r.z), node(arr[i + 1], r.z), r.w);
    }
    for (const c of COLS) {
      const zs = new Set([c.z0, c.z1]);
      for (const r of ROWS) if (r.z >= c.z0 && r.z <= c.z1 && c.x >= r.x0 && c.x <= r.x1) zs.add(r.z);
      const arr = [...zs].sort((a, b) => a - b);
      for (let i = 0; i < arr.length - 1; i++) link(node(c.x, arr[i]), node(c.x, arr[i + 1]), c.w);
    }
    for (const n of nodes) n.hw = Math.max(...n.adj.map((a) => a.e.w)) / 2;
    for (const e of edges) {
      // Rectangle de chaussée (prolongé jusqu'au milieu des carrefours).
      const ea = e.a.hw, eb = e.b.hw;
      if (e.horiz) {
        const xa = Math.min(e.a.x, e.b.x), xb = Math.max(e.a.x, e.b.x);
        const ext0 = e.a.x < e.b.x ? ea : eb, ext1 = e.a.x < e.b.x ? eb : ea;
        e.rect = [xa - ext0, e.a.z - e.w / 2, xb + ext1, e.a.z + e.w / 2];
      } else {
        const za = Math.min(e.a.z, e.b.z), zb = Math.max(e.a.z, e.b.z);
        const ext0 = e.a.z < e.b.z ? ea : eb, ext1 = e.a.z < e.b.z ? eb : ea;
        e.rect = [e.a.x - e.w / 2, za - ext0, e.a.x + e.w / 2, zb + ext1];
      }
    }
    this.nodes = nodes;
    this.edges = edges;
  }

  nearestNode(x, z, filter) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (filter && !filter(n)) continue;
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // Projection sur la route la plus proche.
  nearestEdgePoint(x, z) {
    let best = null, bd = Infinity;
    for (const e of this.edges) {
      const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z;
      let t = ((x - e.a.x) * dx + (z - e.a.z) * dz) / (e.len * e.len);
      t = Math.max(0, Math.min(1, t));
      const px = e.a.x + dx * t, pz = e.a.z + dz * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = { e, t, x: px, z: pz, d: Math.sqrt(d) }; }
    }
    return best;
  }

  // Plus court chemin (Dijkstra) entre deux nœuds.
  path(from, to) {
    const N = this.nodes.length;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    dist[from.id] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to.id) break;
      done[u] = 1;
      for (const a of this.nodes[u].adj) {
        const nd = dist[u] + a.e.len;
        if (nd < dist[a.n.id]) { dist[a.n.id] = nd; prev[a.n.id] = u; }
      }
    }
    if (from !== to && prev[to.id] < 0) return [from];
    const out = [];
    for (let v = to.id; v >= 0; v = prev[v]) { out.push(this.nodes[v]); if (v === from.id) break; }
    return out.reverse();
  }

  // ------------------------------------------------------------ grille de marche
  // bit 1 = terre ferme, bit 2 = route ou trottoir (y compris sur les ponts).
  buildWalkGrid() {
    const s = 2, nx = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / s), nz = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / s);
    const a = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      const z = BOUNDS.z0 + (j + 0.5) * s;
      // Intersections du polygone côtier avec la ligne : remplissage par segments.
      const xs = [];
      for (let i = 0, k = COAST.length - 1; i < COAST.length; k = i++) {
        const [xi, zi] = COAST[i], [xk, zk] = COAST[k];
        if ((zi > z) !== (zk > z)) xs.push(((xk - xi) * (z - zi)) / (zk - zi) + xi);
      }
      xs.sort((p, q) => p - q);
      for (let m = 0; m + 1 < xs.length; m += 2) {
        const i0 = Math.max(0, Math.ceil((xs[m] - BOUNDS.x0) / s - 0.5));
        const i1 = Math.min(nx - 1, Math.floor((xs[m + 1] - BOUNDS.x0) / s - 0.5));
        for (let i = i0; i <= i1; i++) a[j * nx + i] |= 1;
      }
    }
    for (const e of this.edges) {
      const [x0, z0, x1, z1] = e.rect;
      const pad = SIDEWALK;
      const i0 = Math.max(0, Math.floor((x0 - pad - BOUNDS.x0) / s)), i1 = Math.min(nx - 1, Math.floor((x1 + pad - BOUNDS.x0) / s));
      const j0 = Math.max(0, Math.floor((z0 - pad - BOUNDS.z0) / s)), j1 = Math.min(nz - 1, Math.floor((z1 + pad - BOUNDS.z0) / s));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) a[j * nx + i] |= 2;
    }
    this.wg = { s, nx, nz, a };
  }

  cell(x, z) {
    const { s, nx, nz, a } = this.wg;
    const i = Math.floor((x - BOUNDS.x0) / s), j = Math.floor((z - BOUNDS.z0) / s);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return 0;
    return a[j * nx + i];
  }
  isWalkable(x, z) { return this.cell(x, z) !== 0; }
  isLand(x, z) { return (this.cell(x, z) & 1) !== 0; }
  onRoad(x, z) { return (this.cell(x, z) & 2) !== 0; }

  areaName(x, z) {
    if (!this.isLand(x, z)) {
      if (this.onRoad(x, z)) return z > 330 ? 'Pont vers Treichville' : 'Pont de la Baie';
      return DISTRICT_NAMES.lagune;
    }
    return DISTRICT_NAMES[districtAt(x, z)];
  }

  // ------------------------------------------------------------ collisions
  addBox(x0, z0, x1, z1, h, solid = true) {
    const b = { x0, z0, x1, z1, h, s: 0, solid };
    const i = this.boxes.length;
    this.boxes.push(b);
    const c0 = Math.floor((x0 - BOUNDS.x0) / CELL), c1 = Math.floor((x1 - BOUNDS.x0) / CELL);
    const r0 = Math.floor((z0 - BOUNDS.z0) / CELL), r1 = Math.floor((z1 - BOUNDS.z0) / CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) {
      const k = cx * 4096 + cz;
      let l = this.cells.get(k);
      if (!l) this.cells.set(k, (l = []));
      l.push(i);
    }
    return b;
  }

  query(x0, z0, x1, z1, fn) {
    const st = ++this.stamp;
    const c0 = Math.floor((x0 - BOUNDS.x0) / CELL), c1 = Math.floor((x1 - BOUNDS.x0) / CELL);
    const r0 = Math.floor((z0 - BOUNDS.z0) / CELL), r1 = Math.floor((z1 - BOUNDS.z0) / CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) {
      const l = this.cells.get(cx * 4096 + cz);
      if (!l) continue;
      for (const i of l) {
        const b = this.boxes[i];
        if (b.s === st) continue;
        b.s = st;
        if (fn(b) === false) return;
      }
    }
  }

  // Repousse un cercle hors des bâtiments. Renvoie le déplacement à appliquer.
  pushCircle(x, z, r, minH = 0.3) {
    let dx = 0, dz = 0, hit = false;
    this.query(x - r, z - r, x + r, z + r, (b) => {
      if (!b.solid || b.h < minH) return;
      const px = x + dx, pz = z + dz;
      const cx = Math.max(b.x0, Math.min(px, b.x1)), cz = Math.max(b.z0, Math.min(pz, b.z1));
      const ox = px - cx, oz = pz - cz, d2 = ox * ox + oz * oz;
      if (d2 >= r * r) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), p = r - d;
        dx += (ox / d) * p; dz += (oz / d) * p;
      } else {
        const l = px - b.x0, rr = b.x1 - px, t = pz - b.z0, bt = b.z1 - pz, m = Math.min(l, rr, t, bt);
        if (m === l) dx -= l + r; else if (m === rr) dx += rr + r; else if (m === t) dz -= t + r; else dz += bt + r;
      }
      hit = true;
    });
    return hit ? { dx, dz } : null;
  }

  insideBuilding(x, y, z) {
    let inside = false;
    this.query(x, z, x, z, (b) => {
      if (b.solid && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.h) { inside = true; return false; }
    });
    return inside;
  }

  // Rayon contre les bâtiments (tests de dalles 3D). Renvoie la distance d'impact ou maxT.
  rayCast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    const ex = ox + dx * maxT, ez = oz + dz * maxT;
    this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), (b) => {
      if (!b.solid) return;
      let t0 = 0, t1 = best;
      const slab = (o, d, lo, hi) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let a = (lo - o) / d, c = (hi - o) / d;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        return t0 <= t1;
      };
      if (slab(ox, dx, b.x0, b.x1) && slab(oz, dz, b.z0, b.z1) && slab(oy, dy, 0, b.h)) best = Math.min(best, t0);
    });
    return best;
  }

  // ------------------------------------------------------------ helpers placement
  rectOnLand(x0, z0, x1, z1) {
    return pointInPoly(x0, z0, COAST) && pointInPoly(x1, z0, COAST) && pointInPoly(x0, z1, COAST) &&
      pointInPoly(x1, z1, COAST) && pointInPoly((x0 + x1) / 2, (z0 + z1) / 2, COAST);
  }
  rectHitsRoad(x0, z0, x1, z1, m) {
    for (const e of this.edges) {
      const r = e.rect;
      if (x1 > r[0] - m && x0 < r[2] + m && z1 > r[1] - m && z0 < r[3] + m) return true;
    }
    return false;
  }
  rectFree(x0, z0, x1, z1, gap = 1) {
    let free = true;
    this.query(x0 - gap, z0 - gap, x1 + gap, z1 + gap, (b) => {
      if (x1 + gap > b.x0 && x0 - gap < b.x1 && z1 + gap > b.z0 && z0 - gap < b.z1) { free = false; return false; }
    });
    if (!free) return false;
    for (const n of this.noBuild) if (x1 + gap > n[0] && x0 - gap < n[2] && z1 + gap > n[1] && z0 - gap < n[3]) return false;
    return true;
  }

  // Point sur une voie (circulation à droite) le long de la route la plus proche.
  lanePoint(x, z, dirSign = 1) {
    const p = this.nearestEdgePoint(x, z);
    const e = p.e;
    const dx = (e.b.x - e.a.x) / e.len * dirSign, dz = (e.b.z - e.a.z) / e.len * dirSign;
    const off = e.w / 4;
    return { x: p.x - dz * off, z: p.z + dx * off, heading: Math.atan2(dx, dz), edge: e };
  }

  // ------------------------------------------------------------ sol & eau
  buildGround() {
    const s = 8;
    const nx = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / s) + 1, nz = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / s) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    const land = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      land[j * nx + i] = pointInPoly(BOUNDS.x0 + i * s, BOUNDS.z0 + j * s, COAST) ? 1 : 0;
    }
    const tint = {
      adjame: new THREE.Color('#9a7458'), plateau: new THREE.Color('#8f8d85'),
      cocody: new THREE.Color('#5f8a46'), banco: new THREE.Color('#3b5e2f'),
    };
    const sand = new THREE.Color('#cdb98a'), mud = new THREE.Color('#6f6450');
    const c = new THREE.Color();
    const r = rng(77);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = BOUNDS.x0 + i * s, z = BOUNDS.z0 + j * s;
      const isL = land[k];
      let shore = false;
      if (isL) {
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && !land[jj * nx + ii]) shore = true;
        }
      }
      pos[k * 3] = x; pos[k * 3 + 1] = isL ? 0 : -3; pos[k * 3 + 2] = z;
      if (!isL) c.copy(mud);
      else if (shore) c.copy(sand);
      else c.copy(tint[districtAt(x, z)]);
      const n = 0.92 + r() * 0.12;
      col[k * 3] = c.r * n; col[k * 3 + 1] = c.g * n; col[k * 3 + 2] = c.b * n;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = (j + 1) * nx + i, cc = j * nx + i + 1, d = (j + 1) * nx + i + 1;
      idx.push(a, b, cc, cc, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    this.scene.add(m);
  }

  buildWater() {
    const g = new THREE.PlaneGeometry(4000, 4000, 1, 1);
    g.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshPhongMaterial({ color: '#2d6f8c', specular: '#9fc4dd', shininess: 90, transparent: true, opacity: 0.92 });
    const m = new THREE.Mesh(g, this.waterMat);
    m.position.y = -0.6;
    this.scene.add(m);
  }

  // ------------------------------------------------------------ routes
  buildRoads() {
    const side = new Batch(), asph = new Batch(), mark = new Batch(), deck = new Batch();
    const sideCol = new THREE.Color('#b5b0a5'), asphCol = new THREE.Color('#4a4b4f');
    const white = new THREE.Color('#e8e8e0'), concrete = new THREE.Color('#a9a59c'), rail = new THREE.Color('#d8d4c8');
    for (const e of this.edges) {
      const [x0, z0, x1, z1] = e.rect;
      side.flat(x0 - SIDEWALK, z0 - SIDEWALK, x1 + SIDEWALK, z1 + SIDEWALK, 0.05, sideCol);
      asph.flat(x0, z0, x1, z1, 0.1, asphCol);
      // Marquage central en pointillés
      const L = e.len, dx = (e.b.x - e.a.x) / L, dz = (e.b.z - e.a.z) / L;
      const skipA = e.a.adj.length > 2 ? e.a.hw + 3 : 2, skipB = e.b.adj.length > 2 ? e.b.hw + 3 : 2;
      for (let t = skipA; t < L - skipB - 3; t += 7) {
        const cx = e.a.x + dx * (t + 1.5), cz = e.a.z + dz * (t + 1.5);
        const hl = 1.5, hw = 0.13;
        if (e.horiz) mark.flat(cx - hl, cz - hw, cx + hl, cz + hw, 0.14, white);
        else mark.flat(cx - hw, cz - hl, cx + hw, cz + hl, 0.14, white);
      }
      // Passages piétons aux grands carrefours
      for (const [n, sgn] of [[e.a, 1], [e.b, -1]]) {
        if (n.adj.length < 3) continue;
        const off = n.hw + 2;
        const cx = n.x + dx * off * sgn, cz = n.z + dz * off * sgn;
        for (let k = -e.w / 2 + 0.8; k < e.w / 2 - 0.5; k += 1.2) {
          if (e.horiz) mark.flat(cx - 1.2, cz + k, cx + 1.2, cz + k + 0.6, 0.14, white);
          else mark.flat(cx + k, cz - 1.2, cx + k + 0.6, cz + 1.2, 0.14, white);
        }
      }
      // Ponts : tablier, piles et garde-corps au-dessus de l'eau
      let run = null;
      const flush = (tEnd) => {
        if (!run) return;
        const t0 = run, t1 = tEnd;
        const ax = e.a.x + dx * t0, az = e.a.z + dz * t0, bx = e.a.x + dx * t1, bz = e.a.z + dz * t1;
        const hw = e.w / 2 + SIDEWALK;
        const rx0 = Math.min(ax, bx) - (e.horiz ? 0 : hw), rx1 = Math.max(ax, bx) + (e.horiz ? 0 : hw);
        const rz0 = Math.min(az, bz) - (e.horiz ? hw : 0), rz1 = Math.max(az, bz) + (e.horiz ? hw : 0);
        deck.box(rx0, -1.2, rz0, rx1, 0.04, rz1, concrete, { noTop: true, bottom: true });
        if (e.horiz) {
          deck.box(rx0, 0, rz0 - 0.4, rx1, 1.1, rz0, rail); deck.box(rx0, 0, rz1, rx1, 1.1, rz1 + 0.4, rail);
          this.addBox(rx0, rz0 - 0.4, rx1, rz0, 1.1); this.addBox(rx0, rz1, rx1, rz1 + 0.4, 1.1);
        } else {
          deck.box(rx0 - 0.4, 0, rz0, rx0, 1.1, rz1, rail); deck.box(rx1, 0, rz0, rx1 + 0.4, 1.1, rz1, rail);
          this.addBox(rx0 - 0.4, rz0, rx0, rz1, 1.1); this.addBox(rx1, rz0, rx1 + 0.4, rz1, 1.1);
        }
        for (let t = t0 + 12; t < t1 - 6; t += 26) {
          const px = e.a.x + dx * t, pz = e.a.z + dz * t;
          deck.box(px - 2, -6, pz - 2, px + 2, -1.2, pz + 2, concrete);
        }
        run = null;
      };
      for (let t = 0; t <= L; t += 2) {
        const wet = !pointInPoly(e.a.x + dx * t, e.a.z + dz * t, COAST);
        if (wet && run === null) run = t;
        if (!wet && run !== null) flush(t);
      }
      flush(L);
    }
    const mk = (b, color, extra = {}) => {
      const m = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({
        vertexColors: true, polygonOffset: true, polygonOffsetFactor: extra.po ?? -1, polygonOffsetUnits: extra.po ?? -1,
      }));
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    mk(side, null, { po: -1 });
    mk(asph, null, { po: -2 });
    mk(mark, null, { po: -3 });
    const d = new THREE.Mesh(deck.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    d.receiveShadow = true; d.castShadow = true;
    this.scene.add(d);
  }

  // ------------------------------------------------------------ bâtiments
  building(style, x0, z0, x1, z1, h, color, o = {}) {
    const cell = style === 'plain' ? null : FACADE_TILE[style];
    this.B[style].box(x0, 0, z0, x1, h, z1, color, { cell, topColor: o.roof || ROOF(color) });
    if (o.collide !== false) this.addBox(x0, z0, x1, z1, h);
  }

  sign(lines, x, y, z, w, h, rotY, bg, fg, accent) {
    // Deux faces dos à dos : le texte se lit dans le bon sens des deux côtés.
    const tex = signTexture(lines, bg, fg, 512, Math.round(512 * (h / w)), accent);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(w, h);
    const front = new THREE.Mesh(geo, mat), back = new THREE.Mesh(geo, mat);
    back.rotation.y = Math.PI;
    g.add(front, back);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.scene.add(g);
    return g;
  }

  label(name, x, z, kind = 'landmark', dy = 14) { this.labels.push({ name, x, z, kind, dy }); }

  buildLandmarks() {
    const P = this.B.plain;
    // ---- Plateau
    this.building('glass', -268, -8, -232, 28, 150, '#b4cde0');
    P.box(-258, 150, 2, -242, 168, 18, '#d0d8e0');
    P.box(-251, 168, 9, -249, 196, 11, '#e74c3c');
    this.label('Tour Babi', -250, 10);

    this.B.office.hexa([
      [-172, 0, 82], [-128, 0, 82], [-128, 0, 126], [-172, 0, 126],
      [-156, 46, 98], [-144, 46, 98], [-144, 46, 110], [-156, 46, 110],
    ], '#cdb999', { cell: FACADE_TILE.office, topColor: '#9a8a70' });
    this.addBox(-168, 86, -132, 122, 40);
    this.label('La Pyramide', -150, 104);

    // Cathédrale Saint-Paul : nef + tour inclinée
    P.box(-362, 0, 262, -320, 18, 306, '#f1f0ea');
    P.hexa([
      [-362, 18, 262], [-320, 18, 262], [-320, 18, 306], [-362, 18, 306],
      [-341, 30, 262], [-341, 30, 262], [-341, 30, 306], [-341, 30, 306],
    ], '#e3e1d6');
    P.hexa([
      [-318, 0, 296], [-306, 0, 296], [-306, 0, 308], [-318, 0, 308],
      [-334, 72, 280], [-330, 72, 280], [-330, 72, 284], [-334, 72, 284],
    ], '#f7f6f0');
    this.addBox(-362, 262, -320, 306, 30);
    this.addBox(-318, 296, -306, 308, 20);
    this.label('Cathédrale St-Paul', -335, 284, 'landmark', 16);

    this.building('office', -96, -102, -72, -78, 95, '#d9d2c2');
    this.building('office', -62, -70, -38, -46, 84, '#d1cbbd');
    this.label('Cité administrative', -70, -75);

    this.building('block', -272, -102, -238, -80, 11, '#e9e6dc');
    this.sign(['POLICE', 'Commissariat du Plateau'], -255, 8, -79.9, 14, 3.4, 0, '#1f4e9c', '#fff', '#e8e8e8');
    this.noBuild.push([-280, -78, -212, -45]);
    this.places.police = { x: -211, z: -66 };
    this.parkedSpots.push({ type: 'police', x: -258, z: -66, h: Math.PI / 2 }, { type: 'police', x: -242, z: -58, h: Math.PI / 2 });
    this.label('Commissariat', -255, -90, 'police');

    this.building('glass', -276, 258, -234, 300, 42, '#dfcf9a');
    this.sign(['BANQUE LAGUNAIRE', 'Votre argent en sécurité*'], -255, 10, 300.1, 22, 4, 0, '#0c2340', '#f1c40f', '#f1c40f');
    this.label('Banque Lagunaire', -255, 279, 'bank', -14);
    this.places.bank = { x: -195.5, z: 280 };

    // ---- Adjamé
    this.building('block', -182, -386, -118, -328, 9, '#e3b574', { roof: '#2f7d4f' });
    P.hexa([
      [-182, 9, -386], [-118, 9, -386], [-118, 9, -328], [-182, 9, -328],
      [-170, 14, -376], [-130, 14, -376], [-130, 14, -338], [-170, 14, -338],
    ], '#2f7d4f');
    this.sign(['FORUM DES MARCHÉS', 'Adjamé'], -150, 6.5, -327.9, 20, 4, 0, '#2f7d4f', '#fff', '#f1c40f');
    this.label('Forum des Marchés', -150, -357, 'market');
    this.places.forum = { x: -150, z: -312 };

    this.noBuild.push([-104, -575, -26, -496]);
    P.flat(-104, -575, -26, -496, 0.03, '#8a6a4c');
    P.box(-40, 0, -520, -30, 3.2, -510, '#d35400', { topColor: '#7f8c8d' });
    this.addBox(-40, -520, -30, -510, 3.2);
    this.sign(["GARE ROUTIÈRE D'ADJAMÉ", 'Gbaka · Cars · Woro-woro'], -65, 6, -495, 18, 3.6, 0, '#f1c40f', '#1b1b1b', '#1e8449');
    P.box(-74.5, 0, -495.3, -74, 7.8, -494.8, '#555'); P.box(-56, 0, -495.3, -55.5, 7.8, -494.8, '#555');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      this.parkedSpots.push({ type: 'gbaka', x: -92 + i * 14, z: -560 + j * 34, h: j ? Math.PI : 0 });
    }
    this.label('Gare routière', -65, -535, 'bus');

    this.building('plain', -262, -470, -228, -436, 13, '#efe9dc', { roof: '#d6cfbf' });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#2e8b57' }));
    dome.position.set(-245, 13, -453); dome.castShadow = true;
    this.scene.add(dome);
    P.box(-224, 0, -440, -218, 42, -434, '#f4f0e6'); P.box(-225, 42, -441, -217, 45, -433, '#2e8b57');
    P.hexa([[-224, 45, -440], [-218, 45, -440], [-218, 45, -434], [-224, 45, -434],
      [-221, 50, -437], [-221, 50, -437], [-221, 50, -437], [-221, 50, -437]], '#2e8b57');
    this.addBox(-224, -440, -218, -434, 45);
    this.label("Mosquée d'Adjamé", -245, -453, 'mosque', -14);

    this.building('block', -332, -462, -302, -430, 7, '#d8d2c0');
    this.sign(['GARAGE MOUSSA', 'Mécanique générale · Tôlerie'], -301.9, 5.2, -446, 16, 3, Math.PI / 2, '#c0392b', '#fff', '#f1c40f');
    this.places.garage = { x: -293, z: -446 };
    this.label('Garage Moussa', -317, -446, 'garage');

    this.building('block', -97, -632, -80, -612, 6, '#7fb3a6');
    this.places.bakary = { x: -102, z: -622 };

    // ---- Cocody
    this.building('office', 312, -92, 392, -30, 24, '#f2f2f0');
    this.sign(['+ CHU DE COCODY', 'Urgences 24h/24'], 352, 18, -29.9, 22, 4, 0, '#ffffff', '#c0392b', '#c0392b');
    this.places.hospital = { x: 350, z: -108 };
    this.label('CHU de Cocody', 352, -61, 'hospital');

    this.building('office', 440, -292, 540, -272, 14, '#eadcc0');
    this.building('office', 440, -255, 470, -150, 12, '#e5d6b8');
    this.building('office', 505, -250, 540, -150, 16, '#eadcc0');
    P.flat(426, -303, 554, -129, 0.03, '#79a85a');
    this.sign(['UNIVERSITÉ FHB', 'Cocody'], 490, 5, -135, 14, 3, 0, '#1a5276', '#fff', '#f39c12');
    this.places.univ = { x: 490, z: -123 };
    this.label('Université FHB', 490, -215, 'univ');

    this.building('office', 325, 488, 385, 508, 92, '#f4f1e8');
    this.building('block', 300, 510, 420, 530, 14, '#eee7d6');
    this.sign(['HÔTEL IVOIRE'], 355, 86, 487.9, 30, 5, Math.PI, '#0b3d2e', '#f4d03f');
    this.label('Hôtel Ivoire', 355, 505);

    // Villa de Koffi : murs, maison, piscine
    this.building('plain', 590, 190, 665, 192, 2.4, '#efe6d4', { collide: false });
    this.building('plain', 590, 260, 665, 262, 2.4, '#efe6d4', { collide: false });
    this.building('plain', 590, 190, 592, 262, 2.4, '#efe6d4', { collide: false });
    this.building('plain', 663, 190, 665, 262, 2.4, '#efe6d4', { collide: false });
    this.addBox(590, 190, 665, 262, 2.4);
    this.building('villa', 605, 200, 648, 236, 8, '#f6f0e3', { collide: false, roof: '#b9b2a4' });
    P.flat(612, 240, 640, 254, 0.06, '#2fb3d6');
    this.places.koffi = { x: 568, z: 226 };
    this.label('Villa de Koffi', 627, 226, 'home');

    // Campement de Séry, en lisière du Banco
    this.building('plain', -602, -332, -584, -318, 3.6, '#7a6a55', { roof: '#9aa0a3' });
    this.building('plain', -606, -312, -596, -298, 2.6, '#cfd6d8', { roof: '#a8b0b3' });
    this.noBuild.push([-620, -340, -560, -290]);
    this.places.sery = { x: -556, z: -319 };
    this.label('Campement de Séry', -592, -322, 'home');

    // Pont fermé vers Treichville
    for (let i = 0; i < 6; i++) P.box(-209 + i * 3, 0, 581, -207.6 + i * 3, 1.2, 582, i % 2 ? '#ffffff' : '#c0392b');
    P.box(-210, 1.0, 581, -190, 1.3, 582, '#c0392b');
    this.addBox(-212, 580.5, -188, 582.5, 1.3);
    this.sign(['PONT FERMÉ', 'Treichville — bientôt'], -200, 3.2, 579.5, 9, 2.6, Math.PI, '#f39c12', '#1b1b1b');
    this.label('Treichville (fermé)', -200, 600);

    this.places.bakaryCarSpot = { x: -293, z: -428 };
  }

  buildBuildings() {
    const r = this.r;
    const ADJ = ['#e8c39e', '#d9785b', '#f2e3b3', '#9fc5b0', '#e0a96d', '#c7d3e0', '#f5d76e', '#e59866', '#d2b4de', '#a9cce3', '#f0b27a'];
    const PLA = ['#d9dde2', '#c8ccd0', '#e6e1d6', '#cfd8dc', '#b8c4cc', '#e8dcc8'];
    const COC = ['#f6f0e3', '#f3e5c9', '#efe4d8', '#f6e7e0', '#e8efe3', '#fff7e8'];
    const place = (d, step, fill, margin, gen) => {
      for (let z = BOUNDS.z0 + step / 2; z < BOUNDS.z1; z += step) for (let x = BOUNDS.x0 + step / 2; x < BOUNDS.x1; x += step) {
        if (r() > fill) continue;
        const cx = x + (r() - 0.5) * step * 0.3, cz = z + (r() - 0.5) * step * 0.3;
        if (districtAt(cx, cz) !== d) continue;
        const b = gen(cx, cz);
        const x0 = cx - b.w / 2, x1 = cx + b.w / 2, z0 = cz - b.d / 2, z1 = cz + b.d / 2;
        const pad = b.pad || 0;
        if (!this.rectOnLand(x0 - pad - 2, z0 - pad - 2, x1 + pad + 2, z1 + pad + 2)) continue;
        if (this.rectHitsRoad(x0 - pad, z0 - pad, x1 + pad, z1 + pad, margin)) continue;
        if (!this.rectFree(x0 - pad, z0 - pad, x1 + pad, z1 + pad, 1.2)) continue;
        b.make(x0, z0, x1, z1);
      }
    };
    // Adjamé : petits immeubles colorés et serrés
    place('adjame', 13, 0.9, 5.2, () => {
      const w = 7 + r() * 4.5, d = 7 + r() * 4.5, h = 3.5 * (1 + Math.floor(r() * r() * 4.5));
      const col = ADJ[Math.floor(r() * ADJ.length)];
      return {
        w, d, make: (x0, z0, x1, z1) => {
          this.building('block', x0, z0, x1, z1, h, col);
          if (r() < 0.5) this.B.plain.box(x0 + 1, h, z0 + 1, x0 + 2.4, h + 1.6, z0 + 2.4, '#2c3e50');
          if (r() < 0.3) this.B.plain.box(x1 - 3, h, z1 - 2, x1 - 1, h + 0.25, z1 - 1, '#bdc3c7');
        },
      };
    });
    // Plateau : bureaux et tours de verre
    place('plateau', 30, 0.95, 7, (cx, cz) => {
      const w = 15 + r() * 11, d = 15 + r() * 11;
      const dc = Math.hypot(cx + 200, cz - 60);
      let h = 12 + r() * 24;
      if (dc < 240 && r() < 0.55) h = 40 + r() * (110 - dc * 0.25);
      const style = h > 36 ? 'glass' : 'office';
      const col = PLA[Math.floor(r() * PLA.length)];
      return {
        w, d, make: (x0, z0, x1, z1) => {
          this.building(style, x0, z0, x1, z1, h, col);
          if (h > 50 && r() < 0.5) {
            const ix = (x1 - x0) * 0.2, iz = (z1 - z0) * 0.2;
            this.B.plain.box(x0 + ix, h, z0 + iz, x1 - ix, h + 4, z1 - iz, '#9aa3ab');
          }
        },
      };
    });
    // Cocody : villas avec murs d'enceinte, quelques résidences
    place('cocody', 32, 0.85, 8, (cx, cz) => {
      if (r() < 0.14) {
        const w = 14 + r() * 8, d = 14 + r() * 8, h = 12 + r() * 18;
        const col = COC[Math.floor(r() * COC.length)];
        return { w, d, make: (x0, z0, x1, z1) => this.building('block', x0, z0, x1, z1, h, col) };
      }
      const w = 10 + r() * 6, d = 10 + r() * 6, h = 4 + r() * 3.5;
      const walled = r() < 0.7, pad = walled ? 4 : 0;
      const col = COC[Math.floor(r() * COC.length)];
      return {
        w, d, pad, make: (x0, z0, x1, z1) => {
          this.building('villa', x0, z0, x1, z1, h, col, { collide: !walled });
          if (r() < 0.55) {
            const m = 0.6;
            this.B.plain.hexa([
              [x0 - m, h, z0 - m], [x1 + m, h, z0 - m], [x1 + m, h, z1 + m], [x0 - m, h, z1 + m],
              [(x0 + x1) / 2 - 1, h + 3.2, (z0 + z1) / 2 - 1], [(x0 + x1) / 2 + 1, h + 3.2, (z0 + z1) / 2 - 1],
              [(x0 + x1) / 2 + 1, h + 3.2, (z0 + z1) / 2 + 1], [(x0 + x1) / 2 - 1, h + 3.2, (z0 + z1) / 2 + 1],
            ], r() < 0.5 ? '#b5523b' : '#8e4a3a', { noTop: true });
          }
          if (walled) {
            const X0 = x0 - pad, X1 = x1 + pad, Z0 = z0 - pad, Z1 = z1 + pad, t = 0.3, wh = 2.2, wc = '#e9e2d2';
            const P = this.B.plain;
            P.box(X0, 0, Z0, X1, wh, Z0 + t, wc); P.box(X0, 0, Z1 - t, X1, wh, Z1, wc);
            P.box(X0, 0, Z0, X0 + t, wh, Z1, wc); P.box(X1 - t, 0, Z0, X1, wh, Z1, wc);
            this.addBox(X0, Z0, X1, Z1, wh);
          }
        },
      };
    });
  }

  // ------------------------------------------------------------ arbres
  buildTrees() {
    const r = this.r;
    const palms = [], leafy = [];
    const tryTree = (x, z, list, s) => {
      if (!pointInPoly(x, z, COAST)) return false;
      if (this.rectHitsRoad(x - 0.4, z - 0.4, x + 0.4, z + 0.4, SIDEWALK + 0.3)) return false;
      if (!this.rectFree(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.6)) return false;
      list.push([x, z, s]);
      this.addBox(x - 0.35, z - 0.35, x + 0.35, z + 0.35, 6);
      return true;
    };
    // Palmiers le long des grands axes
    for (const e of this.edges) {
      const d = districtAt((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
      if (d === 'adjame' && e.w < 18) continue;
      const step = d === 'cocody' ? 16 : 22;
      const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len, off = e.w / 2 + SIDEWALK + 0.9;
      for (let t = e.a.hw + 8; t < e.len - e.b.hw - 8; t += step) {
        for (const sgn of [-1, 1]) {
          const x = e.a.x + dx * t - dz * off * sgn, z = e.a.z + dz * t + dx * off * sgn;
          if (r() < 0.8) tryTree(x, z, palms, 0.85 + r() * 0.4);
        }
      }
    }
    // Forêt du Banco, jardins de Cocody, manguiers d'Adjamé
    for (let i = 0; i < 9000; i++) {
      const x = BOUNDS.x0 + r() * (BOUNDS.x1 - BOUNDS.x0), z = BOUNDS.z0 + r() * (BOUNDS.z1 - BOUNDS.z0);
      const d = districtAt(x, z);
      const p = d === 'banco' ? 0.35 : d === 'cocody' ? 0.08 : d === 'adjame' ? 0.02 : 0.03;
      if (r() > p) continue;
      if (d !== 'banco' && r() < 0.35) tryTree(x, z, palms, 0.8 + r() * 0.5);
      else tryTree(x, z, leafy, d === 'banco' ? 1.1 + r() * 1.1 : 0.8 + r() * 0.5);
    }
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    // Palmiers : tronc + couronne de palmes
    const trunkG = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
    trunkG.translate(0, 0.5, 0);
    const crown = new Batch();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const P = (rad, y, side) => [ca * rad - sa * side, y, sa * rad + ca * side];
      crown.quad(P(0, 0, -0.35), P(1.8, -0.2, -0.45), P(1.8, -0.2, 0.45), P(0, 0, 0.35), '#3f8a3a', 1, 1, [0.01, 0.01]);
      crown.quad(P(1.8, -0.2, -0.45), P(3.4, -1.1, -0.15), P(3.4, -1.1, 0.15), P(1.8, -0.2, 0.45), '#2f7a2f', 1, 1, [0.01, 0.01]);
    }
    const crownG = crown.build();
    const trunkM = new THREE.MeshLambertMaterial({ color: '#7b5e45' });
    const crownM = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const pt = new THREE.InstancedMesh(trunkG, trunkM, palms.length);
    const pc = new THREE.InstancedMesh(crownG, crownM, palms.length);
    palms.forEach(([x, z, s], i) => {
      const h = 9 * s;
      dummy.position.set(x, 0, z); dummy.rotation.set((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08); dummy.scale.set(s, h, s);
      dummy.updateMatrix(); pt.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, h, z); dummy.rotation.set(0, r() * 6.28, 0); dummy.scale.set(s, s, s);
      dummy.updateMatrix(); pc.setMatrixAt(i, dummy.matrix);
    });
    pt.castShadow = pc.castShadow = true;
    this.scene.add(pt, pc);
    // Feuillus
    const lt = new THREE.InstancedMesh(trunkG, trunkM, leafy.length);
    const lcG = new THREE.IcosahedronGeometry(1, 0);
    const lc = new THREE.InstancedMesh(lcG, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), leafy.length);
    leafy.forEach(([x, z, s], i) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s * 1.2, 3.2 * s, s * 1.2);
      dummy.updateMatrix(); lt.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 3.2 * s + 1.6 * s, z); dummy.rotation.set(r(), r() * 6, r()); dummy.scale.set(3 * s, 2.3 * s, 3 * s);
      dummy.updateMatrix(); lc.setMatrixAt(i, dummy.matrix);
      lc.setColorAt(i, col.setHSL(0.27 + r() * 0.08, 0.45 + r() * 0.2, 0.22 + r() * 0.1));
    });
    lt.castShadow = lc.castShadow = true;
    this.scene.add(lt, lc);
  }

  // ------------------------------------------------------------ accessoires urbains
  buildProps() {
    const r = this.r, P = this.B.plain;
    const UMB = ['#e74c3c', '#f1c40f', '#27ae60', '#2980b9', '#e67e22', '#8e44ad', '#ecf0f1'];
    // Étals de marché autour du Forum et dans les rues d'Adjamé
    for (const e of this.edges) {
      const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
      if (districtAt(mx, mz) !== 'adjame') continue;
      const near = Math.hypot(mx + 150, mz + 357) < 220;
      const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len, off = e.w / 2 + SIDEWALK + 1.3;
      for (let t = e.a.hw + 5; t < e.len - e.b.hw - 5; t += 5) {
        if (r() > (near ? 0.55 : 0.12)) continue;
        const sgn = r() < 0.5 ? -1 : 1;
        const x = e.a.x + dx * t - dz * off * sgn, z = e.a.z + dz * t + dx * off * sgn;
        if (!this.rectFree(x - 1.2, z - 1.2, x + 1.2, z + 1.2, 0.2)) continue;
        const kiosk = r() < 0.18;
        if (kiosk) {
          // Cabine de transfert d'argent / crédit téléphonique
          const c = ['#f39c12', '#16a085', '#c0392b', '#2471a3'][Math.floor(r() * 4)];
          P.box(x - 1, 0, z - 1, x + 1, 2.4, z + 1, c, { topColor: '#ecf0f1' });
          P.box(x - 1.15, 2.4, z - 1.15, x + 1.15, 2.6, z + 1.15, '#ecf0f1');
          this.addBox(x - 1, z - 1, x + 1, z + 1, 2.6);
        } else {
          P.box(x - 0.9, 0.75, z - 0.6, x + 0.9, 0.85, z + 0.6, '#8b5a2b');
          P.box(x - 0.85, 0, z - 0.55, x - 0.75, 0.75, z - 0.45, '#5d3a1a');
          P.box(x + 0.75, 0, z + 0.45, x + 0.85, 0.75, z + 0.55, '#5d3a1a');
          const goods = ['#e67e22', '#c0392b', '#f1c40f', '#27ae60', '#ecf0f1'];
          for (let k = 0; k < 3; k++) {
            const gx = x - 0.6 + k * 0.6;
            P.box(gx - 0.22, 0.85, z - 0.25, gx + 0.22, 1.05, z + 0.25, goods[Math.floor(r() * goods.length)]);
          }
          P.box(x - 0.04, 0.85, z - 0.04, x + 0.04, 2.3, z + 0.04, '#444');
          const u = UMB[Math.floor(r() * UMB.length)];
          P.hexa([[x - 1.4, 2.0, z - 1.4], [x + 1.4, 2.0, z - 1.4], [x + 1.4, 2.0, z + 1.4], [x - 1.4, 2.0, z + 1.4],
            [x, 2.6, z], [x, 2.6, z], [x, 2.6, z], [x, 2.6, z]], u, { noTop: true, bottom: true });
          this.addBox(x - 0.9, z - 0.6, x + 0.9, z + 0.6, 1);
        }
      }
    }
    // Panneaux publicitaires (marques fictives)
    const ads = [
      [['GARBA EXPRESS', 'Attiéké + thon : 500 F seulement'], '#f39c12', '#1b1b1b'],
      [['BABICOM', 'Appelle ta go 24h/24'], '#8e44ad', '#fff'],
      [['MAQUIS LE TONNERRE', 'Poulet braisé · Alloco · Ambiance'], '#c0392b', '#fff'],
      [['ZOUGLOU FM 98.4', 'La radio qui parle comme toi'], '#16a085', '#fff'],
      [['WAX ROYAL', 'Pagnes de luxe depuis 1972'], '#1f3a93', '#f1c40f'],
      [['ATTIÉKÉ DE MAMIE', 'Le vrai goût de Babi'], '#27ae60', '#fff'],
      [['LAGUNE COLA', 'Fraîche comme la lagune'], '#e74c3c', '#fff'],
      [['ALLÔ GBAKA', 'Adjamé ↔ partout, à toute heure'], '#f1c40f', '#1b1b1b'],
    ];
    let ai = 0;
    for (let i = 0; i < 400 && ai < 22; i++) {
      const e = this.edges[Math.floor(r() * this.edges.length)];
      const d = districtAt((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
      if (d === 'banco' || e.len < 60) continue;
      const t = e.len * (0.3 + r() * 0.4), sgn = r() < 0.5 ? -1 : 1;
      const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len, off = e.w / 2 + SIDEWALK + 5;
      const x = e.a.x + dx * t - dz * off * sgn, z = e.a.z + dz * t + dx * off * sgn;
      if (!this.rectFree(x - 4, z - 4, x + 4, z + 4, 0.5) || !pointInPoly(x, z, COAST)) continue;
      const ad = ads[ai % ads.length];
      ai++;
      const m = this.sign(ad[0], x, 6.2, z, 8, 3, 0, ad[1], ad[2], '#ffffff');
      m.rotation.y = Math.atan2(-dx * sgn, -dz * sgn); // face aux voitures qui arrivent
      P.box(x - 0.15, 0, z - 0.15, x + 0.15, 4.7, z + 0.15, '#4d4d4d');
      this.addBox(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 4.7);
    }
    // Pirogues sur la lagune
    for (let i = 0; i < 26; i++) {
      const x = BOUNDS.x0 + r() * (BOUNDS.x1 - BOUNDS.x0), z = BOUNDS.z0 + r() * (BOUNDS.z1 - BOUNDS.z0);
      if (pointInPoly(x, z, COAST) || this.onRoad(x, z)) continue;
      const a = r() * Math.PI, L = 4 + r() * 3, W = 0.8;
      const ca = Math.cos(a), sa = Math.sin(a);
      const T = (lx, y, lz) => [x + lx * ca - lz * sa, y, z + lx * sa + lz * ca];
      const c = ['#c0392b', '#2471a3', '#f1c40f', '#27ae60'][Math.floor(r() * 4)];
      P.hexa([T(-L / 2, -0.7, -0.1), T(L / 2, -0.7, -0.1), T(L / 2, -0.7, 0.1), T(-L / 2, -0.7, 0.1),
        T(-L / 2 - 0.4, -0.2, -W / 2), T(L / 2 + 0.4, -0.2, -W / 2), T(L / 2 + 0.4, -0.2, W / 2), T(-L / 2 - 0.4, -0.2, W / 2)],
      c, { topColor: '#5d4037' });
    }
  }

  flushBatches() {
    for (const [style, b] of Object.entries(this.B)) {
      if (b.empty) continue;
      let mat;
      if (style === 'plain') mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      else {
        const f = facade(style);
        mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: f.map, emissiveMap: f.em, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
        this.windowMats.push(mat);
      }
      const m = new THREE.Mesh(b.build(), mat);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }
    this.B = null;
  }

  setNight(k) {
    for (const m of this.windowMats) m.emissiveIntensity = k * 0.9;
  }

  // ------------------------------------------------------------ minimap statique
  buildMinimapCanvas() {
    const W = BOUNDS.x1 - BOUNDS.x0, H = BOUNDS.z1 - BOUNDS.z0;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const X = (x) => x - BOUNDS.x0, Z = (z) => z - BOUNDS.z0;
    g.fillStyle = '#2b5876'; g.fillRect(0, 0, W, H);
    g.save();
    g.beginPath();
    COAST.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.closePath();
    g.fillStyle = '#4a4f47'; g.fill();
    g.clip();
    g.fillStyle = '#56503f'; g.fillRect(0, 0, X(120), Z(-165));
    g.fillStyle = '#425a3b'; g.fillRect(X(120), 0, W, H);
    g.fillStyle = '#2f4a2a'; g.fillRect(0, 0, X(-395), Z(-190));
    g.fillStyle = '#4c4e52'; g.fillRect(0, Z(-165), X(120), H);
    g.restore();
    g.fillStyle = 'rgba(30,32,36,0.55)';
    for (const b of this.boxes) if (b.h > 3 && b.x1 - b.x0 > 2) g.fillRect(X(b.x0), Z(b.z0), b.x1 - b.x0, b.z1 - b.z0);
    g.fillStyle = '#d6d6d0';
    for (const e of this.edges) {
      const [x0, z0, x1, z1] = e.rect;
      g.fillRect(X(x0), Z(z0), x1 - x0, z1 - z0);
    }
    this.mapCanvas = c;
  }
}
