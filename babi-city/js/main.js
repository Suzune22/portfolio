import * as THREE from 'three';
import { World } from './world.js';
import { Peds, makeHuman, animHuman, randomLook } from './people.js';
import { Traffic } from './vehicles.js';
import { Police } from './police.js';
import { Effects } from './effects.js';
import { Combat, Pickups } from './combat.js';
import { Audio } from './audio.js';
import { Missions, CHARACTERS } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { clamp, lerp, wrapAngle } from './util.js';

const SAVE_KEY = 'babi-city-save-v1';
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Ciel, soleil et cycle jour/nuit (une journée = 16 minutes)
// ---------------------------------------------------------------------------
class Sky {
  constructor(scene) {
    this.scene = scene;
    this.hour = 15.5;
    this.night = 0;
    this.hemi = new THREE.HemisphereLight('#d6ecff', '#8a7458', 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 10; c.far = 600;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);
    scene.fog = new THREE.Fog('#9cc8e6', 140, 560);
    scene.background = new THREE.Color('#9cc8e6');
    this.cDay = new THREE.Color('#9cc8e6');
    this.cSet = new THREE.Color('#f0a35e');
    this.cNight = new THREE.Color('#0b1430');
    this.tmp = new THREE.Color();
  }

  update(dt, P, world) {
    this.hour = (this.hour + dt * (24 / 960)) % 24;
    const a = ((this.hour - 6) / 12) * Math.PI;
    const elev = Math.sin(a);
    this.night = clamp((0.12 - elev) / 0.3, 0, 1);
    const sunset = clamp(1 - Math.abs(elev) / 0.35, 0, 1) * (1 - this.night * 0.6);
    const col = this.tmp.copy(this.cDay).lerp(this.cSet, sunset * 0.75).lerp(this.cNight, this.night);
    this.scene.background.copy(col);
    this.scene.fog.color.copy(col);
    this.scene.fog.far = lerp(560, 420, this.night);
    const e = Math.max(elev, 0.18);
    this.sun.position.set(P.x - Math.cos(a) * 220, e * 260, P.z + 90);
    this.sun.target.position.set(P.x, 0, P.z);
    this.sun.intensity = Math.min(1, Math.max(0, elev) * 1.6) * 2.6 * (1 - this.night) + 0.05;
    this.sun.color.set(sunset > 0.3 ? '#ffc58a' : '#fff1d6');
    this.hemi.intensity = lerp(1.25, 0.6, this.night);
    this.hemi.color.set(this.night > 0.5 ? '#6f86c9' : '#cfe6ff');
    world.setNight(this.night);
  }
}

