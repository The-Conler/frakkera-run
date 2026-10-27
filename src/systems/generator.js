// =====================================================================
// Generatore procedurale del percorso.
// Garanzia di percorribilita' (SENZA usare la pistola): prima si traccia un
// "sentiero sicuro" (una corsia sempre libera che cambia al massimo di una
// corsia alla volta, con 2 file libere in entrambe le corsie durante il
// cambio), poi si piazzano ostacoli SOLO fuori dal sentiero. Gli ostacoli
// mobili compaiono solo in "finestre calme" senza altri ostacoli.
// Tappeti, combustibile e pistola si piazzano solo in celle libere.
// =====================================================================
import { DIFFICULTY as DF, WORLD, PX_PER_METER, CARPETS as CP, PISTOL, SPEED_STEPS as SS, BIOME_OBST as BO, DUCK, MASKS as MK, FIRE, MINE, CART, COLLECT, DANCE, FESTA, POWER } from '../config.js';
import { biomeAt, BIOMES } from '../game/biomes/config.js';
import { makeRng } from './rng.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export function difficultyAt(px) {
  const m = px / PX_PER_METER;
  return Math.pow(clamp01(m / DF.RAMP_METERS), DF.RAMP_EXP);
}

// v5s6: numero di ambienti nuovi raggiunti dall'inizio della corsa (gradini di velocita').
// offM = metri di partenza dentro il giro (solo il salto di mappa di sviluppo, altrimenti 0).
export function biomeIndexAt(m) { const i = biomeAt(Math.max(0, m)); return i.lap * BIOMES.length + i.index; }
export function speedStepsAt(px, offM = 0) {
  return Math.min(SS.CAP_STEPS, Math.max(0, biomeIndexAt(px / PX_PER_METER + offM) - biomeIndexAt(offM)));
}
export const biomeIdAt = (px, offM = 0) => biomeAt(Math.max(0, px / PX_PER_METER + offM)).b.id;

export function speedAt(px, offM = 0) {
  return Math.min(baseSpeedAt(px) + speedStepsAt(px, offM) * SS.PER_STEP, DF.SPEED_MAX);
}
export function baseSpeedAt(px) {
  const d = difficultyAt(px);
  let s = lerp(DF.SPEED_START, DF.SPEED_END, d);
  const m = px / PX_PER_METER;
  if (m > DF.RAMP_METERS) s += (m - DF.RAMP_METERS) * DF.SPEED_OVERDRIVE;
  return Math.min(s, DF.SPEED_MAX);
}

// ostacoli che fermano il giocatore (la pozzanghera no: toglie solo fuoco)
// v5s18: tratto del carrello alla distanza m (metri assoluti, compreso il salto di mappa): null o { lap, local }
export function cartAt(m, lead = 0, tail = 0) {
  const bi = biomeAt(Math.max(0, m));
  if (bi.b.id !== CART.BIOME) return null;
  if (bi.local < CART.FROM_M - lead || bi.local >= CART.FROM_M + CART.LEN_M + tail) return null;
  return { lap: bi.lap, local: bi.local - CART.FROM_M };
}
export const SOLID = {
  muretto: true, botte: true, bottecoricata: true, botti: true, narrow: true, goat: true, rollbarrel: true, pozza: false,
  // v5s6: ostacoli d'ambiente (la pietra bagnata non ferma: fa scivolare) e trave bassa (si passa abbassandosi)
  rollin: true, sasso: true, bagnato: false, trave: false, ramo: false,
  // v5s10: maschere di Gadoni (la fune si passa abbassandosi, come la trave)
  maimoni: true, fune: false, fuso: true,
  // v5s18: binario interrotto (respingente o crollo) durante il giro in carrello
  deadend: true,
};
// distruttibili con la pistola: tutte e sole le botti
export const DESTRUCTIBLE = { botte: true, bottecoricata: true, botti: true, rollbarrel: true, rollin: true, sasso: true, bagnato: true };
// ostacoli d'ambiente v5s6 (punteggio e log a parte)
export const BIOME_KINDS = { rollin: true, sasso: true, bagnato: true };
// ambiente -> ostacolo tipico (il viadotto non ne ha)
export const BIOME_OBST_KIND = { village: 'rollin', rock: 'sasso', river: 'bagnato', 'mine-ext': 'rollin', 'mine-int': 'rollin', 'mine-blue': 'rollin' };
// v5s10: maschere del carnevale di Gadoni: la pistola le attraversa senza effetto
export const MASK_KINDS = { maimoni: true, fune: true, fuso: true };
// v5s16: frakkere accese a bordo strada (non occupano corsie)
export const SIDE_KINDS = { falo: true, minatore: true, lampada: true, carrello: true, scambio: true, bancarella: true, folla: true, festone: true };
// v5s21: tratto in festa del paese alla distanza m (metri assoluti): null o { lap, local }
export function festaAt(m) {
  const bi = biomeAt(Math.max(0, m));
  if (bi.b.id !== FESTA.BIOME || bi.local < FESTA.FROM_M || bi.local >= FESTA.TO_M) return null;
  return { lap: bi.lap, local: bi.local - FESTA.FROM_M };
}
export const PICKUP_KINDS = { asfodelo: 'fuel', ferula: 'fuel', tappeto: 'carpet', pistola: 'pistol', calamita: 'power', finocchio: 'power', scarponi: 'power', campanaccio: 'collect', facciola: 'collect' };

