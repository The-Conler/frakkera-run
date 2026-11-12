// =====================================================================
// Simulazione di gioco a passo fisso, SENZA rendering: stessa logica della
// v2 (punteggio, fiamma, collisioni, pistola, tappeti, tetti anti-exploit,
// registro partita). Il renderer 3D legge lo stato e riceve gli effetti
// tramite `fx(tipo, dati)`. Unita': px del mondo 2D (10 px = 1 m), corsie
// centrate su x = 0.
// =====================================================================
import { SCORE, FUEL, WORLD, PX_PER_METER, PISTOL, SPEED_STEPS, BIOME_OBST, DUCK, SHOP, MASKS, DANCE, FIRE, MINE, CART, COLLECT, SKINS, FESTA, POWER, JUMP, UPGRADES, WEATHER, ANIMALS, VILLAGE, CICCIO, danceThisLap } from '../config.js';
import { biomeAt } from './biomes/config.js';
import { cartAt, festaAt } from '../systems/generator.js';
import { Generator, SOLID, DESTRUCTIBLE, PICKUP_KINDS, BIOME_KINDS, MASK_KINDS, difficultyAt, speedAt, speedStepsAt, lerp } from '../systems/generator.js';
import { randomSeed, makeRng } from '../systems/rng.js';
export const DANCE_DIRS = ['left', 'down', 'up', 'right'];

export const HALF_W = { muretto: 12, botte: 7, bottecoricata: 11, botti: 12, pozza: 9, narrow: 17, goat: 7, rollbarrel: 7, rollin: 7, sasso: 8, bagnato: 9, trave: 60, panni: 60, processione: 13, tessitrice: 8, ciccio: 10, ramo: 60, acqua: 10, calamita: 11, finocchio: 11, scarponi: 11, maimoni: 8, fune: 40, fuso: 7, asfodelo: 10, ferula: 10, tappeto: 11, pistola: 11, pecora: 7, maialetto: 5, caprarupe: 8 };
export const ATTRACT_SPEED = 34;
const PLAYER_BACK = 3, PLAYER_FRONT = 5, PLAYER_HALF = 3;
export const GUTTER = 4;
export const ROAD_HALF = (WORLD.LANES * WORLD.LANE_W + GUTTER * 2) / 2;
export const VIEW_AHEAD = 1150;   // px generati davanti (orizzonte 3D)
const MOVE_AHEAD = 336;           // gli ostacoli mobili si muovono solo da qui (come la v2)
const SHOT_RANGE = 360;           // gittata del colpo (come la v2)
const BEHIND = 140;               // px dietro il giocatore prima di riciclare
export const isMoving = (k) => k === 'goat' || k === 'rollbarrel' || k === 'maimoni' || k === 'pecora' || k === 'maialetto';
export const laneX = (i) => (i - (WORLD.LANES - 1) / 2) * WORLD.LANE_W;

export class Sim {
  constructor(fx, opts = {}) {
    this.fx = fx || (() => {});
    this.debug = opts.debug || '';
    this.mapOffsetM = opts.mapOffsetM || 0;   // salto di mappa (sviluppo)
    this.getBest = opts.getBest || (() => 0);
    this.addCarpets = opts.addCarpets || (() => 0);
    this.spendCarpets = opts.spendCarpets || ((n) => (this.carpetTotal >= n ? this.carpetTotal - n : -1));
    this.carpetTotal = opts.carpetTotal || 0;
    this.addCollectible = opts.addCollectible || (() => 0);   // v5s19: conteggi salvati in locale
    this.getUpgrades = opts.getUpgrades || (() => ({}));   // v5s25: migliorie permanenti
    this.setUpgrade = opts.setUpgrade || (() => {});
    this.skin = 'base';
    this.mode = 'attract';
    this.T = 0; this.genOffset = 0; this.clock = 0;
    this.entities = []; this.shots = []; this.parades = {};
    this.currentSpeed = ATTRACT_SPEED;
    this.uid = 1;
    this.resetRunState();
    this.lane = 1; this.targetLane = 1; this.px = laneX(1); this.vx = 0;
  }

  resetRunState() {
    this.score = 0; this.metersCredited = 0; this.fuel = FUEL.START; this.chain = 0;
    this.stats = { pickups: 0, nearMiss: 0, chains: 0, milestones: 0, hits: 0, bonus: 0, carpets: 0, barrels: 0, goats: 0, shopVisits: 0, shopBuys: 0, shopSpent: 0, shields: 0, obst: 0, ducks: 0, beams: 0, slips: 0, speedSteps: 0, shots: 0, pistols: 0, masks: 0, parades: 0, ropes: 0, spindles: 0, dances: 0, danceSkips: 0, dancePerfect: 0, danceGood: 0, danceMiss: 0, danceBest: 0, survival: 0, capped: 0, fires: 0, fireFuel: 0, lamps: 0, miners: 0, carts: 0, junctions: 0, deadends: 0, bells: 0, sweets: 0, cheers: 0, roars: 0, magnets: 0, fennels: 0, fennelBlocks: 0, boots: 0, bootsPts: 0, branches: 0, magnetPulls: 0, jumps: 0, jumped: 0, upBuys: 0, wetSlows: 0, flocks: 0, sheep: 0, piglets: 0, dogs: 0, barks: 0, chases: 0, nips: 0, escapes: 0, rockGoats: 0, laundry: 0, weaverCarpets: 0, weaverHits: 0, weaverDodges: 0, carpetsLost: 0, ciccio: 0, ciccioDodged: 0, procHits: 0, procClean: 0, windowCheers: 0 };
    this.dogT = 0; this.chase = null; this.cic = null; this.cicLap = -1; this.deathReason = null;
    this.shopLap = 0; this.shopOffer = 0; this.shop = null; this.shield = 0;
    this.danceLap = -1; this.danceCue = null; this.dance = null;
    this.cart = null; this.cartLap = -1; this.cartSpK = 1;
    this.duckT = 0; this.duckCd = 0; this.slipT = 0; this.speedStep = 0; this.beamHint = false;
    this.magnetT = 0; this.fennelT = 0; this.bootsT = 0; this.bootsTick = 0;
    this.jumpHint = false; this.jumpT = 0; this.jumpCd = 0; this.jumpBuf = 0; this.jumpH = 0; this.wetT = 0;
    this.carpetStreak = 0; this.ammo = 0; this.fireCd = 0; this.recoilT = 0;
    this.shots = [];
    this.nextSurvival = SCORE.SURVIVAL_EVERY_S;
    this.bonusWin = { idx: -1, sum: 0 };
    this.events = []; this.inputs = [];
    this.nextMilestone = 0; this.lastNearMiss = -99; this.invuln = 0; this.slowT = 99;
    this.step = 0; this.best = this.getBest(); this.bestAnnounced = this.best <= 0; this.runTime = 0;
  }

  debugFesta() { return !!festaAt(this.runD / PX_PER_METER + this.mapOffsetM); }   // v5s21: per l'audio della festa
  get runD() { return this.T - this.genOffset; }
  log(code, v = 0) { this.events.push([this.step, code, v]); }

  clearEntities() { for (const e of this.entities) this.fx('despawn', e); this.entities = []; this.parades = {}; }

  startRun(seed) {
    // Il cerchio del ballo e la UI restano attaccati al mondo (T non torna a zero): senza questo,
    // un rigioca durante il ballo o il cue riparte dentro il ballu tundu.
    if (this.mode === 'dance' || this.dance || this.danceCue) this.fx('danceAbort');
    this.clearEntities();
    this.resetRunState();
    this.seed = seed ?? randomSeed();
    this.gen = new Generator(this.seed, { debugPistol: this.debug.includes('pistol'), mapOffsetM: this.mapOffsetM });
    this.genOffset = this.T;
    this.mode = 'run';
    this.lane = 1; this.targetLane = 1;
    // v5s19: costume scelto (registrato nel log: cambia la velocita')
    const sk = SKINS.find((x) => x.id === this.skin) || SKINS[0];
    this.skin = sk.id; this.skinK = sk.speedK; this.log('S', SKINS.indexOf(sk));
    this.up = {}; { const u = this.getUpgrades() || {}; let code = 0; UPGRADES.forEach((x, i) => { const l = Math.max(0, Math.min(3, u[x.id] | 0)); this.up[x.id] = l; code += l << (i * 2); }); this.log('V', code); }
    this.fx('start');
  }