// ---------------------------------------------------------------------------
// Caméra à la troisième personne
// ---------------------------------------------------------------------------
class CameraRig {
  constructor(G, cam) {
    this.G = G;
    this.cam = cam;
    this.yaw = 0;
    this.pitch = 0.22;
    this.mouseT = 10;
    this.shake = 0;
    this.dist = 4.6;
    this.target = new THREE.Vector3();
    this.dir = new THREE.Vector3();
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return this.dir.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  update(dt) {
    const G = this.G, I = G.input, pl = G.player, cam = this.cam;
    if (G.switching) return;
    if (G.cutscene) {
      const P = pl.pos(), t = G.time * 0.15;
      cam.position.set(P.x + Math.sin(t) * 9, 3.2, P.z + Math.cos(t) * 9);
      cam.lookAt(P.x, 1.4, P.z);
      return;
    }
    const sens = I.touch ? 0.004 : 0.0024;
    if (I.mouse.dx || I.mouse.dy) {
      this.yaw -= I.mouse.dx * sens;
      this.pitch = clamp(this.pitch + I.mouse.dy * sens * 0.8, -0.35, 1.1);
      this.mouseT = 0;
    }
    this.mouseT += dt;
    const v = pl.vehicle;
    let dist, h;
    if (v) {
      if (this.mouseT > 1.2 && v.fwdSpeed > 1) {
        this.yaw += wrapAngle(v.h - this.yaw) * Math.min(1, dt * 2.5);
        this.pitch += (0.2 - this.pitch) * Math.min(1, dt * 1.5);
      }
      dist = 5.5 + v.spec.len + v.speed * 0.04;
      h = v.spec.h + 0.6;
      this.target.set(v.x, h, v.z);
    } else {
      dist = pl.aiming ? 2.3 : 4.4;
      this.target.set(pl.x, 1.55 + pl.y, pl.z);
      if (pl.dead) dist = 7;
    }
    this.dist += (dist - this.dist) * Math.min(1, dt * 6);
    const d = this.lookDir();
    if (pl.aiming && !v) {
      this.target.x += -Math.cos(this.yaw) * 0.55;
      this.target.z += Math.sin(this.yaw) * 0.55;
    }
    // Recul de la caméra limité par les bâtiments
    let use = this.dist;
    for (let s = 0.5; s <= this.dist; s += 0.5) {
      const x = this.target.x - d.x * s, y = this.target.y - d.y * s, z = this.target.z - d.z * s;
      if (G.world.insideBuilding(x, y, z)) { use = Math.max(0.6, s - 0.5); break; }
    }
    cam.position.set(this.target.x - d.x * use, Math.max(0.4, this.target.y - d.y * use), this.target.z - d.z * use);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    cam.lookAt(cam.position.x + d.x, cam.position.y + d.y, cam.position.z + d.z);
    const fov = v ? 62 + Math.min(14, v.speed * 0.3) : pl.aiming ? 50 : 60;
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
  }
}

// ---------------------------------------------------------------------------
// Joueur
// ---------------------------------------------------------------------------
class Player {
  constructor(G) {
    this.G = G;
    this.models = CHARACTERS.map((c) => {
      const m = makeHuman(c.look);
      m.visible = false;
      G.scene.add(m);
      return m;
    });
    this.charIdx = 1;
    this.x = 0; this.z = 0; this.y = 0; this.vy = 0; this.h = 0;
    this.health = 100; this.armor = 0;
    this.vehicle = null;
    this.weapon = 1; this.ammo = 120;
    this.phase = 0; this.dead = false; this.deadT = 0;
    this.shootCd = 0; this.punchCd = 0; this.aiming = false; this.hurtT = 10; this.kvx = 0; this.kvz = 0;
  }

  get model() { return this.models[this.charIdx]; }
  get money() { return this.G.chars[this.charIdx].money; }
  addMoney(n) { this.G.chars[this.charIdx].money = Math.max(0, this.G.chars[this.charIdx].money + n); }
  pos() { return this.vehicle ? { x: this.vehicle.x, z: this.vehicle.z } : { x: this.x, z: this.z }; }

  teleport(x, z, h = this.h) {
    if (this.vehicle) this.exitVehicle(true);
    this.x = x; this.z = z; this.h = h; this.y = 0;
    this.sync();
  }

  sync() {
    const m = this.model;
    m.position.set(this.x, this.y, this.z);
    m.rotation.y = this.h;
    m.visible = !this.vehicle;
  }

  hurt(amount, src) {
    const G = this.G;
    if (this.dead || G.cutscene || G.switching) return;
    if (this.armor > 0) {
      const a = Math.min(this.armor, amount * 0.66);
      this.armor -= a; amount -= a;
    }
    this.health -= amount;
    this.hurtT = 0;
    $('damage').classList.remove('hit'); void $('damage').offsetWidth; $('damage').classList.add('hit');
    if (this.health <= 0) { this.health = 0; G.wasted(src); }
  }

