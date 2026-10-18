// Son entièrement synthétisé avec la Web Audio API : radios, sirènes, tirs, moteur.
const STATIONS = [
  { name: 'Babi FM 99.1', sub: 'Coupé-décalé non-stop', kind: 'coupe' },
  { name: 'Zouglou FM 98.4', sub: 'La radio qui parle comme toi', kind: 'zouglou' },
  { name: 'Radio Lagune Info', sub: 'Infos trafic et faits divers', kind: 'talk' },
  { name: 'Radio coupée', sub: '', kind: 'off' },
];

const NEWS = [
  "Radio Lagune Info. Bouchons monstres sur le boulevard de la République, prévoyez une heure de plus.",
  "Un gbaka a encore pris le trottoir pour un raccourci à Adjamé. Pas de blessés, mais beaucoup de cris.",
  "Météo : il fait chaud à Babi. Demain ? Il fera chaud aussi.",
  "La police recherche un individu qui conduit trop vite à Cocody. Si vous l'entendez, ne le suivez pas.",
  "Le prix du garba reste stable. Les étudiants de l'université respirent.",
  "Rappel : le pont vers Treichville est toujours fermé pour travaux. Patience, on est ensemble.",
  "Un fourgon blindé de la Banque Lagunaire circulera ce jeudi. Mais ça, on n'aurait pas dû le dire.",
];

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.radioOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.listener = { x: 0, z: 0 };
    this.talkT = 3;
  }

  get stationInfo() { return STATIONS[this.station]; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0.6; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.0; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Sirène
    this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'sawtooth';
    this.sirenLfo = c.createOscillator(); this.sirenLfo.frequency.value = 0.9;
    const lfoGain = c.createGain(); lfoGain.gain.value = 260;
    this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
    this.sirenOsc.frequency.value = 820;
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
    this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(sf); sf.connect(this.sirenGain); this.sirenGain.connect(this.sfx);
    this.sirenOsc.start(); this.sirenLfo.start();
    // Moteur
    this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 50;
    const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400;
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(ef); ef.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start();
    this.nextTime = c.currentTime + 0.1;
  }

  vol(x, z, range = 120) {
    const d = Math.hypot(x - this.listener.x, z - this.listener.z);
    return Math.max(0, 1 - d / range);
  }

  noiseHit(t, dur, freq, q, gain, type = 'bandpass', dest = this.sfx) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  tone(t, freq, dur, type, gain, dest = this.sfx, glide = 0) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  gunshot(x, z, k = 1) {
    if (!this.ctx) return;
    const v = this.vol(x, z, 200) * k;
    if (v <= 0) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.25, 1200, 0.7, 0.9 * v);
    this.tone(t, 160, 0.12, 'square', 0.3 * v, this.sfx, 50);
  }
  explosion(x, z) {
    if (!this.ctx) return;
    const v = this.vol(x, z, 400);
    const t = this.ctx.currentTime;
    this.noiseHit(t, 1.6, 300, 0.5, 1.2 * v, 'lowpass');
    this.tone(t, 90, 0.8, 'sine', 0.8 * v, this.sfx, 30);
  }
  impact(strength, x, z) {
    if (!this.ctx) return;
    const v = this.vol(x, z, 80) * Math.min(1, strength / 15);
    if (v < 0.03) return;
    this.noiseHit(this.ctx.currentTime, 0.18, 500, 1, 0.8 * v, 'lowpass');
  }
  horn(x, z) {
    if (!this.ctx) return;
    const v = this.vol(x, z, 90);
    if (v <= 0) return;
    const t = this.ctx.currentTime;
    this.tone(t, 392, 0.4, 'square', 0.12 * v); this.tone(t, 494, 0.4, 'square', 0.1 * v);
  }
  punch() { if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.1, 300, 1, 0.6, 'lowpass'); }
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, N(76), 0.12, 'triangle', 0.3); this.tone(t + 0.08, N(83), 0.2, 'triangle', 0.3);
  }
  jingle(ok = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = ok ? [69, 73, 76, 81] : [69, 68, 66, 62];
    notes.forEach((n, i) => this.tone(t + i * 0.16, N(n), 0.5, 'triangle', 0.35));
  }
  whoosh() { if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.9, 900, 0.4, 0.5, 'bandpass'); }

  siren(v) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(v * 0.12, this.ctx.currentTime, 0.1);
  }
  engine(on, speed, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on ? 0.05 + Math.abs(throttle) * 0.04 : 0, t, 0.1);
    this.engOsc.frequency.setTargetAtTime(45 + speed * 3.2 + Math.abs(throttle) * 15, t, 0.08);
  }

  setRadio(on) {
    this.radioOn = on;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on && STATIONS[this.station].kind !== 'off' ? 0.32 : 0, this.ctx.currentTime, 0.3);
    if (!on && window.speechSynthesis) window.speechSynthesis.cancel();
  }
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.talkT = 1;
    this.setRadio(this.radioOn);
    return STATIONS[this.station];
  }

  // Séquenceur : on programme les notes un peu en avance.
  update(dt) {
    if (!this.ctx) return;
    const st = STATIONS[this.station];
    if (!this.radioOn || st.kind === 'off') return;
    if (st.kind === 'talk') {
      this.talkT -= dt;
      if (this.talkT <= 0 && window.speechSynthesis && !window.speechSynthesis.speaking) {
        const u = new SpeechSynthesisUtterance(NEWS[Math.floor(Math.random() * NEWS.length)]);
        u.lang = 'fr-FR'; u.rate = 1.05; u.volume = 0.8;
        window.speechSynthesis.speak(u);
        this.talkT = 12 + Math.random() * 8;
      }
    }
    const bpm = st.kind === 'coupe' ? 124 : st.kind === 'zouglou' ? 100 : 70;
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(st.kind, this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(kind, s, t) {
    const M = this.music, i = s % 16, bar = Math.floor(s / 16) % 4;
    if (kind === 'coupe') {
      const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
      const ch = chords[bar];
      if (i % 4 === 0) this.tone(t, 110, 0.18, 'sine', 0.9, M, 40);
      if (i === 4 || i === 12) this.noiseHit(t, 0.15, 1800, 0.8, 0.5, 'bandpass', M);
      if (i % 2 === 1) this.noiseHit(t, 0.04, 8000, 1, 0.18, 'highpass', M);
      if ([3, 7, 10, 11, 14].includes(i)) this.tone(t, [200, 160, 240, 180, 150][i % 5], 0.12, 'sine', 0.45, M, 90);
      if ([0, 3, 6, 8, 11, 14].includes(i)) this.tone(t, N(ch[0] - 12), 0.22, 'square', 0.16, M);
      if (i % 2 === 0) this.tone(t, N(ch[(i / 2) % 3] + 12), 0.1, 'square', 0.06, M);
      if (bar % 2 === 1 && [0, 2, 4, 7, 9].includes(i)) this.tone(t, N([81, 79, 76, 74, 76][[0, 2, 4, 7, 9].indexOf(i)]), 0.14, 'triangle', 0.12, M);
    } else if (kind === 'zouglou') {
      const chords = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]];
      const ch = chords[bar];
      if ([0, 6, 8, 14].includes(i)) this.tone(t, 100, 0.2, 'sine', 0.8, M, 45);
      if (i === 4 || i === 12) this.noiseHit(t, 0.12, 2500, 0.9, 0.35, 'bandpass', M);
      this.noiseHit(t, 0.05, 6000, 1.2, i % 4 === 2 ? 0.16 : 0.07, 'highpass', M);
      if ([0, 3, 6, 8, 10, 13].includes(i)) this.tone(t, N(ch[[0, 1, 2, 1, 0, 2][[0, 3, 6, 8, 10, 13].indexOf(i)]]), 0.3, 'triangle', 0.18, M);
      if ([0, 6, 8, 11].includes(i)) this.tone(t, N(ch[0] - 24), 0.3, 'sine', 0.35, M);
    } else if (kind === 'talk') {
      if (i === 0 && s % 32 === 0) this.tone(t, N(48 + [0, 5, 7, 3][bar]), 3.2, 'sine', 0.08, M);
    }
  }
}
