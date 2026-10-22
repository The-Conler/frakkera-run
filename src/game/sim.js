// =====================================================================
// Simulazione di gioco a passo fisso, SENZA rendering: stessa logica della
// v2 (punteggio, fiamma, collisioni, pistola, tappeti, tetti anti-exploit,
// registro partita). Il renderer 3D legge lo stato e riceve gli effetti
// tramite `fx(tipo, dati)`. Unita': px del mondo 2D (10 px = 1 m), corsie
// centrate su x = 0.
// =====================================================================
import { SCORE, FUEL, WORLD, PX_PER_METER, PISTOL } from '../config.js';
import { Generator, SOLID, DESTRUCTIBLE, PICKUP_KINDS, difficultyAt, speedAt, lerp } from '../systems/generator.js';
import { randomSeed } from '../systems/rng.js';

export const HALF_W = { muretto: 12, botte: 7, bottecoricata: 11, botti: 12, pozza: 9, narrow: 17, goat: 7, rollbarrel: 7, asfodelo: 10, ferula: 10, tappeto: 11, pistola: 11 };
export const ATTRACT_SPEED = 34;
const PLAYER_BACK = 3, PLAYER_FRONT = 5, PLAYER_HALF = 3;
export const GUTTER = 4;
export const ROAD_HALF = (WORLD.LANES * WORLD.LANE_W + GUTTER * 2) / 2;
export const VIEW_AHEAD = 1150;   // px generati davanti (orizzonte 3D)
const MOVE_AHEAD = 336;           // gli ostacoli mobili si muovono solo da qui (come la v2)
const SHOT_RANGE = 360;           // gittata del colpo (come la v2)
const BEHIND = 140;               // px dietro il giocatore prima di riciclare
export const isMoving = (k) => k === 'goat' || k === 'rollbarrel';
export const laneX = (i) => (i - (WORLD.LANES - 1) / 2) * WORLD.LANE_W;

export class Sim {
  constructor(fx, opts = {}) {
    this.fx = fx || (() => {});
    this.debug = opts.debug || '';
    this.getBest = opts.getBest || (() => 0);
    this.addCarpets = opts.addCarpets || (() => 0);
    this.carpetTotal = opts.carpetTotal || 0;
    this.mode = 'attract';
    this.T = 0; this.genOffset = 0; this.clock = 0;
    this.entities = []; this.shots = [];
    this.currentSpeed = ATTRACT_SPEED;
    this.uid = 1;
    this.resetRunState();
    this.lane = 1; this.targetLane = 1; this.px = laneX(1); this.vx = 0;
  }

  resetRunState() {
    this.score = 0; this.metersCredited = 0; this.fuel = FUEL.START; this.chain = 0;
    this.stats = { pickups: 0, nearMiss: 0, chains: 0, milestones: 0, hits: 0, bonus: 0, carpets: 0, barrels: 0, shots: 0, pistols: 0, survival: 0, capped: 0 };
    this.carpetStreak = 0; this.ammo = 0; this.fireCd = 0; this.recoilT = 0;
    this.shots = [];
    this.nextSurvival = SCORE.SURVIVAL_EVERY_S;
    this.bonusWin = { idx: -1, sum: 0 };
    this.events = []; this.inputs = [];
    this.nextMilestone = 0; this.lastNearMiss = -99; this.invuln = 0; this.slowT = 99;
    this.step = 0; this.best = this.getBest(); this.bestAnnounced = this.best <= 0; this.runTime = 0;
  }

  get runD() { return this.T - this.genOffset; }
  log(code, v = 0) { this.events.push([this.step, code, v]); }

  clearEntities() { for (const e of this.entities) this.fx('despawn', e); this.entities = []; }

  startRun(seed) {
    this.clearEntities();
    this.resetRunState();
    this.seed = seed ?? randomSeed();
    this.gen = new Generator(this.seed, { debugPistol: this.debug.includes('pistol') });
    this.genOffset = this.T;
    this.mode = 'run';
    this.lane = 1; this.targetLane = 1;
    this.fx('start');
  }

  toAttract() {
    this.mode = 'attract';
    this.genOffset = this.T;
    this.score = 0;
    this.clearEntities();
    this.fuel = FUEL.MAX; this.targetLane = 1; this.ammo = 0; this.shots = [];
    this.fx('attract');
  }

