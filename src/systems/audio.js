// =====================================================================
// Audio interamente sintetizzato con WebAudio: nessun file da scaricare.
// Si attiva solo dopo un gesto dell'utente (policy autoplay dei browser).
// =====================================================================

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// scala modale scura (re frigio/dorico misto), registro medio-basso
const SCALE = [50, 53, 55, 57, 60, 62, 65, 50, 57];

class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ready = false;
    this.intensity = 0; // 0 menu, 1 in corsa
    this.fireLevel = 0;
    this.tempo = 0;
    this._sched = null;
    this._nextNote = 0;
    this._nextBeat = 0;
  }

  // da chiamare dentro un handler di click/touch
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.ctx = new AC(); }
      this._build();
    }
    if (this.ctx.state === 'suspended' && !this._hidden) this.ctx.resume().catch(() => {});
    // sblocco iOS: un buffer muto riprodotto nel gesto
    try {
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    } catch { /* ignore */ }
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);

    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicOn === false ? 0 : 0.55; this.music.connect(this.master);

    // rumore bianco riutilizzabile
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // riverbero sintetico (impulso di rumore decrescente)
    const irLen = Math.floor(c.sampleRate * 2.6);
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const x = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    this.revGain = c.createGain(); this.revGain.gain.value = 0.5;
    this.reverb.connect(this.revGain); this.revGain.connect(this.music);

    // delay per le note sparse
    this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.38;
    const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay);
    dl.connect(this.music); dl.connect(this.reverb);

    this._buildAmbience();
    this._buildFire();
    this.ready = true;
    this._sched = setInterval(() => this._schedule(), 120);
  }

  _noiseSrc(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = loop;
    if (!loop) s.loopStart = 0;
    return s;
  }

  _buildAmbience() {
    const c = this.ctx;
    // bordone grave: due triangoli leggermente scordati
    const droneF = c.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 260;
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0.0;
    droneF.connect(this.droneGain); this.droneGain.connect(this.music); this.droneGain.connect(this.reverb);
    [[NOTE(38), -6], [NOTE(38), 7], [NOTE(45), 0]].forEach(([f, det]) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      const g = c.createGain(); g.gain.value = 0.22;
      o.connect(g); g.connect(droneF); o.start();
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 120;
    lfo.connect(lfoG); lfoG.connect(droneF.frequency); lfo.start();

    // vento notturno
    const wind = this._noiseSrc(true);
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.8;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.0;
    wind.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.music);
    const wl = c.createOscillator(); wl.frequency.value = 0.11;
    const wlg = c.createGain(); wlg.gain.value = 260;
    wl.connect(wlg); wlg.connect(wf.frequency); wl.start(); wind.start();

    // v5: acqua che scorre (fiume / piscina naturale)
    const water = this._noiseSrc(true);
    const wa = c.createBiquadFilter(); wa.type = 'bandpass'; wa.frequency.value = 900; wa.Q.value = 0.45;
    const wb = c.createBiquadFilter(); wb.type = 'highshelf'; wb.frequency.value = 3000; wb.gain.value = -8;
    this.waterGain = c.createGain(); this.waterGain.gain.value = 0;
    water.connect(wa); wa.connect(wb); wb.connect(this.waterGain); this.waterGain.connect(this.sfx);
    water.start(0, 0.7);
    // rimbombo cupo della galleria
    const cave = this._noiseSrc(true);
    const cf = c.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 120;
    this.caveGain = c.createGain(); this.caveGain.gain.value = 0;
    cave.connect(cf); cf.connect(this.caveGain); this.caveGain.connect(this.music);
    cave.start(0, 1.3);
    this.amb = { wind: 0.06, water: 0, drips: 0, birds: 0, bells: 0, cave: 0 };
    this._nextDrip = 0; this._nextBird = 0; this._nextBell = 0;
    const t = c.currentTime;
    this.droneGain.gain.setTargetAtTime(0.35, t, 1.5);
    this.windGain.gain.setTargetAtTime(0.10, t, 2);
  }
  // v5: atmosfera sonora dell'ambiente (vento, acqua, gocce, uccelli, campane, galleria)
  ambience(a) {
    if (!this.ready || !a) return;
    const t = this.ctx.currentTime;
    this.amb = a;
    this.windGain.gain.setTargetAtTime(0.02 + (a.wind || 0) * 0.6, t, 0.8);
    this.waterGain.gain.setTargetAtTime((a.water || 0) * 0.55, t, 0.8);
    this.caveGain.gain.setTargetAtTime((a.cave || 0) * 0.5, t, 0.6);
    this.revGain.gain.setTargetAtTime(0.5 + (a.cave || 0) * 0.5, t, 0.6);
  }
  _ambTick(now) {
    const a = this.amb; if (!a) return;
    if (a.drips > 0.05 && now >= this._nextDrip) {          // gocce che cadono nella galleria
      const f = 1400 + Math.random() * 1600, when = now + 0.02;
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, when); o.frequency.exponentialRampToValueAtTime(f * 0.45, when + 0.09);
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.05 * a.drips, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      o.connect(g); g.connect(this.reverb); g.connect(this.sfx); o.start(when); o.stop(when + 0.2);
      this._nextDrip = now + (0.5 + Math.random() * 2.2) / a.drips;
    }
    if (a.birds > 0.05 && now >= this._nextBird) {          // cinguettii
      const n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1800;
      for (let i = 0; i < n; i++) this._tone({ t: i * 0.09, f: base * (1 + Math.random() * 0.2), fEnd: base * 1.35, dur: 0.06, type: 'sine', vol: 0.025 * a.birds });
      this._nextBird = now + (2.5 + Math.random() * 5) / a.birds;
    }
    if (a.bells > 0.5 && now >= this._nextBell) {           // campane della chiesa, lontane
      if (this._nextBell) for (let i = 0; i < 3; i++) this._pluck(NOTE([57, 53, 50][i]), now + 0.1 + i * 1.1, 0.06);
      this._nextBell = now + 16 + Math.random() * 14;
    }
  }

  _buildFire() {
    const c = this.ctx;
    // ruggito sordo della fiamma
    const roar = this._noiseSrc(true);
    const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 380;
    this.roarGain = c.createGain(); this.roarGain.gain.value = 0;
    roar.connect(rf); rf.connect(this.roarGain); this.roarGain.connect(this.sfx);
    roar.start();
  }

  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (!this.muted) this._ambTick(now);
    // note sparse e lente: suonano anche nel menu
    if (now >= this._nextNote) {
      const n = SCALE[Math.floor(Math.random() * SCALE.length)];
      this._pluck(NOTE(n + (Math.random() < 0.3 ? 12 : 0)), now + 0.05, 0.11);
      this._nextNote = now + (this.intensity > 0.5 ? 1.6 + Math.random() * 1.6 : 2.6 + Math.random() * 3.2);
    }
    // battito grave in corsa, piu' rapido con la velocita'
    if (this.intensity > 0.5) {
      if (now >= this._nextBeat) {
        this._thump(now + 0.02, 0.18 * this.intensity);
        this._nextBeat = now + Math.max(0.42, 0.9 - this.tempo * 0.45);
      }
    } else this._nextBeat = now + 0.3;
  }

  _pluck(freq, t, vol) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2.01;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const g2 = c.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.delay); g.connect(this.reverb); g.connect(this.music);
    o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
  }

  _thump(t, vol) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.32);
  }

  _burst({ t = 0, dur = 0.05, type = 'bandpass', f = 1000, q = 1, vol = 0.3, fEnd = null, dest = null }) {
    const c = this.ctx;
    const when = c.currentTime + t;
    const s = this._noiseSrc(false);
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, when); fl.Q.value = q;
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, when + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
    s.start(when, Math.random() * 1.5, dur + 0.05);
  }

  _tone({ t = 0, f = 440, fEnd = null, dur = 0.15, type = 'square', vol = 0.12, dest = null }) {
    const c = this.ctx;
    const when = c.currentTime + t;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, when);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, when + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(when); o.stop(when + dur + 0.05);
  }

  get ok() { return this.ready && this.ctx.state === 'running' && !this.muted; }

  // ---------------- API pubblica --------------------------------------
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.08);
  }
  setIntensity(v, tempo = 0) { this.intensity = v; this.tempo = tempo; }
  setHidden(h) {
    this._hidden = h;
    if (!this.ctx) return;
    if (h) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  // chiamata ogni frame: crepitio proporzionale alla fiamma
  fire(level, dt, active) {
    if (!this.ready) return;
    const target = active ? 0.05 + 0.13 * level : 0.02;
    this.roarGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    if (!this.ok) return;
    const rate = active ? 4 + 14 * level : 2.5;
    if (Math.random() < rate * dt) {
      this._burst({ dur: 0.006 + Math.random() * 0.02, f: 1500 + Math.random() * 3500, q: 2.5, vol: 0.12 + Math.random() * 0.22 });
    }
  }
  step(alt) {
    if (!this.ok) return;
    this._burst({ dur: 0.05, type: 'lowpass', f: alt ? 520 : 440, vol: 0.32 });
    this._burst({ dur: 0.02, t: 0.004, f: 2400, q: 3, vol: 0.05 });
  }
  pickup(kind) {
    if (!this.ok) return;
    const base = kind === 'ferula' ? 523 : 659;
    this._tone({ f: base, dur: 0.09, type: 'triangle', vol: 0.18 });
    this._tone({ t: 0.06, f: base * 1.5, dur: 0.16, type: 'triangle', vol: 0.16 });
    this._burst({ dur: 0.25, type: 'bandpass', f: 600, fEnd: 2500, q: 0.7, vol: 0.18 });
  }
  chain() {
    if (!this.ok) return;
    [0, 4, 7, 12].forEach((s, i) => this._tone({ t: i * 0.06, f: 523 * Math.pow(2, s / 12), dur: 0.14, type: 'square', vol: 0.06 }));
  }
  nearMiss() {
    if (!this.ok) return;
    this._burst({ dur: 0.16, type: 'bandpass', f: 3000, fEnd: 700, q: 1.2, vol: 0.25 });
    this._tone({ t: 0.02, f: 880, fEnd: 1320, dur: 0.1, type: 'square', vol: 0.05 });
  }
  hit() {
    if (!this.ok) return;
    this._tone({ f: 160, fEnd: 50, dur: 0.25, type: 'sine', vol: 0.5 });
    this._burst({ dur: 0.18, type: 'lowpass', f: 900, vol: 0.45 });
    this._burst({ t: 0.03, dur: 0.35, type: 'bandpass', f: 2000, fEnd: 400, q: 0.8, vol: 0.2 });
  }
  puddle() {
    if (!this.ok) return;
    this._burst({ dur: 0.12, type: 'lowpass', f: 700, vol: 0.3 });
    this._burst({ t: 0.04, dur: 0.6, type: 'highpass', f: 3500, fEnd: 1800, vol: 0.18 }); // sfrigolio
  }
  goat() {
    if (!this.ok) return;
    this._tone({ f: 420, fEnd: 380, dur: 0.35, type: 'sawtooth', vol: 0.05 });
  }
  milestone() {
    if (!this.ok) return;
    [0, 7, 12].forEach((s, i) => this._tone({ t: i * 0.09, f: 392 * Math.pow(2, s / 12), dur: 0.22, type: 'triangle', vol: 0.15 }));
  }
  gameOver() {
    if (!this.ok) return;
    this._burst({ dur: 1.4, type: 'lowpass', f: 1600, fEnd: 120, vol: 0.35 }); // fiamma che si spegne
    [0, -3, -7, -12].forEach((s, i) => this._tone({ t: 0.25 + i * 0.22, f: 294 * Math.pow(2, s / 12), dur: 0.5, type: 'triangle', vol: 0.14 }));
  }
  record() {
    if (!this.ok) return;
    [0, 4, 7, 12, 16].forEach((s, i) => this._tone({ t: i * 0.08, f: 392 * Math.pow(2, s / 12), dur: 0.25, type: 'square', vol: 0.07 }));
    this._burst({ t: 0.4, dur: 0.6, type: 'bandpass', f: 800, fEnd: 3000, q: 0.6, vol: 0.15 });
  }
  // ---------------- v2: tappeti, pistola, botti ------------------------
  carpet(n = 0) {
    if (!this.ok) return;
    // pizzico morbido + fruscio di tessuto; la nota sale dentro una scia
    const steps = [0, 2, 4, 7, 9, 12, 14];
    const f = 587 * Math.pow(2, steps[n % steps.length] / 12);
    this._tone({ f, dur: 0.12, type: 'triangle', vol: 0.12 });
    this._tone({ t: 0.03, f: f * 2, dur: 0.08, type: 'sine', vol: 0.05 });
    this._burst({ dur: 0.09, type: 'highpass', f: 2600, vol: 0.06 });
  }
  pistolPickup() {
    if (!this.ok) return;
    this._burst({ dur: 0.03, type: 'bandpass', f: 3200, q: 4, vol: 0.3 });
    this._burst({ t: 0.09, dur: 0.04, type: 'bandpass', f: 2200, q: 5, vol: 0.35 });
    [0, 5, 12].forEach((s, i) => this._tone({ t: 0.16 + i * 0.07, f: 330 * Math.pow(2, s / 12), dur: 0.16, type: 'square', vol: 0.06 }));
  }
  shoot() {
    if (!this.ok) return;
    this._burst({ dur: 0.05, type: 'highpass', f: 1800, vol: 0.5 });           // scatto della pietra focaia
    this._burst({ t: 0.01, dur: 0.35, type: 'lowpass', f: 1400, fEnd: 200, vol: 0.6 }); // botto
    this._tone({ t: 0.01, f: 120, fEnd: 40, dur: 0.25, type: 'sine', vol: 0.45 });
  }
  barrelBreak(big) {
    if (!this.ok) return;
    const n = big ? 6 : 4;
    for (let i = 0; i < n; i++) {
      this._burst({ t: i * 0.035 + Math.random() * 0.02, dur: 0.07, type: 'bandpass', f: 500 + Math.random() * 900, q: 2, vol: 0.35 });
    }
    this._tone({ f: 95, fEnd: 50, dur: 0.3, type: 'sine', vol: 0.4 });
    this._burst({ t: 0.08, dur: 0.4, type: 'lowpass', f: 700, fEnd: 200, vol: 0.18 }); // vino che si versa
  }
  ricochet() {
    if (!this.ok) return;
    this._tone({ f: 1800, fEnd: 900, dur: 0.12, type: 'square', vol: 0.05 });
    this._burst({ dur: 0.05, type: 'bandpass', f: 3500, q: 3, vol: 0.2 });
  }
  empty() {
    if (!this.ok) return;
    this._burst({ dur: 0.02, type: 'bandpass', f: 4000, q: 6, vol: 0.25 });
  }
  survival() {
    if (!this.ok) return;
    [0, 7, 12, 19].forEach((s, i) => this._tone({ t: i * 0.07, f: 349 * Math.pow(2, s / 12), dur: 0.2, type: 'triangle', vol: 0.12 }));
  }
  // ---------------- v5s6 ----------------
  speedUp() {
    if (!this.ok) return;
    [0, 5, 9, 14].forEach((s, i) => this._tone({ t: i * 0.05, f: 440 * Math.pow(2, s / 12), dur: 0.12, type: 'sawtooth', vol: 0.05 }));
    this._burst({ dur: 0.45, type: 'bandpass', f: 600, fEnd: 3200, q: 0.7, vol: 0.14 });   // whoosh
  }
  duck() {
    if (!this.ok) return;
    this._burst({ dur: 0.18, type: 'bandpass', f: 1400, fEnd: 500, q: 1, vol: 0.14 });
  }
  // v5s18: carrello della miniera
  cartBoard() {
    if (!this.ok) return;
    this._burst({ dur: 0.08, type: 'bandpass', f: 1800, q: 2, vol: 0.3 });
    this._tone({ f: 180, fEnd: 90, dur: 0.18, type: 'square', vol: 0.12 });
    this._burst({ t: 0.1, dur: 1.4, type: 'lowpass', f: 260, fEnd: 160, vol: 0.32 });
  }
  cartSwitch() {
    if (!this.ok) return;
    for (const t of [0, 0.09]) { this._burst({ t, dur: 0.04, type: 'bandpass', f: 2400, q: 3, vol: 0.3 }); this._tone({ t, f: 320, fEnd: 200, dur: 0.06, type: 'square', vol: 0.08 }); }
    this._tone({ t: 0.12, f: 784, dur: 0.12, type: 'triangle', vol: 0.1 });
  }
  cartExit() {
    if (!this.ok) return;
    this._burst({ dur: 0.5, type: 'highpass', f: 3200, fEnd: 1800, vol: 0.14 });   // freno
    this._tone({ t: 0.35, f: 140, fEnd: 60, dur: 0.2, type: 'sine', vol: 0.35 });
  }
  rumble() {
    if (!this.ok) return;
    this._burst({ dur: 0.9, type: 'lowpass', f: 220, fEnd: 120, vol: 0.3 });
    this._tone({ f: 60, fEnd: 48, dur: 0.8, type: 'sine', vol: 0.2 });
  }
  // ---------------- v5s10: maschere di Gadoni ----------------
  cowbell() {          // campanacci di su Maimoni: rintocchi metallici irregolari
    if (!this.ok) return;
    for (let i = 0; i < 9; i++) {
      const t = i * 0.13 + (i % 3) * 0.03, f = [520, 610, 470, 690][i % 4];
      this._tone({ t, f, fEnd: f * 0.97, dur: 0.22, type: 'square', vol: 0.045 });
      this._tone({ t, f: f * 2.76, dur: 0.12, type: 'triangle', vol: 0.03 });
      this._burst({ t, dur: 0.05, type: 'bandpass', f: 3000, q: 2, vol: 0.06 });
    }
  }
  // campanacci posizionali: chiamata a ogni frame con le maschere vicine [{id, dist(px), pan(-1..1), kind}]
  // ritmo di scuotimento (piu' fitto per su Maimoni che saltella), volume che cresce avvicinandosi
  bells(list, dt) {
    if (!this.ok) return;
    const st = this._bellSt || (this._bellSt = new Map());
    const live = new Set();
    for (const b of list) {
      live.add(b.id);
      if (b.dist > 760 || b.dist < -60) continue;
      const k = Math.max(0, Math.min(1, 1 - (Math.max(0, b.dist) - 20) / 720));
      const vol = 0.02 + 0.34 * k * k;
      let s0 = st.get(b.id); if (!s0) { s0 = { next: 0, beat: 0 }; st.set(b.id, s0); }
      s0.next -= dt;
      if (s0.next > 0) continue;
      const mai = b.kind === 'maimoni';
      // scossa: 2-3 rintocchi ravvicinati, poi pausa (passo / saltello)
      s0.beat++; s0.next = mai ? (s0.beat % 2 ? 0.17 : 0.27) : (s0.beat % 2 ? 0.32 : 0.46);
      this.bellClank(b.pan, vol * (mai ? 1 : 0.7), mai ? 3 : 2, b.id);
    }
    for (const id of st.keys()) if (!live.has(id)) st.delete(id);
  }
  bellClank(pan, vol, n = 3, seed = 0) {
    const c = this.ctx; const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfx); }
    const dest = p || this.sfx;
    const F = [540, 620, 455, 700, 585];
    for (let i = 0; i < n; i++) {
      const t = i * 0.045 + Math.random() * 0.02, f = F[(seed + i + Math.floor(Math.random() * 3)) % F.length];
      this._tone({ t, f, fEnd: f * 0.985, dur: 0.26, type: 'square', vol: vol * 0.32, dest });
      this._tone({ t, f: f * 2.71, dur: 0.14, type: 'triangle', vol: vol * 0.22, dest });
      this._tone({ t, f: f * 0.5, dur: 0.18, type: 'sine', vol: vol * 0.2, dest });
      this._burst({ t, dur: 0.04, type: 'bandpass', f: 3400, q: 2.5, vol: vol * 0.5, dest });
    }
  }
  collectBell() { this.bellClank(0, 0.6, 4, 7); this.milestone?.(); }   // v5s19
  collectSweet() { this.pickup?.('ferula'); this.milestone?.(); }
  bellRing(pan = 0) {   // urto con una maschera: campanacci che risuonano forte
    if (!this.ok) return;
    this.bellClank(pan, 0.55, 6, 3);
    const c = this.ctx; const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfx); }
    for (const f of [612, 893]) this._tone({ t: 0.05, f, fEnd: f * 0.97, dur: 1.1, type: 'triangle', vol: 0.12, dest: p || this.sfx });
  }
  // ---------------- v5s11: ballu tundu (launeddas generate + tamburo + canto a tenore) ----------------
  _drone(f, vol, t = 0, dur = 0) {
    const c = this.ctx, when = c.currentTime + t;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 3; fl.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.25);
    o.connect(fl); fl.connect(g); g.connect(this.music || this.sfx); o.start(when);
    if (dur) { g.gain.setValueAtTime(vol, when + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.stop(when + dur + 0.05); }
    return { o, g };
  }
  danceCue() {        // launeddas che attaccano + coro a tenore (2-3 s prima del ballo)
    if (!this.ok) return;
    this._drone(147, 0.09, 0, 2.6);                      // tumbu (Re)
    this._drone(73.5, 0.12, 0.2, 2.4);                    // bassu del tenore
    this._drone(110, 0.07, 0.4, 2.2);                     // contra
    const mel = [294, 330, 370, 330, 294, 440, 392, 370, 330, 294];
    mel.forEach((f, i) => this._tone({ t: 0.3 + i * 0.2, f, dur: 0.18, type: 'square', vol: 0.05 }));
  }
  danceStart(bpm) {
    if (!this.ok) return;
    this.danceStop();
    this._dn = [this._drone(147, 0.07), this._drone(220, 0.035)];   // tumbu + mancosa
    this._danceI = 0; this._bpm = bpm;
  }
  danceBeat(b) {
    if (!this.ok) return;
    const bt = 60 / (b.bpm || 100);
    // tamburo: colpo basso sul battere, leggero sugli altri; sonagli in controtempo
    this._tone({ f: b.down ? 95 : 120, fEnd: 50, dur: 0.16, type: 'sine', vol: b.down ? 0.42 : 0.24 });
    this._burst({ t: bt / 2, dur: 0.05, type: 'highpass', f: 6000, vol: 0.07 });
    // mancosedda: melodia a terzine sul modo di Re (fiorassiu)
    const SC = [294, 330, 370, 392, 440, 494, 587];
    const PAT = [0, 2, 4, 2, 1, 3, 5, 3, 4, 2, 0, 1, 2, 4, 6, 4];
    const i = this._danceI = (this._danceI || 0) + 1;
    for (let k = 0; k < 3; k++) {
      const f = SC[(PAT[(i * 3 + k) % PAT.length] + (b.r ? 1 : 0)) % SC.length];
      this._tone({ t: k * bt / 3, f, dur: bt / 3 * 0.9, type: 'square', vol: 0.035 });
      this._tone({ t: k * bt / 3, f: f * 2, dur: bt / 3 * 0.6, type: 'triangle', vol: 0.015 });
    }
  }
  danceHit(res) {
    if (!this.ok) return;
    if (res === 'perfect') { this._tone({ f: 880, dur: 0.08, type: 'triangle', vol: 0.09 }); this._tone({ t: 0.04, f: 1320, dur: 0.1, type: 'triangle', vol: 0.06 }); }
    else if (res === 'good') this._tone({ f: 660, dur: 0.08, type: 'triangle', vol: 0.07 });
    else this._tone({ f: 140, fEnd: 90, dur: 0.15, type: 'sawtooth', vol: 0.05 });
  }
  danceStop() {
    if (!this._dn) return;
    const c = this.ctx, now = c.currentTime;
    for (const d of this._dn) { try { d.g.gain.cancelScheduledValues(now); d.g.gain.setValueAtTime(d.g.gain.value, now); d.g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5); d.o.stop(now + 0.6); } catch { /* gia' fermo */ } }
    this._dn = null;
  }
  spindle() {          // il fuso lanciato: fruscio che scende
    if (!this.ok) return;
    this._burst({ dur: 0.35, type: 'bandpass', f: 2600, fEnd: 700, q: 1.5, vol: 0.1 });
    this._tone({ t: 0.36, f: 300, fEnd: 160, dur: 0.1, type: 'triangle', vol: 0.12 });
  }
  bravu() {
    if (!this.ok) return;
    [0, 4, 7, 12, 7, 12].forEach((s, i) => this._tone({ t: i * 0.08, f: 392 * Math.pow(2, s / 12), dur: 0.16, type: 'triangle', vol: 0.12 }));
    for (let i = 0; i < 4; i++) this._tone({ t: 0.5 + i * 0.1, f: 560 + i * 40, dur: 0.2, type: 'square', vol: 0.03 });
  }
  // v5s16: la fiamma prende da un'altra frakkera: soffio (whoosh) + crepitio + nota calda
  fireBonus() {
    if (!this.ok) return;
    this._burst({ dur: 0.45, type: 'bandpass', f: 300, fEnd: 1800, q: 0.6, vol: 0.32 });
    this._burst({ t: 0.05, dur: 0.5, type: 'lowpass', f: 600, vol: 0.22 });
    for (let i = 0; i < 6; i++) this._burst({ t: 0.08 + i * 0.055 + (i % 2) * 0.02, dur: 0.025, type: 'highpass', f: 2600 + i * 300, vol: 0.12 });
    this._tone({ t: 0.04, f: 392, fEnd: 587, dur: 0.22, type: 'triangle', vol: 0.12 });
  }
  rockFall() {
    if (!this.ok) return;
    this._burst({ dur: 0.3, type: 'bandpass', f: 2400, fEnd: 600, q: 1, vol: 0.12 });
    this._tone({ t: 0.28, f: 110, fEnd: 40, dur: 0.3, type: 'sine', vol: 0.45 });
    this._burst({ t: 0.28, dur: 0.3, type: 'lowpass', f: 800, vol: 0.35 });
  }
  click() {
    if (!this.ok) return;
    this._tone({ f: 740, dur: 0.05, type: 'square', vol: 0.05 });
  }
}

export const audio = new AudioSys();
