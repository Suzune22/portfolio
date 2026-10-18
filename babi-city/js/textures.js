import * as THREE from 'three';
import { rng } from './util.js';

// Toutes les textures sont dessinées à la volée sur des <canvas> : aucun fichier image à charger.
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Taille (m) d'une tuile de façade : largeur, hauteur.
export const FACADE_TILE = { glass: [16, 14], office: [16, 14], block: [14, 12], villa: [16, 7] };

const facadeCache = {};
export function facade(kind) {
  if (facadeCache[kind]) return facadeCache[kind];
  const S = 256;
  const [c, g] = mk(S, S);
  const [e, ge] = mk(S, S);
  const r = rng(kind.charCodeAt(0) * 131 + 7);
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const lit = (x, y, w, h, p) => {
    if (r() < p) {
      ge.fillStyle = ['#ffd27a', '#fff0c8', '#ffe6a8', '#cfe8ff'][Math.floor(r() * 4)];
      ge.fillRect(x, y, w, h);
    }
  };
  if (kind === 'glass') {
    const n = 4, cw = S / n;
    g.fillStyle = '#e6e9ec'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cw + 3, y = j * cw + 5, w = cw - 6, h = cw - 12;
      const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
      gr.addColorStop(0, '#a6cbe2'); gr.addColorStop(0.5, '#5a809c'); gr.addColorStop(1, '#2d4a60');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y, w * 0.15, h);
      lit(x, y, w, h, 0.4);
    }
  } else if (kind === 'office') {
    const n = 4, bh = S / n;
    g.fillStyle = '#f0ece4'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < n; j++) {
      const y = j * bh + bh * 0.3, h = bh * 0.5;
      for (let i = 0; i < 8; i++) {
        const x = i * (S / 8) + 2, w = S / 8 - 4;
        g.fillStyle = '#3d4f5c'; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(180,210,230,0.25)'; g.fillRect(x, y, w, h * 0.35);
        lit(x, y, w, h, 0.3);
      }
    }
  } else if (kind === 'block') {
    const n = 4, cw = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cw + cw * 0.28, y = j * cw + cw * 0.25, w = cw * 0.44, h = cw * 0.45;
      g.fillStyle = '#2a2522'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(200,200,200,0.5)';
      for (let k = 1; k < 4; k++) g.fillRect(x + (k * w) / 4 - 1, y, 2, h);
      if (r() < 0.35) {
        g.fillStyle = ['#2e86de', '#27ae60', '#c0392b', '#8e44ad'][Math.floor(r() * 4)];
        g.fillRect(x - 6, y, 6, h); g.fillRect(x + w, y, 6, h);
      }
      if (r() < 0.2) { g.fillStyle = '#bbb'; g.fillRect(x + w * 0.2, y + h + 3, w * 0.6, 8); }
      lit(x, y, w, h, 0.45);
    }
    for (let k = 0; k < 30; k++) {
      g.fillStyle = `rgba(60,45,30,${0.05 + r() * 0.1})`;
      g.fillRect(8 + r() * (S - 16), r() * (S - 30), 2 + r() * 6, 20 + r() * 60);
    }
  } else if (kind === 'villa') {
    const n = 4, cw = S / n;
    for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) {
      const x = i * cw + cw * 0.25, y = j * (S / 2) + S * 0.12, w = cw * 0.5, h = S * 0.24;
      g.fillStyle = '#6d4c33'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
      g.fillStyle = '#1f2a30'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, w, h * 0.3);
      lit(x, y, w, h, 0.5);
    }
  }
  return (facadeCache[kind] = { map: toTex(c), em: toTex(e) });
}

// Motifs de pagne wax pour les vêtements.
export const WAX_PALETTES = [
  ['#f2a900', '#00843d', '#d4202a'], ['#1e3a8a', '#f59e0b', '#fff7ed'],
  ['#7c2d12', '#facc15', '#0f766e'], ['#be185d', '#fde047', '#1d4ed8'],
  ['#065f46', '#f97316', '#fef3c7'], ['#581c87', '#22d3ee', '#fbbf24'],
  ['#0b3d91', '#ffffff', '#e4572e'], ['#d35400', '#1abc9c', '#2c3e50'],
];
const waxCache = [];
export function waxTexture(i) {
  i %= WAX_PALETTES.length;
  if (waxCache[i]) return waxCache[i];
  const p = WAX_PALETTES[i];
  const [c, g] = mk(64, 64);
  const r = rng(i * 97 + 3);
  g.fillStyle = p[0]; g.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 4; k++) {
    const cx = (k % 2) * 32 + 16, cy = Math.floor(k / 2) * 32 + 16;
    for (let rad = 14; rad > 2; rad -= 4) {
      g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.fillStyle = (rad / 4) % 2 < 1 ? p[1] : p[2]; g.fill();
    }
  }
  g.fillStyle = p[2];
  for (let k = 0; k < 12; k++) {
    const x = r() * 64, y = r() * 64;
    g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.fill();
  }
  const t = toTex(c);
  t.magFilter = THREE.NearestFilter;
  return (waxCache[i] = t);
}

// Panneau texte (enseignes, publicités).
export function signTexture(lines, bg = '#c0392b', fg = '#ffffff', w = 512, h = 160, accent = null) {
  const [c, g] = mk(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (accent) { g.fillStyle = accent; g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, w, 6); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((txt, i) => {
    const big = i === 0;
    let size = big ? Math.floor(h * (arr.length > 1 ? 0.36 : 0.5)) : Math.floor(h * 0.2);
    g.font = `${big ? 800 : 600} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    while (g.measureText(txt).width > w * 0.92 && size > 10) {
      size -= 2; g.font = `${big ? 800 : 600} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    }
    const y = arr.length === 1 ? h / 2 : big ? h * 0.38 : h * 0.38 + h * 0.3 * i;
    g.fillText(txt, w / 2, y);
  });
  return toTex(c, false);
}

// Petite texture douce et ronde pour les particules (fumée, feu, poussière).
let puff = null;
export function puffTexture() {
  if (puff) return puff;
  const [c, g] = mk(64, 64);
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (puff = toTex(c, false));
}

// Dégradé vertical pour les marqueurs de mission (colonne lumineuse).
let beam = null;
export function beamTexture() {
  if (beam) return beam;
  const [c, g] = mk(4, 64);
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  return (beam = toTex(c, false));
}
