// =====================================================================
// Controller: ciclo a passo fisso (Sim) + rendering 3D (World) + input.
// Espone all'interfaccia la stessa API della scena v2.
// =====================================================================
import { WORLD, FUEL, PX_PER_METER, VIBE } from '../config.js';
import { difficultyAt } from '../systems/generator.js';
import { Sim } from './sim.js';
import { World } from './world3d.js';
import { audio } from '../systems/audio.js';
import { getBest, addCarpets, getCarpetTotal, spendCarpets, addCollectible, getSkin, getUpgrades, setUpgrade } from '../systems/storage.js';
import { bus } from '../bus.js';
import { classifySwipe, SWIPE_PX } from '../systems/swipe.js';


export class Game {
  constructor(container) {
    this.container = container;
    this.debug = new URLSearchParams(location.search).get('debug') || '';
    this.world = new World(container);
    this.sim = new Sim((t, d) => this.onFx(t, d), { debug: this.debug, getBest, addCarpets, spendCarpets, addCollectible, carpetTotal: getCarpetTotal(), getUpgrades, setUpgrade, mapOffsetM: (this.world.env && this.world.env.offset) || 0 });
    this.paused = false;
    this.accum = 0;
    this.last = 0;
    this.downT = 0;
    this.lastFrame = -1;
    this.perf = { frames: 0, cpu: 0, gap: 0, samples: [] };
    this._pp = { x: 0, y: 0, vis: true };
    this.bindInput();
    this.loop = this.loop.bind(this);
  }

  get mode() { return this.sim.mode; }
  start() { this.world.setSkin?.(getSkin()); this.world.setMood('menu'); requestAnimationFrame(this.loop); }
  resize(w, h) { this.world.resize(w, h); }

