import { fmtMoney, clamp } from './util.js';
import { BOUNDS } from './world.js';
import { CHARACTERS } from './missions.js';

const $ = (id) => document.getElementById(id);

const ICONS = {
  hospital: ['H', '#e74c3c'], police: ['★', '#2e86de'], bank: ['$', '#27ae60'], market: ['M', '#f39c12'],
  bus: ['G', '#f1c40f'], mosque: ['☾', '#2e8b57'], garage: ['🔧', '#c0392b'], univ: ['U', '#8e44ad'], home: ['⌂', '#ffffff'],
};

export class Hud {
  constructor(G) {
    this.G = G;
    this.el = {};
    for (const id of ['money', 'stars', 'clock', 'weapon', 'help', 'objective', 'subtitle', 'areaname', 'vehname', 'radioname',
      'bigmsg', 'letterbox', 'wheel', 'crosshair', 'hpbar', 'arbar', 'toasts', 'timer', 'fullmap', 'credits', 'hud']) this.el[id] = $(id);
    this.mm = $('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.big = this.big.bind(this);
    this.subQueue = [];
    this.subT = 0;
    this.helpT = 0;
    this.bigT = 0;
    this.areaT = 0;
    this.vehT = 0;
    this.radioT = 0;
    this.starFlash = 0;
    this.lastArea = '';
    this.gpsT = 0;
    this.gps = null;
    this.waypoint = null;
    this.mapOpen = false;
    this.bigMap = $('bigmap');
    this.bigMap.addEventListener('click', (e) => this.mapClick(e));
    this.mm.addEventListener('click', () => this.toggleMap());
    this.buildWheel();
  }

  // ------------------------------------------------------------ messages
  toast(msg) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 3200);
  }

  help(html, dur = 5) {
    this.el.help.innerHTML = html;
    this.el.help.classList.add('show');
    this.helpT = dur;
  }

  objective(html) {
    if (this._obj === html) return;
    this._obj = html;
    this.el.objective.innerHTML = html;
    this.el.objective.classList.toggle('show', !!html);
  }

  clearSubtitles() {
    this.subQueue.length = 0;
    this.subT = 0;
    this.showLine(null);
  }

  subtitle(who, text, color) {
    this.subQueue.push({ who, text, color, dur: 2.4 + text.length * 0.045 });
  }

  showLine(line) {
    this.el.subtitle.innerHTML = line ? `<b style="color:${line.color}">${line.who} :</b> ${line.text}` : '';
    this.el.subtitle.classList.toggle('show', !!line);
  }

  big(title, sub = '', kind = 'title') {
    const b = this.el.bigmsg;
    b.className = 'show ' + kind;
    b.querySelector('h1').textContent = title;
    b.querySelector('p').textContent = sub;
    this.bigT = kind === 'title' ? 3 : 4.5;
  }

  timer(sec) {
    const t = this.el.timer;
    if (sec == null) { t.classList.remove('show'); return; }
    const s = Math.max(0, Math.ceil(sec));
    t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    t.classList.add('show');
    t.classList.toggle('urgent', s <= 10);
  }

  flashStars() { this.starFlash = 1.2; }

  vehName(name) {
    this.el.vehname.textContent = name;
    this.el.vehname.classList.add('show');
    this.vehT = 2.5;
  }

  radioName(st) {
    this.el.radioname.innerHTML = st.kind === 'off' ? 'Radio coupée' : `${st.name}<small>${st.sub}</small>`;
    this.el.radioname.classList.add('show');
    this.radioT = 2.5;
  }

  letterbox(on) { this.el.letterbox.classList.toggle('show', on); this.el.hud.classList.toggle('cine', on); }

  credits() {
    this.el.credits.classList.add('show');
    this.G.paused = true;
    document.exitPointerLock?.();
  }

  // ------------------------------------------------------------ roue des personnages
  buildWheel() {
    const w = this.el.wheel;
    w.innerHTML = '';
    CHARACTERS.forEach((c, i) => {
      const d = document.createElement('button');
      d.className = 'char';
      d.style.setProperty('--c', c.color);
      d.innerHTML = `<span class="k">${i + 1}</span><span class="face" style="background:${c.look.skin}"><i style="background:${c.look.top.startsWith('wax') ? c.color : c.look.top}"></i></span><b>${c.name}</b><em data-money></em>`;
      d.addEventListener('click', () => this.G.switchTo(i));
      w.appendChild(d);
    });
  }

  showWheel(on) {
    if (on) {
      [...this.el.wheel.children].forEach((d, i) => {
        d.classList.toggle('cur', i === this.G.player.charIdx);
        d.querySelector('[data-money]').textContent = fmtMoney(this.G.chars[i].money);
      });
    }
    this.el.wheel.classList.toggle('show', on);
  }

  // ------------------------------------------------------------ boucle
  update(dt) {
    const G = this.G, pl = G.player;
    this.el.money.textContent = fmtMoney(pl.money);
    const lvl = G.police.level;
    let s = '';
    const flashing = lvl > 0 && !G.police.seen && Math.floor(G.time * 3) % 2 === 0;
    for (let i = 1; i <= 5; i++) s += `<i class="${i <= lvl ? (flashing ? 'on dim' : 'on') : ''}">★</i>`;
    this.el.stars.innerHTML = s;
    this.el.stars.classList.toggle('active', lvl > 0);
    this.el.stars.classList.toggle('flash', this.starFlash > 0);
    this.starFlash -= dt;
    const h = G.sky.hour;
    this.el.clock.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    this.el.weapon.innerHTML = pl.weapon === 1 ? `Pistolet <b>${pl.ammo}</b>` : 'Poings';
    this.el.hpbar.style.width = clamp(pl.health, 0, 100) + '%';
    this.el.hpbar.classList.toggle('low', pl.health < 30);
    this.el.arbar.style.width = clamp(pl.armor, 0, 100) + '%';
    this.el.crosshair.classList.toggle('show', !pl.vehicle && !pl.dead && !G.cutscene && pl.weapon === 1);

    // Sous-titres
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.showLine(null);
    }
    if (this.subT <= 0 && this.subQueue.length && !G.cutscene) {
      const l = this.subQueue.shift();
      this.showLine(l);
      this.subT = l.dur;
    }
    for (const k of ['help', 'big', 'area', 'veh', 'radio']) {
      const key = k + 'T';
      if (this[key] > 0) {
        this[key] -= dt;
        if (this[key] <= 0) {
          const el = { help: this.el.help, big: this.el.bigmsg, area: this.el.areaname, veh: this.el.vehname, radio: this.el.radioname }[k];
          el.classList.remove('show');
        }
      }
    }
    const area = G.world.areaName(pl.x, pl.z);
    if (area !== this.lastArea) {
      this.lastArea = area;
      this.el.areaname.textContent = area;
      this.el.areaname.classList.add('show');
      this.areaT = 3.5;
    }

    this.gpsT -= dt;
    if (this.gpsT <= 0) { this.gpsT = 0.5; this.computeGps(); }
    this.drawMinimap();
    if (this.mapOpen) this.drawBigMap();
  }

  goalTarget() {
    const goal = this.G.missions.goal;
    if (goal && goal.kind !== 'enemy') return { x: goal.x, z: goal.z, color: '#f5d742' };
    if (goal && goal.kind === 'enemy' && goal.x !== undefined) return { x: goal.x, z: goal.z, color: '#e74c3c' };
    if (this.waypoint) return { x: this.waypoint.x, z: this.waypoint.z, color: '#b469ff' };
    return null;
  }

  computeGps() {
    const G = this.G, W = G.world, t = this.goalTarget();
    if (!t) { this.gps = null; return; }
    const P = G.player.pos();
    if (this.waypoint && !G.missions.goal && Math.hypot(P.x - this.waypoint.x, P.z - this.waypoint.z) < 15) { this.waypoint = null; this.gps = null; return; }
    if (Math.hypot(P.x - t.x, P.z - t.z) < 40) { this.gps = { pts: [[P.x, P.z], [t.x, t.z]], color: t.color }; return; }
    const a = W.nearestNode(P.x, P.z), b = W.nearestNode(t.x, t.z);
    const path = W.path(a, b);
    this.gps = { pts: [[P.x, P.z], ...path.map((n) => [n.x, n.z]), [t.x, t.z]], color: t.color };
  }

  blips() {
    const G = this.G, out = [];
    for (const v of G.traffic.list) {
      if (v.isCop && v.siren && !v.dead) out.push({ x: v.x, z: v.z, kind: 'cop' });
    }
    const goal = G.missions.goal;
    if (goal) {
      if (goal.list) for (const p of goal.list) out.push({ x: p.x, z: p.z, kind: 'enemy', edge: true });
      else out.push({ x: goal.x, z: goal.z, kind: goal.kind === 'enemy' ? 'enemy' : goal.kind === 'veh' ? 'veh' : 'goal', edge: true });
    }
    if (this.waypoint) out.push({ x: this.waypoint.x, z: this.waypoint.z, kind: 'way', edge: true });
    for (const b of G.missions.blips()) out.push({ ...b, edge: false });
    return out;
  }

  drawBlip(g, x, y, b, scale = 1) {
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    if (b.kind === 'cop') {
      g.fillStyle = Math.floor(this.G.time * 6) % 2 ? '#e74c3c' : '#2e86de';
      g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
    } else if (b.kind === 'mission') {
      g.fillStyle = b.color; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 11px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.letter, 0, 1);
    } else if (b.kind === 'icon') {
      const [ch, col] = ICONS[b.icon] || ['•', '#fff'];
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
      g.fillStyle = col; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, 0, 1);
    } else {
      const col = { enemy: '#e74c3c', veh: '#4fb3ff', goal: '#f5d742', way: '#b469ff' }[b.kind];
      g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill(); g.stroke();
    }
    g.restore();
  }

  drawMinimap() {
    const G = this.G, pl = G.player, g = this.mmCtx, c = this.mm;
    const W = c.width, H = c.height, cx = W / 2, cy = H * 0.64;
    const P = pl.pos();
    const sp = pl.vehicle ? pl.vehicle.speed : 0;
    const zoom = pl.vehicle ? clamp(1.2 - sp / 60, 0.55, 1.2) : 1.5;
    const yaw = G.camera.yaw;
    const ang = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const toS = (x, z) => {
      const dx = (x - P.x) * zoom, dz = (z - P.z) * zoom;
      return [cx + dx * ca - dz * sa, cy + dx * sa + dz * ca];
    };
    g.fillStyle = '#2b5876';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    g.scale(zoom, zoom);
    g.translate(-(P.x - BOUNDS.x0), -(P.z - BOUNDS.z0));
    g.drawImage(G.world.mapCanvas, 0, 0);
    if (this.gps) {
      g.strokeStyle = this.gps.color; g.lineWidth = 5 / zoom; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      this.gps.pts.forEach(([x, z], i) => (i ? g.lineTo(x - BOUNDS.x0, z - BOUNDS.z0) : g.moveTo(x - BOUNDS.x0, z - BOUNDS.z0)));
      g.stroke();
    }
    if (G.police.level > 0) {
      const ls = G.police.lastSeen;
      g.fillStyle = Math.floor(G.time * 2) % 2 ? 'rgba(231,76,60,0.18)' : 'rgba(46,134,222,0.18)';
      g.beginPath(); g.arc(ls.x - BOUNDS.x0, ls.z - BOUNDS.z0, G.police.searchRadius, 0, 7); g.fill();
    }
    g.restore();
    // Icônes de lieux proches
    for (const l of G.world.labels) {
      if (!ICONS[l.kind]) continue;
      const [x, y] = toS(l.x, l.z);
      if (x > 8 && x < W - 8 && y > 8 && y < H - 8) this.drawBlip(g, x, y, { kind: 'icon', icon: l.kind }, 0.9);
    }
    for (const b of this.blips()) {
      let [x, y] = toS(b.x, b.z);
      if (b.edge || b.kind === 'mission') { x = clamp(x, 8, W - 8); y = clamp(y, 8, H - 8); }
      else if (x < 0 || y < 0 || x > W || y > H) continue;
      this.drawBlip(g, x, y, b);
    }
    // Joueur
    const fh = pl.vehicle ? pl.vehicle.h : pl.h;
    const [hx, hy] = toS(P.x + Math.sin(fh), P.z + Math.cos(fh));
    const pa = Math.atan2(hy - cy, hx - cx);
    g.save();
    g.translate(cx, cy); g.rotate(pa + Math.PI / 2);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // Nord
    const [nx, ny] = toS(P.x, P.z - 1000);
    const na = Math.atan2(ny - cy, nx - cx);
    const r = Math.min(W, H) / 2 - 10;
    const px = clamp(cx + Math.cos(na) * 400, 10, W - 10), py = clamp(cy + Math.sin(na) * 400, 10, H - 10);
    void r;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(px, py, 7, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', px, py + 1);
  }

  // ------------------------------------------------------------ grande carte
  toggleMap(force) {
    this.mapOpen = force ?? !this.mapOpen;
    this.el.fullmap.classList.toggle('show', this.mapOpen);
    this.G.paused = this.mapOpen;
    if (this.mapOpen) { document.exitPointerLock?.(); this.drawBigMap(); }
  }

  mapGeom() {
    const c = this.bigMap;
    const W = (c.width = c.clientWidth * devicePixelRatio), H = (c.height = c.clientHeight * devicePixelRatio);
    const mw = BOUNDS.x1 - BOUNDS.x0, mh = BOUNDS.z1 - BOUNDS.z0;
    const s = Math.min(W / mw, H / mh) * 0.95;
    return { W, H, s, ox: (W - mw * s) / 2, oz: (H - mh * s) / 2 };
  }

  mapClick(e) {
    const { s, ox, oz } = this.mapGeom();
    const r = this.bigMap.getBoundingClientRect();
    const px = (e.clientX - r.left) * devicePixelRatio, py = (e.clientY - r.top) * devicePixelRatio;
    const x = (px - ox) / s + BOUNDS.x0, z = (py - oz) / s + BOUNDS.z0;
    if (this.waypoint && Math.hypot(this.waypoint.x - x, this.waypoint.z - z) < 30) this.waypoint = null;
    else this.waypoint = { x, z };
    this.gpsT = 0;
    this.computeGps();
    this.drawBigMap();
  }

  drawBigMap() {
    const G = this.G, g = this.bigMap.getContext('2d');
    const { W, H, s, ox, oz } = this.mapGeom();
    const T = (x, z) => [ox + (x - BOUNDS.x0) * s, oz + (z - BOUNDS.z0) * s];
    g.fillStyle = '#1f4560'; g.fillRect(0, 0, W, H);
    g.drawImage(G.world.mapCanvas, ox, oz, (BOUNDS.x1 - BOUNDS.x0) * s, (BOUNDS.z1 - BOUNDS.z0) * s);
    if (this.gps) {
      g.strokeStyle = this.gps.color; g.lineWidth = 4 * devicePixelRatio; g.lineJoin = 'round';
      g.beginPath();
      this.gps.pts.forEach(([x, z], i) => { const [a, b] = T(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.stroke();
    }
    const dpr = devicePixelRatio;
    const districts = [['ADJAMÉ', -330, -625], ['LE PLATEAU', -210, 190], ['COCODY', 470, 60], ['FORÊT DU BANCO', -560, -520],
      ['LAGUNE ÉBRIÉ', -320, 470], ['BAIE DE COCODY', 132, 330]];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [n, x, z] of districts) {
      const [a, b] = T(x, z);
      g.font = `600 ${Math.round(22 * dpr)}px "Bebas Neue", "Barlow Condensed", sans-serif`;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillText(n, a, b);
    }
    g.font = `600 ${Math.round(11 * dpr)}px "Barlow Condensed", sans-serif`;
    for (const l of G.world.labels) {
      const [a, b] = T(l.x, l.z);
      if (ICONS[l.kind]) this.drawBlip(g, a, b, { kind: 'icon', icon: l.kind }, dpr);
      else { g.fillStyle = '#fff'; g.beginPath(); g.arc(a, b, 3 * dpr, 0, 7); g.fill(); }
      g.fillStyle = '#fff';
      g.fillText(l.name, a, b + l.dy * dpr);
    }
    for (const b of this.blips()) {
      const [a, c] = T(b.x, b.z);
      this.drawBlip(g, a, c, b, dpr * 1.2);
    }
    const pl = G.player, P = pl.pos();
    const [px, py] = T(P.x, P.z);
    const fh = pl.vehicle ? pl.vehicle.h : pl.h;
    g.save(); g.translate(px, py); g.rotate(Math.atan2(Math.cos(fh), Math.sin(fh)) + Math.PI / 2);
    g.scale(dpr * 1.4, dpr * 1.4);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
