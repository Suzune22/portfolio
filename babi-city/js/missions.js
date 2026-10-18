import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { beamTexture } from './textures.js';
import { pick, fmtMoney } from './util.js';

// ---------------------------------------------------------------------------
// Les trois protagonistes (comme le trio de GTA V, mais 100 % ivoiriens)
// ---------------------------------------------------------------------------
export const CHARACTERS = [
  {
    id: 'koffi', name: 'Koffi', full: 'Koffi Ahoussou', color: '#e8b730', home: 'koffi', money: 85000,
    bio: "45 ans. Ancien « homme d'affaires » rangé dans une villa de Cocody. Sa famille lui coûte plus cher que ses anciens coups.",
    look: { skin: '#4a2c1d', top: 'wax:1', sleeve: 'wax:1', bottom: '#d5c4a1', hat: 'hair', glasses: true, beard: true, scale: 1.02 },
  },
  {
    id: 'bakary', name: 'Bakary', full: 'Bakary « Bak » Traoré', color: '#4fb3ff', home: 'bakary', money: 3500,
    bio: "24 ans. Chauffeur de gbaka à Adjamé, il fait les recouvrements du garage Moussa et rêve de plus grand.",
    look: { skin: '#5a3825', top: '#ff7f00', bottom: '#1a237e', hat: 'cap', hatColor: '#009e60', scale: 0.98 },
  },
  {
    id: 'sery', name: 'Séry', full: 'Séry « Tonnerre » Gnahoré', color: '#ff5a4f', home: 'sery', money: 12000,
    bio: "38 ans. Imprévisible, il vit dans un campement en lisière du Banco. Quand il se fâche, tout Adjamé l'entend.",
    look: { skin: '#2e1a12', top: '#4b5320', bottom: '#556b2f', beard: true, scale: 1.08 },
  },
];

const SPEAKERS = {
  Koffi: '#e8b730', Bakary: '#4fb3ff', 'Séry': '#ff5a4f', Moussa: '#7ee081', Junior: '#d7a6ff',
  Kader: '#ffb36b', Radio: '#bbbbbb', Client: '#ffffff', Cliente: '#ffffff',
};

const JUNIOR = { skin: '#4a2c1d', top: '#ffffff', bottom: '#2c3e50', hat: 'hair', scale: 0.95 };

// Itinéraire du fourgon blindé : il remonte le boulevard vers Adjamé puis file vers Cocody.
const FOURGON_ROUTE = [[-200, 150], [-200, 60], [-200, -30], [-200, -120], [-200, -220], [-200, -310], [-200, -400],
  [-200, -490], [-200, -580], [-200, -670], [-110, -670], [-20, -670], [70, -670], [280, -670], [420, -670]];

