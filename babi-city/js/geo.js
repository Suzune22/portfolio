import * as THREE from 'three';

// Accumulateur de géométrie : on fusionne des milliers de boîtes colorées
// en un seul maillage (un seul appel de rendu par matériau).
const _c = new THREE.Color();

export class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }

  quad(bl, br, tr, tl, color, uw = 1, vh = 1, uvFixed = null) {
    const ax = br[0] - bl[0], ay = br[1] - bl[1], az = br[2] - bl[2];
    let bx = tl[0] - bl[0], by = tl[1] - bl[1], bz = tl[2] - bl[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    let l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) {
      bx = tr[0] - bl[0]; by = tr[1] - bl[1]; bz = tr[2] - bl[2];
      nx = ay * bz - az * by; ny = az * bx - ax * bz; nz = ax * by - ay * bx;
      l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) return;
    }
    nx /= l; ny /= l; nz /= l;
    const c = color && color.isColor ? color : _c.set(color);
    const uvs = uvFixed ? [uvFixed, uvFixed, uvFixed, uvFixed] : [[0, 0], [uw, 0], [uw, vh], [0, vh]];
    const vs = [bl, br, tr, tl];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = vs[i];
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(c.r, c.g, c.b);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
  }

  // Hexaèdre quelconque. c = 8 coins : bas [x0z0, x1z0, x1z1, x0z1], puis haut dans le même ordre.
  // o.cell = [largeur, hauteur] d'une tuile de texture en mètres (façades).
  hexa(c, color, o = {}) {
    const faces = [[2, 1, 5, 6], [0, 3, 7, 4], [3, 2, 6, 7], [1, 0, 4, 5]];
    for (const f of faces) {
      const bl = c[f[0]], br = c[f[1]], tr = c[f[2]], tl = c[f[3]];
      if (o.cell) {
        const w = Math.hypot(br[0] - bl[0], br[2] - bl[2]);
        const h = Math.abs(tl[1] - bl[1]);
        this.quad(bl, br, tr, tl, color, w / o.cell[0], h / o.cell[1]);
      } else this.quad(bl, br, tr, tl, color, 1, 1, [0.01, 0.01]);
    }
    if (!o.noTop) this.quad(c[7], c[6], c[5], c[4], o.topColor || color, 1, 1, [0.01, 0.01]);
    if (o.bottom) this.quad(c[0], c[1], c[2], c[3], color, 1, 1, [0.01, 0.01]);
  }

  box(x0, y0, z0, x1, y1, z1, color, o) {
    this.hexa([
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ], color, o);
  }

  // Quadrilatère horizontal (sol, route…)
  flat(x0, z0, x1, z1, y, color) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color, 1, 1, [0.01, 0.01]);
  }

  get empty() { return this.pos.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}
