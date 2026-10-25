// v5s11: cerchio del ballu tundu nella piazza: 9 ballerini in costume di Gadoni + il corridore
// (posto 0 del cerchio, frakkera alzata). Il cerchio gira a tempo; a fine ballo si apre e si passa in mezzo.
import * as THREE from 'three';
import { buildDancer, danceStep } from './dancers.js';
import { DANCE } from '../../config.js';

const C_GOLD = new THREE.Color('#ffd060'), C_ORANGE = new THREE.Color('#ffa040');
const U = 0.1, N = 10, R0 = 3.0, R_OPEN = 7.6;
export class DanceRing {
  constructor(world) {
    this.w = world; this.group = null; this.active = false; this.state = 'off';
    this.C = new THREE.Vector3(); this.theta = 0; this.R = R0; this.beatT = -9; this.bpm = DANCE.BPM0; this.t = 0; this.blend = 0;
    this.runner = { x: 0, z: 0, ry: Math.PI, hop: 0 }; this.from = new THREE.Vector3();
  }
  build() {
    const g = new THREE.Group(); this.dancers = [];
    for (let i = 1; i < N; i++) { const d = buildDancer(this.w.mats2, i % 2 === 1, i); g.add(d.root); this.dancers.push({ ...d, slot: i }); }
    this.w.scene.add(g); this.group = g;
  }
  on(type, d, sim) {
    if (type === 'danceCue') {
      if (!this.group) this.build();
      const toGo = sim.danceCue ? sim.danceCue.d0 : 0;
      this.C.set(0, 0, -(sim.T + toGo) * U - R0); this.R = R0; this.state = 'cue'; this.group.visible = true; this.t = 0; this.bpm = DANCE.BPM0 + DANCE.BPM_LAP * (d.lap || 0);
    } else if (type === 'danceStart') {
      if (!this.group) this.build();
      if (this.state !== 'cue') { this.C.set(0, 0, -sim.T * U - R0); this.R = R0; this.group.visible = true; }
      this.C.z = -sim.T * U - R0;
      this.state = 'dance'; this.joinT = 0; this.bpm = d.bpm;
      this.theta = 0; this.from.set(sim.px * U, 0, -sim.T * U);
    } else if (type === 'danceBeat') { this.beatT = this.w.clock; this.bpm = d.bpm; if (d.down) this.w.addShake?.(0.04, 0.05); }
    else if (type === 'danceEnd') {
      if (this.state === 'dance') { this.blend = 1; this.from.set(this.runner.x, 0, this.runner.z); }
      this.state = 'open'; this.openT = 0;
    } else if (type === 'danceJudge') {
      const t = this.w.tipW;
      if (d.res === 'perfect') { this.w.burst(t.x, t.y + 0.6, t.z, C_GOLD, 16, 5); this.w.flashBoost = 0.6; }
      else if (d.res === 'good') this.w.burst(t.x, t.y + 0.6, t.z, C_ORANGE, 8, 3);
    }
  }
  // ritorna la posizione del corridore nel cerchio (o null)
  update(dt, sim) {
    if (!this.group || this.state === 'off') return null;
    this.t += dt;
    const bt = 60 / this.bpm;
    const om = (Math.PI * 2) / (32 * bt);   // (apertura finale)
    // il cerchio ondeggia a tempo (avanti e indietro di un passo e mezzo), il corridore resta davanti
    this.swayT = (this.swayT || 0) + dt;
    this.theta = 0.42 * Math.sin((this.swayT * Math.PI * 2) / (16 * bt)) + (this.state === 'open' ? (this.openT || 0) * om * 3 : 0);
    if (this.state === 'open') {
      this.openT += dt; this.R += (R_OPEN - this.R) * Math.min(1, dt * 2.2);
      const camZ = this.w.camera.position.z;
      if (this.C.z - R_OPEN > camZ + 2 || this.openT > 12) { this.state = 'off'; this.group.visible = false; return null; }
    }
    const bk = Math.exp(-Math.max(0, this.w.clock - this.beatT) * 7);
    const ph = (this.t / (bt * 2)) % 1;
    for (const d of this.dancers) {
      const a = this.theta + (d.slot / N) * Math.PI * 2;
      d.root.position.set(this.C.x + Math.sin(a) * this.R, 0, this.C.z + Math.cos(a) * this.R);
      d.root.rotation.y = a + Math.PI;                      // guardano il centro
      danceStep(d, ph + d.slot * 0.5, bk);
    }
    if (this.state === 'dance') {
      this.joinT += dt; const q = Math.min(1, this.joinT / 0.9), e = q * q * (3 - 2 * q);
      const a = this.theta;
      const sx = this.C.x + Math.sin(a) * this.R, sz = this.C.z + Math.cos(a) * this.R;
      this.runner.x = this.from.x + (sx - this.from.x) * e; this.runner.z = this.from.z + (sz - this.from.z) * e;
      this.runner.ry = Math.PI + (a) * e; this.runner.hop = bk * 0.1;
      return this.runner;
    }
    if (this.blend > 0) {
      this.blend = Math.max(0, this.blend - dt / 0.6); const e = this.blend * this.blend;
      this.runner.x = sim.px * U + (this.from.x - sim.px * U) * e; this.runner.z = -sim.T * U + (this.from.z + sim.T * U) * e * 0; this.runner.ry = Math.PI; this.runner.hop = 0;
      this.runner.z = -sim.T * U;
      return this.runner;
    }
    return null;
  }
  camera(cp, cl) {
    // la camera segue il corridore lungo il cerchio (resta dietro di lui, fuori dal cerchio)
    const a = (this.state === 'dance' ? this.theta * Math.min(1, (this.joinT || 0) / 0.9) : 0) * 0.5, D = this.R + 9;
    cp.set(this.C.x + Math.sin(a) * D, 7.2, this.C.z + Math.cos(a) * D); cl.set(this.C.x, 2.3, this.C.z - 0.8);
    return 58;
  }
}