const SHORT_LEN = { muretto: 14, botte: 18, bottecoricata: 14, pozza: 13 };

export class Generator {
  constructor(seed, opts = {}) {
    this.rng = makeRng(seed);
    this.seed = seed;
    this.debugPistol = !!opts.debugPistol;
    this.offM = opts.mapOffsetM || 0;     // salto di mappa (sviluppo): ostacoli dell'ambiente mostrato
    this.nextBeamAt = 20; this.nextBiomeAt = 10;
    const L = WORLD.LANES;
    this.row = 0;
    this.path = 1;
    this.hold = 4;
    this.freeUntil = new Array(L).fill(-1);
    this.blockedUntil = new Array(L).fill(-1);
    this.laneCool = new Array(L).fill(-1);
    this.calmUntil = -1;
    this.nextMovingAt = 14;
    this.lastPickupRow = -10;
    // tappeti
    this.carpetRows = 0;
    this.carpetMode = 'path';
    this.carpetLane = 1;
    this.nextCarpetAt = 1;
    this.carpetVariant = 0;
    // pistola
    this.pistols = 0;
    this.nextPistolRow = Math.ceil((PISTOL.FROM_M * PX_PER_METER - WORLD.LEAD_IN) / WORLD.ROW);
    this.barrelBoostUntil = -1;
    // v5s10: corteo delle maschere di Gadoni
    this.parade = null; this.paradeG = 0; this.nextParadeAt = 0;
    // v5s16: flusso RNG separato per le frakkere a bordo strada (non cambia il resto del percorso)
    this.sideBlocks = [];
    this.frng = makeRng(((seed >>> 0) ^ 0x5f17e3) >>> 0);
    this.nextFireRow = 0; this.fireSide = this.frng() < 0.5 ? -1 : 1; this.fires = 0;
    // v5s17: flusso separato anche per minatori e lampade della miniera
    this.mrng = makeRng(((seed >>> 0) ^ 0x3a17e5) >>> 0);
    // v5s19: flusso separato per i collezionabili rari
    this.crng = makeRng(((seed >>> 0) ^ 0x19c011) >>> 0);
    this.nextCollectRow = Math.ceil((COLLECT.FROM_M * PX_PER_METER - WORLD.LEAD_IN) / WORLD.ROW) + this.crng.int(0, 20); this.collects = 0;
    // v5s21: flusso separato per la festa (bancarelle, folla, festoni)
    this.prng = makeRng(((seed >>> 0) ^ 0x21fe57) >>> 0);
    this.stallNext = { '-1': 0, '1': 0 }; this.crowdNext = 0; this.festoonNext = 0; this.crowds = 0;
    // v5s24: flusso separato per potenziamenti e rami caduti
    this.wrng = makeRng(((seed >>> 0) ^ 0x7e0b11) >>> 0);
    this.nextPowerRow = Math.ceil((POWER.FROM_M * PX_PER_METER - WORLD.LEAD_IN) / WORLD.ROW) + this.wrng.int(0, 30); this.powers = 0;
    this.nextBranchRow = 0; this.branches = 0;
    this.nextMinerRow = 0; this.nextLampRow = 0; this.minerSide = 1; this.lampSide = -1; this.miners = 0; this.lamps = 0;
  }