  spawn(e) {
    e.id = this.uid++;
    e.d += this.genOffset;
    e.solid = !!SOLID[e.kind];
    e.hit = false; e.done = false; e.near = false;
    if (e.kind === 'goat' || e.kind === 'rollbarrel') e.x = e.dir > 0 ? -ROAD_HALF - 6 : ROAD_HALF + 6;
    this.entities.push(e);
    this.fx('spawn', e);
  }

  // ------------------------------------------------------------ input
  move(dir) {
    if (this.mode !== 'run') return false;
    const next = Math.max(0, Math.min(WORLD.LANES - 1, this.targetLane + dir));
    if (next === this.targetLane) return false;
    const fromLane = Math.round((this.px - laneX(0)) / WORLD.LANE_W);
    const win = (this.currentSpeed || 0) * SCORE.NEAR_MISS_WINDOW_S;
    for (const e of this.entities) {
      if (!e.solid || e.hit || e.done || e.lane !== fromLane || isMoving(e.kind)) continue;
      const gap = e.d - (this.T + PLAYER_FRONT);
      if (gap >= 0 && gap <= win) e.near = true;
    }
    this.targetLane = next;
    this.inputs.push([this.step, dir]);
    return true;
  }

  fire() {
    if (this.mode !== 'run' || this.ammo <= 0 || this.fireCd > 0) return false;
    this.ammo--;
    this.fireCd = PISTOL.FIRE_COOLDOWN_S;
    this.recoilT = 0.12;
    this.stats.shots++;
    this.inputs.push([this.step, 'F']);
    const p = { d: this.T + 22, x: this.px - 5, id: this.uid++ };
    this.shots.push(p);
    this.fx('shot', p);
    if (this.ammo === 0) this.fx('popup', { text: 'SENZA COLPI', style: 'grey' });
    return true;
  }

  // ------------------------------------------------------------ passo fisso
  tick(dt) {
    this.clock += dt;
    if (this.mode === 'attract') {
      this.currentSpeed = ATTRACT_SPEED;
      // v4: nel menu il personaggio 3D e' fermo (IDLE), quindi il mondo non scorre
      this.fuel = FUEL.MAX;
      this.approachLane(dt);
      return;
    }
    if (this.mode === 'over') { this.currentSpeed = 0; return; }
    if (this.mode === 'dying') {
      this.currentSpeed = this.dieByHit ? 0 : Math.max(0, (this.currentSpeed || 0) - 900 * dt);
      this.T += this.currentSpeed * dt;
      this.dieT -= dt;
      if (this.dieT <= 0) this.finish();
      return;
    }
    this.step++;
    this.runTime += dt;
    const rd = this.runD;
    if (this.slowT < WORLD.HIT_RECOVER_S) this.slowT += dt;
    const slow = lerp(WORLD.HIT_SLOW, 1, Math.min(1, this.slowT / WORLD.HIT_RECOVER_S));
    const speed = speedAt(rd) * slow;
    this.currentSpeed = speed;
    this.T += speed * dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.fuel -= lerp(FUEL.DRAIN_START, FUEL.DRAIN_END, difficultyAt(rd)) * dt;

    const meters = Math.floor(this.runD / PX_PER_METER);
    while (this.metersCredited < meters) {
      this.metersCredited++;
      this.score += SCORE.PER_METER;
      this.checkMilestone(this.metersCredited);
    }
    this.approachLane(dt);
    this.gen.fillUntil(this.runD + VIEW_AHEAD, (e) => this.spawn(e));
    this.updateEntities(dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.recoilT = Math.max(0, this.recoilT - dt);
    this.updateShots(dt);
    if (this.runTime >= this.nextSurvival) {
      this.nextSurvival += SCORE.SURVIVAL_EVERY_S;
      const pts = this.addBonus(SCORE.SURVIVAL_BONUS, false);
      this.stats.survival++;
      this.log('s', pts);
      this.fx('popup', { text: `LA FIAMMA RESISTE +${pts}`, style: 'gold' });
      this.fx('sound', 'survival');
    }
    if (!this.bestAnnounced && this.score > this.best) {
      this.bestAnnounced = true;
      this.fx('popup', { text: 'NUOVO RECORD!', style: 'record' });
      this.fx('sound', 'record');
    }
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.mode = 'dying';
      this.dieByHit = this.lastHitStep === this.step;
      this.dieT = WORLD.DYING_S;
      for (const p of this.shots) this.fx('shotEnd', p);
      this.shots = [];
      this.fx('die');
    }
  }