  enterVehicle(v) {
    const G = this.G;
    if (v.driver === 'ai') {
      // Braquage du conducteur
      const side = { x: v.x + Math.cos(v.h) * (v.spec.wid / 2 + 0.8), z: v.z - Math.sin(v.h) * (v.spec.wid / 2 + 0.8) };
      if (!v.mission) {
        const p = G.peds.spawnAt(side.x, side.z, randomLook('plateau'));
        p.mode = 'flee'; p.fx = this.x; p.fz = this.z; p.t = 8;
      }
      if (v.isCop) G.police.crime(1, v.x, v.z, true);
      else G.police.crime(0.2, v.x, v.z, Math.random() < 0.3);
      G.peds.panic(v.x, v.z, 15);
    }
    if (G.police.units.includes(v)) G.police.units.splice(G.police.units.indexOf(v), 1);
    this.vehicle = v;
    v.driver = 'player';
    v.ai = null;
    v.persistent = false;
    v.siren = false;
    this.aiming = false;
    this.sync();
    G.hud.vehName(v.spec.name);
    G.audio.setRadio(true);
    if (['taxi', 'woro'].includes(v.type) && !G.missions.active) G.hud.help('Appuie sur <kbd>J</kbd> pour faire des courses avec des clients.', 5);
  }

  exitVehicle(force = false) {
    const G = this.G, v = this.vehicle;
    if (!v) return;
    const W = G.world;
    const opts = [
      [Math.cos(v.h), -Math.sin(v.h), v.spec.wid / 2 + 0.9], [-Math.cos(v.h), Math.sin(v.h), v.spec.wid / 2 + 0.9],
      [-Math.sin(v.h), -Math.cos(v.h), v.spec.len / 2 + 1], [Math.sin(v.h), Math.cos(v.h), v.spec.len / 2 + 1],
    ];
    let placed = false;
    for (const [dx, dz, d] of opts) {
      const x = v.x + dx * d, z = v.z + dz * d;
      if (W.isWalkable(x, z) && !W.pushCircle(x, z, 0.35)) { this.x = x; this.z = z; placed = true; break; }
    }
    if (!placed) { this.x = v.x + opts[0][0] * opts[0][2]; this.z = v.z + opts[0][1] * opts[0][2]; }
    this.h = v.h;
    const sp = v.speed;
    if (sp > 10 && !force) { this.hurt(Math.min(40, sp), 'chute'); this.kvx = v.vx * 0.5; this.kvz = v.vz * 0.5; }
    v.driver = null;
    v.throttle = 0;
    this.vehicle = null;
    this.sync();
    G.audio.setRadio(false);
    G.audio.engine(false, 0, 0);
  }