  // v5s18: file del giro in carrello: niente ostacoli normali, scambi con binari interrotti
  cartRow(r, D, diff, used, emit) {
    const m = D / PX_PER_METER + this.offM;
    const c = cartAt(m, CART.LEAD_M, 4);
    if (!c) { this.cartLap = this.cartLap ?? -1; return false; }
    const rng = this.rng, L = WORLD.LANES, ROW = WORLD.ROW;
    for (let l = 0; l < L; l++) if (this.blockedUntil[l] >= r) used[l] = true;
    if (this.cartLap !== c.lap && (c.local >= 0 || c.local > -ROW / PX_PER_METER * 2.2)) {
      this.cartLap = c.lap; this.cartJ = 0;
      this.nextJunction = r + (c.local < 0 ? Math.ceil(CART.FIRST_M * PX_PER_METER / ROW) + 1 : 3);
      if (c.local < 0) { const dB = Math.round(D - c.local * PX_PER_METER) - 10; for (let l = 0; l < L; l++) emit({ kind: 'carrello', lane: l, d: dB, len: 14, lap: c.lap }); }   // v5s20: carrelli fermi proprio dove si sale   // carrelli fermi, uno per binario
    }
    if (c.local < 0) { this.carpetRow(r, D, diff, used, emit); return true; }   // tratto libero prima della salita
    if (r >= this.nextJunction && c.local < CART.LEN_M - CART.END_FREE_M) {
      this.nextJunction = r + CART.JUNCTION_ROWS;
      let dir = rng() < 0.5 ? -1 : 1;
      if (this.path + dir < 0 || this.path + dir >= L) dir = -dir;
      let next = rng() < 0.75 ? this.path + dir : this.path;
      if (used[next]) next = this.path;
      if (used[next]) { this.nextJunction = r + 1; this.carpetRow(r, D, diff, used, emit); return true; }
      const two = rng() < CART.P_TWO_BLOCKED;
      // binari aperti: sempre quello del sentiero; con un solo binario interrotto se ne apre un secondo
      const open = new Set([next]);
      if (!two) { const others = [0, 1, 2].filter((l) => l !== next); open.add(others.includes(this.path) && this.path !== next ? this.path : rng.pick(others)); }
      const j = ++this.cartJ;
      for (let l = 0; l < L; l++) if (this.freeUntil[l] >= r) open.add(l);   // corsie che devono restare libere (dopo un tappeto)
      this.path = next; this.hold = CART.JUNCTION_ROWS;
      for (let l = 0; l < L; l++) {
        if (open.has(l) || used[l]) continue;
        used[l] = true; this.laneCool[l] = r + 1;
        emit({ kind: 'deadend', lane: l, d: D + 10, len: 14, junction: j, variant: rng.int(0, 2) });
      }
      emit({ kind: 'scambio', lane: next, d: D + 10, len: 14, junction: j, open: [...open].sort() });
    }
    // niente tappeti nella fila prima di uno scambio (la corsia dopo un tappeto deve restare libera)
    if (r + 1 !== this.nextJunction) this.carpetRow(r, D, diff, used, emit);
    return true;
  }

  // v5s17: minatori lungo le pareti e lampade a muro (lato -1/+1, fuori dalle corsie)
  maybeMine(r, D, emit) {
    const bid = biomeIdAt(D, this.offM), cfg = bid === biomeIdAt(D + 14, this.offM) ? MINE.BIOMES[bid] : null;
    if (!cfg) { this.nextMinerRow = Math.max(this.nextMinerRow, r + 1); this.nextLampRow = Math.max(this.nextLampRow, r + 1); return; }
    const mr = this.mrng, L = WORLD.LANES;
    const free = (side) => this.blockedUntil[side < 0 ? 0 : L - 1] < r - 1;
    if (r >= this.nextMinerRow) {
      const side = mr() < 0.65 ? -this.minerSide : this.minerSide;
      this.nextMinerRow = r + mr.int(cfg.miners[0], cfg.miners[1]);
      if (free(side)) {
        this.minerSide = side; this.miners++;
        this.sideBlocks.push({ edge: side < 0 ? 0 : L - 1, until: r + 3 });
        emit({ kind: 'minatore', lane: side < 0 ? 0 : L - 1, side, d: D + 10, len: 10, variant: mr.int(0, MINE.POSES - 1), look: mr() < 0.5 ? 1 : 0, miner: this.miners });
      }
    }
    if (cfg.lamps && r >= this.nextLampRow) {
      this.nextLampRow = r + mr.int(cfg.lamps[0], cfg.lamps[1]);
      this.lampSide = -this.lampSide;
      if (free(this.lampSide)) this.lamps++, emit({ kind: 'lampada', lane: this.lampSide < 0 ? 0 : L - 1, side: this.lampSide, d: D + 4, len: 6, lamp: this.lamps });
    }
  }