  toAttract() {
    if (this.dance || this.danceCue) { this.dance = null; this.danceCue = null; this.fx('danceEnd', { skipped: true, quit: true }); }
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
    if (e.kind === 'fuso' && e.idle) e.solid = false;
    if (e.group) {                     // v5s10: corteo di Gadoni
      const pr = this.parades[e.group] || (this.parades[e.group] = { n: 0, ok: 0, fail: false, closed: false });
      pr.n++; if (e.last) pr.closed = true;
      if (e.kind === 'maimoni') this.log('q', e.group);   // nuovo corteo nel registro
    }
    if (isMoving(e.kind)) e.x = e.dir > 0 ? -ROAD_HALF - 6 : ROAD_HALF + 6;
    if (e.xoff) e.x -= e.dir * e.xoff;   // v5s24: pecore del gregge in fila
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
    if (this.cart) this.fx('sound', 'cartClunk');   // v5s22: cambio binario nel carrello
    this.inputs.push([this.step, dir]);
    return true;
  }

  // v5s25: salto (swipe su): si passa sopra gli ostacoli bassi (JUMP.KINDS)
  // v5s45 (#10 "a volte non salta"): lo swipe su non si perde piu': durante l'atterraggio (ultimi JUMP.BUFFER_S del salto
  // o nel cooldown) resta in memoria e parte appena possibile; da accovacciati il salto interrompe l'accovacciata.
  // Si rifiuta solo quando e' davvero impossibile (fuori corsa, nel carrello).
  jump() {
    if (this.mode !== 'run' || this.cart) return false;
    if (this.jumpT > 0 || this.jumpCd > 0) {
      if (this.jumpT <= JUMP.BUFFER_S) { this.jumpBuf = JUMP.BUFFER_S + this.jumpT + this.jumpCd; return true; }
      return false;
    }
    if (this.duckT > 0) { this.duckT = 0; this.duckCd = DUCK.COOLDOWN_S; }
    this.jumpBuf = 0;
    this.jumpT = JUMP.TIME_S; this.stats.jumps++;
    this.inputs.push([this.step, 'J']);
    this.fx('jump'); this.fx('sound', 'jump');
    return true;
  }
  upLvl(id) { return (this.up && this.up[id]) || 0; }
  upVal(id) { const u = UPGRADES.find((x) => x.id === id); return u ? u.add * this.upLvl(id) : 0; }
  // migliorie permanenti: comprate nel negozio, non contano nel tetto per visita
  buyUpgrade(id) {
    if (this.mode !== 'shop') return { ok: false, why: 'chiuso' };
    const u = UPGRADES.find((x) => x.id === id); if (!u) return { ok: false, why: 'articolo' };
    const lvl = this.upLvl(id); if (lvl >= 3) return { ok: false, why: 'massimo' };
    const price = u.prices[lvl];
    if (this.carpetTotal < price) return { ok: false, why: 'tappeti' };
    const left = this.spendCarpets(price); if (left < 0) return { ok: false, why: 'tappeti' };
    this.carpetTotal = left; this.up[id] = lvl + 1; this.setUpgrade(id, lvl + 1); this.stats.upBuys++;
    this.inputs.push([this.step, 'U', UPGRADES.indexOf(u)]);
    this.log('C', UPGRADES.indexOf(u) * 10 + lvl + 1);
    this.fx('shopBuy', { id, price, total: left, upgrade: true });
    return { ok: true, total: left, level: lvl + 1 };
  }

  // v5s6: abbassarsi (swipe giu', freccia giu', S) per passare sotto le travi basse
  duck() {
    if (this.mode !== 'run' || this.duckCd > 0 || this.duckT > 0 || this.cart) return false;
    this.duckT = DUCK.TIME_S;
    this.inputs.push([this.step, 'D']);
    this.fx('duck');
    return true;
  }

  // ------------------------------------------------------------ v5s7: Garag di Pinu
  enterShop() {
    if (this.mode !== 'run' || this.shopOffer <= 0) return false;
    this.mode = 'shop'; this.shopOffer = 0;
    this.shop = { lap: this.shopLap, buys: {}, count: 0 };
    this.stats.shopVisits++;
    this.inputs.push([this.step, 'E']);
    this.log('E', this.shopLap);
    for (const p of this.shots) this.fx('shotEnd', p);
    this.shots = [];
    this.fx('shopEnter', { lap: this.shopLap });
    return true;
  }
  // ritorna { ok, why } - tutte le regole qui (prezzo, tetto per visita, per articolo)
  buy(id) {
    if (this.mode !== 'shop' || !this.shop) return { ok: false, why: 'chiuso' };
    const idx = SHOP.ITEMS.findIndex((x) => x.id === id), it = SHOP.ITEMS[idx];
    if (!it) return { ok: false, why: 'articolo' };
    if (this.shop.count >= SHOP.MAX_PER_VISIT) return { ok: false, why: 'tetto' };
    if ((this.shop.buys[id] || 0) >= it.max) return { ok: false, why: 'esaurito' };
    if (id === 'pistola' && this.ammo >= SHOP.AMMO_CAP) return { ok: false, why: 'pieno' };
    if (id === 'asfodelo' && this.fuel >= FUEL.MAX - 0.5) return { ok: false, why: 'pieno' };
    if (id === 'scudo' && this.shield > 0) return { ok: false, why: 'pieno' };
    if (this.carpetTotal < it.price) return { ok: false, why: 'tappeti' };
    const left = this.spendCarpets(it.price);
    if (left < 0) return { ok: false, why: 'tappeti' };
    this.carpetTotal = left;
    this.shop.buys[id] = (this.shop.buys[id] || 0) + 1; this.shop.count++;
    this.stats.shopBuys++; this.stats.shopSpent += it.price;
    if (id === 'pistola') { this.ammo = Math.min(SHOP.AMMO_CAP, this.ammo > 0 ? this.ammo + PISTOL.AMMO : PISTOL.AMMO); this.fireCd = 0; }
    else if (id === 'asfodelo') this.fuel = FUEL.MAX;
    else if (id === 'scudo') this.shield = 1;
    this.inputs.push([this.step, 'B', idx]);
    this.log('B', idx * 1000 + it.price);
    this.fx('shopBuy', { id, price: it.price, total: this.carpetTotal });
    return { ok: true, total: this.carpetTotal };
  }
  exitShop() {
    if (this.mode !== 'shop') return false;
    this.mode = 'run';
    this.inputs.push([this.step, 'X']);
    this.log('X', this.shop ? this.shop.count : 0);
    this.fx('shopExit', { count: this.shop ? this.shop.count : 0 });
    this.shop = null;
    return true;
  }