  approachLane(dt) {
    const tx = laneX(this.targetLane);
    const d = tx - this.px;
    if (Math.abs(d) <= WORLD.LANE_SNAP_PX) { this.px = tx; this.vx = 0; return; }
    this.px += d * (1 - Math.exp(-WORLD.LANE_EASE * dt));
    this.vx = Math.max(-1, Math.min(1, d / WORLD.LANE_W));
  }

  checkMilestone(m) {
    const list = SCORE.MILESTONES;
    let target, bonus;
    if (this.nextMilestone < list.length) { target = list[this.nextMilestone].m; bonus = list[this.nextMilestone].bonus; }
    else {
      target = list[list.length - 1].m + (this.nextMilestone - list.length + 1) * SCORE.MILESTONE_REPEAT_EVERY;
      bonus = SCORE.MILESTONE_REPEAT_BONUS;
    }
    if (m >= target) {
      this.nextMilestone++;
      const pts = this.addBonus(bonus, false); // legato alla distanza: fuori dal tetto
      this.stats.milestones++;
      this.log('m', pts);
      this.fx('popup', { text: `${target} M  +${pts}`, style: 'gold' });
      this.fx('sound', 'milestone');
    }
  }

  // tetto anti-exploit: al massimo BONUS_CAP_PER_10S punti-azione ogni 10 s di corsa
  addBonus(v, capped = true) {
    if (!capped) { this.score += v; this.stats.bonus += v; return v; }
    const idx = Math.floor(this.runTime / 10);
    if (idx !== this.bonusWin.idx) this.bonusWin = { idx, sum: 0 };
    const room = Math.max(0, SCORE.BONUS_CAP_PER_10S - this.bonusWin.sum);
    const pts = Math.min(v, room);
    if (pts < v) { this.stats.capped += v - pts; this.log('cap', v - pts); }
    this.bonusWin.sum += pts;
    this.score += pts; this.stats.bonus += pts;
    return pts;
  }

  entX(e) { return isMoving(e.kind) ? e.x : laneX(e.lane); }