export const MISSIONS = [
  {
    id: 'b1', char: 'bakary', start: 'bakary', title: 'Recouvrement au Plateau', requires: [], reward: 15000,
    steps: [
      { type: 'cut', lines: [
        ['Moussa', "Bak ! Viens ici mon petit. Tu connais la Mercedes du gars de la Tour Babi ?"],
        ['Bakary', "Le gars qui paie jamais ? Lui il est gaou, il pense que la voiture est à lui."],
        ['Moussa', "Il me doit trois mois de crédit. Va la récupérer au Plateau, elle est garée près de la Banque Lagunaire."],
        ['Bakary', "C'est dja. Je te la ramène propre propre."],
        ['Moussa', "Et fais attention aux corps habillés, hein !"],
      ] },
      { type: 'spawnVeh', id: 'merco', kind: 'sport', color: '#111111', lane: [-245, 240, 1], mode: 'parked' },
      { type: 'getIn', id: 'merco', text: 'Va au Plateau et monte dans la <b class="y">Mercedes</b>.' },
      { type: 'say', lines: [['Bakary', "Ah, ça c'est une voiture dêh ! Moussa va être content."]] },
      { type: 'wanted', level: 1 },
      { type: 'say', lines: [['Radio', "Le propriétaire a appelé la police !"]] },
      { type: 'goto', place: 'garage', vehicle: 'merco', noWanted: true, r: 7, text: 'Ramène la <b class="y">Mercedes</b> au <b class="y">garage Moussa</b> à Adjamé.' },
      { type: 'cut', lines: [
        ['Moussa', "Ahhh mon fils ! Tu vois que tu es fort ?"],
        ['Bakary', "Fort, fort... Donne d'abord mon argent, vié père."],
        ['Moussa', "Tiens. Et reviens me voir, j'ai toujours du travail pour toi."],
      ] },
    ],
  },
  {
    id: 'b2', char: 'bakary', start: 'garage', title: 'Le voleur du Forum', requires: ['b1'], reward: 20000,
    steps: [
      { type: 'cut', lines: [
        ['Moussa', "Bak ! Un môgô a volé la caisse du garage ! Il fuit vers le Forum en voiture rouge !"],
        ['Bakary', "Quoi ?! Il est fou lui ! Je vais le daba."],
        ['Moussa', "Prends ton gbaka, il est garé devant. Vite !"],
      ] },
      { type: 'spawnVeh', id: 'gbaka', kind: 'gbaka', color: '#1e8449', at: 'bakaryCarSpot', heading: 0, mode: 'parked' },
      { type: 'spawnVeh', id: 'thief', kind: 'sedan', color: '#c0392b', lane: [-250, -310, 1], mode: 'flee', hp: 75, cruise: 17 },
      { type: 'disable', id: 'thief', maxDist: 300, text: 'Rattrape et immobilise le <b class="r">voleur</b>.' },
      { type: 'say', lines: [['Bakary', "Tu pensais aller où comme ça, petit voleur ?"]] },
      { type: 'goto', veh: 'thief', onFoot: true, r: 4, text: 'Récupère la <b class="y">caisse</b> dans la voiture du voleur.' },
      { type: 'say', lines: [['Bakary', "Moussa, j'ai la caisse. On est ensemble !"]] },
    ],
  },
  {
    id: 'k1', char: 'koffi', start: 'koffi', title: 'Le fils à papa', requires: ['b2'], reward: 0,
    protect: ['suv'],
    steps: [
      { type: 'cut', lines: [
        ['Koffi', "Junior ! Il est huit heures moins le quart ! Ton examen c'est à huit heures !"],
        ['Junior', "Papa, détends-toi. Même les profs sont en retard à Cocody."],
        ['Koffi', "J'ai pas fait vingt ans de... d'affaires pour que mon fils redouble. Monte dans le 4x4."],
      ] },
      { type: 'spawnVeh', id: 'suv', kind: 'suv', color: '#111111', at: [563, 242], heading: Math.PI, mode: 'parked' },
      { type: 'spawnPed', id: 'junior', look: JUNIOR, at: [571, 236] },
      { type: 'getIn', id: 'suv', text: 'Monte dans ton <b class="b">4x4</b>.' },
      { type: 'board', ped: 'junior', veh: 'suv' },
      { type: 'say', lines: [['Junior', "Papa, tu conduis comme un taxi compteur là..."], ['Koffi', "Tais-toi et révise !"]] },
      { type: 'goto', place: 'univ', vehicle: 'suv', r: 9, timer: 75, stop: true, text: "Dépose Junior à l'<b class=\"y\">Université FHB</b> avant 8 h." },
      { type: 'unboard', ped: 'junior' },
      { type: 'cut', lines: [
        ['Junior', "Merci papa. Au fait... il me faut 200 000 pour les polycopiés."],
        ['Koffi', "Les polycopiés. Toujours les polycopiés..."],
        ['Koffi', "(au téléphone) Allô ? Séry ? Ça fait longtemps... Oui. J'ai peut-être un travail."],
      ] },
    ],
  },
  {
    id: 's1', char: 'sery', start: 'sery', title: 'Tonnerre sur Adjamé', requires: ['k1'], reward: 25000,
    steps: [
      { type: 'cut', lines: [
        ['Séry', "Les gars de la bande à Zézé m'ont vendu des pièces détachées volées... À MOI !"],
        ['Kader', "Séry, calme-toi, on peut parler avec eux..."],
        ['Séry', "Parler ? Moi je parle avec mes mains. Leurs trois gbakas rouges sont garés à la gare routière."],
        ['Kader', "Ça va chauffer dêh..."],
      ] },
      { type: 'spawnVeh', id: 'v1', kind: 'gbaka', color: '#d35400', at: [-85, -543], heading: Math.PI / 2, mode: 'parked', hp: 110 },
      { type: 'spawnVeh', id: 'v2', kind: 'gbaka', color: '#d35400', at: [-60, -543], heading: Math.PI / 2, mode: 'parked', hp: 110 },
      { type: 'spawnVeh', id: 'v3', kind: 'gbaka', color: '#d35400', at: [-34, -562], heading: 0, mode: 'parked', hp: 110 },
      { type: 'destroy', ids: ['v1', 'v2', 'v3'], text: 'Détruis les <b class="r">gbakas</b> de la bande à Zézé (tire ou fonce dedans).' },
      { type: 'wanted', level: 2 },
      { type: 'say', lines: [['Séry', "Ha ! Ça c'est du coupé-décalé ! Coupé... DÉCALÉ !"]] },
      { type: 'lose', text: 'Sème la <b class="b">police</b>.' },
      { type: 'say', lines: [['Séry', "Koffi veut me voir ? Ça sent le gros coup, ça."]] },
    ],
  },
  {
    id: 'h1', char: 'koffi', start: 'koffi', title: 'Le Coup du Plateau', requires: ['s1'], reward: 250000, rewardAll: true,
    steps: [
      { type: 'cut', lines: [
        ['Koffi', "Écoutez bien. Chaque jeudi, un fourgon blindé quitte la Banque Lagunaire, au Plateau."],
        ['Bakary', "Et il monte vers Adjamé par le boulevard. Je connais la route par cœur."],
        ['Séry', "On le défonce, on prend l'argent, on rentre. Simple !"],
        ['Koffi', "Pas simple. Propre. Bakary surveille, Séry couvre, moi je conduis."],
        ['Séry', "Toi tu réfléchis trop, vié père."],
      ] },
      { type: 'goto', at: [-195.5, 200], r: 10, text: "Va au <b class=\"y\">point d'embuscade</b> sur le boulevard, au Plateau." },
      { type: 'spawnVeh', id: 'fourgon', kind: 'fourgon', at: 'bank', heading: Math.PI, mode: 'route', route: FOURGON_ROUTE, cruise: 13 },
      { type: 'say', lines: [['Bakary', "(radio) Le fourgon sort de la banque ! Il monte le boulevard vers toi."]] },
      { type: 'disable', id: 'fourgon', maxDist: 380, text: 'Immobilise le <b class="r">fourgon blindé</b> (tire dessus ou percute-le).' },
      { type: 'say', lines: [['Séry', "(radio) Il est mort ! Va prendre les sacs, vite !"]] },
      { type: 'goto', veh: 'fourgon', onFoot: true, r: 4.5, text: 'Récupère le <b class="y">butin</b> dans le fourgon.' },
      { type: 'wanted', level: 4 },
      { type: 'say', lines: [['Séry', "(radio) Wôôô ! On est riches ! Maintenant, on court !"]] },
      { type: 'lose', text: 'Sème la <b class="b">police</b> !' },
      { type: 'goto', place: 'koffi', noWanted: true, r: 7, text: 'Rentre à la <b class="y">villa de Koffi</b> à Cocody.' },
      { type: 'cut', lines: [
        ['Koffi', "Sept cent cinquante mille. On partage en trois. Et on se fait oublier."],
        ['Bakary', "Se faire oublier ? À Babi ? Tout le monde sait tout ici."],
        ['Séry', "Moi je veux une voiture de sport. Rose."],
        ['Koffi', "Babi ne dort jamais... et nous non plus."],
      ] },
    ],
    ending: true,
  },
];