  // ------------------------------------------------------------ v5s11: ballu tundu
  // spartito deterministico (seed + giro): frecce sul battito, piu' fitte e veloci nei giri successivi
  danceChart(lap) {
    const rng = makeRng((this.seed ^ Math.imul(lap + 1, 2654435761)) >>> 0);
    const bpm0 = Math.min(DANCE.BPM_MAX, DANCE.BPM0 + DANCE.BPM_LAP * lap);
    const notes = [], beats = [], rounds = [];
    let t = DANCE.INTRO_S;
    for (let r = 0; r < DANCE.ROUNDS; r++) {
      const bpm = Math.min(DANCE.BPM_MAX, bpm0 * (r ? DANCE.ROUND2_K : 1)), bt = 60 / bpm;
      const n = Math.floor(DANCE.ROUND_S / bt);
      rounds.push({ t0: t, bpm, n });
      let last = -1;
      for (let i = 0; i < n; i++) {
        const tb = t + i * bt; beats.push({ t: tb, i, r, bpm, down: i % 4 === 0 });
        if (i < 2) continue;                                       // due battute di attacco senza frecce
        if (i % 4 !== 0 && rng() < 0.18 - Math.min(0.1, lap * 0.03)) continue;   // qualche pausa
        let dir = rng.int(0, 3); if (dir === last && rng() < 0.6) dir = (dir + rng.int(1, 3)) % 4; last = dir;
        notes.push({ t: tb, dir, res: null });
        if (lap + r >= 2 && i % 2 === 1 && rng() < 0.12 * (lap + r) && i < n - 1) notes.push({ t: tb + bt / 2, dir: (dir + 2) % 4, res: null });   // controtempo
      }
      t += n * bt + DANCE.ROUND_GAP_S;
    }
    return { bpm: bpm0, notes, beats, rounds, end: t - DANCE.ROUND_GAP_S + DANCE.OUT_S };
  }
  startDance(lap) {
    const ch = this.danceChart(lap);
    this.mode = 'dance'; this.currentSpeed = 0; this.duckT = 0;
    this.dance = { lap, t: 0, ...ch, beatIdx: 0, idx: 0, combo: 0, maxCombo: 0, perf: 0, good: 0, miss: 0, pts: 0, carpets: 0, round: 0, last: null };
    this.stats.dances++;
    for (const p of this.shots) this.fx('shotEnd', p);
    this.shots = [];
    // la piazza resta libera: via gli ostacoli vicini (davanti e appena dietro)
    for (const e of this.entities) if (!e.done && e.d + e.len > this.T - 60 && e.d < this.T + 700) { e.done = true; this.fx('despawn', e); e.gone = true; }
    this.entities = this.entities.filter((e) => !e.gone);
    this.log('A', 100 + lap);
    this.fx('danceStart', { lap, bpm: ch.bpm, notes: ch.notes.length });
  }
  tickDance(dt) {
    const d = this.dance;
    this.step++; this.clock += dt;
    d.t += dt;
    while (d.beatIdx < d.beats.length && d.beats[d.beatIdx].t <= d.t) { const b = d.beats[d.beatIdx++]; if (b.i === 0) { d.round = b.r; this.fx('danceRound', { r: b.r, bpm: b.bpm }); } this.fx('danceBeat', b); }
    for (const n of d.notes) {
      if (n.res || n.t > d.t - DANCE.WINDOW_S) continue;
      this.judge(n, 'miss');
    }
    if (d.t >= d.end) this.finishDance(false);
  }
  judge(n, res) {
    const d = this.dance; n.res = res; d.last = { res, t: d.t, dir: n.dir };
    if (res === 'miss') { d.miss++; d.combo = 0; this.stats.danceMiss++; this.log('N', n.dir); this.fx('danceJudge', { res, dir: n.dir, combo: 0 }); return; }
    d.combo++; d.maxCombo = Math.max(d.maxCombo, d.combo);
    const base = res === 'perfect' ? DANCE.PTS_PERFECT : DANCE.PTS_GOOD;
    const pts = Math.round(base * (1 + Math.min(d.combo, DANCE.COMBO_MAX) * DANCE.COMBO_K));
    d.pts += pts;
    if (res === 'perfect') { d.perf++; this.stats.dancePerfect++; this.fuel = Math.min(FUEL.MAX, this.fuel + DANCE.FUEL_PERFECT); this.log('P', pts); }
    else { d.good++; this.stats.danceGood++; this.fuel = Math.min(FUEL.MAX, this.fuel + DANCE.FUEL_GOOD); this.log('H', pts); }
    this.fx('danceJudge', { res, dir: n.dir, combo: d.combo, pts });
  }
  // swipe / freccia durante il ballo
  danceInput(dir) {
    if (this.mode !== 'dance' || !this.dance) return false;
    const d = this.dance;
    if (typeof dir === 'string') dir = DANCE_DIRS.indexOf(dir);
    if (dir < 0 || dir > 3) return false;
    this.inputs.push([this.step, 'a', dir]);
    let best = null, bd = 9;
    for (const n of d.notes) { if (n.res) continue; const e = Math.abs(n.t - d.t); if (e <= DANCE.WINDOW_S && e < bd) { best = n; bd = e; } if (n.t > d.t + DANCE.WINDOW_S) break; }
    if (!best) return false;                                       // nessuna freccia vicina: nessuna penalita'
    if (best.dir !== dir) { this.judge(best, 'miss'); return true; }
    this.judge(best, bd <= DANCE.PERFECT_S ? 'perfect' : bd <= DANCE.GOOD_S ? 'good' : 'miss');
    return true;
  }
  // SALTA: facoltativo, nessuna penalita' (si perde solo il bonus del ballo)
  skipDance() {
    if (this.mode === 'run' && this.danceCue) {
      this.danceLap = this.danceCue.lap; this.danceCue = null;
      this.inputs.push([this.step, 'K']); this.log('K', 0); this.stats.danceSkips++; this.fx('danceEnd', { skipped: true }); return true;
    }
    if (this.mode !== 'dance') return false;
    this.inputs.push([this.step, 'K']);
    this.finishDance(true);
    return true;
  }
  finishDance(skipped) {
    const d = this.dance;
    const total = d.notes.length, hits = d.perf + d.good;
    let pts = 0, carpets = 0, win = false;
    if (skipped) { this.stats.danceSkips++; this.log('K', 1); }
    else {
      win = total > 0 && hits / total >= DANCE.WIN_RATIO;
      if (win) {
        pts = d.pts + d.maxCombo * DANCE.COMBO_BONUS;
        carpets = Math.min(DANCE.CARPET_MAX, Math.floor(d.perf / DANCE.CARPET_EVERY));
        this.addBonus(pts, false);
        this.fuel = Math.min(FUEL.MAX, this.fuel + DANCE.FUEL_WIN);
        if (carpets) { this.stats.carpets += carpets; for (let i = 0; i < carpets; i++) this.carpetTotal = this.addCarpets(1); }
        this.fx('popup', { text: `SA DANZA +${pts}`, style: 'gold' });
        if (carpets) this.fx('popup', { text: `+${carpets} TAPPET${carpets > 1 ? 'I' : 'O'}`, style: 'small' });
        this.fx('sound', 'bravu');
      } else {
        this.fuel = Math.max(1, this.fuel - DANCE.FAIL_FUEL);
        this.fx('popup', { text: 'BALLO PERSO', style: 'grey' });
      }
      this.stats.danceBest = Math.max(this.stats.danceBest, pts);
      this.log('Y', pts);
    }
    this.mode = 'run'; this.dance = null;
    this.invuln = Math.max(this.invuln, 1.2); this.slowT = 0;
    this.fx('danceEnd', { skipped, win, pts, carpets, perf: d.perf, good: d.good, miss: d.miss, total, maxCombo: d.maxCombo });
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
    if (this.mode === 'shop') { this.currentSpeed = 0; return; }
    if (this.mode === 'dance') { this.tickDance(dt); return; }      // v5s11: ballu tundu (corsa ferma, passi registrati)   // v5s7: nel negozio la corsa e' congelata (nessun passo)
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
    // v5s22: frenata morbida dopo un urto (entra in HIT_EASE_S, poi recupera); nel carrello frena meno;
    // partenza dolce nei primi START_RAMP_S secondi
    const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const depth = 1 - (this.cart ? CART.HIT_SLOW : WORLD.HIT_SLOW), st = this.slowT, E = WORLD.HIT_EASE_S;
    const H = WORLD.HIT_HOLD_S || 0;
    const slow = st >= WORLD.HIT_RECOVER_S ? 1 : 1 - depth * sm(st / E) * (1 - sm((st - E - H) / (WORLD.HIT_RECOVER_S - E - H)))
;
    const startK = this.mode === 'run' ? lerp(WORLD.START_K, 1, sm(this.runTime / WORLD.START_RAMP_S)) : 1;
    const steps = speedStepsAt(rd, this.mapOffsetM);
    if (steps > this.speedStep) {
      this.speedStep = steps; this.stats.speedSteps = steps;
      this.log('v', steps);
      this.fx('speedUp', { step: steps });
      this.fx('popup', { text: SPEED_STEPS.BANNER, style: 'speed' });
      this.fx('sound', 'speedUp');
    }
    // v5s7: offerta del Garag di Pinu a ogni ritorno al paese (giro >= 1)
    // v5s46d (251): solo davanti alla bottega, all'inizio del paese. Si chiude superata la facciata,
    // cosi' il banner non resta al centro dello schermo fino a Santa Marta (giro 2, ~177 m).
    if (this.shopOffer > 0) {
      this.shopOffer = Math.max(0, this.shopOffer - dt);
      const here = biomeAt(rd / PX_PER_METER + this.mapOffsetM);
      if (here.b.id !== 'village' || here.lap !== this.shopLap || here.local > SHOP.OFFER_UNTIL_M) this.shopOffer = 0;
      if (this.shopOffer === 0) { this.log('Q', 0); this.fx('shopOfferEnd'); }
    }
    { const bi = biomeAt(rd / PX_PER_METER + this.mapOffsetM);
      if (bi.b.id === 'village' && bi.lap >= 1 && bi.lap > this.shopLap && bi.local >= SHOP.OFFER_AT_M && bi.local <= SHOP.OFFER_UNTIL_M && !this.danceCue) {
        this.shopLap = bi.lap; this.shopOffer = SHOP.OFFER_S; this.log('O', bi.lap); this.fx('shopOffer', { lap: bi.lap, s: SHOP.OFFER_S, at: SHOP.AT_M });
      } }
    // Ballu tundu solo nei giri pari (2, 4, 6...), subito dopo Su Nascimentu. Mai al giro 1 ne' nei dispari.
    { const bi = biomeAt(rd / PX_PER_METER + this.mapOffsetM);
      if (bi.b.id === 'village' && danceThisLap(bi.lap) && bi.lap > this.danceLap && bi.local < DANCE.AT_M + 5) {
        const toGo = (DANCE.AT_M - bi.local) * PX_PER_METER;
        const sp = speedAt(rd, this.mapOffsetM);
        if (!this.danceCue && toGo > 0 && toGo <= sp * DANCE.CUE_S) {
          this.danceCue = { lap: bi.lap, d0: toGo }; this.log('A', bi.lap);
          this.fx('danceCue', { lap: bi.lap }); this.fx('popup', { text: 'SA DANZA!', style: 'gold' }); this.fx('sound', 'danceCue');
        }
        if (this.danceCue && toGo <= 0) { this.danceLap = bi.lap; this.danceCue = null; this.startDance(bi.lap); return; }
      } }
    // v5s45 (18): Ciccio col pickup bianco, una volta nel giro 2 (lap index CICCIO.LAP), nel paese
    { const bi = biomeAt(rd / PX_PER_METER + this.mapOffsetM);
      if (bi.b.id === 'village' && bi.lap === CICCIO.LAP && this.cicLap !== bi.lap && bi.local >= CICCIO.WARN_M && bi.local < CICCIO.CLEAR_TO_M - 30 && !this.danceCue) this.startCiccio(bi.lap); }
    if (this.duckT > 0) { this.duckT = Math.max(0, this.duckT - dt); if (this.duckT === 0) this.duckCd = DUCK.COOLDOWN_S; }
    else this.duckCd = Math.max(0, this.duckCd - dt);
    this.slipT = Math.max(0, this.slipT - dt);
    if (this.jumpT > 0) { this.jumpT = Math.max(0, this.jumpT - dt); if (this.jumpT === 0) { this.jumpCd = JUMP.COOLDOWN_S; this.fx('land'); } }
    else this.jumpCd = Math.max(0, this.jumpCd - dt);
    if (this.jumpBuf > 0) { this.jumpBuf = Math.max(0, this.jumpBuf - dt); if (this.jumpT === 0 && this.jumpCd === 0) { this.jumpBuf = 0; this.jump(); } }   // v5s45: salto in memoria
    this.jumpH = this.jumpT > 0 ? Math.sin(Math.PI * (1 - this.jumpT / JUMP.TIME_S)) * JUMP.H_PX : 0;
    this.wetT = Math.max(0, this.wetT - dt);
    // v5s18: giro in carrello (salita / discesa decise dalla distanza: deterministico)
    { const c = cartAt(rd / PX_PER_METER + this.mapOffsetM);
      if (c && !this.cart && c.lap !== this.cartLap) {
        this.cart = { lap: c.lap, ok: 0, j: 0, t: 0 }; this.cartBadJ = {}; this.cartLap = c.lap; this.stats.carts++; this.duckT = 0;
        this.log('R', c.lap); this.fx('cartBoard', { lane: this.targetLane }); this.fx('popup', { text: 'IN CARRELLO!', style: 'gold' }); this.fx('sound', 'cartBoard');
      } else if (!c && this.cart) {
        const k = this.cart; this.cart = null;
        this.log('r', k.ok); this.fx('cartExit', { ok: k.ok, j: k.j }); this.fx('popup', { text: `SCAMBI ${k.ok}/${k.j}`, style: k.ok === k.j ? 'gold' : 'white' }); this.fx('sound', 'cartExit');
      }
      if (this.cart) this.cart.t += dt; }
    // v5s20: il carrello accelera e frena dolcemente (prima la velocita' saltava di colpo a salita e discesa)
    this.cartSpK = (this.cartSpK || 1) + ((this.cart ? CART.SPEED_K : 1) - (this.cartSpK || 1)) * Math.min(1, dt * 1.6);
    let speed = speedAt(rd, this.mapOffsetM) * slow * startK * this.cartSpK * (this.mode === 'run' ? (this.skinK || 1) : 1);
    if (this.danceCue) speed *= lerp(DANCE.CUE_SLOW, 1, Math.max(0, Math.min(1, ((DANCE.AT_M - biomeAt(rd / PX_PER_METER + this.mapOffsetM).local) * PX_PER_METER) / this.danceCue.d0)));
    if (this.wetT > 0) speed *= WEATHER.PUDDLE_SLOW;
    if (this.bootsT > 0 && this.mode === 'run') speed *= lerp(1, POWER.BOOTS_K, Math.min(1, this.bootsT * 2));
    this.currentSpeed = speed;
    this.T += speed * dt;
    this.updatePowers(dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.fuel -= lerp(FUEL.DRAIN_START, FUEL.DRAIN_END, difficultyAt(rd)) * (1 - this.upVal('fiamma')) * dt;

    const meters = Math.floor(this.runD / PX_PER_METER);
    while (this.metersCredited < meters) {
      this.metersCredited++;
      this.score += SCORE.PER_METER;
      this.checkMilestone(this.metersCredited);
    }
    this.approachLane(dt);
    this.gen.fillUntil(this.runD + VIEW_AHEAD, (e) => this.spawn(e));
    this.updateEntities(dt);
    this.updateAnimals(dt);
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
    if (this.fuel <= 0 && this.mode === 'run') {
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
    this.px += d * (1 - Math.exp(-(this.slipT > 0 ? BIOME_OBST.WET_EASE : WORLD.LANE_EASE) * dt));
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

  entX(e) { if (e.kind === 'falo') return e.side * FIRE.X; if (e.kind === 'folla' || e.kind === 'bancarella') return e.side * FESTA.X; if (e.kind === 'tessitrice') return e.side * VILLAGE.WEAVER_X; if (e.kind === 'minatore') return e.side * MINE.MINER_X; if (e.kind === 'lampada') return e.side * MINE.LAMP_X; if (e.kind === 'pastore') return e.side * ANIMALS.SHEPHERD_X; if (e.kind === 'cane' || e.kind === 'canepastore') return laneX(e.lane); if (e.kind === 'tappeto' && e.mx !== undefined) return e.mx; return isMoving(e.kind) ? e.x : e.kind === 'fune' ? 0 : laneX(e.lane); }

  updateEntities(dt) {
    const T = this.T;
    const pBack = T - PLAYER_BACK, pFront = T + PLAYER_FRONT;
    const px = this.px;
    for (const e of this.entities) {
      if (isMoving(e.kind)) {
        if ((e.kind === 'pecora' || e.kind === 'goat') && e.freeLane != null && !e.scared && !e.hit) {
          // v5s40: capre e pecore non spazzano piu' le corsie davanti al giocatore: si fermano (a ANIMALS.STOP_S)
          // lasciando sempre libera la corsia del sentiero sicuro; ripartono quando il giocatore e' passato
          const v = Math.max(30, this.currentSpeed || 0), stopD = v * ANIMALS.STOP_S + 30;
          if (e.d - T < Math.max(MOVE_AHEAD, stopD + v * 2.4)) {   // partono ~2.4 s prima della sosta: passo tranquillo
            if (e.stopX == null) {
              const tS = Math.max(0.35, (e.d - T - stopD) / v);
              let tx;
              if (e.kind === 'pecora') tx = laneX(e.freeLane) + e.dir * ((e.gapC || 0) - (e.xoff || 0));
              else { const pred = e.x + e.vx * e.dir * tS; let best = null; for (let l = 0; l < WORLD.LANES; l++) if (l !== e.freeLane && (best == null || Math.abs(laneX(l) - pred) < Math.abs(laneX(best) - pred))) best = l; tx = laneX(best); }
              e.stopX = tx; const dist = e.dir * (tx - e.x);
              e.vx = dist > 0 ? Math.max(8, Math.min(70, dist / tS)) : 0;
            }
            if (e.d < T - 30) { e.stopX = Infinity * e.dir; if (!e.vx) e.vx = 24; }
            const nx = e.x + e.vx * e.dir * dt;
            if (e.dir * (nx - e.stopX) >= 0) { e.x = e.dir * (e.x - e.stopX) >= 0 ? e.x : e.stopX; e.moving = false; e.stopped = true; e.vx = 0; }
            else { e.x = nx; e.moving = e.vx > 0; }
          }
        } else if (e.d - T < MOVE_AHEAD) { e.x += e.vx * e.dir * dt; e.moving = true; }
        // v5s40: chi ha finito di attraversare esce di scena a bordo via (prima tronchi che rotolano, capre e maialetti
        // proseguivano per sempre dentro case, rocce e acqua: "tronchi caduti in posti a caso")
        if (e.kind !== 'maimoni' && !e.offroad && e.dir * e.x > ROAD_HALF + 8) { e.offroad = true; e.moving = false; e.done = true; e.vx = 0; this.fx('offroad', { e }); }
        if (e.kind === 'maimoni') {
          // v5s10: su Maimoni carica a zig-zag: rimbalza tra la prima e l'ultima corsia
          if (!e.bell && e.d - T < MOVE_AHEAD + MASKS.BELL_AHEAD) { e.bell = true; this.fx('sound', 'cowbell'); this.fx('maskBell', { e }); }
          if (e.moving && !e.done) {
            if (e.dir > 0 && e.x > laneX(WORLD.LANES - 1) && e.x < ROAD_HALF) { e.dir = -1; e.zig = (e.zig || 0) + 1; }
            else if (e.dir < 0 && e.x < laneX(0) && e.x > -ROAD_HALF) { e.dir = 1; e.zig = (e.zig || 0) + 1; }
          }
        }
        if (e.kind === 'goat' && !e.bleat && e.d - T < MOVE_AHEAD - 10) { e.bleat = true; this.fx('sound', 'goat'); }
        if (e.kind === 'pecora' && !e.bleat && e.d - T < MOVE_AHEAD - 10) { e.bleat = true; this.stats.sheep++; if (!e.xoff) this.fx('sound', 'sheep'); }
        if (e.kind === 'maialetto' && !e.bleat && e.d - T < MOVE_AHEAD - 10) { e.bleat = true; this.stats.piglets++; this.log('aP', e.dir); this.fx('sound', 'piglet'); this.fx('popup', { text: 'SU PORCHEDDU!', style: 'small' }); }
      }
      if (e.kind === 'ciccio' && !e.done) {   // v5s45 (18): il pickup corre verso il giocatore nella sua corsia
        e.d -= e.vt * dt;
        if (!e.hit && e.d <= pFront && e.d + e.len >= pBack && Math.abs(laneX(e.lane) - px) <= CICCIO.HALF + PLAYER_HALF) { this.hitCiccio(e); return; }
        if (!e.passed && e.d + e.len < pBack) { e.passed = true; this.stats.ciccioDodged++; const pts = this.addBonus(CICCIO.PTS); this.log('cP', pts); this.fx('popup', { text: `CICCIO E' PASSATO! +${pts}`, style: 'gold' }); this.fx('sound', 'cheer'); }
        if (e.d + e.len < T - 260) { e.done = true; }
        continue;
      }
      if (e.kind === 'processione' && !e.done && e.d + (e.len || 0) > T - 80) {
        // il corteo cammina sempre verso chi corre, dovunque sia sulla mappa: non si ferma dopo pochi metri
        e.d -= VILLAGE.PROC_WALK_PX_S * dt;
      }
      if (e.kind === 'rollin' && !e.done && e.d - T < MOVE_AHEAD) {
        // botte / carrello che rotola verso il giocatore lungo la corsia (velocita' proporzionale alla corsa)
        if (!e.moving) { e.moving = true; this.fx('sound', 'rumble'); }
        e.d -= BIOME_OBST.ROLL_K * (this.currentSpeed || 0) * dt;
      }
      if (e.kind === 'sasso' && !e.landed && e.d - T < (this.currentSpeed || 0) * BIOME_OBST.ROCK_LEAD_S + 40) {
        e.landed = true; this.fx('rockFall', { e });       // l'ombra era gia' sulla corsia: ora il masso cade e resta li'
      }
      if (e.kind === 'fuso' && !e.idle) {
        // v5s10: sa Grastula lancia il fuso: prima il segno a terra, ~1 s dopo il fuso arriva sulla corsia
        const sp = this.currentSpeed || 0;
        if (!e.warned && e.d - T < sp * MASKS.FUSO_WARN_S + 30) { e.warned = true; this.fx('spindleWarn', { e }); }
        if (!e.landed && e.d - T < sp * MASKS.FUSO_THROW_S + 30) { e.landed = true; this.stats.spindles++; this.log('J', e.lane); this.fx('spindleThrow', { e }); this.fx('sound', 'spindle'); }
      }
      if (!this.jumpHint && JUMP.KINDS[e.kind] && e.kind !== 'pozza' && e.kind !== 'acqua' && e.kind !== 'bagnato' && this.runTime > 4 && e.lane === this.targetLane && e.d - T < (this.currentSpeed || 0) * 1.4 && e.d > T) { this.jumpHint = true; this.fx('jumpHint', { e }); }
      if (e.kind === 'ramo' && !e.hint && !this.beamHint && e.d - T < (this.currentSpeed || 0) * 1.7) { e.hint = true; this.beamHint = true; this.fx('beamHint', { e }); }
      if (e.kind === 'trave' && !e.hint && !this.beamHint && e.d - T < (this.currentSpeed || 0) * 1.7) {
        e.hint = true; this.beamHint = true; this.fx('beamHint', { e });
      }
      if (e.done) continue;
      const ex = this.entX(e);
      const hw = HALF_W[e.kind] || 10;
      const overlapD = e.d <= pFront && e.d + e.len >= pBack;
      if (e.kind === 'carrello') { if (e.d + e.len < pBack) e.done = true; continue; }
      if (e.kind === 'scambio') {      // v5s18: scambio superato: ok se non hai preso il binario interrotto
        if (!e.cued && e.d - T < Math.max(120, this.currentSpeed * CART.CUE_S)) {   // v5s22: avviso dello scambio
          e.cued = true; const safe = (e.open || []).includes(this.targetLane);
          this.fx('junctionCue', { e, safe }); this.fx('sound', safe ? 'junctionCue' : 'junctionWarn');
        }
        if (e.d + e.len < pBack) {
          // v5s20: conta solo l'urto con un binario interrotto di QUESTO scambio (prima qualsiasi urto precedente lo annullava)
          e.done = true; const good = !(this.cartBadJ && this.cartBadJ[e.junction]);
          if (this.cart) { this.cart.j++; if (good) this.cart.ok++; }
          if (good) { this.stats.junctions++; const pts = this.addBonus(CART.PTS_JUNCTION); this.log('T', pts); this.fx('popup', { text: `SCAMBIO! +${pts}`, style: 'small' }); this.fx('sound', 'cartSwitch'); }
          else this.log('T', 0);
        }
        continue;
      }
      if (e.kind === 'minatore' || e.kind === 'lampada') {   // v5s17: scena della miniera, non si tocca
        if (e.kind === 'lampada' && !e.lit && e.d - T < MINE.LAMP_ON_PX) { e.lit = true; e.litAt = this.step; this.stats.lamps++; }
        if (e.kind === 'minatore' && !e.seen && e.d - T < MINE.LAMP_ON_PX) { e.seen = true; this.stats.miners++; this.fx('minerHello', { e }); }
        if (e.d + e.len < pBack) e.done = true;
        continue;
      }
      // v5s24: animali sulla strada
      if (e.kind === 'pastore') {
        if (!e.seen && e.d - T < MOVE_AHEAD + 40) { e.seen = true; this.stats.flocks++; this.log('aF', e.n); this.fx('shepherd', { e }); this.fx('sound', 'flockBells'); }
        if (e.d + e.len < pBack) e.done = true;
        continue;
      }
      if (e.kind === 'cane') {
        if (overlapD || e.d + e.len < pBack) e.done = true;   // v5s46d (utente): il cane che seguiva il corridore e' tolto
        continue;
      }
      if (e.kind === 'canepastore') {
        if (overlapD) { e.done = true; this.stats.chases++; this.chase = { t: ANIMALS.CHASE_S, hit0: this.stats.hits }; this.log('aC', 0); this.fx('chaseStart', { e }); this.fx('sound', 'bark'); this.fx('popup', { text: 'IL CANE TI INSEGUE!', style: 'white' }); }
        else if (e.d + e.len < pBack) e.done = true;
        continue;
      }
      if (e.kind === 'caprarupe' && !e.landed && e.d - T < (this.currentSpeed || 0) * ANIMALS.ROCKGOAT_LEAD_S + 40) {
        e.landed = true; this.stats.rockGoats++; this.log('aG', e.lane); this.fx('rockGoatJump', { e }); this.fx('sound', 'goat');
      }
      if (e.kind === 'caprarupe' && !e.landed) continue;   // v5s40: la capra colpisce solo quando e' scesa sulla corsia (si vede)
      if (e.kind === 'bancarella' || e.kind === 'festone') { if (e.d + e.len < pBack) e.done = true; continue; }   // v5s21: scena della festa
      if (e.kind === 'folla') {       // v5s21: passando vicino alla folla (corsia laterale) si sente l'applauso
        if (!e.cheered && overlapD && Math.abs(px - laneX(e.lane)) <= FESTA.BRUSH_PX) {
          e.cheered = true; this.stats.cheers++; const pts = this.addBonus(FESTA.PTS); this.log('H', pts);
          this.fx('cheer', { e }); this.fx('popup', { text: 'EVVIVA!', style: 'small' }); this.fx('sound', 'cheer');
        }
        if (e.d + e.len < pBack) e.done = true;
        continue;
      }
      if (e.kind === 'tessitrice') {  // v5s45 (15): telaio IN MEZZO alla via: urto = perdi tappeti; schivata = applauso e un tappeto
        if (!e.hit && overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF && this.invuln <= 0) { this.hitWeaver(e); continue; }
        if (e.d + e.len < pBack) {
          e.done = true;
          if (!e.hit && !e.thrown) {
            e.thrown = true; this.stats.weaverDodges++; this.stats.weaverCarpets++; this.stats.carpets++; this.carpetTotal = this.addCarpets(1);
            const pts = this.addBonus(VILLAGE.WEAVER_PTS); this.log('vW', pts);
            this.fx('weaverThrow', { e, pts, total: this.carpetTotal }); this.fx('popup', { text: `BRAVU! TAPPETO +${pts}`, style: 'gold' }); this.fx('sound', 'cheer');
          }
        }
        continue;
      }
      if (e.kind === 'processione') { // feat-village: Santa Marta: si schiva; l'urto costa fuoco ma non ferma
        if (!e.hit && overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF && this.invuln <= 0) { this.hitProcession(e); continue; }
        if (e.d + e.len < pBack) {
          e.done = true;
          if (!e.hit) { this.stats.procClean++; const pts = this.addBonus(VILLAGE.PROC_PTS); this.log('vi', pts); this.fx('popup', { text: `VIVA SANTA MARTA! +${pts}`, style: 'gold' }); this.fx('sound', 'cheer'); }
        }
        continue;
      }
      if (e.kind === 'falo') {        // v5s16: frakkera accesa a bordo strada, si prende sfiorandola
        if (overlapD && Math.abs(px - laneX(e.lane)) <= FIRE.BRUSH_PX) { this.fireBonus(e); continue; }
        if (e.d + e.len < pBack) e.done = true;
        continue;
      }
      if (e.pickup) {
        if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF) { this.collect(e); continue; }
        if (e.d + e.len < pBack) {
          e.done = true;
          if (PICKUP_KINDS[e.kind] === 'fuel') this.chain = 0;
          if (e.kind === 'tappeto') this.carpetStreak = 0;
        }
        continue;
      }
      if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF && !e.hit && this.jumpH >= JUMP.CLEAR_PX && JUMP.KINDS[e.kind]) {
        e.hit = true; e.jumped = true; this.stats.jumped++; const pts = this.addBonus(JUMP.PTS); this.log('a', pts); this.fx('jumped', { e }); continue;
      }
      if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF && !e.hit) {
        if (e.kind === 'acqua') { e.hit = true; this.wetT = WEATHER.PUDDLE_SLOW_S; this.stats.wetSlows++; this.log('y', 0); this.fx('puddle', { e, rain: true }); this.fx('popup', { text: 'SPLASH!', style: 'water' }); continue; }
        if (e.kind === 'pozza') { this.hitPuddle(e); continue; }
        if (e.kind === 'bagnato') { this.hitWet(e); continue; }
        if (e.kind === 'fune') {
          if (this.duckT > 0) { e.hit = true; e.ducked = true; this.stats.ropes++; this.log('j', 0); this.fx('ducked', { e }); this.maskPass(e); continue; }
          // v5s44c: la fune (bassa, ~0.5 m) si salta: superata se i piedi sono sopra la corda; in volo non si viene colpiti finche' non si riatterra
          if (this.jumpH >= MASKS.FUNE_CLEAR_PX) { e.hit = true; e.jumped = true; this.stats.ropes++; this.stats.jumped++; this.log('jF', 0); this.fx('jumped', { e }); this.maskPass(e); continue; }
          if (this.jumpT > 0) continue;
          if (this.invuln <= 0) { this.hitSolid(e); continue; }
        }
        if (e.kind === 'ramo') {        // v5s24: ramo caduto, ci si abbassa
          if (this.duckT > 0) { e.hit = true; e.ducked = true; this.stats.branches++; this.log('d', 0); this.fx('ducked', { e }); this.fx('sound', 'branchDuck'); continue; }
          if (this.invuln <= 0) { this.hitSolid(e); continue; }
        }
        if (e.kind === 'panni') {       // feat-village: i panni della nonna: ci si abbassa
          if (this.duckT > 0) { e.hit = true; e.ducked = true; this.stats.laundry++; this.log('vL', 0); this.fx('ducked', { e }); continue; }
          if (this.invuln <= 0) { this.hitSolid(e); continue; }
        }
        if (e.kind === 'trave') {
          if (this.duckT > 0) { e.hit = true; e.ducked = true; this.stats.beams++; this.log('u', 0); this.fx('ducked', { e }); continue; }
          if (this.invuln <= 0) { this.hitSolid(e); continue; }
        }
        if (this.invuln <= 0) { this.hitSolid(e); continue; }
      }
      if (e.d + e.len < pBack) {
        e.done = true;
        if (e.group && !e.hit) this.maskPass(e);
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
          if (MASK_KINDS[e.kind]) continue;          // v5s10: le maschere non si colpiscono: il colpo passa
          if (e.done || e.pickup || (!e.solid && !(e.kind === 'bagnato' && !e.hit))) continue;
          const ex = this.entX(e);
          if (e.d <= p.d + 3 && e.d + e.len + 6 >= p.d && Math.abs(ex - p.x) <= (HALF_W[e.kind] || 10) + 2) {
            if (e.kind === 'goat') this.scareGoat(e);
            else if (e.kind === 'caprarupe') this.scareRockGoat(e);   // v5s26: anche le capre scese dalla roccia
            else if (BIOME_KINDS[e.kind]) this.destroyObst(e);
            else if (DESTRUCTIBLE[e.kind]) this.destroyBarrel(e);
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

  // v5s6: ostacolo d'ambiente distrutto con la pistola (come una botte, log 'o')
  destroyObst(e) {
    e.done = true; e.destroyed = true;
    const pts = this.addBonus(SCORE.OBST_BIOME);
    this.stats.obst++;
    this.log('o', pts);
    this.fx('barrel', { e, big: false, pts, x: this.entX(e) });
  }

  // pietra bagnata: niente danno, ma per un attimo il cambio corsia e' lento (scivoli)
  hitWet(e) {
    e.hit = true;
    this.slipT = BIOME_OBST.WET_SLIP_S;
    this.stats.slips++;
    this.log('k', 0);
    this.fx('slip', { e });
    this.fx('popup', { text: 'SCIVOLA!', style: 'water' });
  }

  // colpo alla capra: niente sangue, la capra fa un balzo e scappa via di corsa in una nuvola di polvere;
  // da quel momento non e' piu' un ostacolo (done). Deterministico come le botti, registrato nel log ('g').
  scareGoat(e) {
    e.done = true; e.scared = true;
    e.vx *= 3.2;
    const pts = this.addBonus(SCORE.GOAT);
    this.stats.goats++;
    this.log('g', pts);
    this.fx('goatScared', { e, pts, x: this.entX(e) });
    this.fx('sound', 'goat');
  }

  // v5s26: colpo alla capra scesa dalla roccia: bela, salta via di lato e libera la corsia (+10, log 'aS')
  scareRockGoat(e) {
    e.done = true; e.scared = true;
    const pts = this.addBonus(ANIMALS.ROCKGOAT_SHOT_PTS);
    this.stats.rockGoatShots = (this.stats.rockGoatShots || 0) + 1;
    this.log('aS', pts);
    this.fx('goatScared', { e, pts, x: this.entX(e) }); this.fx('rockGoatFlee', { e });
    this.fx('sound', 'goat');
  }

  collect(e) {
    e.done = true;
    const type = PICKUP_KINDS[e.kind];
    if (type === 'collect') {          // v5s19: campanaccio, salvato subito
      const c = COLLECT.KINDS[e.kind];
      this.stats.bells++;
      const total = this.addCollectible(c, 1);
      const pts = this.addBonus(COLLECT.PTS);
      this.log('k', 1);
      this.fx('collectible', { e, kind: c, total, pts });
      this.fx('popup', { text: 'CAMPANACCIO!', style: 'gold' });   // v5s46d: sa facciola non si raccoglie piu'
      this.fx('sound', 'collectBell');
      return;
    }
    if (type === 'carpet') {
      const n = Math.max(1, e.value | 0);   // v5s46c (8): nel paese un tappeto vale per due (la via e' meno affollata, stesso totale)
      this.stats.carpets += n;
      this.carpetTotal = this.addCarpets(n); // salvato subito: non si perde
      const pts = this.addBonus(SCORE.CARPET * n);
      this.log('c', pts);
      this.fx('carpet', { e, pts, streak: this.carpetStreak, run: this.stats.carpets, total: this.carpetTotal, n });
      // v5s21: nella festa la folla esulta per le scie di tappeti (solo effetto, nel log)
      const vm = this.runD / PX_PER_METER + this.mapOffsetM;
      for (let i = 0; i < n; i++) {
        this.carpetStreak++;
        // feat-village: nel paese (fuori dalla festa) i paesani esultano dalle finestre per le scie
        if (this.carpetStreak % VILLAGE.CHEER_STREAK === 0 && this.mode !== 'attract' && biomeAt(vm).b.id === VILLAGE.BIOME && !festaAt(vm)) { this.stats.windowCheers++; const wp = this.addBonus(VILLAGE.CHEER_PTS); this.log('vV', wp); this.fx('windowCheer', { streak: this.carpetStreak }); this.fx('sound', 'crowdRoar'); }
        if (this.carpetStreak % FESTA.STREAK === 0 && festaAt(vm)) { this.stats.roars++; this.log('Y', this.carpetStreak); this.fx('crowdRoar', { streak: this.carpetStreak }); this.fx('sound', 'crowdRoar'); }
      }
      return;
    }
    if (type === 'power') { this.powerUp(e.kind, e); return; }
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
    const add = (e.kind === 'ferula' ? FUEL.FERULA : FUEL.ASFODELO) * (e.mult || 1);   // v5s46c (8): fascina doppia dove una e' stata diradata
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

  // v5s24: potenziamenti (calamita 'G', finocchio 'I', scarponi 'U')
  powerUp(kind, e) {
    if (kind === 'calamita') { this.magnetT = POWER.MAGNET_S + this.upVal('calamita'); this.stats.magnets++; this.log('G', 0); this.fx('popup', { text: 'CALAMITA!', style: 'gold' }); this.fx('sound', 'magnetOn'); }
    else if (kind === 'finocchio') { this.fennelT = POWER.FENNEL_S + this.upVal('finocchio'); this.stats.fennels++; this.log('I', 0); this.fx('popup', { text: 'SCUDO DI FINOCCHIO!', style: 'gold' }); this.fx('sound', 'fennelOn'); }
    else { this.bootsT = POWER.BOOTS_S + this.upVal('scarponi'); this.bootsTick = 0; this.stats.boots++; this.log('U', 0); this.fx('popup', { text: 'SCARPONI DEL CALZOLAIO!', style: 'gold' }); this.fx('sound', 'bootsOn'); }
    this.fx('power', { e, kind });
  }

  updatePowers(dt) {
    if (this.magnetT > 0) {
      this.magnetT = Math.max(0, this.magnetT - dt);
            for (const e of this.entities) {
        if (e.kind !== 'tappeto' || e.done) continue;
        const gap = e.d - this.T;
        if (gap > POWER.MAGNET_PX || gap < -PLAYER_BACK) continue;
        if (e.mx === undefined) { e.mx = laneX(e.lane); e.mv = POWER.MAGNET_V0; e.g0 = Math.max(1, Math.hypot(gap, this.px - e.mx)); this.stats.magnetPulls++; }
        // v5s27p: il tappeto vola dritto verso il personaggio (inseguimento, accelera), anche se cambia corsia
        e.mv = Math.min(POWER.MAGNET_VMAX, e.mv + POWER.MAGNET_ACC * dt);
        const dx = this.px - e.mx, dd = this.T + POWER.MAGNET_AIM - e.d, dist = Math.hypot(dx, dd), step = e.mv * dt;
        if (dist <= Math.max(step, POWER.MAGNET_GRAB)) { this.collect(e); continue; }
        e.mx += dx / dist * step; e.d += dd / dist * step;
        e.my = Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - dist / e.g0))) * POWER.MAGNET_ARC;   // leggero arco in volo
      }
      if (this.magnetT === 0) this.fx('powerEnd', { kind: 'calamita' });
    }
    if (this.fennelT > 0) { this.fennelT = Math.max(0, this.fennelT - dt); if (this.fennelT === 0) this.fx('powerEnd', { kind: 'finocchio' }); }
    if (this.bootsT > 0) {
      this.bootsT = Math.max(0, this.bootsT - dt); this.bootsTick += dt;
      if (this.bootsTick >= POWER.BOOTS_TICK_S) { this.bootsTick -= POWER.BOOTS_TICK_S; const pts = this.addBonus(POWER.BOOTS_PTS); this.stats.bootsPts += pts; this.log('L', pts); }
      if (this.bootsT === 0) this.fx('powerEnd', { kind: 'scarponi' });
    }
  }

  // v5s16: ci si accende alla frakkera di un paesano o a un falo'
  fireBonus(e) {
    e.done = true; e.lit = true;
    const before = this.fuel;
    this.fuel = Math.min(FUEL.MAX, this.fuel + FIRE.BONUS);
    const pts = this.addBonus(FIRE.PTS);
    this.stats.fires++; this.stats.fireFuel += this.fuel - before;
    this.log('F', pts);
    this.fx('fireBonus', { e, pts, gain: this.fuel - before });
    this.fx('popup', { text: '+FUOCO', style: 'fire' });
    this.fx('sound', 'fireBonus');
  }

  // v5s45 (15): urto col telaio della tessitrice: perdi il 25% dei tappeti Sa Burra (min 1, max 5), inciampo breve
  hitWeaver(e) {
    e.hit = true; this.stats.weaverHits++;
    const have = Math.max(0, this.carpetTotal || 0);
    const want = Math.min(VILLAGE.WEAVER_LOSS_MAX, Math.max(1, Math.round(have * VILLAGE.WEAVER_LOSS_K)));
    const loss = Math.min(have, want);
    if (loss > 0) { const left = this.spendCarpets(loss); if (left >= 0) this.carpetTotal = left; }
    this.stats.carpetsLost += loss; this.stats.carpets = Math.max(0, this.stats.carpets - loss);
    this.carpetStreak = 0; this.invuln = WORLD.HIT_INVULN_S; this.slowT = 0; this.slipT = 0.35;
    this.log('vX', loss);
    this.fx('weaverHit', { e, loss, total: this.carpetTotal });
    this.fx('popup', { text: loss > 0 ? `IL TELAIO! -${loss} TAPPET${loss > 1 ? 'I' : 'O'}` : 'IL TELAIO! ATTENTO!', style: 'white' });
    this.fx('sound', 'weaverHit');
  }
  // v5s45 (18): Ciccio. Il camion nasce a (v_giocatore + v_camion) * WARN_S davanti: arriva dopo WARN_S alla velocita' attuale
  startCiccio(lap) {
    this.cicLap = lap; this.stats.ciccio++;
    const vp = Math.max(40, this.currentSpeed || speedAt(this.runD, this.mapOffsetM)), vt = CICCIO.SPEED_PX_S;
    const gap = (vp + vt) * CICCIO.WARN_S;
    const e = { kind: 'ciccio', lane: CICCIO.LANE, d: this.T + PLAYER_FRONT + gap - this.genOffset, len: CICCIO.LEN, vt, warnAt: this.runTime };
    this.spawn(e); this.cic = e;
    this.log('cW', CICCIO.LANE);
    this.fx('ciccioWarn', { e, lane: CICCIO.LANE, s: CICCIO.WARN_S });
    this.fx('popup', { text: CICCIO.BANNER, style: 'ciccio' });
    this.fx('sound', 'horn');
  }
  // v5s45 (18): investito da Ciccio: game over immediato (niente scudo, niente invulnerabilita')
  hitCiccio(e) {
    e.hit = true; this.lastHitStep = this.step; this.deathReason = 'ciccio';
    this.log('cX', 0);
    this.fx('hit', { e }); this.fx('ciccioHit', { e }); this.fx('sound', 'horn');
    this.fx('popup', { text: CICCIO.REASON.toUpperCase(), style: 'white' });
    this.fuel = 0; this.shield = 0;
    this.mode = 'dying'; this.dieByHit = true; this.dieT = WORLD.DYING_S;
    for (const p of this.shots) this.fx('shotEnd', p);
    this.shots = [];
    this.fx('die');
  }
  // feat-village: urto con la processione: fuoco in meno (mai sotto 1), niente frenata
  hitProcession(e) {
    e.hit = true; this.stats.procHits++;
    const loss = Math.min(VILLAGE.PROC_FUEL, Math.max(0, this.fuel - 1));
    this.fuel -= loss; this.carpetStreak = 0; this.invuln = WORLD.HIT_INVULN_S;
    this.log('vI', Math.round(loss));
    this.fx('procBump', { e }); this.fx('popup', { text: 'ATTENTO ALLA SANTA!', style: 'white' }); this.fx('sound', 'nearMiss');
  }
  hitPuddle(e) {
    e.hit = true; e.done = true;
    this.log('w', FUEL.HIT_PUDDLE);
    this.fuel -= FUEL.HIT_PUDDLE;
    this.fx('puddle', { e });
  }

  // v5s10: un membro del corteo passato senza urti; corteo intero = BRAVU! (log 'M')
  maskPass(e) {
    const pr = this.parades[e.group];
    if (!pr || pr.fail) return;
    pr.ok++;
    if (pr.closed && pr.ok === pr.n) {
      pr.done = true;
      const pts = this.addBonus(MASKS.BONUS);
      this.stats.parades++;
      this.log('M', pts);
      this.fx('popup', { text: `BRAVU! +${pts}`, style: 'gold' });
      this.fx('sound', 'bravu');
    }
  }

  // v5s24: cane randagio (abbaia prima degli ostacoli nella tua corsia) e cane pastore (morde se rallenti o urti)
  updateAnimals(dt) {
    // v5s46d (utente): tolto il cane randagio che seguiva il corridore e abbaiava prima degli ostacoli
    const c = this.chase;
    if (c) {
      c.t -= dt;
      const slow = (this.currentSpeed || 0) < speedAt(Math.max(0, this.runD), this.mapOffsetM) * ANIMALS.CHASE_SLOW_K;
      if (this.stats.hits > c.hit0 || (slow && c.t < ANIMALS.CHASE_S - 0.5)) {
        this.chase = null; this.stats.nips++; this.fuel -= ANIMALS.NIP_FUEL; this.log('aN', ANIMALS.NIP_FUEL);
        this.fx('dogNip', {}); this.fx('sound', 'bark'); this.fx('popup', { text: 'MORSO! -FUOCO', style: 'white' });
      } else if (c.t <= 0) {
        this.chase = null; this.stats.escapes++; this.log('aE', 0); this.fx('chaseEnd', {}); this.fx('popup', { text: 'SEMINATO!', style: 'small' });
      }
    }
  }

  hitSolid(e) {
    e.hit = true; e.done = true;
    if (e.kind === 'deadend') { (this.cartBadJ || (this.cartBadJ = {}))[e.junction] = 1; this.stats.deadends++; this.fx('cartCrash', { e }); this.fx('popup', { text: 'BINARIO INTERROTTO!', style: 'white' }); }
    if (e.group && this.parades[e.group]) this.parades[e.group].fail = true;
    if (MASK_KINDS[e.kind]) this.stats.masks++;
    if (this.fennelT > 0) {            // v5s24: lo scudo di finocchio para un urto e si consuma (log 'W')
      this.fennelT = 0; this.stats.fennelBlocks++;
      this.invuln = WORLD.HIT_INVULN_S;
      this.log('W', 0);
      this.fx('shieldBlock', { e, fennel: true });
      this.fx('popup', { text: 'FINOCCHIO!', style: 'gold' });
      this.fx('powerEnd', { kind: 'finocchio' });
      return;
    }
    if (this.shield > 0) {             // v5s7: lo scudo di sughero para un urto (log 'Z')
      this.shield--; this.stats.shields++;
      this.invuln = WORLD.HIT_INVULN_S;
      this.log('Z', 0);
      this.fx('shieldBlock', { e });
      this.fx('popup', { text: 'SCUDO!', style: 'gold' });
      return;
    }
    this.lastHitStep = this.step;
    const loss = e.kind === 'maimoni' ? MASKS.HIT_MAIMONI : e.kind === 'fune' ? MASKS.HIT_FUNE : e.kind === 'fuso' ? MASKS.HIT_FUSO : isMoving(e.kind) || e.kind === 'rollin' ? FUEL.HIT_GOAT : e.kind === 'trave' || e.kind === 'ramo' || e.kind === 'panni' ? FUEL.HIT_BEAM : FUEL.HIT_SOLID;
    this.log('h', loss);
    this.carpetStreak = 0;
    this.fuel -= loss;
    this.stats.hits++;
    this.chain = 0;
    this.invuln = WORLD.HIT_INVULN_S;
    this.slowT = 0;
    if (e.kind === 'goat') e.vx = Math.max(e.vx, 24) * 2.5;
    this.fx('hit', { e });
  }

  finish() {
    this.mode = 'over';
    const meters = Math.floor(this.runD / PX_PER_METER);
    this.fx('over', {
      score: this.score, meters, ...this.stats, reason: this.deathReason === 'ciccio' ? CICCIO.REASON : null, time: Math.round(this.runTime * 10) / 10,
      seed: this.seed, carpetTotal: this.carpetTotal, debug: this.debug,
      log: { v: 4, mapOffsetM: this.mapOffsetM, seed: this.seed, steps: this.step, inputs: this.inputs.slice(), events: this.events.slice() },
    });
  }

  debugState() {
    return {
      mode: this.mode, score: this.score, fuel: this.fuel, meters: Math.floor(this.runD / PX_PER_METER),
      lane: this.targetLane, px: this.px, dance: this.dance && { lap: this.dance.lap, t: this.dance.t, bpm: this.dance.bpm, combo: this.dance.combo, perf: this.dance.perf, good: this.dance.good, miss: this.dance.miss, pts: this.dance.pts, notes: this.dance.notes.length, round: this.dance.round, end: this.dance.end }, danceCue: !!this.danceCue, T: this.T, stats: { ...this.stats }, speed: this.currentSpeed, baseSpeed: speedAt(Math.max(0, this.runD), this.mapOffsetM), speedStep: this.speedStep, shopOffer: this.shopOffer, shopLap: this.shopLap, shield: this.shield, shop: this.shop && { ...this.shop, buys: { ...this.shop.buys } }, duckT: this.duckT, slipT: this.slipT, jumpT: this.jumpT, jumpH: this.jumpH, up: { ...(this.up || {}) }, magnetT: this.magnetT, fennelT: this.fennelT, bootsT: this.bootsT, dogT: this.dogT, chase: this.chase && this.chase.t,
      skin: this.skin, festa: !!festaAt(this.runD / PX_PER_METER + this.mapOffsetM) && this.mode !== 'attract', ammo: this.ammo, shotsInFlight: this.shots.length, carpetTotal: this.carpetTotal, events: this.events.length, inputs: this.inputs.length,
      entities: this.entities.filter((e) => !e.done).map((e) => ({ kind: e.kind, lane: e.lane, x: e.x, ahead: e.d - this.T, len: e.len, pickup: !!e.pickup, solid: e.solid, group: e.group || 0, side: e.side, idle: !!e.idle, destructible: !!DESTRUCTIBLE[e.kind] })),
    };
  }
}