  nearestVehicle() {
    let best = null, bd = Infinity;
    for (const v of this.G.traffic.list) {
      if (v.dead) continue;
      const d = Math.hypot(v.x - this.x, v.z - this.z) - v.spec.len / 2;
      if (d < 2.6 && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  shoot() {
    const G = this.G, cam = G.camera, d = cam.lookDir();
    if (this.ammo <= 0) { G.hud.help('Plus de munitions. Achète-en chez… euh, trouve-en.', 2); this.weapon = 0; return; }
    this.ammo--;
    const cp = G.cam3.position;
    const hx = this.x, hy = 1.45 + this.y, hz = this.z;
    const t0 = Math.max(0, (hx - cp.x) * d.x + (hy - cp.y) * d.y + (hz - cp.z) * d.z);
    const ox = cp.x + d.x * t0, oy = cp.y + d.y * t0, oz = cp.z + d.z * t0;
    const r = G.combat.ray(ox, oy, oz, d.x, d.y, d.z, 140);
    const ex = ox + d.x * r.t, ey = oy + d.y * r.t, ez = oz + d.z * r.t;
    const sx = hx + Math.sin(this.h) * 0.5 - Math.cos(this.h) * 0.3, sz = hz + Math.cos(this.h) * 0.5 + Math.sin(this.h) * 0.3;
    G.effects.tracer(sx, hy, sz, ex, ey, ez);
    G.effects.emit('spark', sx, hy, sz, 2);
    G.audio.gunshot(this.x, this.z);
    G.peds.panic(this.x, this.z, 45);
    G.police.crime(0.15, this.x, this.z, false);
    if (r.hit?.kind === 'ped') {
      G.effects.emit('blood', ex, ey, ez, 5);
      G.peds.damage(r.hit.p, ey > r.hit.p.y + 1.55 ? 200 : 60, this.x, this.z, true);
    } else if (r.hit?.kind === 'veh') {
      const v = r.hit.v;
      G.effects.emit('spark', ex, ey, ez, 4);
      v.damage(9, true);
      if (v.isCop) G.police.crime(0.4, v.x, v.z, true);
      else if (v.driver === 'ai' && v.ai && v.ai.mode === 'traffic' && !v.mission) { v.ai.mode = 'flee'; v.ai.cruise = v.spec.max * 0.7; v.ai.next = null; }
    } else if (r.t < 140) G.effects.emit('dust', ex, ey, ez, 2);
    G.camera.shake = Math.max(G.camera.shake, 0.06);
  }

  punch() {
    const G = this.G;
    G.audio.punch();
    for (const p of G.peds.list) {
      if (p.mode === 'dead' || p.attached) continue;
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
      if (d > 1.7) continue;
      if (Math.abs(wrapAngle(Math.atan2(dx, dz) - this.h)) > 0.9) continue;
      G.peds.damage(p, 55, this.x, this.z, true);
      if (p.mode === 'dead') { p.kvx = dx / d * 3; p.kvz = dz / d * 3; }
      G.police.crime(0.15, p.x, p.z, false);
      break;
    }
  }

  update(dt) {
    const G = this.G, I = G.input;
    this.hurtT += dt;
    if (this.health < 50 && this.hurtT > 5 && !this.dead) this.health = Math.min(50, this.health + dt * 2);
    if (this.dead) {
      this.deadT += dt;
      return;
    }
    const frozen = G.cutscene || G.switching || G.paused;
    if (this.vehicle) {
      const v = this.vehicle;
      if (frozen) { v.throttle = 0; v.steer = 0; v.handbrake = true; }
      else {
        v.throttle = I.axisY();
        v.steer = -I.axisX();
        v.handbrake = I.down('Space');
        if (I.hit('KeyH')) G.audio.horn(v.x, v.z);
        if (I.hit('KeyF')) { this.exitVehicle(); return; }
        if (v.state === 'burning' && Math.random() < dt) G.hud.help('Le véhicule prend feu ! Sors vite (<kbd>F</kbd>) !', 2);
      }
      G.audio.engine(v.state === 'ok', v.speed, v.throttle);
      this.x = v.x; this.z = v.z;
      return;
    }
    if (frozen) { animHuman(this.model, this.phase, 0); return; }
    const cam = G.camera;
    const ax = I.axisX(), ay = I.axisY();
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx;
    let mx = fx * ay + rx * ax, mz = fz * ay + rz * ax;
    const len = Math.hypot(mx, mz);
    this.aiming = this.weapon === 1 && (I.mouse.right || (I.touch && I.mouse.left));
    const run = I.down('ShiftLeft') || I.down('ShiftRight') || (I.touch && len > 0.9);
    let speed = len > 0.1 ? (run ? 6.4 : 2.6) : 0;
    if (this.aiming) { speed = Math.min(speed, 2.2); this.h += wrapAngle(cam.yaw - this.h) * Math.min(1, dt * 15); }
    else if (len > 0.1) this.h += wrapAngle(Math.atan2(mx, mz) - this.h) * Math.min(1, dt * 12);
    if (len > 0.1) { mx /= len; mz /= len; }
    const W = G.world;
    let nx = this.x + mx * speed * dt + this.kvx * dt, nz = this.z + mz * speed * dt + this.kvz * dt;
    this.kvx *= 1 - Math.min(1, dt * 4); this.kvz *= 1 - Math.min(1, dt * 4);
    if (W.isWalkable(nx, nz)) { this.x = nx; this.z = nz; }
    const res = W.pushCircle(this.x, this.z, 0.35, 0.6 + this.y);
    if (res) { this.x += res.dx; this.z += res.dz; }
    // Pas à travers les véhicules
    for (const v of G.traffic.list) {
      if (Math.abs(v.x - this.x) > 5 || Math.abs(v.z - this.z) > 5) continue;
      const { lx, lz } = v.local(this.x, this.z);
      const hw = v.spec.wid / 2 + 0.35, hl = v.spec.len / 2 + 0.35;
      if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
        if (v.speed > 6 && v.driver === 'ai') {
          this.hurt(v.speed * 1.6, 'voiture');
          this.kvx = v.vx * 0.9; this.kvz = v.vz * 0.9;
        }
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
        const s = Math.sin(v.h), c = Math.cos(v.h);
        if (px < pz) { const k = Math.sign(lx) * px; this.x += c * k; this.z -= s * k; }
        else { const k = Math.sign(lz) * pz; this.x += s * k; this.z += c * k; }
      }
    }
    if (I.hit('Space') && this.y === 0) this.vy = 5.2;
    this.vy -= 16 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
    this.phase += dt * speed * 3.1;
    animHuman(this.model, this.phase, speed > 0 ? clamp(speed * 0.18, 0.35, 0.95) : 0, this.aiming);

    this.shootCd -= dt; this.punchCd -= dt;
    if (I.hit('KeyX')) this.weapon = this.weapon === 1 ? 0 : (this.ammo > 0 ? 1 : 0);
    if (this.weapon === 1 && I.mouse.left && this.shootCd <= 0 && (this.aiming || I.locked || I.touch)) { this.shootCd = 0.24; this.shoot(); }
    if (this.weapon === 0 && I.mouse.leftPressed && this.punchCd <= 0) { this.punchCd = 0.45; this.punch(); }

    if (I.hit('KeyF')) {
      const v = this.nearestVehicle();
      if (v) this.enterVehicle(v);
    } else {
      const v = this.nearestVehicle();
      if (v && !G.hud.el.help.classList.contains('show')) G.hud.help(`Appuie sur <kbd>F</kbd> pour ${v.driver === 'ai' ? 'braquer' : 'monter dans'} : ${v.spec.name}.`, 1.2);
    }
    this.sync();
  }
}

// ---------------------------------------------------------------------------
// Jeu
// ---------------------------------------------------------------------------
class Game {
  constructor() {
    const canvas = $('game');
    this.canvas = canvas;
    const dpr = Math.min(devicePixelRatio, 1.5);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 1.5, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.cam3 = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 1400);
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.cam3.aspect = innerWidth / innerHeight;
      this.cam3.updateProjectionMatrix();
      if (this.hud.mapOpen) this.hud.drawBigMap();
    });