  // v5s21: festa: bancarelle e folla sui marciapiedi (fuori dalle corsie), festoni con le luci in alto
  maybeFesta(r, D, emit) {
    if (!festaAt(D / PX_PER_METER + this.offM)) return;
    const pr = this.prng, L = WORLD.LANES;
    const busy = (side) => { const edge = side < 0 ? 0 : L - 1; return this.blockedUntil[edge] >= r - 1 || this.sideBlocks.some((b) => b.edge === edge && b.until >= r); };
    if (r >= this.festoonNext) { this.festoonNext = r + FESTA.FESTOON_ROWS; emit({ kind: 'festone', lane: 1, d: D + 2, len: 4, variant: pr.int(0, 2) }); }
    for (const side of [-1, 1]) {
      if (r < this.stallNext[side] || busy(side)) continue;
      this.stallNext[side] = r + pr.int(FESTA.STALL_GAP[0], FESTA.STALL_GAP[1]);
      const edge = side < 0 ? 0 : L - 1;
      this.sideBlocks.push({ edge, until: r + 2 });
      emit({ kind: 'bancarella', lane: edge, side, d: D + 6, len: 24, variant: pr.int(0, 3) });
    }
    if (r >= this.crowdNext) {
      const side = pr() < 0.5 ? -1 : 1;
      this.crowdNext = r + pr.int(FESTA.CROWD_GAP[0], FESTA.CROWD_GAP[1]);
      if (!busy(side)) {
        const edge = side < 0 ? 0 : L - 1; this.crowds++;
        this.sideBlocks.push({ edge, until: r + 1 });
        emit({ kind: 'folla', lane: edge, side, d: D + 10, len: 14, n: pr.int(3, 5), variant: pr.int(0, 5), crowd: this.crowds });
      }
    }
  }

  // v5s16: falo' o paesano con la frakkera sul marciapiede, lato -1 (sinistra) / +1 (destra)
  maybeFire(r, D, emit) {
    if (r < this.nextFireRow || D / PX_PER_METER < FIRE.FROM_M) return;
    const cfg = FIRE.BIOMES[biomeIdAt(D, this.offM)];
    if (!cfg) { this.nextFireRow = r + 4; return; }
    const fr = this.frng;
    let side = cfg.sides.length > 1 ? (fr() < 0.7 ? -this.fireSide : this.fireSide) : cfg.sides[0];
    const edge = side < 0 ? 0 : WORLD.LANES - 1;
    if (this.blockedUntil[edge] >= r - 1) { this.nextFireRow = r + 2; return; } // casa che sporge da quel lato
    this.fireSide = side;
    this.nextFireRow = r + fr.int(cfg.gap[0], cfg.gap[1]);
    this.sideBlocks.push({ edge, until: r + 3 });
    this.fires++;
    emit({ kind: 'falo', lane: edge, side, d: D + 8, len: 16, variant: fr() < FIRE.VILLAGER_SHARE ? 1 : 0, fire: this.fires });
  }

  // v5s19: campanaccio o facciola in una cella libera (dopo il resto della fila: il percorso non cambia)
  maybeCollect(r, emit) {
    const used = this._used;
    if (!used || r < this.nextCollectRow) return;
    if (r <= this.calmUntil + 1) { this.nextCollectRow = r + 1; return; }   // niente collezionabili sulla traiettoria di capre, botti e maschere
    const D = this.rowDist(r);
    if (cartAt(D / PX_PER_METER + this.offM, 2, 2)) return;
    const cr = this.crng, free = [];
    for (let l = 0; l < WORLD.LANES; l++) if (!used[l] && this.blockedUntil[l] < r) free.push(l);
    if (!free.length) { this.nextCollectRow = r + 1; return; }
    this.nextCollectRow = r + cr.int(COLLECT.GAP_ROWS[0], COLLECT.GAP_ROWS[1]);
    const lane = free[cr.int(0, free.length - 1)]; used[lane] = true; this.collects++;
    emit({ kind: cr() < COLLECT.P_FACCIOLA ? 'facciola' : 'campanaccio', lane, d: D + 9, len: 12, pickup: true, collect: this.collects });
  }