  // ---------------------------------------------------- API per ui.js
  startRun() {
    this.intro = null;
    this.paused = false;
    this.downT = 0;
    if (this.faceSnap != null && this.world.char3d) this.world.char3d.facing = this.faceSnap;
    this.faceSnap = null;
    this.sim.skin = getSkin();
    this.world.setSkin?.(this.sim.skin);
    this.sim.startRun();
    this.world.dance?.reset();
    audio.danceStop();
    this.world.setMood('run');
    audio.setIntensity(1, 0);
    this.emitHud(true);
  }
  // Dal menu: il corridore si gira e la camera passa dietro, poi parte la corsa. Riduzione movimento: taglio secco.
  beginIntro(done) {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.faceSnap = Math.PI;
      done();
      return;
    }
    this.intro = { t: 0, dur: 0.62, done };
  }
  toAttract() {
    this.intro = null;
    this.paused = false;
    this.downT = 0;
    this.sim.toAttract();
    this.world.dance?.reset();
    audio.danceStop();
    this.world.setMood('menu');
    audio.setIntensity(0);
  }
  duck() { return this.sim.duck(); }
  jump() { return this.sim.jump(); }
  // v5s7: Garag di Pinu (tutte le regole nella sim, qui solo vista e audio)
  enterShop() { const ok = this.sim.enterShop(); if (ok) { this.world.shopView = true; audio.click(); } return ok; }
  buyUpgrade(id) { return this.sim.buyUpgrade(id); }
  buyItem(id) { const r = this.sim.buy(id); if (r.ok) { audio.pistolPickup(); this.world.shopNod(); } else audio.empty(); return r; }
  leaveShopView() { this.world.shopView = false; }
  exitShop() { this.world.shopView = false; this.accum = 0; return this.sim.exitShop(); }
  skipDance() { return this.sim.skipDance(); }
  danceInput(dir) { return this.sim.danceInput(dir); }
  bellPan(e) { return Math.max(-1, Math.min(1, (this.sim.entX(e) - this.sim.px) / 45)); }
  fire() { const ok = this.sim.fire(); if (ok) audio.shoot(); return ok; }
  setSkin(id) { this.world.setSkin?.(id); }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.accum = 0; }
  isPaused() { return this.paused; }
  setHidden(h) { this.hidden = h; this.last = 0; this.accum = 0; }
  debugState() { return this.sim.debugState(); }

  // v5s46 (44): vibrazione del telefono (dove c'e' navigator.vibrate; iOS Safari non la supporta e si ignora)
  buzz(pattern) {
    if (!pattern || this.world.reducedMotion) return;
    (this.vibes || (this.vibes = [])).push(pattern); if (this.vibes.length > 20) this.vibes.shift();
    try { if (typeof navigator !== 'undefined' && navigator.vibrate && !(this.settings && this.settings.vibrate === false)) navigator.vibrate(pattern); } catch { /* non supportato */ }
  }
  // ---------------------------------------------------- effetti
  onFx(type, d) {
    const sim = this.sim;
    this.world.onFx(type, d, sim);
    switch (type) {
      case 'shot': break;
      case 'ricochet': audio.ricochet(); break;
      case 'barrel': audio.barrelBreak(d.big); break;
      case 'carpet': audio.carpet(d.streak); bus.emit('carpet', { run: d.run, total: d.total }); break;
      case 'fuel': audio.pickup(d.e.kind); break;
      case 'pistol': audio.pistolPickup(); break;
      case 'powerEnd': audio.powerEnd?.(); break;
      case 'collectible': bus.emit('collect', d); break;
      case 'junctionCue': try { navigator.vibrate?.(d.safe ? 20 : [60, 40, 60]); } catch { /* non supportato */ } break;   // v5s22: vibrazione
      case 'puddle': audio.puddle(); break;
      case 'hit': this.buzz(d.e && d.e.kind === 'ciccio' ? null : VIBE.HIT); audio.hit(); if (d.e && (d.e.kind === 'maimoni' || d.e.kind === 'fune')) audio.bellRing(this.bellPan(d.e)); break;
      case 'slip': audio.puddle(); break;
      case 'rockFall': audio.rockFall?.(); break;
      case 'duck': audio.duck?.(); break;
      case 'jumped': audio.nearMiss?.(); break;
      case 'jumpHint': {
        let seen = false; try { seen = localStorage.getItem('frakkera.jumphint.v1') === '1'; localStorage.setItem('frakkera.jumphint.v1', '1'); } catch { /* privato */ }
        if (!seen || this.debug.includes('hint')) bus.emit('popup', { text: 'SCORRI SU PER SALTARE', style: 'hint' });
        break;
      }
      case 'speedUp': bus.emit('speedup', d); break;
      case 'shopOffer': bus.emit('shopOffer', d); audio.milestone(); break;
      case 'shopOfferEnd': bus.emit('shopOfferEnd'); break;
      // v5s11: ballu tundu
      case 'danceCue': bus.emit('danceCue', d); break;
      case 'danceAbort': audio.danceStop(); bus.emit('danceEnd', { skipped: true, quit: true, reset: true }); break;
      case 'danceStart': bus.emit('danceStart', d); audio.danceStart(d.bpm); break;
      case 'danceBeat': audio.danceBeat(d); break;
      case 'danceRound': bus.emit('danceRound', d); break;
      case 'danceJudge': bus.emit('danceJudge', d); audio.danceHit(d.res); break;
      case 'danceEnd': bus.emit('danceEnd', d); audio.danceStop(); break;
      case 'shopBuy': bus.emit('carpet', { run: this.sim.stats.carpets, total: d.total }); break;
      case 'shieldBlock': this.buzz(VIBE.SHIELD); audio.ricochet(); break;
      case 'weaverHit': this.buzz(VIBE.WEAVER); break;
      case 'ciccioHit': this.buzz(VIBE.CICCIO); break;   // v5s46 (44): piu' forte
      case 'beamHint': {
        // suggerimento la prima volta (poi resta salvato)
        let seen = false; try { seen = localStorage.getItem('frakkera.duckhint.v1') === '1'; localStorage.setItem('frakkera.duckhint.v1', '1'); } catch { /* privato */ }
        if (!seen || this.debug.includes('hint')) bus.emit('popup', { text: 'SCORRI GI\u00d9 PER ABBASSARTI', style: 'hint' });
        break;
      }
      case 'die': if (sim.deathReason !== 'ciccio') this.buzz(VIBE.DIE); audio.gameOver(); audio.setIntensity(0); this.world.setMood('over'); break;
      case 'over': bus.emit('gameover', d); break;
      case 'popup': bus.emit('popup', d); break;
      case 'sound': audio[d]?.(); break;
      default: break;
    }
  }

  // ---------------------------------------------------- input
  bindInput() {
    // v5s45 (#10 "a volte non salta"): gli swipe si leggono su tutta la finestra (anche se partono sopra un banner o
    // l'offerta di Pinu), la direzione si decide solo dopo SWIPE_PX di movimento con l'asse dominante (prima un piccolo
    // scarto laterale all'inizio di uno swipe su lo trasformava in cambio corsia), e uno swipe veloce chiuso senza
    // pointermove intermedi viene letto al rilascio. Pulsanti con stopPropagation (spara, pausa) restano esclusi.
    const el = this.container;
    const isBtn = (t) => !!(t && t.closest && t.closest('button, .dn-pad'));
    // v5s46 (168): vicino ai bordi dello schermo lo swipe ha meno spazio (e il telefono se lo prende per i suoi gesti):
    // soglia piu' bassa se parte a meno di EDGE_PX dal bordo, e uno swipe interrotto dal sistema (pointercancel) si legge lo stesso
    const EDGE_PX = 36;
    const nearEdge = (x, y) => { const r = el.getBoundingClientRect(); return x < r.left + EDGE_PX || x > r.right - EDGE_PX || y > r.bottom - EDGE_PX; };
    window.addEventListener('pointerdown', (p) => { this.ptr = { x: p.clientX, y: p.clientY, lx: p.clientX, ly: p.clientY, t: performance.now(), swiped: false, id: p.pointerId, btn: isBtn(p.target), edge: nearEdge(p.clientX, p.clientY) }; });
    // iOS/Android: un tocco che parte sul bordo non deve diventare il gesto "indietro" del browser durante la corsa
    window.addEventListener('touchstart', (e) => {
      if (!(this.sim.mode === 'run' || this.sim.mode === 'dance') || this.paused) return;
      const t = e.touches[0]; if (!t || isBtn(e.target)) return;
      const r = el.getBoundingClientRect(); if (t.clientX < r.left + EDGE_PX || t.clientX > r.right - EDGE_PX) e.preventDefault();
    }, { passive: false });
    const swipe = (q, x, y, min) => {
      const dir = classifySwipe(x - q.x, y - q.y, min);
      if (!dir) return false;
      if (this.sim.mode === 'dance') this.sim.danceInput(dir);
      else if (dir === 'left' || dir === 'right') this.sim.move(dir === 'right' ? 1 : -1);
      else if (dir === 'up') this.jump();
      else this.duck();
      q.x = x; q.y = y; q.n = (q.n || 0) + 1;
      q.swiped = q.n >= 3;
      return true;
    };
    window.addEventListener('pointermove', (p) => {
      const q = this.ptr;
      if (!q || q.swiped || q.id !== p.pointerId) return;
      q.lx = p.clientX; q.ly = p.clientY;
      swipe(q, p.clientX, p.clientY, q.edge ? SWIPE_PX * 0.65 : SWIPE_PX);
    });
    const up = (p) => {
      const q = this.ptr;
      if (!q || q.id !== p.pointerId) return;
      const dt = performance.now() - q.t, dx = p.clientX - q.x, dy = p.clientY - q.y;
      if (!q.n && !swipe(q, p.clientX, p.clientY, SWIPE_PX * 0.75) && !q.btn && dt < 350 && Math.abs(dx) < 20 && this.sim.mode !== 'dance' && el.contains(p.target) !== false) {
        const r = el.getBoundingClientRect();
        this.sim.move(p.clientX < r.left + r.width / 2 ? -1 : 1);
      }
      this.ptr = null;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', (p) => { const q = this.ptr; if (q && q.id === p.pointerId && !q.n) swipe(q, q.lx, q.ly, SWIPE_PX * 0.6); this.ptr = null; });
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (this.paused) return;
      const k = e.code;
      if (this.sim.mode === 'dance') {
        const m = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }[k];
        if (m && !e.repeat) { this.sim.danceInput(m); e.preventDefault(); }
        return;
      }
      if (k === 'ArrowLeft' || k === 'KeyA') { if (!e.repeat) this.sim.move(-1); }
      else if (k === 'ArrowRight' || k === 'KeyD') { if (!e.repeat) this.sim.move(1); }
      else if (k === 'Space') this.fire();
      else if (k === 'KeyW' || k === 'ArrowUp') { if (!e.repeat) this.jump(); }
      else if (k === 'ArrowDown' || k === 'KeyS') { if (!e.repeat) this.duck(); }
      else if ((k === 'KeyP' || k === 'Escape') && this.sim.mode === 'run') bus.emit('request-pause');
    });
  }

  // ---------------------------------------------------- ciclo
  loop(now) {
    requestAnimationFrame(this.loop);
    try { this.world.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { this.world.reducedMotion = false; }
    if (this.hidden) return;
    const t0 = performance.now();
    const dtReal = this.last ? Math.min((now - this.last) / 1000, 0.25) : 1 / 60;
    if (this.last) { this.perf.gap += now - this.last; }
    this.last = now;
    const sim = this.sim;
    const intro = this.intro;
    if (intro) {
      intro.t += dtReal;
      if (intro.t >= intro.dur) { const done = intro.done; this.intro = null; done?.(); }
    }
    if (!this.paused && !this.intro) {
      this.accum += dtReal;
      let steps = 0;
      while (this.accum >= WORLD.FIXED_DT && steps < WORLD.MAX_STEPS_PER_FRAME) { sim.tick(WORLD.FIXED_DT); this.accum -= WORLD.FIXED_DT; steps++; }
      if (steps >= WORLD.MAX_STEPS_PER_FRAME) this.accum = 0;
    }
    const dt = this.paused ? 0 : dtReal;
    const mode = sim.mode;
    if (mode === 'dying' || mode === 'over') this.downT = Math.min(1, this.downT + dt / 0.6);
    const fuelF = Math.max(0, sim.fuel) / FUEL.MAX;
    const ch = this.character || (this.character = {});
    ch.mode = mode; ch.speed = sim.currentSpeed; ch.clock = sim.clock; ch.vx = sim.vx; ch.invuln = sim.invuln; ch.targetLane = sim.targetLane;
    ch.duck = mode === 'run' ? sim.duckT : 0; ch.jumpH = mode === 'run' ? sim.jumpH : 0; ch.slip = sim.slipT; ch.fuelLow = sim.fuel < FUEL.LOW_WARNING; ch.armed = mode === 'run' && (sim.ammo > 0 || sim.recoilT > 0);
    ch.recoil = sim.recoilT; ch.flameOn = mode === 'run' || mode === 'attract' || mode === 'dance' || !!this.intro; ch.raise = mode === 'dance' ? 1 : 0; ch.downT = this.downT;
    const ease = this.intro ? this.intro.t / this.intro.dur : 0;
    const introK = ease <= 0 ? 0 : ease >= 1 ? 1 : ease * ease * (3 - 2 * ease);
    ch.face = (mode === 'attract' || this.intro) ? introK * Math.PI : null;
    const view = this.view || (this.view = {});
    view.introK = this.intro ? introK : 0;
    view.cam = (mode === 'attract' || this.intro) ? 'menu' : mode === 'dance' ? 'dance' : (mode === 'run' || mode === 'shop' || mode === 'dying') ? 'run' : 'over';   // il rallenty dell'urto tiene la camera di corsa, cosi' si vede l'ostacolo
    view.char = ch; view.fuelF = mode === 'attract' || this.intro ? 1 : fuelF; view.speed = sim.currentSpeed; view.smoke = mode === 'dying' || mode === 'over';
    this.world.render(sim, dt, view);
    if (this.world.shopSign) bus.emit('shopAnchor', { on: true, x: this.world.shopSign.x, y: this.world.shopSign.y });
    else if (this._shopAnch) bus.emit('shopAnchor', { on: false });
    this._shopAnch = !!this.world.shopSign;
    if (this._nightK !== this.world.nightK) { this._nightK = this.world.nightK || 0; bus.emit('night', this._nightK); }
    // passi
    const fr = this.world.stepFrame();
    if (fr !== this.lastFrame && (fr === 1 || fr === 3) && mode === 'run' && !this.paused && !sim.cart) audio.step(fr === 3);
    this.lastFrame = fr;
    if (!this.paused) {
      audio.fire(fuelF, dtReal, mode === 'run' || mode === 'attract');
      if ((this._ambT = (this._ambT || 0) + dtReal) > 0.25) { this._ambT = 0; audio.ambience(this.world.amb); audio.festa?.(this.sim.mode === 'run' && this.sim.debugFesta()); }
      audio.cartTick?.(!!this.sim.cart && this.sim.mode === 'run' && !this.paused, this.sim.currentSpeed || 0, dtReal);   // v5s22: rumore del carrello
      if (mode === 'run') audio.setIntensity(1, difficultyAt(sim.runD));
      // v5s10: campanacci di su Maimoni e degli Stramaionis (volume per distanza, pan per corsia)
      if (mode === 'run' && !this.paused) {
        const bl = this._bl || (this._bl = []); bl.length = 0;
        for (const e of sim.entities) if ((e.kind === 'maimoni' || e.kind === 'fune') && !(e.hit && !e.ducked)) bl.push({ id: e.id, kind: e.kind, dist: e.d - sim.T, pan: this.bellPan(e) });
        audio.bells(bl, dtReal);
      }
    }
    // popup posizionati nel mondo
    const q = this.world.popupQ;
    while (q.length) {
      const p = q.shift();
      this.world.project(p.x, p.y, p.z, this._pp);
      if (this._pp.vis) bus.emit('popup', { text: p.text, style: p.style, x: this._pp.x, y: this._pp.y });
    }
    this.emitHud(false);
    const cpu = performance.now() - t0;
    this.perf.frames++; this.perf.cpu += cpu;
    const s = this.perf.samples; s.push(cpu); if (s.length > 240) s.shift();
    // qualita' adattiva: se i frame sono lenti per 2 s, si abbassa la risoluzione (min 1x)
    const ad = this.adapt || (this.adapt = { t: 0, n: 0, gap: 0, off: /[?&]fixeddpr/.test(location.search) });
    if (!ad.off && !this.paused && dtReal < 0.2) {
      ad.t += dtReal; ad.n++; ad.gap += dtReal;
      if (ad.t > 2) {
        const avg = ad.gap / ad.n, pr = this.world.renderer.getPixelRatio();
        const cap = this.world.maxPR || 1.75, now = performance.now();
        if (avg > 0.024 && pr > 1.01) { this.world.setPixelRatio(Math.max(1, pr - 0.25)); ad.down = now; }
        // v5s14: se poi il gioco torna fluido (es. dopo un ambiente pesante) la risoluzione risale, con calma
        else if (avg < 0.0135 && pr < cap - 0.01 && now - (ad.down || -1e9) > 20000) this.world.setPixelRatio(Math.min(cap, pr + 0.25));
        ad.t = 0; ad.n = 0; ad.gap = 0;
      }
    }
  }

  emitHud(force) {
    const now = performance.now();
    if (!force && now - (this._lastHud || 0) < 66) return;
    this._lastHud = now;
    const sim = this.sim;
    bus.emit('hud', {
      mode: sim.mode, score: sim.score,
      best: Math.max(sim.best, sim.mode === 'run' || sim.mode === 'dying' || sim.mode === 'over' || sim.mode === 'dance' || sim.mode === 'shop' ? sim.score : 0),   // v5s29 (QA L1): REC non torna a 0 durante il ballo
      meters: Math.floor(Math.max(0, sim.runD) / PX_PER_METER),
      fuel: Math.max(0, sim.fuel) / FUEL.MAX, chain: sim.chain,
      carpets: sim.mode === 'attract' ? 0 : sim.stats.carpets, carpetTotal: sim.carpetTotal,
      ammo: sim.mode === 'run' ? sim.ammo : 0,
      magnetT: sim.mode === 'run' ? sim.magnetT : 0, fennelT: sim.mode === 'run' ? sim.fennelT : 0, bootsT: sim.mode === 'run' ? sim.bootsT : 0,
    });
  }

  perfStats() {
    const s = this.perf.samples.slice().sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
    return {
      frames: this.perf.frames, cpuAvgMs: +avg.toFixed(2), cpuP95Ms: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2),
      frameGapAvgMs: +(this.perf.gap / Math.max(1, this.perf.frames - 1)).toFixed(2),
      drawCalls: this.world.renderer.info.render.calls, triangles: this.world.renderer.info.render.triangles,
      pixelRatio: this.world.renderer.getPixelRatio(),
    };
  }
}