    this.time = 0;
    this.paused = true;
    this.cutscene = null;
    this.switching = null;
    this.stats = { kills: 0, copsDown: 0 };

    this.world = new World(this.scene);
    this.sky = new Sky(this.scene);
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.effects = new Effects(this.scene);
    this.combat = new Combat(this);
    this.pickups = new Pickups(this);
    this.player = new Player(this);
    this.camera = new CameraRig(this, this.cam3);
    this.peds = new Peds(this);
    this.traffic = new Traffic(this);
    this.police = new Police(this);
    this.missions = new Missions(this);
    this.hud = new Hud(this);

    const P = this.world.places;
    this.chars = CHARACTERS.map((c) => {
      const home = P[c.home];
      return { money: c.money, x: home.x + 4, z: home.z + 10, h: Math.PI, health: 100, armor: 0, ammo: c.id === 'sery' ? 300 : 120 };
    });
    this.pickups.add('health', P.hospital.x, P.hospital.z - 2, 0, 60);
    this.pickups.add('armor', P.police.x, P.police.z + 2, 0, 90);
    this.pickups.add('health', P.bakary.x, P.bakary.z + 4, 0, 60);
    this.pickups.add('armor', P.sery.x - 6, P.sery.z - 4, 0, 90);
    this.pickups.add('health', P.forum.x + 20, P.forum.z, 0, 60);

