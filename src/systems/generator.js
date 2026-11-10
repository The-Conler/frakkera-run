// =====================================================================
// Generatore procedurale del percorso.
// Garanzia di percorribilita' (SENZA usare la pistola): prima si traccia un
// "sentiero sicuro" (una corsia sempre libera che cambia al massimo di una
// corsia alla volta, con 2 file libere in entrambe le corsie durante il
// cambio), poi si piazzano ostacoli SOLO fuori dal sentiero. Gli ostacoli
// mobili compaiono solo in "finestre calme" senza altri ostacoli.
// Tappeti, combustibile e pistola si piazzano solo in celle libere.
// =====================================================================
import { DIFFICULTY as DF, WORLD, PX_PER_METER, CARPETS as CP, PISTOL, SPEED_STEPS as SS, BIOME_OBST as BO, DUCK, MASKS as MK, FIRE, MINE, CART, COLLECT, DANCE, FESTA, POWER, WEATHER, ANIMALS, SANTAMARTA, VILLAGE as VL, ZONE3 as Z3, NATURE_TREES as NT, PACE, CICCIO } from '../config.js';
import { rainLap } from './weather.js';
import { biomeAt, BIOMES, CYCLE } from '../game/biomes/config.js';
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
  const s = Math.min(baseSpeedAt(px) + speedStepsAt(px, offM) * SS.PER_STEP, DF.SPEED_MAX);
  return zone3Speed(s, px / PX_PER_METER + offM);
}
// v5s34: zona 3 (dal terzo giro): la velocita' scende dolcemente sotto il tetto e poi cresce appena
export const ZONE3_FROM_M = Z3.FROM_LAP * CYCLE;
export const inZone3 = (m) => m >= ZONE3_FROM_M;
export function zone3Speed(s, m) {
  if (m < ZONE3_FROM_M) return s;
  const x = m - ZONE3_FROM_M, cap = Math.min(Z3.SPEED_CAP_MAX, Z3.SPEED_CAP + x * Z3.SPEED_GROW);
  if (s <= cap) return s;
  const t = Math.min(1, x / Z3.EASE_M), k = t * t * (3 - 2 * t);
  return s - (s - cap) * k;
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
  rollin: true, sasso: true, bagnato: false, trave: false, ramo: false, acqua: false,
  // v5s10: maschere di Gadoni (la fune si passa abbassandosi, come la trave)
  maimoni: true, fune: false, fuso: true,
  // feat-village: panni stesi (ci si abbassa), processione (urto = fuoco, non ferma)
  panni: false, processione: false,
  // v5s18: binario interrotto (respingente o crollo) durante il giro in carrello
  deadend: true,
  // v5s24: animali (pecore e maialetto attraversano, capre saltano giu' dalla roccia)
  pecora: true, maialetto: true, caprarupe: true,
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
export const SIDE_KINDS = { falo: true, minatore: true, lampada: true, carrello: true, scambio: true, bancarella: true, folla: true, festone: true };   // v5s45 (15): la tessitrice ora e' un ostacolo in mezzo alla via
// v5 stage 24: navata di Santa Marta alla distanza m (metri assoluti): null o { lap, local }
export function santaMartaAt(m, lead = 0, tail = 0) {
  // misurata dall'inizio del paese nel giro (la navata sconfina nei primi metri della roccia)
  const v = BIOMES.find((b) => b.id === SANTAMARTA.BIOME), mm = Math.max(0, m), lap = Math.floor(mm / CYCLE), local = mm - lap * CYCLE - v.from;
  if (local < SANTAMARTA.FROM_M - lead || local >= SANTAMARTA.FROM_M + SANTAMARTA.LEN_M + tail) return null;
  return { lap, local: local - SANTAMARTA.FROM_M };
}
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
    this.z3Next = -1;   // v5s34: zona 3, prima fila in cui puo' arrivare la prossima azione obbligata
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
    // v5s24: flusso separato per gli animali
    this.arng = makeRng(((seed >>> 0) ^ 0x6a1e05) >>> 0); this.nextAnimalRow = 0; this.animals = 0;
    // v5s24: flusso separato per potenziamenti e rami caduti
    this.wrng = makeRng(((seed >>> 0) ^ 0x7e0b11) >>> 0);
    this.nextPowerRow = Math.ceil((POWER.FROM_M * PX_PER_METER - WORLD.LEAD_IN) / WORLD.ROW) + this.wrng.int(0, 30); this.powers = 0;
    this.nextBranchRow = 0; this.branches = 0; this.nextPuddleRow = 0; this.puddles = 0;
    this.rrng = makeRng(((seed >>> 0) ^ 0x4a1c9d) >>> 0);   // v5s25: pozzanghere della notte di pioggia
    // feat-village: flusso separato per la vita del paese (panni, tessitrice, processione)
    this.vrng = makeRng(((seed >>> 0) ^ 0x7a11a9) >>> 0);
    this.weaverNext = 0; this.weaverLap = -1; this.weavers = 0; this.procLap = -1; this.procs = 0; this.laundry = 0;
    this.nextMinerRow = 0; this.nextLampRow = 0; this.minerSide = 1; this.lampSide = -1; this.miners = 0; this.lamps = 0;
    this.rockHold = [[], [], []];
    // v5s44c: ritmo delle azioni (accovacciata / salto / scarto) sopra la prenotazione di corsia
    this.paceLast = { crouch: -1, wave: -1 };
    this.paceLane = Object.create(null);
    this.paceLog = [];
  }

  // v5s43: pietre, strettoie rocciose, gruppi e detriti condividono una prenotazione di corsia.
  // Almeno 2 corsie su 3 restano libere, contando anche gli ostacoli gia' attivi e il volo del masso.
  rockBlocked(a, b) {
    if (!this.rockHold) this.rockHold = [[], [], []];
    const out = new Set(), keep = this.row - 16;
    for (let lane = 0; lane < WORLD.LANES; lane++) {
      if (this.blockedUntil[lane] >= a) out.add(lane);
      const list = this.rockHold[lane];
      for (let i = list.length - 1; i >= 0; i--) {
        const iv = list[i];
        if (iv[1] < keep) list.splice(i, 1);
        else if (iv[0] < b && iv[1] >= a) out.add(lane);
      }
    }
    return out;
  }
  rockOk(lane, a, b) { const s = this.rockBlocked(a, b); s.add(lane); return WORLD.LANES - s.size >= 2; }
  rockTake(lane, a, b) { if (!this.rockHold) this.rockHold = [[], [], []]; this.rockHold[lane].push([a, b]); }

  // v5s44c: tipo di azione obbligata (null = pickup/decoro, non conta nel ritmo)
  actionType(kind) {
    if (kind === 'trave' || kind === 'panni' || kind === 'ramo' || kind === 'fune') return 'crouch';
    if (kind === 'botte' || kind === 'bottecoricata' || kind === 'muretto' || kind === 'sasso' || kind === 'botti') return 'jump';
    if (PICKUP_KINDS[kind] || SIDE_KINDS[kind] || kind === 'deadend') return null;   // il carrello ha il suo ritmo di scambi
    if (SOLID[kind] || kind === 'processione' || kind === 'tessitrice') return 'lane';
    return null;
  }
  paceDt(a, b) { return (b - a) / Math.max(40, speedAt(a, this.offM)); }
  waveKey(d) { return Math.floor((d + 0.01 - WORLD.LEAD_IN) / WORLD.ROW); }
  paceOkType(type, d, lane) {
    if (!type) return true;
    const prev = type === 'crouch' ? this.paceLast.crouch : this.paceLane[type + ':' + (lane ?? 0)];
    return !(prev >= 0 && this.paceDt(prev, d) < PACE.SAME_S);
  }
  paceOkWave(d, extra = 1) {
    if (this.paceLast.wave >= 0 && this.waveKey(d) === this.waveKey(this.paceLast.wave)) return true;
    for (const w of this.paceLog) {
      if (this.waveKey(w) === this.waveKey(d)) return true;
      const dt = Math.abs(d - w) / Math.max(40, speedAt(Math.min(d, w), this.offM));
      if (dt < PACE.ANY_S) return false;
    }
    let n = 0;
    for (const w of this.paceLog) {
      const dt = Math.abs(d - w) / Math.max(40, speedAt(Math.min(d, w), this.offM));
      if (dt < PACE.CHAIN_WINDOW_S + 0.05) n++;
    }
    if (n + extra - 1 >= PACE.CHAIN_N) return false;
    return true;
  }
  paceOk(type, d, lane, extra = 1) { return this.paceOkType(type, d, lane) && this.paceOkWave(d, extra); }
  paceTake(type, d, lane) {
    if (!type) return;
    if (type === 'crouch') this.paceLast.crouch = d;
    else this.paceLane[type + ':' + (lane ?? 0)] = d;
    if (this.paceLast.wave < 0 || this.waveKey(d) !== this.waveKey(this.paceLast.wave)) { this.paceLast.wave = d; this.paceLog.push(d); }
  }
  paceRows(D) { return Math.ceil(PACE.SAME_S * speedAt(D, this.offM) / WORLD.ROW); }

  // v5s18: file del giro in carrello: niente ostacoli normali, scambi con binari interrotti
  cartRow(r, D, diff, used, emit) {
    const m = D / PX_PER_METER + this.offM;
    const c = cartAt(m, CART.LEAD_M, 4);
    if (!c) { this.cartLap = this.cartLap ?? -1; return false; }
    const rng = this.rng, L = WORLD.LANES, ROW = WORLD.ROW;
    for (let l = 0; l < L; l++) if (this.blockedUntil[l] >= r) used[l] = true;
    if (this.cartLap !== c.lap && (c.local >= 0 || c.local > -ROW / PX_PER_METER * 2.2)) {
      this.cartLap = c.lap; this.cartJ = 0;
      // v5s45 (12): grazia dopo la salita: il primo scambio arriva dopo almeno CART.GRACE_S di corsa in carrello
      { const boardD = D - c.local * PX_PER_METER, grace = Math.max(CART.FIRST_M * PX_PER_METER, CART.GRACE_S * speedAt(boardD, this.offM) * CART.SPEED_K);
        this.cartGraceD = boardD + grace;
        this.nextJunction = r + Math.max(c.local < 0 ? 1 : 3, Math.ceil((boardD + grace - 10 - D) / ROW)); }
      if (c.local < 0) { const dB = Math.round(D - c.local * PX_PER_METER) - 10; for (let l = 0; l < L; l++) emit({ kind: 'carrello', lane: l, d: dB, len: 14, lap: c.lap }); }   // v5s20: carrelli fermi proprio dove si sale   // carrelli fermi, uno per binario
    }
    if (c.local < 0) { this.carpetRow(r, D, diff, used, emit); return true; }   // tratto libero prima della salita
    if (r >= this.nextJunction && c.local < CART.LEN_M - CART.END_FREE_M) {
      this.nextJunction = r + CART.JUNCTION_ROWS;
      const j0 = this.cartJ;
      let dir = rng() < 0.5 ? -1 : 1;
      if (this.path + dir < 0 || this.path + dir >= L) dir = -dir;
      let next = rng() < 0.75 ? this.path + dir : this.path;
      if (used[next]) next = this.path;
      if (used[next]) { this.nextJunction = r + 1; this.carpetRow(r, D, diff, used, emit); return true; }
      const two = rng() < CART.P_TWO_BLOCKED && j0 > 0;   // v5s45 (12): il primo scambio interrompe un solo binario
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
      this.paceTake('lane', D + 10, next);
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
    const nearD = this.nearDance(D, 70, 46);   // v5s45 (19/20): niente festoni ne' bancarelle davanti e sopra il cerchio del ballo
    if (r >= this.festoonNext && !nearD) { this.festoonNext = r + FESTA.FESTOON_ROWS; emit({ kind: 'festone', lane: 1, d: D + 2, len: 4, variant: pr.int(0, 2) }); }
    for (const side of [-1, 1]) {
      if (r < this.stallNext[side] || busy(side) || this.nearDance(D, 12, 14)) continue;
      this.stallNext[side] = r + pr.int(FESTA.STALL_GAP[0], FESTA.STALL_GAP[1]);
      const edge = side < 0 ? 0 : L - 1;
      this.sideBlocks.push({ edge, until: r + 2 });
      emit({ kind: 'bancarella', lane: edge, side, d: D + 6, len: 24, variant: pr.int(0, 3) });
    }
    if (r >= this.crowdNext) {
      const side = pr() < 0.5 ? -1 : 1;
      this.crowdNext = r + pr.int(FESTA.CROWD_GAP[0], FESTA.CROWD_GAP[1]);
      if (!busy(side) && !this.nearDance(D, 12, 14) && festaAt((D + 10) / PX_PER_METER + this.offM)) {   // v5s24: mai a cavallo della fine della festa
        const edge = side < 0 ? 0 : L - 1; this.crowds++;
        this.sideBlocks.push({ edge, until: r + 1 });
        emit({ kind: 'folla', lane: edge, side, d: D + 10, len: 14, n: pr.int(3, 5), variant: pr.int(0, 5), crowd: this.crowds });
      }
    }
  }

  // v5s45 (15): la tessitrice al telaio IN MEZZO alla via (corsia 1), girata verso chi corre: una per giro nel paese.
  // Le corsie 0 e 2 restano aperte; se il sentiero sicuro e' sulla corsia 1 lo si sposta prima (come un cambio normale).
  villageCalm(D) {
    const bi = biomeAt(D / PX_PER_METER + this.offM);
    if (bi.b.id !== VL.BIOME) return false;
    if (bi.lap >= 1 && bi.local > DANCE.AT_M - DANCE.CLEAR_BEFORE_M - 6 && bi.local < DANCE.AT_M + DANCE.CLEAR_AFTER_M) return true;
    if (bi.lap === CICCIO.LAP && bi.local > CICCIO.CLEAR_FROM_M - 8 && bi.local < CICCIO.CLEAR_TO_M) return true;
    if (this.weaverLap !== bi.lap) { const [f, t] = this.weaverWindow(bi.lap); if (bi.local > f - 22 && bi.local < t) return true; }
    return false;
  }
  weaverWindow(lap) { return lap === CICCIO.LAP ? [VL.WEAVER_LAP2_FROM_M, VL.WEAVER_LAP2_TO_M] : [VL.WEAVER_FROM_M, VL.WEAVER_TO_M]; }
  maybeWeaver(r, D, used, emit) {
    const bi = biomeAt(D / PX_PER_METER + this.offM);
    if (bi.b.id !== VL.BIOME || bi.lap === this.weaverLap) return;
    const [from, to] = this.weaverWindow(bi.lap);
    if (bi.local < from || bi.local >= to) return;
    if (this.parade || this.nearDance(D, 30, 18)) return;
    const L = WORLD.LANES, lane = 1, d = D + 8;
    if (this.path === lane) {          // sposta il sentiero sicuro su una corsia laterale libera, riprova tra due file
      const opts = [0, L - 1].filter((l) => this.blockedUntil[l] < r && !used[l]);
      if (!opts.length) return;
      const t = opts[this.vrng.int(0, opts.length - 1)];
      this.freeUntil[this.path] = Math.max(this.freeUntil[this.path], r + 1); this.freeUntil[t] = Math.max(this.freeUntil[t], r + 1);
      this.path = t; this.hold = Math.max(this.hold, 4);
      return;
    }
    if (this.freeUntil[lane] >= r || this.blockedUntil[lane] >= r || used[lane] || (this.carpetRows > 0 && this.carpetLane === lane)) return;
    if (!this.paceOk('lane', d, lane)) return;
    const vr = this.vrng;
    this.weaverLap = bi.lap; this.weavers++;
    const rows = Math.ceil((VL.WEAVER_LEN + 8) / WORLD.ROW) + 1;
    this.blockedUntil[lane] = Math.max(this.blockedUntil[lane], r + rows); used[lane] = true;
    this.hold = Math.max(this.hold, rows);    // il sentiero resta sulla corsia laterale finche' il telaio non e' passato
    this.paceTake('lane', d, lane);
    emit({ kind: 'tessitrice', lane, side: 0, d, len: VL.WEAVER_LEN, variant: vr.int(0, 3), weaver: this.weavers });
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
    // v5s25: notte di pioggia: pozzanghere che rallentano un poco (corsia libera, mai sola via d'uscita)
    if (free.length >= 2 && r >= this.nextPuddleRow && rainLap(biomeAt(m).lap) && !biomeAt(m).b.id.startsWith('mine')) {
      const rr = this.rrng; this.nextPuddleRow = r + rr.int(WEATHER.PUDDLE_GAP_ROWS[0], WEATHER.PUDDLE_GAP_ROWS[1]);
      const lane = free[rr.int(0, free.length - 1)]; used[lane] = true; this.puddles++;
      emit({ kind: 'acqua', lane, d: D + 8, len: 14, variant: rr.int(0, 2) });
      return;
    }
    const z3 = this.z3Rows(D);
    if (free.length === L && r >= this.nextBranchRow && m >= POWER.BRANCH_FROM_M && (!z3 || (r >= this.z3Next && this.hold <= 0))) {
      const bi = biomeAt(m);
      if (POWER.BRANCH_BIOMES.includes(bi.b.id) && wr() < POWER.BRANCH_P * NT.BRANCH_K) {   // v5s34: rami caduti piu' rari
        if (!this.paceOk('crouch', D + 10, 1)) { this.nextBranchRow = r + 1; return; }
        this.nextBranchRow = r + wr.int(POWER.BRANCH_GAP_ROWS[0], POWER.BRANCH_GAP_ROWS[1]); this.branches++;
        for (let l = 0; l < L; l++) used[l] = true;
        if (z3) { this.z3Next = Math.max(this.z3Next, r + z3); this.hold = Math.max(this.hold, z3); }
        this.paceTake('crouch', D + 10, 1);
        this.nextBeamAt = Math.max(this.nextBeamAt, r + this.paceRows(D));
        emit({ kind: 'ramo', lane: 1, d: D + 10, len: POWER.BRANCH_LEN, variant: wr.int(0, 2) });
      }
    }
  }

  // v5s20: la fila D e' vicina al punto del ballu tundu (metri prima / dopo)?
  nearDance(D, before, after) {
    const bi = biomeAt(D / PX_PER_METER + this.offM);
    if (bi.b.id !== 'village' || bi.lap < 1) return false;   // v5s26: niente ballo al primo giro
    return bi.local > DANCE.AT_M - before && bi.local < DANCE.AT_M + after;
  }

  // v5s44c: una processione per giro, poco prima di Santa Marta (non all'uscita della miniera)
  maybeProcession(r, D, used, emit) {
    const vb = biomeAt(D / PX_PER_METER + this.offM);
    if (vb.b.id !== VL.BIOME || vb.lap === this.procLap) return;
    if (vb.local < VL.PROC_FROM_M || vb.local >= VL.PROC_TO_M) return;
    if (this.nearDance(D, 80, 40)) return;
    // v5s44g: sempre sulla corsia SINISTRA (richiesta: il corteo a sinistra). Cammina verso chi corre (fino a
    // PROC_WALK_MAX_PX indietro): la corsia sinistra deve essere libera dal sentiero sicuro anche nelle file
    // precedenti, altrimenti si riprova alla fila dopo (finestra 200-220 m); corsie 1 e 2 restano aperte
    const pl = [0, 1, 2].filter((l) => l !== this.path && l !== this.prevPath && l !== this.lastPath && !(this.carpetRows > 0 && this.carpetLane === l) && this.blockedUntil[l] < r - 2);
    const lane = 0;
    if (!pl.includes(lane)) return;
    if (!this.paceOk('lane', D + 24, lane)) return;   // corteo non solido: costa solo fuoco; il passo indietro (<= 6 m) non cambia il ritmo
    const vr = this.vrng;
    this.procLap = vb.lap; this.procs++;
    const rows = Math.ceil((VL.PROC_LEN + 24) / WORLD.ROW) + 1;
    this.blockedUntil[lane] = Math.max(this.blockedUntil[lane], r + rows);
    used[lane] = true;
    this.paceTake('lane', D + 24, lane);
    emit({ kind: 'processione', lane, d: D + 24, len: VL.PROC_LEN, proc: this.procs, variant: vr.int(0, 2) });
  }

  // v5s24: eventi animali (flusso arng): gregge con su pastore (+ cane pastore dopo), maialetto, cane randagio, capre dalla roccia
  maybeAnimals(r, D, diff, emit) {
    const ar = this.arng, A = ANIMALS, L = WORLD.LANES, ROW = WORLD.ROW;
    if (r < this.nextAnimalRow || D / PX_PER_METER < A.FROM_M) return false;
    const roll = ar(), pick = ar();
    if (roll >= A.P_ROW) return false;
    const bid = biomeIdAt(D, this.offM), opts = [];
    if (A.FLOCK_BIOMES.includes(bid) && A.FLOCK_BIOMES.includes(biomeIdAt(D + 30 * PX_PER_METER, this.offM))) opts.push('flock');
    if (A.PIG_BIOMES.includes(bid)) opts.push('pig');
    if (A.DOG_BIOMES.includes(bid)) opts.push('dog');
    if (A.ROCKGOAT_BIOMES.includes(bid)) opts.push('rockgoat');
    if (!opts.length) return false;
    const ev = opts[Math.floor(pick * opts.length)], id = ++this.animals, dir = ar() < 0.5 ? 1 : -1;
    this.nextAnimalRow = r + ar.int(A.GAP_ROWS[0], A.GAP_ROWS[1]);
    if (ev === 'dog') {               // aiutante: non occupa le corsie, il generatore prosegue normalmente
      emit({ kind: 'cane', lane: dir > 0 ? 0 : L - 1, side: -dir, d: D + 6, len: 10, animal: id });
      return false;
    }
    this.calmUntil = r + 6; this.nextMovingAt = Math.max(this.nextMovingAt, r + 14);
    if (ev === 'flock') {
      const n = ar.int(A.FLOCK_N[0], A.FLOCK_N[1]), gapAt = ar.int(1, n - 1), vx = lerp(A.FLOCK_VX[0], A.FLOCK_VX[1], diff);
      const d0 = D + 3 * ROW + 4; let off = 0;
      emit({ kind: 'pastore', lane: dir > 0 ? 0 : L - 1, side: -dir, d: d0 + 10, len: 12, animal: id, n });
      for (let i = 0; i < n; i++) {
        if (i === gapAt) off += A.FLOCK_GAP;
        emit({ kind: 'pecora', lane: dir > 0 ? 0 : L - 1, d: d0 + ar.int(-3, 3), len: 12, dir, vx, xoff: off, flock: id, variant: ar.int(0, 2), freeLane: this.path, gapC: (gapAt - 1) * A.FLOCK_STEP + (A.FLOCK_STEP + A.FLOCK_GAP) / 2 });   // v5s40: il gregge si ferma col varco sulla corsia libera
        off += A.FLOCK_STEP;
      }
      emit({ kind: 'canepastore', lane: 1, d: d0 + A.CHASE_ROWS * ROW, len: 8, animal: id });
      return true;
    }
    if (ev === 'pig') {
      emit({ kind: 'maialetto', lane: dir > 0 ? 0 : L - 1, d: D + 3 * ROW + 4, len: 10, dir, vx: lerp(A.PIG_VX[0], A.PIG_VX[1], diff), animal: id });
      return true;
    }
    // capre dalla roccia: 1-2 capre sulla stessa fila, mai sul sentiero sicuro (resta sempre un passaggio)
    // v5s44f: le capre compaiono a D+9 (non D+3*ROW): il ritmo si controlla e si registra dove compaiono davvero
    if (!this.paceOk('lane', D + 9, 1)) return false;
    this._animPaceD = D + 9;
    const k = ar.int(A.ROCKGOAT_N[0], A.ROCKGOAT_N[1]), lanes = [0, 1, 2].filter((l) => l !== this.path && this.freeUntil[l] < r && !(this._used || [])[l]);
    for (let i = lanes.length - 1; i > 0; i--) { const j = ar.int(0, i); [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
    lanes.length = Math.min(k, lanes.length);
    lanes.forEach((l) => { emit({ kind: 'caprarupe', lane: l, side: l === 0 ? -1 : l === 2 ? 1 : dir, d: D + 9, len: 12, animal: id }); this.blockedUntil[l] = Math.max(this.blockedUntil[l], r); });
    return true;
  }

  rowDist(r) { return WORLD.LEAD_IN + r * WORLD.ROW; }

  // v5s43: intervallo in metri locali [from, to) su qualunque giro. Ritorna il giro, o -1.
  inSpan(d, len, from, to) {
    let a = (d || 0) / PX_PER_METER + this.offM, b = ((d || 0) + (len || 0)) / PX_PER_METER + this.offM;
    if (a > b) { const t = a; a = b; b = t; }
    const lap0 = Math.floor(a / CYCLE) - 1, lap1 = Math.floor(b / CYCLE) + 1;
    for (let lap = lap0; lap <= lap1; lap++) {
      if (a < lap * CYCLE + to && b > lap * CYCLE + from) return lap;
    }
    return -1;
  }
  inClear(d, len) { return this.inSpan(d, len, 230, 285) >= 0; }

  // v5s34: zona 3: file minime tra due azioni obbligate (0 = fuori zona, nessun vincolo)
  z3Rows(D) {
    if (!inZone3(D / PX_PER_METER + this.offM)) return 0;
    return Math.ceil(Z3.MIN_GAP_S * speedAt(D - WORLD.LEAD_IN, this.offM) / WORLD.ROW);
  }

  fillUntil(maxDist, emit) {
    // v5s43: navata di Santa Marta (230-285 m locali, ogni giro): niente ostacoli, pickup, poteri o maschere.
    // Il test e' sull'intervallo intero [d, d+len], non solo sugli estremi.
    const em = emit;
    const clearFrom = 230, clearTo = 285;
    emit = (e) => {
      const lap = this.inSpan(e.d, e.len, clearFrom, clearTo);
      if (lap >= 0) {
        // un pezzo di corteo non si butta (il gruppo resterebbe monco): esce appena dopo la navata
        if (e.group) {
          const after = (lap * CYCLE + clearTo + 0.6 - this.offM) * PX_PER_METER;
          const placed = { ...e, d: after, idle: e.kind === 'fuso' ? true : e.idle };
          (this._maskHold || (this._maskHold = [])).push(placed);
          em(placed);
        }
        return;
      }
      if (e.pickup && this._maskHold) {
        for (const m of this._maskHold) {
          if (m.lane === e.lane && e.d < m.d + (m.len || 0) + 6 && e.d + (e.len || 0) > m.d - 6) return;
        }
      }
      // v5s45 (12): niente ostacoli normali sul tratto del carrello (salita compresa): solo scambi e binari interrotti
      if (!e.pickup && !SIDE_KINDS[e.kind] && e.kind !== 'deadend' && e.kind !== 'scambio' && e.kind !== 'carrello' && (SOLID[e.kind] || this.actionType(e.kind) || e.kind === 'rollin')) {
        const a = e.d / PX_PER_METER + this.offM, b = (e.d + (e.len || 0)) / PX_PER_METER + this.offM;
        if (cartAt(a, CART.LEAD_M, CART.EXIT_GRACE_M) || cartAt(b, CART.LEAD_M, CART.EXIT_GRACE_M) || cartAt((a + b) / 2, CART.LEAD_M, CART.EXIT_GRACE_M)) return;
      }
      // v5s45 (19): cerchio del ballu tundu (dal giro 2): niente ostacoli ne' pickup nel cerchio e subito prima
      if (!SIDE_KINDS[e.kind] && e.kind !== 'cane') {
        const dl = this.inSpan(e.d, e.len, DANCE.AT_M - DANCE.CLEAR_BEFORE_M, DANCE.AT_M + DANCE.CLEAR_AFTER_M);
        if (dl >= 1) return;
      }
      // v5s45 (18): passaggio di Ciccio (solo giro 2): nessun altro ostacolo, nessun pickup sulla sua corsia
      if (e.kind !== 'cane' && !SIDE_KINDS[e.kind] && this.inSpan(e.d, e.len, CICCIO.CLEAR_FROM_M, CICCIO.CLEAR_TO_M) === CICCIO.LAP) {
        if (!e.pickup || e.lane === CICCIO.LANE || e.mx !== undefined) return;
      }
      // v5s43: dal vicolo fino alla navata (paese, 150-230 m) niente ostacoli solidi (la botte davanti all'arco)
      const approach = this.inSpan(e.d, e.len, 150, clearFrom);
      if (approach >= 0 && SOLID[e.kind] && !e.pickup && !e.group && biomeIdAt(e.d, this.offM) === 'village') return;
      // v5s44c: niente travi/panni/rami di traverso negli ultimi NO_SPAN_M prima di Santa Marta (sembravano un ponte/ringhiera)
      if ((e.kind === 'trave' || e.kind === 'panni' || e.kind === 'ramo') &&
          this.inSpan(e.d, e.len, SANTAMARTA.FROM_M - SANTAMARTA.NO_SPAN_M, SANTAMARTA.FROM_M) >= 0) return;
      em(e);
    };
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
    const nature = NT.BIOMES.includes(biomeIdAt(D, this.offM));   // v5s34: meno alberi caduti nella natura
    const used = new Array(L).fill(false); this._used = used;
    const z3 = this.z3Rows(D), z3ok = !z3 || r >= this.z3Next;   // v5s34: zona 3, si puo' mettere un'azione in questa fila?
    const z3mark = (row) => { if (z3) this.z3Next = Math.max(this.z3Next, row + z3); };
    this.prevPath = this.lastPath ?? this.path; this.lastPath = this.path;
    for (let l = 0; l < L; l++) if (this.blockedUntil[l] >= r) used[l] = true;
    // v5 stage 24: dentro Santa Marta niente ostacoli ne' falo' (si corre sulla passatoia): solo tappeti
    if (!this.parade && santaMartaAt(D / PX_PER_METER + this.offM, SANTAMARTA.LEAD_M, 2)) { this.carpetRow(r, D, diff, used, emit); return; }
    this.maybeFire(r, D, emit);
    this.maybeMine(r, D, emit);
    this.maybeFesta(r, D, emit);
    this.maybeWeaver(r, D, used, emit);
    this.maybeProcession(r, D, used, emit);
    if (this.sideBlocks.length > 4) this.sideBlocks = this.sideBlocks.filter((b) => b.until >= r);
    if (this.cartRow(r, D, diff, used, emit)) return;
    // v5s45: tratti calmi del paese (cerchio del ballo dal giro 2, attesa della tessitrice, passaggio di Ciccio nel giro 2):
    // niente nuove azioni obbligate (cosi' il ritmo non registra ostacoli che poi verrebbero tolti), solo tappeti e pickup
    if (this.villageCalm(D)) { this.maybePickup(r, D, diff, used, emit, 0); this.carpetRow(r, D, diff, used, emit); return; }

    // ---- finestra calma con ostacolo mobile -------------------------
    if (r <= this.calmUntil) {
      this.maybePistol(r, D, used, emit);
      this.maybePickup(r, D, diff, used, emit, 0.45);
      this.carpetRow(r, D, diff, used, emit);
      return;
    }
    const longActive = this.blockedUntil.some((b) => b >= r);
    // ---- v5s10: corteo di Gadoni (solo nel paese): parte con su Maimoni in una finestra calma ----
    if (!this.parade && !longActive && z3ok && r >= this.nextParadeAt && D / PX_PER_METER >= MK.FROM_M &&
        biomeIdAt(D, this.offM) === 'village') {
      const bi = biomeAt(D / PX_PER_METER + this.offM), lap = bi.lap;
      if (lap === CICCIO.LAP) { this.nextParadeAt = r + 1; } else
      // v5s20: il corteo non entra mai nel cerchio del ballu tundu (piazza della chiesa)
      if (bi.local < Math.min(bi.b.to - bi.b.from, SANTAMARTA.FROM_M - SANTAMARTA.LEAD_M) - 90 && !this.nearDance(D, 90, 30) && this.paceOk('lane', D + 3 * ROW, 0, 3) && rng() < MK.P_LAP[Math.min(lap, MK.P_LAP.length - 1)]) {
        const g = ++this.paradeG;
        this.calmUntil = r + 6;
        this.nextMovingAt = Math.max(this.nextMovingAt, r + 14);
        this.nextParadeAt = r + MK.MIN_GAP_ROWS + rng.int(0, 10);
        const funeR = r + 7 + MK.FUNE_GAP_ROWS, fusoR = funeR + 1 + MK.FUSO_GAP_ROWS;
        // se un pezzo cadrebbe nella navata, il corteo non si emette (niente gruppo monco) ma lo stato resta uguale
        let silent = this.inClear(D + 3 * ROW + 4, 12) || this.inClear(this.rowDist(funeR) + 10, DUCK.BEAM_LEN);
        for (let k = 0; k <= 24 && !silent; k++) silent = this.inClear(this.rowDist(fusoR + k) + 8, 12);
        this.parade = { g, stage: 1, next: funeR, tries: 0, silent };
        z3mark(r + 3);
        const dir = rng() < 0.5 ? 1 : -1;
        if (!silent) { this.paceTake('lane', D + 3 * ROW + 4, dir > 0 ? 0 : L - 1); emit({ kind: 'maimoni', lane: dir > 0 ? 0 : L - 1, d: D + 3 * ROW + 4, len: 12, dir,
          vx: lerp(MK.MAIMONI_VX[0], MK.MAIMONI_VX[1], diff), group: g }); }
        return;
      }
    }
    if (!this.parade && !longActive && z3ok && this.paceOk('lane', D + 3 * ROW, 1) && (this._animPaceD = null, this.maybeAnimals(r, D, diff, emit))) { this.paceTake('lane', this._animPaceD ?? D + 3 * ROW, 1); z3mark(r + 3); return; }
    if (!this.parade && diff >= DF.MOVING_FROM && r >= this.nextMovingAt && !longActive && z3ok &&
        rng() < 0.07 + 0.12 * diff) {
      this.calmUntil = r + 6;
      this.nextMovingAt = r + 16 + rng.int(0, 12);
      const kind = rng() < (nature ? 1 - NT.ROLL_LOG_SHARE : 0.55) ? 'goat' : 'rollbarrel';
      z3mark(r + 3);
      const dir = rng() < 0.5 ? 1 : -1;
      // v5s43: capra e botte che rotola attraversano: prenotano tutte le corsie, cosi' non finiscono fra le casse
      const travel = 8;
      let cross = this.paceOk('lane', D + 3 * ROW + 4, 1);
      for (let l = 0; l < L; l++) if (!this.rockOk(l, r, r + travel)) cross = false;
      if (cross) for (let l = 0; l < L; l++) this.rockTake(l, r, r + travel);
      if (cross) { this.paceTake('lane', D + 3 * ROW + 4, 1); emit({
        kind, lane: dir > 0 ? 0 : L - 1, d: D + 3 * ROW + 4, len: 12,
        dir, vx: kind === 'goat' ? lerp(22, 38, diff) : lerp(40, 66, diff), freeLane: this.path,   // v5s40: la capra si ferma fuori dal sentiero sicuro
      }); }
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
        this.hold = Math.max(Math.round(lerp(4, 2, diff)), z3);   // v5s34: in zona 3 il sentiero resta fermo almeno MIN_GAP_S
      }
    }
    const required = new Array(L).fill(false);
    for (let l = 0; l < L; l++) required[l] = this.freeUntil[l] >= r || l === this.path;

    // ---- v5s10: i due Stramaionis con la fune tesa su 2 corsie (ci si abbassa), poi sa Grastula ----
    const pa = this.parade;
    if (pa && r >= pa.next && this.nearDance(D, 55, 30)) pa.next = r + 1;   // v5s20: niente fune/fuso nel cerchio del ballo
    if (pa && r >= pa.next && !z3ok) pa.next = r + 1;   // v5s34: in zona 3 fune e fuso aspettano il loro turno
    if (pa && r >= pa.next && !longActive) {
      z3mark(r);
      if (pa.stage === 1) {
        const left = this.path === 0 ? 1 : this.path === L - 1 ? 0 : (rng() < 0.5 ? 0 : 1);  // il sentiero resta libero se si puo'
        for (let l = 0; l < L; l++) { used[l] = true; this.laneCool[l] = Math.max(this.laneCool[l], r + 1); }
        this.nextBeamAt = Math.max(this.nextBeamAt, r + 8);
        if (!pa.silent) { this.paceTake('crouch', D + 10, 1); emit({ kind: 'fune', lane: 1, d: D + 10, len: DUCK.BEAM_LEN, group: pa.g }); }
        this.nextBeamAt = Math.max(this.nextBeamAt, r + this.paceRows(D));
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
        if (!pa.silent) { this.paceTake('lane', D + 8, l); emit({ kind: 'fuso', lane: l, d: D + 8, len: 12, side, group: pa.g, last: true, idle: !free.length }); }
        this.nextBeamAt = Math.max(this.nextBeamAt, r + 4);
        this.parade = null;
      }
    }
    // v5s44c: mentre il corteo e' in corso non si inseriscono altre azioni (il combo resta da 3)
    if (this.parade) {
      this.maybePistol(r, D, used, emit);
      this.maybePickup(r, D, diff, used, emit, 0);
      this.carpetRow(r, D, diff, used, emit);
      return;
    }
    // ---- v5s6: trave bassa (tutte le corsie, si passa abbassandosi: niente altro sulla fila) ----
    if (diff >= DUCK.BEAM_FROM && r >= this.nextBeamAt && !longActive && z3ok && (!z3 || this.hold <= 0) && this.paceOk('crouch', D + 10, 1) && rng() < lerp(DUCK.BEAM_P_START, DUCK.BEAM_P_END, diff) * (nature ? NT.BEAM_K : 1)) {
      this.nextBeamAt = r + Math.max(this.paceRows(D), Math.round((DUCK.BEAM_MIN_GAP_ROWS + rng.int(0, 8)) * (z3 ? Z3.BEAM_GAP_K : 1)));
      z3mark(r); if (z3) this.hold = Math.max(this.hold, z3);   // niente cambio di sentiero subito dopo la trave
      for (let l = 0; l < L; l++) { used[l] = true; this.laneCool[l] = Math.max(this.laneCool[l], r + 1); }
      this.paceTake('crouch', D + 10, 1);
      // feat-village: nel paese la trave puo' diventare i panni della nonna (la processione ha il suo flusso)
      const vb = biomeAt(D / PX_PER_METER + this.offM), vr = this.vrng;
      if (vb.b.id === VL.BIOME && vr() < VL.LAUNDRY_SHARE) {
        this.laundry++;
        emit({ kind: 'panni', lane: 1, d: D + 10, len: DUCK.BEAM_LEN, variant: vr.int(0, 3) });
        this.carpetRow(r, D, diff, used, emit);
        return;
      }
      emit({ kind: 'trave', lane: 1, d: D + 10, len: DUCK.BEAM_LEN });
      this.carpetRow(r, D, diff, used, emit);
      return;
    }
    // ---- v5s6: ostacolo tipico dell'ambiente (fuori dal sentiero sicuro) ----
    // v5s34: zona 3: una corsia si puo' ancora bloccare? (fila permessa; se il sentiero e' su una corsia
    // esterna, al massimo un'altra corsia bloccata: mai obbligare a uno scarto di due corsie)
    const z3can = (l) => {
      if (!z3) return true;
      if (!z3ok) return false;
      if (this.path !== 0 && this.path !== L - 1) return true;
      for (let k = 0; k < L; k++) if (k !== this.path && k !== l && (used[k] || this.blockedUntil[k] >= r)) return false;
      return true;
    };
    let z3hit = false;
    if (diff >= BO.FROM && r >= this.nextBiomeAt && z3ok && rng() < lerp(BO.P_START, BO.P_END, diff)) {
      const kind = BIOME_OBST_KIND[biomeIdAt(D, this.offM)];
      const free = [];
      for (let l = 0; l < L; l++) if (!required[l] && !used[l] && this.blockedUntil[l] < r && this.laneCool[l] < r && z3can(l)) free.push(l);
      if (kind && free.length) {
        const span = kind === 'rollin' ? BO.ROLL_ROWS + 1 : kind === 'sasso' ? Math.ceil((speedAt(D) * BO.ROCK_LEAD_S + 40) / ROW) + 2 : 3;
        const a0 = kind === 'sasso' ? r - span : r, end = r + (kind === 'sasso' ? 2 : span);
        // stessa estrazione di prima: la prenotazione toglie solo l'oggetto, non il consumo di rng ne' il blocco di corsia
        const l = rng.pick(free);
        const typ = kind === 'sasso' ? 'jump' : 'lane';
        const paceD = kind === 'rollin' ? D + BO.ROLL_ROWS * ROW : D + 8;
        const place = this.rockOk(l, a0, end) && this.paceOk(typ, paceD, l);
        this.rockTake(l, a0, end);
        if (place) this.paceTake(typ, paceD, l);
        this.nextBiomeAt = r + Math.round((BO.MIN_GAP_ROWS + rng.int(0, 6)) * (z3 ? Z3.BIOME_GAP_K : 1));
        used[l] = true;
        if (z3) { z3hit = true; if (kind === 'rollin') z3mark(r + BO.ROLL_ROWS - 2); }
        if (kind === 'rollin') {
          // rotola verso il giocatore: la corsia resta riservata per le file che attraversa
          this.blockedUntil[l] = r + BO.ROLL_ROWS; this.laneCool[l] = r + BO.ROLL_ROWS + 1;
          const sweep = Math.ceil(336 * BO.ROLL_K / (1 + BO.ROLL_K)) + 12;
          if (place) emit({ kind, lane: l, d: D + BO.ROLL_ROWS * ROW, len: 14, sweep });
        } else {
          this.laneCool[l] = r + 1;
          if (place) emit({ kind, lane: l, d: D + 8, len: 14 });
        }
      }
    }

    // ---- ostacoli lunghi -------------------------------------------
    const canLong = (l) => !required[l] && !used[l] && this.blockedUntil[l] < r && z3can(l);
    const longK = z3 ? Z3.LONG_K : 1;
    if (diff >= DF.NARROW_FROM && rng() < (0.035 + 0.05 * diff) * longK) {
      const l = rng() < 0.5 ? 0 : L - 1;
      const rows = 3 + rng.int(0, Math.round(1 + 2 * diff));
      // v5s40: nel paese la strettoia era una casa sporgente dentro la corsia esterna (sembrava una casa fuori posto,
      // sempre piu' frequente dai giri successivi con la difficolta'): nel paese niente strettoie, le case restano a bordo via
      const inVillage = biomeIdAt(D, this.offM) === 'village' || biomeIdAt(D + rows * ROW, this.offM) === 'village';
      if (!inVillage && canLong(l) && !this.sideBlocks.some((b) => b.edge === l && b.until >= r)) {
        this.blockedUntil[l] = r + rows - 1;
        this.laneCool[l] = r + rows;
        used[l] = true; z3hit = true;
        const place = this.rockOk(l, r, r + rows) && this.paceOk('lane', D + 2, l);
        this.rockTake(l, r, r + rows);
        if (place) { this.paceTake('lane', D + 2, l); emit({ kind: 'narrow', lane: l, d: D + 2, len: rows * ROW - 6 }); }
      }
    }
    if (diff >= DF.GROUP_FROM && rng() < (0.04 + 0.06 * diff) * longK) {
      const l = rng.int(0, L - 1);
      if (canLong(l)) {
        this.blockedUntil[l] = r + 1;
        this.laneCool[l] = r + 2;
        used[l] = true; z3hit = true; z3mark(r + 1);
        const place = this.rockOk(l, r, r + 2) && this.paceOk('jump', D + 4, l);
        this.rockTake(l, r, r + 2);
        if (place) { this.paceTake('jump', D + 4, l); emit({ kind: 'botti', lane: l, d: D + 4, len: 2 * ROW - 10 }); }
      }
    }

    // ---- ostacoli corti --------------------------------------------
    const pObs = lerp(DF.OBSTACLE_P_START, DF.OBSTACLE_P_END, diff) * (z3 ? Z3.OBST_K : 1);
    const boost = r <= this.barrelBoostUntil;
    for (let l = 0; l < L; l++) {
      if (required[l] || used[l] || this.laneCool[l] >= r) continue;
      if (!z3can(l)) continue;
      if (rng() >= pObs * (boost ? 1.25 : 1)) continue;
      let kind;
      const k = rng();
      const village = biomeIdAt(D, this.offM) === 'village';   // v5s36: nel paese niente dischi d'acqua sulle pietre
      if (boost) kind = k < 0.6 ? 'botte' : k < 0.85 ? 'bottecoricata' : 'muretto';
      else if (!village && diff >= DF.PUDDLE_FROM && k < 0.14) kind = 'pozza';   // v5s36: pozze piu' rare anche fuori (prima 0.22)
      else if (k < 0.48) kind = 'muretto';
      else if (k < (nature ? 1 - NT.LOG_SHARE : 0.8)) kind = 'botte';
      else kind = 'bottecoricata';
      const len = SHORT_LEN[kind];
      used[l] = true; z3hit = true;
      this.laneCool[l] = r + 1;
      const typ = this.actionType(kind);
      const ed = D + Math.floor((ROW - len) / 2);
      const place = kind === 'pozza' || (this.rockOk(l, r, r + 1) && this.paceOk(typ, ed, l));
      if (kind !== 'pozza') this.rockTake(l, r, r + 1);
      if (place) { if (typ) this.paceTake(typ, ed, l); emit({ kind, lane: l, d: ed, len }); }
    }
    if (z3hit) z3mark(r);

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