  // v5s24: potenziamenti rari in una corsia libera; ramo caduto (tutte le corsie, ci si abbassa) solo su file vuote
  maybePower(r, emit) {
    const used = this._used;
    if (!used || r <= this.calmUntil + 1) return;
    const D = this.rowDist(r), m = D / PX_PER_METER + this.offM;
    if (cartAt(m, 2, 2) || this.nearDance(D, 60, 30)) return;
    const wr = this.wrng, L = WORLD.LANES;
    const free = [];
    for (let l = 0; l < L; l++) if (!used[l] && this.blockedUntil[l] < r) free.push(l);
    if (r >= this.nextPowerRow && free.length) {
      this.nextPowerRow = r + wr.int(POWER.GAP_ROWS[0], POWER.GAP_ROWS[1]);
      let x = wr(), kind = POWER.KINDS[0][0];
      for (const [k, p] of POWER.KINDS) { if (x < p) { kind = k; break; } x -= p; }
      const lane = free[wr.int(0, free.length - 1)]; used[lane] = true; this.powers++;
      emit({ kind, lane, d: D + 9, len: 12, pickup: true });
      return;
    }
    if (free.length === L && r >= this.nextBranchRow && m >= POWER.BRANCH_FROM_M) {
      const bi = biomeAt(m);
      if (POWER.BRANCH_BIOMES.includes(bi.b.id) && wr() < POWER.BRANCH_P) {
        this.nextBranchRow = r + wr.int(POWER.BRANCH_GAP_ROWS[0], POWER.BRANCH_GAP_ROWS[1]); this.branches++;
        for (let l = 0; l < L; l++) used[l] = true;
        emit({ kind: 'ramo', lane: 1, d: D + 10, len: POWER.BRANCH_LEN, variant: wr.int(0, 2) });
      }
    }
  }

  // v5s20: la fila D e' vicina al punto del ballu tundu (metri prima / dopo)?
  nearDance(D, before, after) {
    const bi = biomeAt(D / PX_PER_METER + this.offM);
    if (bi.b.id !== 'village') return false;
    return bi.local > DANCE.AT_M - before && bi.local < DANCE.AT_M + after;
  }

  rowDist(r) { return WORLD.LEAD_IN + r * WORLD.ROW; }

  fillUntil(maxDist, emit) {
    while (this.rowDist(this.row) < maxDist) {
      this._used = null;
      this.genRow(this.row, emit);
      this.maybeCollect(this.row, emit);
      this.maybePower(this.row, emit);
      this.row++;
    }
  }