const CLIENT_LINES = [
  ["Client", "Bonsoir chauffeur. C'est combien pour aller là-bas ? Bon, on y va, je suis pressé."],
  ["Cliente", "Mon fils, dépose-moi vite, mon attiéké va refroidir."],
  ["Client", "Chauffeur, roule doucement hein, je viens de manger garba."],
  ["Cliente", "Faut pas prendre le pont, y a embouteillage. Passe par derrière."],
  ["Client", "On est en retard pour le maquis, les gars nous attendent !"],
];

// ---------------------------------------------------------------------------
export class Missions {
  constructor(G) {
    this.G = G;
    this.done = new Set();
    this.active = null;
    this.markers = new Map();
    this.failed = null;
    this.goal = null;
    const g = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
    g.translate(0, 0.5, 0);
    this.beamGeo = g;
  }

  char() { return CHARACTERS[this.G.player.charIdx]; }
  available() { return MISSIONS.filter((m) => !this.done.has(m.id) && m.requires.every((r) => this.done.has(r))); }
  placePos(name) { return this.G.world.places[name]; }

  makeBeam(color, r = 1.6, h = 3) {
    const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({
      color, map: beamTexture(), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.scale.set(r, h, r);
    this.G.scene.add(m);
    return m;
  }

  syncMarkers() {
    const want = this.active || this.G.player.dead ? [] : this.available();
    for (const [id, mk] of this.markers) {
      if (!want.find((m) => m.id === id)) { this.G.scene.remove(mk.mesh); this.markers.delete(id); }
    }
    for (const m of want) {
      if (this.markers.has(m.id)) continue;
      const c = CHARACTERS.find((c) => c.id === m.char);
      const p = this.placePos(m.start);
      const mesh = this.makeBeam(c.color, 1.4, 2.6);
      mesh.position.set(p.x, 0.05, p.z);
      const pl = this.G.player;
      this.markers.set(m.id, { m, mesh, x: p.x, z: p.z, color: c.color, letter: c.name[0], armed: Math.hypot(pl.x - p.x, pl.z - p.z) > 10 });
    }
  }

  blips() {
    const out = [];
    for (const mk of this.markers.values()) out.push({ x: mk.x, z: mk.z, color: mk.color, letter: mk.letter, kind: 'mission' });
    return out;
  }

  // ------------------------------------------------------------ cycle de vie
  start(m) {
    const G = this.G;
    this.failed = null;
    G.hud.clearSubtitles();
    const sp = this.placePos(m.start) || G.player.pos();
    this.active = { m, i: -1, refs: { veh: {}, ped: {} }, startX: sp.x, startZ: sp.z, st: {} };
    this.syncMarkers();
    G.hud.big(m.title, m.job ? 'Course' : CHARACTERS.find((c) => c.id === m.char)?.full || '', 'title');
    this.next();
  }

  next() {
    const a = this.active;
    if (!a) return;
    a.i++;
    this.goal = null;
    this.G.hud.objective('');
    this.G.hud.timer(null);
    if (a.i >= a.m.steps.length) { this.complete(); return; }
    a.st = { t: 0 };
    this.enter(a.m.steps[a.i]);
  }

  resolvePos(s) {
    const a = this.active, W = this.G.world;
    if (s.veh) { const v = a.refs.veh[s.veh]; return v ? { x: v.x, z: v.z } : null; }
    if (s.place) return W.places[s.place];
    if (Array.isArray(s.at)) return { x: s.at[0], z: s.at[1] };
    if (typeof s.at === 'string') return W.places[s.at];
    if (s.lane) return W.lanePoint(s.lane[0], s.lane[1], s.lane[2] || 1);
    return null;
  }

  enter(s) {
    const G = this.G, a = this.active, W = G.world;
    switch (s.type) {
      case 'cut':
        G.startCutscene(s.lines.map(([who, text]) => ({ who, text, color: SPEAKERS[who] || '#fff' })), () => this.next());
        return;
      case 'say':
        for (const [who, text] of s.lines) G.hud.subtitle(who, text, SPEAKERS[who] || '#fff');
        return this.next();
      case 'spawnVeh': {
        const p = this.resolvePos(s);
        const heading = s.heading ?? p.heading ?? 0;
        const v = G.traffic.add(new Vehicle(G, s.kind, s.color, p.x, p.z, heading));
        v.mission = true;
        if (s.hp) v.hp = s.hp;
        if (s.mode === 'parked') v.ai = { mode: 'parked' };
        else if (s.mode === 'flee' || s.mode === 'route') {
          v.setTraffic(s.cruise || 14);
          v.ai.mode = s.mode;
          if (s.route) {
            v.ai.route = s.route.map(([x, z]) => W.nodes.find((n) => n.x === x && n.z === z)).filter(Boolean);
            v.ai.next = null;
          }
        }
        a.refs.veh[s.id] = v;
        return this.next();
      }
      case 'spawnPed': {
        const p = G.peds.spawnAt(s.at[0], s.at[1], s.look, { mission: true, protect: true, mode: 'idle', t: 1e9 });
        a.refs.ped[s.id] = p;
        return this.next();
      }
      case 'board': {
        const p = a.refs.ped[s.ped];
        p.attached = a.refs.veh[s.veh];
        p.model.visible = false;
        return this.next();
      }
      case 'unboard': {
        const p = a.refs.ped[s.ped], v = p.attached;
        p.attached = null;
        p.model.visible = true;
        if (v) { p.x = v.x + Math.cos(v.h) * 2.2; p.z = v.z - Math.sin(v.h) * 2.2; }
        p.mission = false;
        G.peds.startWalking(p);
        return this.next();
      }
      case 'wanted':
        G.police.set(s.level);
        return this.next();
      case 'money':
        if (s.amount) G.player.addMoney(s.amount);
        return this.next();
      default:
        G.hud.objective(s.text || '');
        if (s.timer) a.st.left = s.timer;
    }
  }

  update(dt) {
    const G = this.G;
    if (!this.active) {
      if (this.failed && G.input.hit('Enter')) this.retry();
      this.syncMarkers();
      if (G.player.dead || G.cutscene || G.switching) return;
      const pl = G.player, ch = this.char();
      for (const mk of this.markers.values()) {
        const d = Math.hypot(pl.x - mk.x, pl.z - mk.z);
        mk.mesh.visible = mk.m.char === ch.id;
        if (d > 10) mk.armed = true;
        if (mk.armed && mk.m.char === ch.id && d < 2.6 && (!pl.vehicle || pl.vehicle.speed < 6)) {
          this.start(mk.m);
          return;
        }
      }
      return;
    }
    const a = this.active, s = a.m.steps[a.i];
    if (!s || G.cutscene) return;
    a.st.t += dt;
    for (const id of a.m.protect || []) {
      const v = a.refs.veh[id];
      if (v && v.dead) return this.fail('Le véhicule a été détruit.');
    }
    if (a.st.left !== undefined) {
      a.st.left -= dt;
      G.hud.timer(a.st.left);
      if (a.st.left <= 0) return this.fail('Trop tard !');
    }
    const pl = G.player;
    switch (s.type) {
      case 'getIn': {
        const v = a.refs.veh[s.id];
        if (v.dead) return this.fail('Le véhicule a été détruit.');
        this.goal = { x: v.x, z: v.z, kind: 'veh' };
        if (pl.vehicle === v) this.next();
        break;
      }
      case 'goto': {
        const p = this.resolvePos(s);
        if (!p) return this.fail('Cible perdue.');
        if (s.vehicle) {
          const v = a.refs.veh[s.vehicle] || pl.vehicle;
          if (!v || v.dead) return this.fail('Le véhicule a été détruit.');
          if (pl.vehicle !== v) {
            G.hud.objective(`Remonte dans le <b class="b">véhicule</b>.`);
            this.goal = { x: v.x, z: v.z, kind: 'veh' };
            break;
          }
        }
        if (s.noWanted && G.police.level > 0) {
          G.hud.objective('Sème d\'abord la <b class="b">police</b>.');
          this.goal = null;
          break;
        }
        if (s.onFoot && pl.vehicle) G.hud.objective('Descends du véhicule. ' + (s.text || ''));
        else G.hud.objective(s.text || '');
        this.goal = { x: p.x, z: p.z, r: s.r || 5, kind: 'point' };
        const d = Math.hypot(pl.x - p.x, pl.z - p.z);
        const okFoot = !s.onFoot || !pl.vehicle;
        const okStop = !s.stop || !pl.vehicle || pl.vehicle.speed < 4;
        if (d < (s.r || 5) && okFoot && okStop) this.next();
        else if (d < (s.r || 5) && !okStop) G.hud.objective('Arrête-toi.');
        break;
      }
      case 'destroy': {
        const alive = s.ids.map((id) => a.refs.veh[id]).filter((v) => v && !v.dead);
        this.goal = alive.length ? { list: alive.map((v) => ({ x: v.x, z: v.z })), kind: 'enemy' } : null;
        if (!alive.length) this.next();
        break;
      }
      case 'disable': {
        const v = a.refs.veh[s.id];
        if (v.lastHitByPlayer && v.ai && v.ai.mode === 'route') { v.ai.mode = 'flee'; v.ai.cruise = v.spec.max * 0.8; v.ai.next = null; }
        this.goal = { x: v.x, z: v.z, kind: 'enemy' };
        if (v.dead || v.crippled) { v.siren = false; return this.next(); }
        const d = Math.hypot(pl.x - v.x, pl.z - v.z);
        a.st.far = d > s.maxDist ? (a.st.far || 0) + dt : 0;
        if (a.st.far > 4) return this.fail('Il s\'est échappé.');
        break;
      }
      case 'lose':
        this.goal = null;
        if (G.police.level === 0) this.next();
        break;
      case 'wait':
        if (a.st.t > s.t) this.next();
        break;
    }
  }

  cleanup(keepVehicles) {
    const G = this.G, a = this.active;
    if (!a) return;
    for (const v of Object.values(a.refs.veh)) {
      v.mission = false;
      if (!keepVehicles && v !== G.player.vehicle) G.traffic.remove(v);
      else if (v.ai && v.ai.mode !== 'parked' && !v.dead && v !== G.player.vehicle) v.setTraffic(12);
    }
    for (const p of Object.values(a.refs.ped)) {
      p.attached = null;
      p.model.visible = true;
      if (!keepVehicles) G.peds.remove(p);
      else p.mission = false;
    }
    this.goal = null;
    G.hud.objective('');
    G.hud.timer(null);
  }

  complete() {
    const G = this.G, a = this.active, m = a.m;
    this.cleanup(true);
    this.active = null;
    if (m.job) {
      G.player.addMoney(m.reward);
      G.hud.big('Course terminée', `+ ${fmtMoney(m.reward)}`, 'pass');
      G.audio.jingle(true);
      G.hud.help('Appuie sur <kbd>J</kbd> pour prendre un autre client.', 5);
      return;
    }
    this.done.add(m.id);
    if (m.rewardAll) for (const c of G.chars) c.money += m.reward;
    else G.player.addMoney(m.reward);
    G.hud.big('Mission réussie', m.title + (m.reward ? ` · + ${fmtMoney(m.reward)}` : ''), 'pass');
    G.audio.jingle(true);
    G.save();
    setTimeout(() => {
      const next = this.available();
      if (!next.length || this.active) return;
      const c = CHARACTERS.find((c) => c.id === next[0].char);
      const idx = CHARACTERS.indexOf(c) + 1;
      const here = c.id === this.char().id;
      G.hud.help(`Nouvelle mission disponible pour <b style="color:${c.color}">${c.name}</b>. ${here ? `Rejoins la lettre <b>${c.name[0]}</b> sur la carte.` : `Change de personnage avec <kbd>${idx}</kbd>.`}`, 8);
    }, 4500);
    if (m.ending) setTimeout(() => G.hud.credits(), 5000);
  }

  fail(reason) {
    const G = this.G, a = this.active;
    if (!a) return;
    const m = a.m;
    this.cleanup(!!m.job);
    this.active = null;
    if (m.job) { G.hud.big('Course annulée', reason, 'fail'); return; }
    this.failed = { m, charIdx: G.player.charIdx };
    G.police.clear();
    G.hud.big('Mission échouée', reason, 'fail');
    G.audio.jingle(false);
    setTimeout(() => { if (this.failed === null || this.active) return; G.hud.help('Appuie sur <kbd>Entrée</kbd> pour recommencer la mission.', 7); }, 2500);
    setTimeout(() => { if (this.failed && this.failed.m === m && !this.active) this.failed = null; }, 12000);
  }

  retry() {
    const G = this.G, f = this.failed;
    this.failed = null;
    if (!f || G.player.dead) return;
    const p = this.placePos(f.m.start);
    G.player.teleport(p.x + 3, p.z + 3);
    this.start(f.m);
  }

  abort() {
    if (!this.active) return;
    this.fail('Mission abandonnée.');
  }

  // ------------------------------------------------------------ courses de taxi
  startJob() {
    const G = this.G, pl = G.player, v = pl.vehicle;
    if (this.active || !v || !['taxi', 'woro'].includes(v.type)) return false;
    const W = G.world;
    const pickPoint = (minD, maxD, from) => {
      for (let i = 0; i < 40; i++) {
        const e = W.edges[Math.floor(Math.random() * W.edges.length)];
        const t = 0.25 + Math.random() * 0.5;
        const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t;
        const d = Math.hypot(x - from.x, z - from.z);
        if (d > minD && d < maxD && W.isLand(x, z)) {
          const dx = (e.b.x - e.a.x) / e.len, dz = (e.b.z - e.a.z) / e.len, off = e.w / 2 - 1;
          return { x: x - dz * off, z: z + dx * off };
        }
      }
      return { x: from.x + 100, z: from.z };
    };
    const a = pickPoint(70, 220, pl.pos());
    const b = pickPoint(250, 650, a);
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const line = pick(CLIENT_LINES);
    const m = {
      id: 'job', job: true, title: v.type === 'woro' ? 'Course de woro-woro' : 'Course de taxi', char: this.char().id,
      reward: Math.round(dist * 30 / 100) * 100 + 1000,
      steps: [
        { type: 'goto', at: [a.x, a.z], vehicle: 'cab', stop: true, r: 6, text: 'Va chercher le <b class="b">client</b>.' },
        { type: 'say', lines: [line] },
        { type: 'goto', at: [b.x, b.z], vehicle: 'cab', stop: true, r: 7, timer: Math.round(dist / 9) + 25, text: 'Conduis le client à <b class="y">destination</b>.' },
        { type: 'say', lines: [[line[0], 'Merci ! Tiens, garde la monnaie.']] },
      ],
    };
    this.active = { m, i: -1, refs: { veh: { cab: v }, ped: {} }, startX: pl.x, startZ: pl.z, st: {} };
    v.mission = true;
    G.hud.big(m.title, 'Petit boulot', 'title');
    this.next();
    return true;
  }
}
