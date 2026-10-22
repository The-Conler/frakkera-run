// =====================================================================
// Controller: ciclo a passo fisso (Sim) + rendering 3D (World) + input.
// Espone all'interfaccia la stessa API della scena v2.
// =====================================================================
import { WORLD, FUEL, PX_PER_METER } from '../config.js';
import { difficultyAt } from '../systems/generator.js';
import { Sim } from './sim.js';
import { World } from './world3d.js';
import { audio } from '../systems/audio.js';
import { getBest, addCarpets, getCarpetTotal } from '../systems/storage.js';
import { bus } from '../bus.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.debug = new URLSearchParams(location.search).get('debug') || '';
    this.world = new World(container);
    this.sim = new Sim((t, d) => this.onFx(t, d), { debug: this.debug, getBest, addCarpets, carpetTotal: getCarpetTotal() });
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
  start() { this.world.setMood('menu'); requestAnimationFrame(this.loop); }
  resize(w, h) { this.world.resize(w, h); }

  // ---------------------------------------------------- API per ui.js
  startRun() {
    this.paused = false;
    this.downT = 0;
    this.sim.startRun();
    this.world.setMood('run');
    audio.setIntensity(1, 0);
    this.emitHud(true);
  }
  toAttract() {
    this.paused = false;
    this.downT = 0;
    this.sim.toAttract();
    this.world.setMood('menu');
    audio.setIntensity(0);
  }
  fire() { const ok = this.sim.fire(); if (ok) audio.shoot(); return ok; }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.accum = 0; }
  isPaused() { return this.paused; }
  setHidden(h) { this.hidden = h; this.last = 0; this.accum = 0; }
  debugState() { return this.sim.debugState(); }

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
      case 'puddle': audio.puddle(); break;
      case 'hit': audio.hit(); break;
      case 'die': audio.gameOver(); audio.setIntensity(0); this.world.setMood('over'); break;
      case 'over': bus.emit('gameover', d); break;
      case 'popup': bus.emit('popup', d); break;
      case 'sound': audio[d]?.(); break;
      default: break;
    }
  }

  // ---------------------------------------------------- input
  bindInput() {
    const el = this.container;
    el.addEventListener('pointerdown', (p) => { this.ptr = { x: p.clientX, y: p.clientY, t: performance.now(), swiped: false, id: p.pointerId }; });
    el.addEventListener('pointermove', (p) => {
      const q = this.ptr;
      if (!q || q.swiped || q.id !== p.pointerId) return;
      const dx = p.clientX - q.x, dy = p.clientY - q.y;
      if (Math.abs(dx) >= 20 && Math.abs(dx) > Math.abs(dy) * 1.1) { this.sim.move(dx > 0 ? 1 : -1); q.swiped = true; }
      else if (dy <= -26 && Math.abs(dy) > Math.abs(dx) * 1.3) { this.fire(); q.swiped = true; }
    });
    const up = (p) => {
      const q = this.ptr;
      if (!q || q.id !== p.pointerId) return;
      const dt = performance.now() - q.t;
      if (!q.swiped && dt < 350 && Math.abs(p.clientX - q.x) < 20) {
        const r = el.getBoundingClientRect();
        this.sim.move(p.clientX < r.left + r.width / 2 ? -1 : 1);
      }
      this.ptr = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { this.ptr = null; });
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (this.paused) return;
      const k = e.code;
      if (k === 'ArrowLeft' || k === 'KeyA') { if (!e.repeat) this.sim.move(-1); }
      else if (k === 'ArrowRight' || k === 'KeyD') { if (!e.repeat) this.sim.move(1); }
      else if (k === 'Space' || k === 'KeyW' || k === 'ArrowUp') this.fire();
      else if ((k === 'KeyP' || k === 'Escape') && this.sim.mode === 'run') bus.emit('request-pause');
    });
  }

  // ---------------------------------------------------- ciclo
  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.hidden) return;
    const t0 = performance.now();
    const dtReal = this.last ? Math.min((now - this.last) / 1000, 0.25) : 1 / 60;
    if (this.last) { this.perf.gap += now - this.last; }
    this.last = now;
    const sim = this.sim;
    if (!this.paused) {
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
    ch.fuelLow = sim.fuel < FUEL.LOW_WARNING; ch.armed = mode === 'run' && (sim.ammo > 0 || sim.recoilT > 0);
    ch.recoil = sim.recoilT; ch.flameOn = mode === 'run' || mode === 'attract'; ch.downT = this.downT;
    const view = this.view || (this.view = {});
    view.cam = mode === 'attract' ? 'menu' : mode === 'run' ? 'run' : 'over';
    view.char = ch; view.fuelF = mode === 'attract' ? 1 : fuelF; view.speed = sim.currentSpeed; view.smoke = mode === 'dying' || mode === 'over';
    this.world.render(sim, dt, view);
    // passi
    const fr = this.world.stepFrame();
    if (fr !== this.lastFrame && (fr === 1 || fr === 3) && mode === 'run' && !this.paused) audio.step(fr === 3);
    this.lastFrame = fr;
    if (!this.paused) {
      audio.fire(fuelF, dtReal, mode === 'run' || mode === 'attract');
      if ((this._ambT = (this._ambT || 0) + dtReal) > 0.25) { this._ambT = 0; audio.ambience(this.world.amb); }
      if (mode === 'run') audio.setIntensity(1, difficultyAt(sim.runD));
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
        if (avg > 0.024 && pr > 1.01) this.world.setPixelRatio(Math.max(1, pr - 0.25));
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
      best: Math.max(sim.best, sim.mode === 'run' || sim.mode === 'dying' || sim.mode === 'over' ? sim.score : 0),
      meters: Math.floor(Math.max(0, sim.runD) / PX_PER_METER),
      fuel: Math.max(0, sim.fuel) / FUEL.MAX, chain: sim.chain,
      carpets: sim.mode === 'attract' ? 0 : sim.stats.carpets, carpetTotal: sim.carpetTotal,
      ammo: sim.mode === 'run' ? sim.ammo : 0,
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