  genRow(r, emit) {
    const rng = this.rng;
    const L = WORLD.LANES;
    const ROW = WORLD.ROW;
    const D = this.rowDist(r);
    const diff = difficultyAt(D);
    const used = new Array(L).fill(false); this._used = used;
    for (let l = 0; l < L; l++) if (this.blockedUntil[l] >= r) used[l] = true;
    this.maybeFire(r, D, emit);
    this.maybeMine(r, D, emit);
    this.maybeFesta(r, D, emit);
    if (this.sideBlocks.length > 4) this.sideBlocks = this.sideBlocks.filter((b) => b.until >= r);
    if (this.cartRow(r, D, diff, used, emit)) return;

    // ---- finestra calma con ostacolo mobile -------------------------
    if (r <= this.calmUntil) {
      this.maybePistol(r, D, used, emit);
      this.maybePickup(r, D, diff, used, emit, 0.45);
      this.carpetRow(r, D, diff, used, emit);
      return;
    }
    const longActive = this.blockedUntil.some((b) => b >= r);
    // ---- v5s10: corteo di Gadoni (solo nel paese): parte con su Maimoni in una finestra calma ----
    if (!this.parade && !longActive && r >= this.nextParadeAt && D / PX_PER_METER >= MK.FROM_M &&
        biomeIdAt(D, this.offM) === 'village') {
      const bi = biomeAt(D / PX_PER_METER + this.offM), lap = bi.lap;
      // v5s20: il corteo non entra mai nel cerchio del ballu tundu (piazza della chiesa)
      if (bi.local < bi.b.to - bi.b.from - 90 && !this.nearDance(D, 90, 30) && rng() < MK.P_LAP[Math.min(lap, MK.P_LAP.length - 1)]) {
        const g = ++this.paradeG;
        this.calmUntil = r + 6;
        this.nextMovingAt = Math.max(this.nextMovingAt, r + 14);
        this.nextParadeAt = r + MK.MIN_GAP_ROWS + rng.int(0, 10);
        this.parade = { g, stage: 1, next: r + 7 + MK.FUNE_GAP_ROWS, tries: 0 };
        const dir = rng() < 0.5 ? 1 : -1;
        emit({ kind: 'maimoni', lane: dir > 0 ? 0 : L - 1, d: D + 3 * ROW + 4, len: 12, dir,
          vx: lerp(MK.MAIMONI_VX[0], MK.MAIMONI_VX[1], diff), group: g });
        return;
      }
    }
    if (diff >= DF.MOVING_FROM && r >= this.nextMovingAt && !longActive &&
        rng() < 0.07 + 0.12 * diff) {
      this.calmUntil = r + 6;
      this.nextMovingAt = r + 16 + rng.int(0, 12);
      const kind = rng() < 0.55 ? 'goat' : 'rollbarrel';
      const dir = rng() < 0.5 ? 1 : -1;
      emit({
        kind, lane: dir > 0 ? 0 : L - 1, d: D + 3 * ROW + 4, len: 12,
        dir, vx: kind === 'goat' ? lerp(22, 38, diff) : lerp(40, 66, diff),
      });
      return;
    }

    // ---- sentiero sicuro -------------------------------------------
    this.hold--;
    let pChange = lerp(DF.PATH_CHANGE_P_START, DF.PATH_CHANGE_P_END, diff);
    if (this.carpetRows > 0 && this.carpetMode === 'path') pChange = Math.min(0.7, pChange * 2); // scie a zig-zag
    if (this.hold <= 0 && rng() < pChange) {
      let dir = rng() < 0.5 ? -1 : 1;
      if (this.path + dir < 0 || this.path + dir >= L) dir = -dir;
      const target = this.path + dir;
      if (this.blockedUntil[target] < r) {
        this.freeUntil[this.path] = Math.max(this.freeUntil[this.path], r + 1);
        this.freeUntil[target] = Math.max(this.freeUntil[target], r + 1);
        this.path = target;
        this.hold = Math.round(lerp(4, 2, diff));
      }
    }
    const required = new Array(L).fill(false);
    for (let l = 0; l < L; l++) required[l] = this.freeUntil[l] >= r || l === this.path;

    // ---- v5s10: i due Stramaionis con la fune tesa su 2 corsie (ci si abbassa), poi sa Grastula ----
    const pa = this.parade;
    if (pa && r >= pa.next && this.nearDance(D, 55, 30)) pa.next = r + 1;   // v5s20: niente fune/fuso nel cerchio del ballo
    if (pa && r >= pa.next && !longActive) {
      if (pa.stage === 1) {
        const left = this.path === 0 ? 1 : this.path === L - 1 ? 0 : (rng() < 0.5 ? 0 : 1);  // il sentiero resta libero se si puo'
        for (let l = 0; l < L; l++) { used[l] = true; this.laneCool[l] = Math.max(this.laneCool[l], r + 1); }
        this.nextBeamAt = Math.max(this.nextBeamAt, r + 8);
        emit({ kind: 'fune', lane: left, d: D + 10, len: DUCK.BEAM_LEN, group: pa.g });
        pa.stage = 2; pa.next = r + 1 + MK.FUSO_GAP_ROWS;
        this.carpetRow(r, D, diff, used, emit);
        return;
      }
      const free = [];
      for (let l = 0; l < L; l++) if (!required[l] && !used[l] && this.blockedUntil[l] < r && this.laneCool[l] < r) free.push(l);
      if (free.length || ++pa.tries > 8) {
        const l = free.length ? free[rng.int(0, free.length - 1)] : (this.path === 0 ? L - 1 : 0);
        const side = l === 0 ? -1 : l === L - 1 ? 1 : (rng() < 0.5 ? -1 : 1);
        if (free.length) { used[l] = true; this.laneCool[l] = Math.max(this.laneCool[l], r + 1); }
        // senza corsia libera sa Grastula resta a guardare (idle: niente lancio, non ferma)
        emit({ kind: 'fuso', lane: l, d: D + 8, len: 12, side, group: pa.g, last: true, idle: !free.length });
        this.nextBeamAt = Math.max(this.nextBeamAt, r + 4);
        this.parade = null;
      }
    }
    // ---- v5s6: trave bassa (tutte le corsie, si passa abbassandosi: niente altro sulla fila) ----
    if (diff >= DUCK.BEAM_FROM && r >= this.nextBeamAt && !longActive && rng() < lerp(DUCK.BEAM_P_START, DUCK.BEAM_P_END, diff)) {
      this.nextBeamAt = r + DUCK.BEAM_MIN_GAP_ROWS + rng.int(0, 8);
      for (let l = 0; l < L; l++) { used[l] = true; this.laneCool[l] = Math.max(this.laneCool[l], r + 1); }
      emit({ kind: 'trave', lane: 1, d: D + 10, len: DUCK.BEAM_LEN });
      this.carpetRow(r, D, diff, used, emit);
      return;
    }
    // ---- v5s6: ostacolo tipico dell'ambiente (fuori dal sentiero sicuro) ----
    if (diff >= BO.FROM && r >= this.nextBiomeAt && rng() < lerp(BO.P_START, BO.P_END, diff)) {
      const kind = BIOME_OBST_KIND[biomeIdAt(D, this.offM)];
      const free = [];
      for (let l = 0; l < L; l++) if (!required[l] && !used[l] && this.blockedUntil[l] < r && this.laneCool[l] < r) free.push(l);
      if (kind && free.length) {
        const l = rng.pick(free);
        this.nextBiomeAt = r + BO.MIN_GAP_ROWS + rng.int(0, 6);
        used[l] = true;
        if (kind === 'rollin') {
          // rotola verso il giocatore: la corsia resta riservata per le file che attraversa
          this.blockedUntil[l] = r + BO.ROLL_ROWS; this.laneCool[l] = r + BO.ROLL_ROWS + 1;
          const sweep = Math.ceil(336 * BO.ROLL_K / (1 + BO.ROLL_K)) + 12;
          emit({ kind, lane: l, d: D + BO.ROLL_ROWS * ROW, len: 14, sweep });
        } else {
          this.laneCool[l] = r + 1;
          emit({ kind, lane: l, d: D + 8, len: 14 });
        }
      }
    }

    // ---- ostacoli lunghi -------------------------------------------
    const canLong = (l) => !required[l] && !used[l] && this.blockedUntil[l] < r;
    if (diff >= DF.NARROW_FROM && rng() < 0.035 + 0.05 * diff) {
      const l = rng() < 0.5 ? 0 : L - 1;
      const rows = 3 + rng.int(0, Math.round(1 + 2 * diff));
      if (canLong(l) && !this.sideBlocks.some((b) => b.edge === l && b.until >= r)) {
        this.blockedUntil[l] = r + rows - 1;
        this.laneCool[l] = r + rows;
        used[l] = true;
        emit({ kind: 'narrow', lane: l, d: D + 2, len: rows * ROW - 6 });
      }
    }
    if (diff >= DF.GROUP_FROM && rng() < 0.04 + 0.06 * diff) {
      const l = rng.int(0, L - 1);
      if (canLong(l)) {
        this.blockedUntil[l] = r + 1;
        this.laneCool[l] = r + 2;
        used[l] = true;
        emit({ kind: 'botti', lane: l, d: D + 4, len: 2 * ROW - 10 });
      }
    }

    // ---- ostacoli corti --------------------------------------------
    const pObs = lerp(DF.OBSTACLE_P_START, DF.OBSTACLE_P_END, diff);
    const boost = r <= this.barrelBoostUntil;
    for (let l = 0; l < L; l++) {
      if (required[l] || used[l] || this.laneCool[l] >= r) continue;
      if (rng() >= pObs * (boost ? 1.25 : 1)) continue;
      let kind;
      const k = rng();
      if (boost) kind = k < 0.6 ? 'botte' : k < 0.85 ? 'bottecoricata' : 'muretto';
      else if (diff >= DF.PUDDLE_FROM && k < 0.22) kind = 'pozza';
      else if (k < 0.48) kind = 'muretto';
      else if (k < 0.8) kind = 'botte';
      else kind = 'bottecoricata';
      const len = SHORT_LEN[kind];
      used[l] = true;
      this.laneCool[l] = r + 1;
      emit({ kind, lane: l, d: D + Math.floor((ROW - len) / 2), len });
    }

    this.maybePistol(r, D, used, emit);
    this.maybePickup(r, D, diff, used, emit, 0);
    this.carpetRow(r, D, diff, used, emit);
  }