    this.input.onLockChange = (locked) => {
      if (!locked && !this.paused && !this.input.touch && !this.hud.mapOpen && $('title').classList.contains('gone')) this.pause(true);
    };
    this.setupMenus();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ état / sauvegarde
  applyChar(i) {
    const c = this.chars[i], pl = this.player;
    pl.models.forEach((m) => (m.visible = false));
    pl.charIdx = i;
    pl.vehicle = null;
    pl.x = c.x; pl.z = c.z; pl.h = c.h; pl.y = 0;
    pl.health = c.health; pl.armor = c.armor; pl.ammo = c.ammo;
    pl.weapon = pl.ammo > 0 ? 1 : 0;
    pl.sync();
    this.camera.yaw = pl.h;
  }

  storeChar() {
    const pl = this.player, c = this.chars[pl.charIdx], P = pl.pos();
    c.x = P.x; c.z = P.z; c.h = pl.vehicle ? pl.vehicle.h : pl.h;
    c.health = Math.max(30, pl.health); c.armor = pl.armor; c.ammo = pl.ammo;
  }

  save() {
    try {
      this.storeChar();
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, done: [...this.missions.done], chars: this.chars, cur: this.player.charIdx, hour: this.sky.hour }));
    } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  }

  loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ }
    this.missions.done.clear();
    this.applyChar(1);
    const P = this.world.places.bakary;
    this.player.teleport(P.x, P.z + 12, Math.PI);
    this.camera.yaw = Math.PI;
    this.sky.hour = 15.5;
    this.startCutscene([
      { who: 'Bakary', text: "Babi. Abidjan, pour ceux qui ne connaissent pas.", color: '#4fb3ff' },
      { who: 'Bakary', text: "Ici, tout le monde court après quelque chose.", color: '#4fb3ff' },
      { who: 'Bakary', text: "Moi je cours après l'argent. Pour l'instant, c'est l'argent qui court plus vite.", color: '#4fb3ff' },
    ], () => {
      this.hud.help('Rejoins la colonne <b style="color:#4fb3ff">bleue</b> (lettre <b>B</b> sur la minimap) pour lancer la première mission.', 9);
    });
  }

  continueGame(s) {
    s.done.forEach((d) => this.missions.done.add(d));
    s.chars.forEach((c, i) => Object.assign(this.chars[i], c));
    this.sky.hour = s.hour ?? 17;
    this.applyChar(s.cur ?? 1);
    this.hud.big('Babi City', CHARACTERS[this.player.charIdx].full, 'title');
  }

  // ------------------------------------------------------------ cinématiques
  startCutscene(lines, onDone) {
    this.cutscene = { lines, i: 0, t: 0, onDone };
    this.hud.letterbox(true);
    this.hud.showLine(lines[0]);
    this.hud.objective('');
  }

  updateCutscene(dt) {
    const c = this.cutscene, I = this.input;
    c.t += dt;
    const line = c.lines[c.i];
    const dur = 2.2 + line.text.length * 0.05;
    if ((c.t > 0.4 && (I.hit('Enter') || I.hit('Space') || I.mouse.leftPressed)) || c.t > dur) {
      c.i++; c.t = 0;
      if (c.i >= c.lines.length) {
        this.cutscene = null;
        this.hud.letterbox(false);
        this.hud.showLine(null);
        c.onDone && c.onDone();
        return;
      }
      this.hud.showLine(c.lines[c.i]);
    }
  }

  // ------------------------------------------------------------ changement de personnage
  switchTo(i) {
    const pl = this.player;
    this.hud.showWheel(false);
    if (i === pl.charIdx || this.switching || this.cutscene || pl.dead) return;
    if (this.missions.active) { this.hud.help('Impossible de changer de personnage pendant une mission.', 3); return; }
    if (this.police.level > 0) { this.hud.help('Impossible de changer de personnage quand la police te recherche.', 3); return; }
    this.storeChar();
    const from = pl.pos();
    const to = { x: this.chars[i].x, z: this.chars[i].z };
    this.switching = { t: 0, from, to, idx: i, done: false, startPos: this.cam3.position.clone() };
    this.audio.whoosh();
    if (this.paused) this.pause(false);
  }

  updateSwitch(dt) {
    const s = this.switching, cam = this.cam3;
    s.t += dt;
    const H = 320, T = 1.1;
    if (s.t < T) {
      const k = s.t / T, e = k * k;
      cam.position.set(lerp(s.startPos.x, s.from.x, e), lerp(s.startPos.y, H, e), lerp(s.startPos.z, s.from.z + 1, e));
      cam.lookAt(s.from.x, 0, s.from.z);
    } else if (s.t < 2 * T) {
      if (!s.done) {
        s.done = true;
        const pl = this.player;
        if (pl.vehicle) { const v = pl.vehicle; v.driver = null; pl.vehicle = null; this.audio.setRadio(false); this.audio.engine(false, 0, 0); }
        this.applyChar(s.idx);
        this.audio.whoosh();
      }
      const k = (s.t - T) / T, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      cam.position.set(lerp(s.from.x, s.to.x, e), H, lerp(s.from.z, s.to.z, e) + 1);
      cam.lookAt(cam.position.x, 0, cam.position.z - 1);
    } else if (s.t < 3 * T) {
      const k = (s.t - 2 * T) / T, e = 1 - (1 - k) * (1 - k);
      const pl = this.player;
      const d = this.camera.lookDir();
      const tx = pl.x - d.x * 4.4, ty = 1.55 - d.y * 4.4, tz = pl.z - d.z * 4.4;
      cam.position.set(lerp(s.to.x, tx, e), lerp(H, ty, e), lerp(s.to.z + 1, tz, e));
      cam.lookAt(lerp(s.to.x, pl.x, e), lerp(0, 1.55, e), lerp(s.to.z, pl.z, e));
    } else {
      this.switching = null;
      const c = CHARACTERS[this.player.charIdx];
      this.hud.big(c.name, c.bio, 'intro');
    }
  }

  // ------------------------------------------------------------ mort / arrestation
  wasted(src) {
    const pl = this.player;
    if (pl.dead) return;
    pl.dead = true; pl.deadT = 0;
    if (pl.vehicle) { pl.vehicle.driver = null; pl.vehicle = null; this.audio.setRadio(false); this.audio.engine(false, 0, 0); }
    const u = pl.model.userData;
    u.body.rotation.x = -Math.PI / 2; u.body.position.y = 0.15;
    pl.sync();
    this.canvas.classList.add('wasted');
    this.hud.big('GÂTÉ !', 'Tu es tombé', 'wasted');
    this.audio.jingle(false);
    if (this.missions.active) this.missions.fail('Tu es mort.');
    this.police.clear();
    setTimeout(() => this.respawn(this.world.places.hospital, 2500, 'Frais d\'hôpital'), 4500);
  }

  busted() {
    const pl = this.player;
    if (pl.dead) return;
    pl.dead = true; pl.deadT = 0;
    this.canvas.classList.add('wasted');
    this.hud.big('ATTRAPÉ !', 'Les corps habillés t\'ont eu', 'wasted');
    this.audio.jingle(false);
    if (this.missions.active) this.missions.fail('Tu t\'es fait arrêter.');
    this.police.clear();
    setTimeout(() => this.respawn(this.world.places.police, 3000, 'Amende'), 4000);
  }

  respawn(place, fee, label) {
    const pl = this.player;
    const u = pl.model.userData;
    u.body.rotation.x = 0; u.body.position.y = 0;
    pl.dead = false;
    pl.health = 100;
    pl.armor = 0;
    if (pl.ammo < 30) pl.ammo = 30;
    const paid = Math.min(pl.money, fee);
    pl.addMoney(-paid);
    pl.teleport(place.x, place.z, 0);
    this.canvas.classList.remove('wasted');
    if (paid) this.hud.toast(`${label} : -${paid} FCFA`);
    this.save();
  }

  // ------------------------------------------------------------ menus
  setupMenus() {
    const title = $('title');
    const save = this.loadSave();
    const start = (fn) => {
      this.audio.init();
      title.classList.add('gone');
      this.pause(false);
      this.traffic.spawnParked();
      for (let i = 0; i < 14; i++) this.traffic.spawnTraffic(true);
      fn();
      if (!this.input.touch) this.canvas.requestPointerLock?.();
    };
    $('btn-new').addEventListener('click', () => start(() => this.newGame()));
    if (save) {
      $('btn-continue').hidden = false;
      $('btn-continue').addEventListener('click', () => start(() => this.continueGame(save)));
    }
    $('btn-resume').addEventListener('click', () => this.pause(false));
    $('btn-map').addEventListener('click', () => { $('pause').classList.remove('show'); this.hud.toggleMap(true); });
    $('btn-abort').addEventListener('click', () => { this.missions.abort(); this.pause(false); });
    $('btn-restart').addEventListener('click', () => {
      if (!confirm('Effacer la sauvegarde et recommencer depuis le début ?')) return;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ }
      location.reload();
    });
    $('btn-sound').addEventListener('click', () => {
      const m = this.audio.master;
      if (!m) return;
      m.gain.value = m.gain.value > 0 ? 0 : 0.6;
      $('btn-sound').textContent = m.gain.value > 0 ? 'Couper le son' : 'Activer le son';
    });
    $('credits').addEventListener('click', () => { $('credits').classList.remove('show'); this.pause(false); });
    $('fullmap').querySelector('.close').addEventListener('click', () => this.hud.toggleMap(false));
  }

  pause(on) {
    this.paused = on;
    $('pause').classList.toggle('show', on);
    $('btn-abort').hidden = !this.missions.active;
    if (on) document.exitPointerLock?.();
    else if (!this.input.touch && $('title').classList.contains('gone')) this.canvas.requestPointerLock?.();
  }

  // ------------------------------------------------------------ boucle principale
  handleGlobalKeys() {
    const I = this.input, H = this.hud;
    if (!$('title').classList.contains('gone')) return;
    if (I.hit('KeyM')) { $('pause').classList.remove('show'); H.toggleMap(); if (!H.mapOpen) this.pause(false); }
    if (I.hit('Escape') || I.hit('KeyP')) {
      if (H.mapOpen) { H.toggleMap(false); this.pause(false); }
      else if ($('credits').classList.contains('show')) { $('credits').classList.remove('show'); this.pause(false); }
      else this.pause(!this.paused);
    }
    if (this.paused) return;
    for (let i = 0; i < 3; i++) if (I.hit('Digit' + (i + 1)) || I.hit('Numpad' + (i + 1))) this.switchTo(i);
    H.showWheel(I.down('Tab') || I.down('KeyC'));
    if (I.hit('KeyR') && this.player.vehicle) H.radioName(this.audio.nextStation());
    if (I.hit('KeyJ') && this.player.vehicle) {
      if (!this.missions.startJob() && !this.missions.active) H.help('Les courses se font avec un <b>taxi compteur</b> ou un <b>woro-woro</b>.', 3);
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.handleGlobalKeys();
    if (!this.paused) {
      this.time += dt;
      if (this.cutscene) this.updateCutscene(dt);
      this.player.update(dt);
      this.traffic.update(dt);
      this.peds.update(dt);
      this.police.update(dt);
      this.missions.update(dt);
      this.pickups.update(dt);
      this.effects.update(dt);
      if (this.switching) this.updateSwitch(dt);
      this.camera.update(dt);
      this.sky.update(dt, this.player.pos(), this.world);
      this.audio.listener = this.player.pos();
      this.audio.update(dt);
      this.autoSaveT = (this.autoSaveT || 0) + dt;
      if (this.autoSaveT > 30 && !this.missions.active && !this.player.dead) { this.autoSaveT = 0; this.save(); }
      for (const mk of this.missions.markers.values()) mk.mesh.material.opacity = 0.45 + Math.sin(this.time * 3) * 0.12;
    }
    this.hud.update(this.paused ? 0 : dt);
    this.renderer.render(this.scene, this.cam3);
    this.input.endFrame();
  }
}

try {
  window.babi = new Game();
  $('loading').classList.add('gone');
} catch (e) {
  console.error(e);
  $('loading').innerHTML = `<p>Impossible de lancer le jeu sur cet appareil (WebGL requis).</p><pre>${String(e && e.message || e)}</pre>`;
}
