// v5s11: cerchio del ballu tundu nella piazza: 9 ballerini in costume di Gadoni + il corridore
// (posto 0 del cerchio, frakkera alzata). Il cerchio gira a tempo; a fine ballo si apre e si passa in mezzo.
import * as THREE from 'three';
import { buildDancer, danceStep } from './dancers.js';
import { DANCE, danceThisLap } from '../../config.js';
import { CYCLE } from '../biomes/config.js';

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
    // v5s46d (278): suonatore di launeddas sul marciapiede, fuori dal cerchio e dalle corsie
    { const laun = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 3, 6), new THREE.MeshLambertMaterial({ color: '#1a1a1a' }));
      body.position.y = 0.85; laun.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: '#e0b48e' }));
      head.position.y = 1.45; laun.add(head);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 6), new THREE.MeshLambertMaterial({ color: '#111' }));
      cap.position.y = 1.62; laun.add(cap);
      for (const [dx, col] of [[-0.06, '#c8a46a'], [0, '#e8d2a0'], [0.06, '#8a5a32']]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 5), new THREE.MeshLambertMaterial({ color: col }));
        p.position.set(dx, 1.15, 0.2); p.rotation.x = 0.4; laun.add(p);
      }
      laun.position.set(-5.6, 0, 0.2); g.add(laun); this.laun = laun; }
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.2, 0.14, 8, 40), new THREE.MeshBasicMaterial({ color: '#e8c060' }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.06; g.add(this.ring);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(R0 + 0.15, 28), new THREE.MeshBasicMaterial({ color: '#c44a2a', transparent: true, opacity: 0.42 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = 0.02; g.add(this.floor);
    this.w.scene.add(g); this.group = g;
  }
  // v5s44c: mostra il cerchio da lontano (VIS_M), senza toccare cue/gameplay
  reset() {
    this.state = 'off'; this.blend = 0; this.active = false; this.openT = 99; this.joinT = 0;
    if (this.group) this.group.visible = false;
  }
  preview(sim) {
    if (this.state === 'dance' || this.state === 'cue' || this.state === 'open') return;
    const m = (sim.runD || 0) / 10 + (sim.mapOffsetM || 0);
    let lap = Math.floor(m / CYCLE);
    if (!danceThisLap(lap) || m > lap * CYCLE + DANCE.AT_M + 25) {
      lap += lap % 2 === 1 ? 2 : 1;
      if (lap < 1) lap = 1;
    }
    if (!danceThisLap(lap)) return;
    const danceM = lap * CYCLE + DANCE.AT_M;
    const ahead = danceM - m, vis = DANCE.VIS_M || 110;
    if (ahead >= vis || ahead < -20) {
      if (this.state === 'preview') { this.state = 'off'; if (this.group) this.group.visible = false; }
      return;
    }
    if (!this.group) this.build();
    this.C.set(0, 0, -sim.T * 0.1 - ahead - R0);
    this.state = 'preview'; this.group.visible = true;
    this.farLod = ahead > 48;
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
    if (this.ring) this.ring.position.set(this.C.x, 0.06, this.C.z);
    if (this.floor) this.floor.position.set(this.C.x, 0.02, this.C.z);
    const bk = Math.exp(-Math.max(0, this.w.clock - this.beatT) * 7);
    const ph = (this.t / (bt * 2)) % 1;
    for (const d of this.dancers) {
      const a = this.theta + (d.slot / N) * Math.PI * 2;
      d.root.position.set(this.C.x + Math.sin(a) * this.R, 0, this.C.z + Math.cos(a) * this.R);
      d.root.rotation.y = a + Math.PI;                      // guardano il centro
      if (this.state === 'preview' && this.farLod) { d.root.position.y = 0; }
      else danceStep(d, ph + d.slot * 0.37, bk * (0.72 + (d.slot % 3) * 0.14));
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