  maybePickup(r, D, diff, used, emit, extraP) {
    const rng = this.rng;
    if (r - this.lastPickupRow < 2) return;
    const p = lerp(DF.PICKUP_P_START, DF.PICKUP_P_END, diff) + extraP * (1 - diff * 0.5);
    if (rng() >= p) return;
    let lane = this.path;
    if (rng() > 0.62 || used[lane]) {
      const free = [];
      for (let l = 0; l < WORLD.LANES; l++) if (!used[l]) free.push(l);
      if (!free.length) return;
      lane = rng.pick(free);
    }
    if (used[lane]) return;
    used[lane] = true;
    this.lastPickupRow = r;
    const kind = rng() < DF.FERULA_SHARE ? 'ferula' : 'asfodelo';
    emit({ kind, lane, d: D + 9, len: 12, pickup: true });
  }

  maybePistol(r, D, used, emit) {
    const lane = this.path;
    if (used[lane]) return;
    let go = false;
    if (this.debugPistol) go = r === 2 || (r > 2 && r % 30 === 2);
    else go = r >= this.nextPistolRow && this.pistols < PISTOL.MAX_PER_RUN && this.rng() < PISTOL.P_PER_ROW;
    if (!go) return;
    used[lane] = true;
    this.pistols++;
    this.nextPistolRow = r + Math.ceil((PISTOL.MIN_GAP_M * PX_PER_METER) / WORLD.ROW);
    this.barrelBoostUntil = r + PISTOL.BARREL_BOOST_ROWS;
    emit({ kind: 'pistola', lane, d: D + 9, len: 12, pickup: true });
  }

