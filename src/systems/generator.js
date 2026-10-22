// =====================================================================
// Generatore procedurale del percorso.
// Garanzia di percorribilita' (SENZA usare la pistola): prima si traccia un
// "sentiero sicuro" (una corsia sempre libera che cambia al massimo di una
// corsia alla volta, con 2 file libere in entrambe le corsie durante il
// cambio), poi si piazzano ostacoli SOLO fuori dal sentiero. Gli ostacoli
// mobili compaiono solo in "finestre calme" senza altri ostacoli.
// Tappeti, combustibile e pistola si piazzano solo in celle libere.
// =====================================================================
import { DIFFICULTY as DF, WORLD, PX_PER_METER, CARPETS as CP, PISTOL } from '../config.js';
import { makeRng } from './rng.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export function difficultyAt(px) {
  const m = px / PX_PER_METER;
  return Math.pow(clamp01(m / DF.RAMP_METERS), DF.RAMP_EXP);
}

export function speedAt(px) {
  const d = difficultyAt(px);
  let s = lerp(DF.SPEED_START, DF.SPEED_END, d);
  const m = px / PX_PER_METER;
  if (m > DF.RAMP_METERS) s += (m - DF.RAMP_METERS) * DF.SPEED_OVERDRIVE;
  return Math.min(s, DF.SPEED_MAX);
}

// ostacoli che fermano il giocatore (la pozzanghera no: toglie solo fuoco)
export const SOLID = {
  muretto: true, botte: true, bottecoricata: true, botti: true, narrow: true, goat: true, rollbarrel: true, pozza: false,
};
// distruttibili con la pistola: tutte e sole le botti
export const DESTRUCTIBLE = { botte: true, bottecoricata: true, botti: true, rollbarrel: true };
export const PICKUP_KINDS = { asfodelo: 'fuel', ferula: 'fuel', tappeto: 'carpet', pistola: 'pistol' };

const SHORT_LEN = { muretto: 14, botte: 18, bottecoricata: 14, pozza: 13 };

export class Generator {
  constructor(seed, opts = {}) {
    this.rng = makeRng(seed);
    this.seed = seed;
    this.debugPistol = !!opts.debugPistol;
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
  }

  rowDist(r) { return WORLD.LEAD_IN + r * WORLD.ROW; }

  fillUntil(maxDist, emit) {
    while (this.rowDist(this.row) < maxDist) {
      this.genRow(this.row, emit);
      this.row++;
    }
  }

  genRow(r, emit) {
    const rng = this.rng;
    const L = WORLD.LANES;
    const ROW = WORLD.ROW;
    const D = this.rowDist(r);
    const diff = difficultyAt(D);
    const used = new Array(L).fill(false);
    for (let l = 0; l < L; l++) if (this.blockedUntil[l] >= r) used[l] = true;

    // ---- finestra calma con ostacolo mobile -------------------------
    if (r <= this.calmUntil) {
      this.maybePistol(r, D, used, emit);
      this.maybePickup(r, D, diff, used, emit, 0.45);
      this.carpetRow(r, D, diff, used, emit);
      return;
    }
    const longActive = this.blockedUntil.some((b) => b >= r);
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

    // ---- ostacoli lunghi -------------------------------------------
    const canLong = (l) => !required[l] && !used[l] && this.blockedUntil[l] < r;
    if (diff >= DF.NARROW_FROM && rng() < 0.035 + 0.05 * diff) {
      const l = rng() < 0.5 ? 0 : L - 1;
      const rows = 3 + rng.int(0, Math.round(1 + 2 * diff));
      if (canLong(l)) {
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
