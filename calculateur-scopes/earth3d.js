// CO2CI — Terre réaliste en 3D et plongée vers Abidjan (bandeau du calcul détaillé).
//
// Séquence au choix d'un profil :
//   1. la Terre tourne pour amener Abidjan face à la caméra ;
//   2. la caméra plonge lentement, puis de plus en plus vite ;
//   3. on traverse la couche de nuages (voile blanc) ;
//   4. on se stabilise au-dessus d'une ville 3D qui dépend du profil (maison, quartier, village,
//      siège d'entreprise et installations de son secteur, ou centre-ville).
//
// Textures : NASA Blue Marble via les exemples de Three.js (licence MIT, voir LICENSE-three.txt).

import * as THREE from './vendor/three.module.min.js';

const ABIDJAN = { lat: 5.32, lon: -4.03 };
const D2R = Math.PI / 180;
const EARTH_R = 1;

// Point à la surface du globe (latitude / longitude en degrés) dans le repère de la sphère.
function surfacePoint(lat, lon, r = EARTH_R) {
  const phi = (90 - lat) * D2R, theta = (lon + 180) * D2R;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeIn = t => t * t * t;                  // lent, puis rapide
const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));


// ---------------------------------------------------------------------------------------------
// Étiquettes et repères façon Google Earth (taille constante à l'écran)
// ---------------------------------------------------------------------------------------------
function textSprite(text, { size = 34, weight = 600, italic = false, color = '#ffffff', pin = false, h = .045 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${italic ? 'italic ' : ''}${weight} ${size}px Inter, Arial, sans-serif`;
  g.font = font;
  const pinW = pin ? size * 1.1 : 0;
  const w = Math.ceil(g.measureText(text).width + pinW + 24), hh = Math.ceil(size * 1.6);
  c.width = w; c.height = hh;
  g.font = font; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (pin) {
    // Épingle grise avec un point, comme sur Google Maps.
    const px = 12 + size * .45, py = hh / 2;
    g.fillStyle = '#5f6368'; g.beginPath(); g.arc(px, py - size * .12, size * .38, Math.PI, 0); g.lineTo(px, py + size * .5); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py - size * .12, size * .15, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = size * .18; g.strokeText(text, 12 + pinW, hh / 2);
  g.fillStyle = color; g.fillText(text, 12 + pinW, hh / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  sp.scale.set(h * w / hh, h, 1); sp.renderOrder = 20;
  return sp;
}
function blueDot() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const halo = g.createRadialGradient(64, 64, 10, 64, 64, 64); halo.addColorStop(0, 'rgba(66,133,244,.45)'); halo.addColorStop(1, 'rgba(66,133,244,0)');
  g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4285f4'; g.beginPath(); g.arc(64, 64, 16, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  sp.scale.set(.06, .06, 1); sp.renderOrder = 21;
  return sp;
}
const PLACE_LABELS = [
  // [texte, latitude, longitude, style]
  ["Côte d'Ivoire", 7.6, -5.6, { size: 40, weight: 700 }],
  ['Ghana', 7.9, -1.1, {}], ['Liberia', 6.5, -9.4, {}], ['Guinée', 10.6, -11.2, {}],
  ['Mali', 16.5, -3.5, {}], ['Burkina Faso', 12.3, -1.6, {}], ['Togo', 8.6, 1.0, { size: 28 }],
  ['Sierra Leone', 8.5, -11.9, { size: 28 }], ['Nigeria', 9.4, 8.0, {}], ['Sénégal', 14.6, -14.6, { size: 30 }],
  ['Golfe de Guinée', 2.4, -2.0, { italic: true, weight: 500, color: '#cfe3ff' }],
  ['Océan Atlantique', 4.0, -16.0, { italic: true, weight: 500, color: '#cfe3ff' }],
  ['Yamoussoukro', 6.82, -5.28, { size: 26, weight: 500 }],
  ['Abidjan', 5.36, -4.01, { size: 30, weight: 700 }],
];
const PIN_TEXT = { individu: 'Ma maison', foyer: 'Notre foyer', communaute: 'Le village', localite: 'Le Plateau', entreprise: 'Votre entreprise' };
const PIN_HEIGHT = { individu: 4, foyer: 5.2, communaute: 4.6, localite: 17.5, entreprise: 9.2 };

// ---------------------------------------------------------------------------------------------
// Ville 3D procédurale
// ---------------------------------------------------------------------------------------------
const PALETTE = {
  glass: [0x8fb3d9, 0x6f8fc0, 0xa9c4e4, 0x5d7fb3],
  concrete: [0xd9cfc0, 0xc9bfae, 0xe4ddd1, 0xb8ad9c],
  warm: [0xe8c9a0, 0xd8b58a, 0xf0d9b5],
  roof: [0xa85a3c, 0x8f4a30, 0xb86a48],
  straw: 0xc8a469, earth: 0xb98a5c, green: 0x3f7a3a, water: 0x1f5f8a,
};
const rnd = seed => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

function makeCityScene(kind, sector, name) {
  const group = new THREE.Group();
  const r = rnd(kind.length * 7 + (sector || '').length * 13 + 5);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const addBox = (x, z, w, h, d, color, opts = {}) => {
    const m = new THREE.Mesh(boxGeo, opts.glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? .8, metalness: opts.metal ?? .05 }));
    m.scale.set(w, h, d); m.position.set(x, h / 2 + (opts.y || 0), z);
    if (opts.rot) m.rotation.y = opts.rot;
    group.add(m); return m;
  };
  const windows = (building, w, h, d, lit = .35) => {
    // Fenêtres éclairées : petits plans émissifs sur deux façades.
    const geo = new THREE.PlaneGeometry(.22, .3);
    const mats = [new THREE.MeshBasicMaterial({ color: 0xffd58a }), new THREE.MeshBasicMaterial({ color: 0x1a2440 })];
    const cols = Math.max(1, Math.floor(w / .5)), rows = Math.max(1, Math.floor(h / .55));
    for (const side of [1, -1]) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const mesh = new THREE.Mesh(geo, r() < lit ? mats[0] : mats[1]);
      mesh.position.set(building.position.x - w / 2 + (i + .5) * (w / cols), .35 + j * .55, building.position.z + side * (d / 2 + .01));
      if (side < 0) mesh.rotation.y = Math.PI;
      group.add(mesh);
    }
  };
  const tower = (x, z, w, h, d, color) => { const b = addBox(x, z, w, h, d, color, { rough: .35, metal: .25 }); windows(b, w, h, d); return b; };
  const tree = (x, z, s = 1) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.06 * s, .09 * s, .9 * s, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b2a }));
    trunk.position.set(x, .45 * s, z); trunk.castShadow = true; group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(.55 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: .9 }));
    crown.position.set(x, 1.15 * s, z); crown.scale.y = .8; crown.castShadow = true; group.add(crown);
  };
  const palm = (x, z, s = 1) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05 * s, .08 * s, 2.2 * s, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a33 }));
    trunk.position.set(x, 1.1 * s, z); trunk.rotation.z = (r() - .5) * .2; trunk.castShadow = true; group.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.3 * s, .04, .22 * s), new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: .9 }));
      leaf.position.set(x + Math.cos(i / 7 * Math.PI * 2) * .55 * s, 2.15 * s, z + Math.sin(i / 7 * Math.PI * 2) * .55 * s);
      leaf.rotation.y = -i / 7 * Math.PI * 2; leaf.rotation.z = -.35; group.add(leaf);
    }
  };
  const road = (x, z, w, d) => { const m = addBox(x, z, w, .02, d, 0x2b2b33, { rough: 1 }); m.receiveShadow = true; return m; };
  const house = (x, z, w, h, d, wall, roof, rot = 0) => {
    const b = addBox(x, z, w, h, d, wall, { rot });
    const rf = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * .78, h * .55, 4), new THREE.MeshStandardMaterial({ color: roof, roughness: .9 }));
    rf.position.set(x, h + h * .27, z); rf.rotation.y = Math.PI / 4 + rot; rf.castShadow = true; group.add(rf);
    return b;
  };
  const sign = (x, y, z, text) => {
    if (!text) return;
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,10,20,.85)'; g.beginPath(); g.roundRect(0, 0, 512, 128, 28); g.fill();
    g.font = '600 64px Inter, Arial, sans-serif'; g.fillStyle = '#fff6e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,214,150,.9)'; g.shadowBlur = 18;
    g.fillText(text.toUpperCase().slice(0, 14), 256, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(3.6, .9, 1); sp.position.set(x, y, z); sp.renderOrder = 10; group.add(sp);
  };

  // Sol : herbe, lagune au nord, quai.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xbdb48c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const lagoon = new THREE.Mesh(new THREE.PlaneGeometry(400, 26), new THREE.MeshStandardMaterial({ color: 0x2f6f96, roughness: .12, metalness: .55 }));
  lagoon.rotation.x = -Math.PI / 2; lagoon.position.set(0, .01, 23); group.add(lagoon);
  addBox(0, 9.7, 400, .25, .6, 0xcfc6b6);              // quai
  road(0, 4.5, 400, 1.6); road(-9, -20, 1.4, 50); road(9, -20, 1.4, 50); road(0, -16, 400, 1.2);
  // Quartiers lointains en fond, pour la profondeur.
  const FACADES = [0xf2ede4, 0xe9e1d3, 0xf3d9b8, 0xd8e3e8, 0xefd2c6, 0xe6e0c8, 0xcfd8d0];
  for (let i = 0; i < 140; i++) {
    const x = (r() - .5) * 90, z = -(8 + r() * 46);
    if (Math.abs(x) < 7.5 && z > -15) continue;
    const w = 1 + r() * 2.2, d = 1 + r() * 2.2, h = .7 + r() * (kind === 'localite' ? 5 : 2.6);
    const b = addBox(x, z, w, h, d, pick(FACADES), { rough: .85 });
    if (r() < .5) addBox(x, z, w * .9, .12, d * .9, 0x9c9488, { y: h });             // toit-terrasse
    if (r() < .35) addBox(x + w * .2, z, .35, .3, .35, 0xe2e2e2, { y: h });          // réservoir d'eau
    void b;
  }
  for (let i = 0; i < 26; i++) { const x = (r() - .5) * 90, z = 6 + r() * 3; if (Math.abs(x) > 4) addBox(x, z, 1.2 + r(), .6 + r() * .6, 1 + r() * .6, pick(FACADES), { rough: .85 }); }
  for (let i = 0; i < 40; i++) tree((r() - .5) * 80, -(7 + r() * 40), .8 + r() * .7);

  const sec = sector || 'services';
  switch (kind) {
    case 'individu': {
      house(0, 0, 3.4, 1.6, 2.8, pick(PALETTE.warm), pick(PALETTE.roof));
      addBox(0, 1.9, 1.4, .08, 1, 0xd9cfc0);                   // allée
      palm(-3, -1.5, 1); palm(3.2, -1, .9); tree(-2.6, 2.2, .8);
      addBox(2.2, 2.4, .9, .5, .5, 0x3b3f52, { rough: .6 });     // voiture
      break;
    }
    case 'foyer': {
      house(0, 0, 5, 2.8, 3.6, pick(PALETTE.warm), pick(PALETTE.roof));
      addBox(0, 2.6, 5.2, .9, 1.2, 0xd9cfc0, { rough: .9 });      // terrasse
      addBox(-4.4, 0, 2.6, 1.5, 2.2, pick(PALETTE.concrete));     // dépendance
      palm(-3.6, -2.4, 1.1); palm(3.8, -2, 1); tree(4, 2.6, 1);
      addBox(0, -3.2, 6.4, .9, .12, 0xb8ad9c);                     // mur
      break;
    }
    case 'communaute': {
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2, rad = 4.5 + r() * 1.5, x = Math.cos(a) * rad, z = Math.sin(a) * rad * .7;
        const hut = new THREE.Mesh(new THREE.CylinderGeometry(.9, .95, .9, 12), new THREE.MeshStandardMaterial({ color: pick(PALETTE.warm), roughness: .95 }));
        hut.position.set(x, .45, z); hut.castShadow = true; group.add(hut);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.1, 12), new THREE.MeshStandardMaterial({ color: PALETTE.straw, roughness: 1 }));
        roof.position.set(x, 1.4, z); roof.castShadow = true; group.add(roof);
      }
      tree(0, 0, 2.2);                                             // arbre à palabres
      // Pas de PointLight : à l'échelle de la Terre, son intensité éblouirait toute la scène.
      const fire = addBox(2, 1.5, .45, .35, .45, 0xffa040, { glow: true }); fire.name = 'flame';
      break;
    }
    case 'localite': {
      // Plateau d'Abidjan : tours de bureaux serrées.
      const spots = [[-5, -2, 2.2, 9], [-2.4, -3, 2, 12], [0.5, -1.5, 2.6, 15], [3.6, -2.8, 2, 10], [6.2, -1, 2.4, 8], [-6.5, 2, 2, 6], [-3, 1.6, 1.8, 7], [2.2, 2, 2.2, 6], [5.5, 2.4, 1.8, 9]];
      for (const [x, z, w, h] of spots) tower(x, z, w, h, w * .9, pick(PALETTE.glass));
      addBox(0, 14, 1.4, .3, 10, 0x9a9aa8, { y: .2 });               // pont sur la lagune
      palm(-8, 3.5, 1); palm(8.5, 3.6, 1);
      break;
    }
    default: {
      // Siège de l'entreprise, avec enseigne, puis installations du secteur.
      const hq = tower(0, 0, 2.6, 7, 2.6, 0x7f9fcf);
      addBox(0, 2.2, 4.2, .5, 1.6, 0xd9cfc0, { rough: .9 });        // parvis
      palm(-2.8, 2.6, .9); palm(2.8, 2.6, .9);
      if (sec === 'btp') {
        const site = addBox(-6, 0, 3.5, 3.4, 3, 0x9c9ca8, { rough: 1 });
        for (let k = 1; k <= 4; k++) addBox(-6, 0, 3.6, .08, 3.1, 0xf2b25c, { y: k * .8 });
        addBox(-4.2, 1.8, .22, 9, .22, 0xf2b25c);                    // grue : mât
        const jib = addBox(-4.2 - 2, 1.8, 6, .22, .22, 0xf2b25c, { y: 9 }); jib.name = 'spin';
        addBox(6, 0, 2.5, 1.2, 2, 0xc9bfae); addBox(5.2, 2.4, .9, .5, .5, 0xe7a43c, { rough: .6 });
      } else if (sec === 'mines') {
        // Fosse en gradins.
        for (let k = 0; k < 4; k++) addBox(-7, -1, 7 - k * 1.4, .55, 5 - k, PALETTE.earth, { y: -k * .55 - .3, rough: 1 });
        addBox(6, -1, .3, 5, .3, 0xc9c6d8); addBox(6.6, -1, .3, 5, .3, 0xc9c6d8); addBox(6.3, -1, 1.2, .3, .3, 0xc9c6d8, { y: 5 });
        addBox(5, 2.4, 1.4, .8, .8, 0xe7a43c, { rough: .7 });
      } else if (sec === 'energie') {
        for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 20), new THREE.MeshStandardMaterial({ color: 0xcfd0d8, metalness: .6, roughness: .35 })); t.position.set(-6 + k * 2.3, .7, -1); t.castShadow = true; group.add(t); }
        addBox(6, -1, .25, 7, .25, 0xd0d0d8, { metal: .6, rough: .3 });
        const fl = addBox(6, -1, .5, .9, .5, 0xffb050, { y: 7, glow: true }); fl.name = 'flame';
        addBox(-5, 3, .5, 1.6, .5, 0xd0d0d8, { metal: .5 }); addBox(-2, 3, .5, 1.6, .5, 0xd0d0d8, { metal: .5 });
      } else if (sec === 'industrie') {
        addBox(-6, -1, 5, 2, 3.6, 0xb8ad9c, { rough: 1 });
        for (let k = 0; k < 2; k++) addBox(-7.4 + k * 1.2, -2.2, .4, 4, .4, 0xc9c6d8, { metal: .4 });
        addBox(5.5, -1, 3.5, 1.6, 3, 0xc9bfae);
      } else if (sec === 'agri') {
        for (let k = 0; k < 6; k++) addBox(-7 + (k % 3) * 2.2, -1 + Math.floor(k / 3) * 2.2, 2, .05, 2, k % 2 ? 0x6f9f45 : 0xa8b060, { rough: 1 });
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 3, 16), new THREE.MeshStandardMaterial({ color: 0xcfd0d8, metalness: .5, roughness: .4 })); silo.position.set(6, 1.5, -1); silo.castShadow = true; group.add(silo);
        addBox(4.5, 2.2, .9, .6, .6, 0x4c7a3a, { rough: .8 });
      } else if (sec === 'transport') {
        const cols = [0xc94c3c, 0x2f6db0, 0xe0a234, 0x3c8a5a, 0x7a4fb0];
        for (let i = 0; i < 12; i++) addBox(-8 + (i % 4) * 1.3, -2 + Math.floor(i / 4) * 1.1, 1.2, .55, 1, cols[i % 5], { y: (i % 3) * .55, rough: .7 });
        addBox(6, -1, 4, 1.8, 3, 0xb8ad9c, { rough: 1 });
        addBox(5, 2.3, 1.6, .7, .7, 0x3b3f52, { rough: .6 });
      } else {
        addBox(-5, -.5, 3, 3, 2.6, pick(PALETTE.concrete)); addBox(5, -.5, 3.4, 2.2, 2.4, pick(PALETTE.warm));
      }
    }
  }
  return group;
}

// ---------------------------------------------------------------------------------------------
// Moteur
// ---------------------------------------------------------------------------------------------
export function mountEarth3D(container, opts = {}) {
  const reduce = !!opts.reducedMotion;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:pan-y;';
  container.appendChild(canvas);
  let renderer;
  try {
    // Tampon de profondeur logarithmique : on passe de l'espace au niveau de la rue sans artefacts.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .0002, 300);

  // --- Terre ---
  const base = opts.assetBase || '';
  const loader = new THREE.TextureLoader();
  let pending = 5;
  const tex = n => loader.load(base + n, () => { if (--pending === 0) opts.onReady && opts.onReady(); }, undefined, () => opts.onError && opts.onError());
  const map = tex('earth_atmos_2048.jpg'); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const lights = tex('earth_lights_2048.png'); lights.colorSpace = THREE.SRGBColorSpace;
  const earthMat = new THREE.MeshPhongMaterial({
    map, normalMap: tex('earth_normal_2048.jpg'), normalScale: new THREE.Vector2(.85, .85),
    specularMap: tex('earth_specular_2048.jpg'), specular: new THREE.Color(0x3a5a80), shininess: 24,
    emissiveMap: lights, emissive: new THREE.Color(0xffc98a), emissiveIntensity: .12,
  });
  const earthGroup = new THREE.Group();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 128), earthMat);
  earthGroup.add(earth);
  const cloudTex = tex('earth_clouds_1024.png'); cloudTex.colorSpace = THREE.SRGBColorSpace;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.01, 96, 96),
    new THREE.MeshLambertMaterial({ map: cloudTex, alphaMap: cloudTex, transparent: true, opacity: .95, depthWrite: false }));
  earthGroup.add(clouds);
  // Halo d'atmosphère (effet Fresnel sur une sphère un peu plus grande).
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.07, 64, 64), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(0x5aa8ff) } },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <logdepthbuf_pars_fragment>\nuniform vec3 c; varying vec3 vN; varying vec3 vP; void main(){\n#include <logdepthbuf_fragment>\nfloat f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.4); gl_FragColor = vec4(c, f * 1.25); }',
  }));
  earthGroup.add(atmo);
  scene.add(earthGroup);

  // Étoiles.
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1800 * 3);
  const sr = rnd(42);
  for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3(sr() - .5, sr() - .5, sr() - .5).normalize().multiplyScalar(80 + sr() * 40); starPos.set([v.x, v.y, v.z], i * 3); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .35, sizeAttenuation: true, transparent: true, opacity: .85, depthWrite: false }));
  scene.add(stars);

  // Lumières : soleil spatial, puis éclairage de fin de journée sur la ville.
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.6); sun.position.set(5, 2.2, 4); scene.add(sun);
  const sunOffset = new THREE.Vector3(1.6, 1.4, 0);
  const ambient = new THREE.AmbientLight(0x334466, .5); scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xffe2c4, 0x3c4a3a, 0); hemi.position.set(0, 0, 1); scene.add(hemi);
  const citySun = new THREE.DirectionalLight(0xffd2a0, 0); citySun.position.set(6, -4, 7); scene.add(citySun);

  // Ciel de fin de journée et brume, visibles une fois sous les nuages.
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
  const sg = skyCanvas.getContext('2d'), grd = sg.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#22305e'); grd.addColorStop(.45, '#6c5f9e'); grd.addColorStop(.75, '#d98d74'); grd.addColorStop(1, '#f2c49a');
  sg.fillStyle = grd; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
  const fog = new THREE.Fog(0xe4bf9e, .014, .034);

  // Ville posée sur Abidjan, tangente à la sphère, à très petite échelle.
  let city = null, pin = null;
  const CITY_SCALE = 0.00022, H_CITY = 0.0042;
  function placeCity(kind, sector, name) {
    if (city) { earthGroup.remove(city); city.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose?.(); m.dispose(); }); }); }
    city = makeCityScene(kind, sector, name);
    city.scale.setScalar(CITY_SCALE);
    const p = surfacePoint(ABIDJAN.lat, ABIDJAN.lon, EARTH_R * 1.00003);
    city.position.copy(p);
    // Axe « haut » de la ville = normale à la sphère ; le nord de la ville vers le pôle.
    const up = p.clone().normalize();
    const north = new THREE.Vector3(0, 1, 0).sub(up.clone().multiplyScalar(up.y)).normalize();
    const east = new THREE.Vector3().crossVectors(north, up).normalize();
    const m = new THREE.Matrix4().makeBasis(east, up, north.clone().negate());
    city.quaternion.setFromRotationMatrix(m);
    city.visible = false;
    earthGroup.add(city);
    // Épingle et nom du lieu au-dessus du sujet, comme sur Google Maps (taille constante à l'écran).
    if (pin) { earthGroup.remove(pin); pin.material.map.dispose(); pin.material.dispose(); }
    pin = textSprite(name || PIN_TEXT[kind] || PIN_TEXT.entreprise, { size: 34, pin: true, h: .052 });
    pin.position.copy(p).addScaledVector(up, (PIN_HEIGHT[kind] || 9) * CITY_SCALE);
    pin.visible = false;
    earthGroup.add(pin);
  }

  // Frontières (blanches, fines) chargées à part ; noms de lieux ; point bleu de localisation.
  const bordersMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  fetch(base + 'borders.json').then(r => r.json()).then(data => {
    const pts = [];
    for (const strip of data.world.concat(data.region)) for (let i = 0; i + 3 < strip.length; i += 2) {
      const a = surfacePoint(strip[i + 1], strip[i], EARTH_R * 1.0008), b = surfacePoint(strip[i + 3], strip[i + 2], EARTH_R * 1.0008);
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    earthGroup.add(new THREE.LineSegments(geo, bordersMat));
  }).catch(() => {});
  const labels = PLACE_LABELS.map(([t, la, lo, st]) => {
    const sp = textSprite(t, st); sp.position.copy(surfacePoint(la, lo, EARTH_R * 1.002)); sp.userData.normal = sp.position.clone().normalize();
    sp.userData.city = t === 'Abidjan' || t === 'Yamoussoukro';
    earthGroup.add(sp); return sp;
  });
  const dot = blueDot(); dot.position.copy(surfacePoint(ABIDJAN.lat, ABIDJAN.lon, EARTH_R * 1.0004)); earthGroup.add(dot);
  const tmpN = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Vector3();
  // Visibilité selon l'altitude de la caméra (alt = distance à la surface, rayon terrestre = 1).
  function updateOverlays(alt, now) {
    const band = (lo, hi, fade) => clamp01((alt - lo) / fade) * clamp01((hi - alt) / fade);
    bordersMat.opacity = .55 * band(.012, 1.3, .25);
    const country = band(.05, .95, .18), town = band(.012, .3, .08);
    for (const sp of labels) {
      tmpN.copy(sp.userData.normal).applyQuaternion(earthGroup.quaternion);
      tmpP.copy(sp.position).applyMatrix4(earthGroup.matrixWorld);
      const facing = clamp01(tmpN.dot(tmpC.copy(camera.position).sub(tmpP).normalize()) * 4);
      sp.material.opacity = (sp.userData.city ? town : country) * facing;
      sp.visible = sp.material.opacity > .01;
    }
    const pulse = reduce ? 1 : 1 + .15 * Math.sin(now / 300);
    dot.material.opacity = band(.004, 1.8, .15) * (phase === 'fly' || phase === 'return' ? 1 : 0);
    dot.visible = dot.material.opacity > .01; dot.scale.set(.05 * pulse, .05 * pulse, 1);
  }

  // Voile de nuages traversé pendant la plongée.
  const veil = document.createElement('div');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 55%, #ffffff 0%, #f1f4fa 50%, rgba(241,244,250,.6) 80%, rgba(241,244,250,0) 100%);';
  container.appendChild(veil);

  // --- Orientation : rotation Y puis X qui amène Abidjan face à la caméra (+z). ---
  const ts = { y: (-ABIDJAN.lon - 90) * D2R, x: ABIDJAN.lat * D2R };
  const nearest = (to, from) => to + 2 * Math.PI * Math.round((from - to) / (2 * Math.PI));
  let spinY = ts.y + 0.9, spinX = ts.x - .25;
  let dragging = false, lastX = 0, lastY = 0, vX = 0, vY = 0, idleSince = 0;
  let phase = 'orbit', flight = null, cityT0 = 0, last = null;
  let W = 1, H = 1, visible = true, raf = 0, disposed = false;
  const banner = opts.banner !== false;
  const ORBIT_D = 3.4;

  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  // En bandeau, la Terre est posée en bas (on n'en voit que le haut) ; décalage annulé pendant la plongée.
  const setOffset = k => { camera.setViewOffset(W, H, 0, banner ? -H * .46 * (1 - k) : 0, W, H); };
  const lightMix = k => {
    hemi.intensity = k * 1.25; citySun.intensity = k * 2.3; sun.intensity = 2.6 * (1 - k * .75); ambient.intensity = .5 * (1 - k * .5);
    scene.background = k > .5 ? skyTex : null; scene.fog = k > .5 ? fog : null;
    stars.visible = k < .5;
  };
  // Pose de la caméra au-dessus de la ville (vue oblique), tournant lentement autour.
  const cityPose = ang => ({
    pos: new THREE.Vector3(-Math.sin(ang) * H_CITY * 1.9, -Math.cos(ang) * H_CITY * 1.9, EARTH_R + H_CITY),
    look: new THREE.Vector3(Math.sin(ang) * H_CITY * .95, Math.cos(ang) * H_CITY * .95, EARTH_R),
  });

  function orbitFrame(now) {
    if (!dragging) {
      if (Math.abs(vX) > 1e-5 || Math.abs(vY) > 1e-5) { spinY += vX; spinX = THREE.MathUtils.clamp(spinX + vY, -1.1, 1.1); vX *= .94; vY *= .94; idleSince = now; }
      else if (!reduce && now - idleSince > 1500) spinY += 0.0015;
    }
    earthGroup.rotation.set(spinX, spinY, 0);
    if (!reduce) clouds.rotation.y += 0.00022;
    camera.up.set(0, 1, 0); camera.position.set(0, 0, ORBIT_D); camera.lookAt(0, 0, 0);
    setOffset(0); lightMix(0); clouds.material.opacity = .95; atmo.visible = true; veil.style.opacity = '0';
    stars.material.opacity = .85;
    if (city) city.visible = false;
  }

  // Plongée : 0 → .3 rotation vers Abidjan ; .22 → 1 descente lente puis rapide.
  let forcedK = null;   // pour les tests : fige la plongée à une étape donnée
  function flyFrame(now) {
    const k = forcedK ?? clamp01((now - flight.t0) / flight.dur);
    const ea = easeInOut(clamp01(k / .3));
    earthGroup.rotation.set(lerp(flight.fromX, ts.x, ea), lerp(flight.fromY, nearest(ts.y, flight.fromY), ea), 0);
    const eb = easeIn(clamp01((k - .22) / .78));
    const pose = cityPose(0);
    // Altitude interpolée en échelle logarithmique : le zoom s'accélère naturellement.
    const alt = Math.exp(lerp(Math.log(ORBIT_D - EARTH_R), Math.log(pose.pos.z - EARTH_R), eb));
    const tilt = easeInOut(clamp01((eb - .82) / .18));       // bascule en vue oblique à la fin
    camera.up.set(0, 1 - tilt, tilt).normalize();
    camera.position.set(pose.pos.x * tilt, pose.pos.y * tilt, EARTH_R + alt);
    camera.lookAt(0, pose.look.y * tilt, lerp(0, EARTH_R, clamp01(eb * 1.4)));
    setOffset(clamp01(eb * 1.6));
    // Traversée des nuages vers eb ≈ .8.
    const thru = clamp01((eb - .7) / .18);
    veil.style.opacity = String(Math.sin(thru * Math.PI) * .97);
    clouds.material.opacity = .95 * (1 - clamp01((eb - .74) / .08));
    atmo.visible = eb < .8;
    const cl = clamp01((eb - .79) / .12);
    lightMix(cl);
    
    if (city) city.visible = eb > .6;
    if (k >= 1 && forcedK === null) { phase = 'city'; cityT0 = now; const d = flight.done; flight = null; d && d(); }
  }

  function cityFrame(now) {
    const t = reduce ? 0 : (now - cityT0) / 1000;
    earthGroup.rotation.set(ts.x, ts.y, 0);
    const pose = cityPose(t * .045);
    camera.up.set(0, 0, 1); camera.position.copy(pose.pos); camera.lookAt(pose.look);
    setOffset(1); lightMix(1); veil.style.opacity = '0'; clouds.material.opacity = 0; atmo.visible = false;
    if (city) { city.visible = true; city.traverse(o => { if (o.name === 'spin') o.rotation.y = t * .25; if (o.name === 'flame') o.scale.y = 1 + Math.sin(t * 18) * .25; }); }
  }

  function returnFrame(now) {
    const k = clamp01((now - flight.t0) / flight.dur), e = easeOut(k);
    const pose = cityPose(flight.ang);
    const alt = Math.exp(lerp(Math.log(pose.pos.z - EARTH_R), Math.log(ORBIT_D - EARTH_R), e));
    const tilt = 1 - clamp01(e / .15);
    earthGroup.rotation.set(ts.x, ts.y + e * .7, 0);
    camera.up.set(0, 1 - tilt, tilt).normalize();
    camera.position.set(pose.pos.x * tilt, pose.pos.y * tilt, EARTH_R + alt);
    camera.lookAt(0, pose.look.y * tilt, lerp(EARTH_R, 0, clamp01(e * 1.6)));
    setOffset(1 - clamp01(e * 1.3));
    veil.style.opacity = String(Math.sin(clamp01((e - .03) / .2) * Math.PI) * .85);
    clouds.material.opacity = .95 * clamp01((e - .14) / .15); atmo.visible = e > .12;
    lightMix(1 - clamp01(e / .14));
    if (city) city.visible = e < .3;
    if (k >= 1) { phase = 'orbit'; spinX = ts.x; spinY = ts.y + .7; vX = vY = 0; idleSince = now; const d = flight.done; flight = null; d && d(); }
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    if (phase === 'orbit') orbitFrame(now);
    else if (phase === 'fly') flyFrame(now);
    else if (phase === 'city') cityFrame(now);
    else returnFrame(now);
    earthGroup.updateMatrixWorld();
    sun.position.copy(camera.position).normalize().multiplyScalar(5).add(sunOffset);
    if (pin) { pin.visible = phase === 'city' || (phase === 'fly' && !!city?.visible && city.visible); pin.material.opacity = phase === 'city' ? 1 : .0; }
    updateOverlays(camera.position.length() - EARTH_R, now);
    renderer.render(scene, camera);
  }

  // Rotation à la souris ou au doigt (uniquement quand on voit la Terre entière).
  const onDown = e => { if (phase !== 'orbit') return; dragging = true; lastX = e.clientX; lastY = e.clientY; vX = vY = 0; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = e => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY, s = 2.4 / Math.min(W, H * 2); spinY += dx * s; spinX = THREE.MathUtils.clamp(spinX + dy * s, -1.1, 1.1); vX = dx * s * .5; vY = dy * s * .5; lastX = e.clientX; lastY = e.clientY; };
  const onUp = e => { if (!dragging) return; dragging = false; idleSince = performance.now(); canvas.releasePointerCapture?.(e.pointerId); };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(resize); ro.observe(container);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([en]) => { visible = en.isIntersecting; }) : null;
  io?.observe(container);
  resize();
  raf = requestAnimationFrame(frame);

  const api = {
    // Plonge vers la scène du profil choisi ; `done` est appelé à l'arrivée.
    flyTo(kind, sector, name, done) {
      last = { kind, sector, name };
      const go = () => {
        placeCity(last.kind, last.sector, last.name);   // valeurs à jour si modifiées pendant le retour
        if (reduce) { phase = 'city'; cityT0 = performance.now(); done && done(); return; }
        flight = { t0: performance.now(), dur: 7000, fromX: earthGroup.rotation.x, fromY: earthGroup.rotation.y, done };
        phase = 'fly';
      };
      if (phase === 'city' || phase === 'fly') this.back(go); else go();
    },
    back(done) {
      if (phase === 'orbit') { done && done(); return; }
      if (reduce) { phase = 'orbit'; spinX = ts.x; spinY = ts.y + .7; done && done(); return; }
      const ang = phase === 'city' ? ((performance.now() - cityT0) / 1000) * .045 : 0;
      flight = { t0: performance.now(), dur: 2600, ang, done };
      phase = 'return';
    },
    // Met à jour la ville sans refaire le vol (nom ou secteur modifié).
    refresh(kind, sector, name) { last = { kind, sector, name }; if (phase === 'city' || phase === 'fly') { const vis = !!city?.visible; placeCity(kind, sector, name); city.visible = vis; } },
    get phase() { return phase; },
    dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io?.disconnect(); renderer.dispose(); canvas.remove(); veil.remove(); },
    // Accès pour les tests automatisés.
    debug: { scene, camera, renderer, fog, hemi, citySun, sun, ambient, seek: v => { forcedK = v; } },
  };
  container.__earth = api;
  return api;
}