  updateEntities(dt) {
    const T = this.T;
    const pBack = T - PLAYER_BACK, pFront = T + PLAYER_FRONT;
    const px = this.px;
    for (const e of this.entities) {
      if (isMoving(e.kind)) {
        if (e.d - T < MOVE_AHEAD) { e.x += e.vx * e.dir * dt; e.moving = true; }
        if (e.kind === 'goat' && !e.bleat && e.d - T < MOVE_AHEAD - 10) { e.bleat = true; this.fx('sound', 'goat'); }
      }
      if (e.done) continue;
      const ex = this.entX(e);
      const hw = HALF_W[e.kind] || 10;
      const overlapD = e.d <= pFront && e.d + e.len >= pBack;
      if (e.pickup) {
        if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF) { this.collect(e); continue; }
        if (e.d + e.len < pBack) {
          e.done = true;
          if (PICKUP_KINDS[e.kind] === 'fuel') this.chain = 0;
          if (e.kind === 'tappeto') this.carpetStreak = 0;
        }
        continue;
      }
      if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF && !e.hit) {
        if (e.kind === 'pozza') { this.hitPuddle(e); continue; }
        if (this.invuln <= 0) { this.hitSolid(e); continue; }
      }
      if (e.d + e.len < pBack) {
        e.done = true;
        if (e.near && !e.hit && this.clock - this.lastNearMiss >= SCORE.NEAR_MISS_COOLDOWN_S) {
          this.lastNearMiss = this.clock;
          const pts = this.addBonus(SCORE.NEAR_MISS);
          this.stats.nearMiss++;
          this.log('n', pts);
          this.fx('popup', { text: `PER UN PELO! +${pts}`, style: 'white' });
          this.fx('sound', 'nearMiss');
        }
      }
    }
    const bottom = T - BEHIND;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.d + e.len < bottom) { this.fx('despawn', e); this.entities.splice(i, 1); }
    }
  }

  updateShots(dt) {
    const speed = (this.currentSpeed || 0) + PISTOL.SHOT_SPEED;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const p = this.shots[i];
      p.d += speed * dt;
      let gone = p.d - this.T > SHOT_RANGE;
      if (!gone) {
        for (const e of this.entities) {
          if (e.done || e.pickup || !e.solid || e.kind === 'goat') continue; // le capre non si toccano
          const ex = this.entX(e);
          if (e.d <= p.d + 3 && e.d + e.len + 6 >= p.d && Math.abs(ex - p.x) <= (HALF_W[e.kind] || 10) + 2) {
            if (DESTRUCTIBLE[e.kind]) this.destroyBarrel(e);
            else this.fx('ricochet', { x: p.x, d: p.d });
            gone = true;
            break;
          }
        }
      }
      if (gone) { this.fx('shotEnd', p); this.shots.splice(i, 1); }
    }
  }

  destroyBarrel(e) {
    e.done = true; e.destroyed = true;
    const big = e.kind === 'botti';
    const pts = this.addBonus(big ? SCORE.BARREL_GROUP : SCORE.BARREL);
    this.stats.barrels++;
    this.log('b', pts);
    this.fx('barrel', { e, big, pts, x: this.entX(e) });
  }

  collect(e) {
    e.done = true;
    const type = PICKUP_KINDS[e.kind];
    if (type === 'carpet') {
      this.stats.carpets++;
      this.carpetTotal = this.addCarpets(1); // salvato subito: non si perde
      const pts = this.addBonus(SCORE.CARPET);
      this.log('c', pts);
      this.fx('carpet', { e, pts, streak: this.carpetStreak++, run: this.stats.carpets, total: this.carpetTotal });
      return;
    }
    if (type === 'pistol') {
      this.ammo = PISTOL.AMMO;
      this.fireCd = 0.15;
      this.stats.pistols++;
      this.log('p', 0);
      this.fx('pistol', { e });
      this.fx('popup', { text: 'PISTOLA BROCCU!', style: 'gold' });
      this.fx('popup', { text: `${PISTOL.AMMO} COLPI`, style: 'small' });
      return;
    }
    const add = e.kind === 'ferula' ? FUEL.FERULA : FUEL.ASFODELO;
    this.fuel = Math.min(FUEL.MAX, this.fuel + add);
    const pts = this.addBonus(SCORE.MATERIAL);
    this.stats.pickups++;
    this.log('f', pts);
    this.chain++;
    this.fx('fuel', { e, pts });
    if (this.chain >= SCORE.CHAIN_SIZE) {
      this.chain = 0;
      const cb = this.addBonus(SCORE.CHAIN_BONUS);
      this.stats.chains++;
      this.log('x', cb);
      this.fx('popup', { text: `CATENA x${SCORE.CHAIN_SIZE}  +${cb}`, style: 'gold' });
      this.fx('sound', 'chain');
    }
  }

  hitPuddle(e) {
    e.hit = true; e.done = true;
    this.log('w', FUEL.HIT_PUDDLE);
    this.fuel -= FUEL.HIT_PUDDLE;
    this.fx('puddle', { e });
  }

  hitSolid(e) {
    e.hit = true; e.done = true;
    this.lastHitStep = this.step;
    const loss = isMoving(e.kind) ? FUEL.HIT_GOAT : FUEL.HIT_SOLID;
    this.log('h', loss);
    this.carpetStreak = 0;
    this.fuel -= loss;
    this.stats.hits++;
    this.chain = 0;
    this.invuln = WORLD.HIT_INVULN_S;
    this.slowT = 0;
    if (e.kind === 'goat') e.vx *= 2.5;
    this.fx('hit', { e });
  }

  finish() {
    this.mode = 'over';
    const meters = Math.floor(this.runD / PX_PER_METER);
    this.fx('over', {
      score: this.score, meters, ...this.stats, time: Math.round(this.runTime * 10) / 10,
      seed: this.seed, carpetTotal: this.carpetTotal, debug: this.debug,
      log: { v: 2, seed: this.seed, steps: this.step, inputs: this.inputs.slice(), events: this.events.slice() },
    });
  }

  debugState() {
    return {
      mode: this.mode, score: this.score, fuel: this.fuel, meters: Math.floor(this.runD / PX_PER_METER),
      lane: this.targetLane, px: this.px, T: this.T, stats: { ...this.stats }, speed: this.currentSpeed, baseSpeed: speedAt(Math.max(0, this.runD)),
      ammo: this.ammo, shotsInFlight: this.shots.length, carpetTotal: this.carpetTotal, events: this.events.length, inputs: this.inputs.length,
      entities: this.entities.filter((e) => !e.done).map((e) => ({ kind: e.kind, lane: e.lane, x: e.x, ahead: e.d - this.T, len: e.len, pickup: !!e.pickup, solid: e.solid, destructible: !!DESTRUCTIBLE[e.kind] })),
    };
  }
}