  // scie di tappeti: seguono il sentiero (zig-zag) o una corsia libera
  carpetRow(r, D, diff, used, emit) {
    const rng = this.rng;
    if (this.carpetRows <= 0) {
      if (r < this.nextCarpetAt) return;
      if (rng() >= lerp(CP.STREAK_P_START, CP.STREAK_P_END, diff)) return;
      this.carpetRows = rng.int(CP.STREAK_MIN_ROWS, CP.STREAK_MAX_ROWS);
      this.carpetVariant = rng.int(0, 3);
      this.carpetMode = rng() < CP.OFFPATH_SHARE ? 'lane' : 'path';
      if (this.carpetMode === 'lane') {
        const free = [];
        for (let l = 0; l < WORLD.LANES; l++) if (!used[l] && l !== this.path) free.push(l);
        if (!free.length) this.carpetMode = 'path';
        else this.carpetLane = rng.pick(free);
      }
    }
    this.carpetRows--;
    if (this.carpetRows <= 0) this.nextCarpetAt = r + 1 + CP.GAP_ROWS;
    let lane = this.carpetMode === 'path' ? this.path : this.carpetLane;
    if (used[lane]) {
      if (this.carpetMode === 'lane') { this.carpetMode = 'path'; lane = this.path; }
      if (used[lane]) return;
    }
    // la fila successiva in quella corsia resta libera: niente trappole
    this.freeUntil[lane] = Math.max(this.freeUntil[lane], r + 1);
    used[lane] = true;
    const step = Math.floor(WORLD.ROW / CP.PER_ROW);
    for (let i = 0; i < CP.PER_ROW; i++) {
      emit({ kind: 'tappeto', lane, d: D + 3 + i * step, len: 8, pickup: true, variant: this.carpetVariant });
    }
  }
}
