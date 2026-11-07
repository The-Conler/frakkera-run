// Misura la difficolta' per giro: velocita', densita' ostacoli e intervalli tra azioni obbligate
// (giocatore "pigro": cambia corsia / si abbassa solo quando e' davvero obbligato).
// Uso: node tools/difficulty_probe.mjs [seeds] > out.json
import { Generator, SOLID, SIDE_KINDS, speedAt } from '../src/systems/generator.js';
import { WORLD } from '../src/config.js';
import { biomeAt } from '../src/game/biomes/config.js';
const SEEDS = +(process.argv[2] || 150), LENGTH = 52000, CELL = 5, L = WORLD.LANES;
const MOVING = new Set(['goat', 'rollbarrel', 'maimoni', 'pecora', 'maialetto']);
const HELPERS = { pastore: 1, cane: 1, canepastore: 1 };
const DUCKABLE = new Set(['trave', 'fune', 'ramo', 'panni']);
const PASSABLE = new Set(['acqua', 'processione']);
const switchS = Math.log(20) / WORLD.LANE_EASE;
const lapOf = (px) => biomeAt(px / 10).lap;
const out = { laps: {} };
const lapStat = (k) => out.laps[k] || (out.laps[k] = { meters: 0, obstacles: 0, actions: 0, gaps: [], speedMin: 1e9, speedMax: 0 });
for (let s = 1; s <= SEEDS; s++) {
  const g = new Generator(s * 7919), ents = [];
  g.fillUntil(LENGTH, (e) => { if (!HELPERS[e.kind] && !SIDE_KINDS[e.kind] && e.kind !== 'falo') ents.push(e); });
  const n = Math.ceil(LENGTH / CELL) + 10;
  const blocked = Array.from({ length: L }, () => new Uint8Array(n));
  const ducks = [];
  for (const e of ents) {
    if (e.pickup || MOVING.has(e.kind) || PASSABLE.has(e.kind) || (e.kind === 'fuso' && e.idle)) continue;
    if (DUCKABLE.has(e.kind)) { ducks.push(e.d); continue; }
    if (SOLID[e.kind] === undefined && e.kind !== 'pozza') continue;
    lapStat(lapOf(e.d)).obstacles++;
    const d0 = e.kind === 'rollin' ? e.d - e.sweep : e.d;
    const c0 = Math.max(0, Math.floor(d0 / CELL) - 1), c1 = Math.ceil((e.d + e.len) / CELL) + 1;
    for (let c = c0; c <= c1 && c < n; c++) blocked[e.lane][c] = 1;
  }
  const Kat = (c) => Math.ceil(switchS * speedAt(c * CELL) / CELL) + 1;
  // backward DP: minimo numero di cambi corsia da (c,l) alla fine
  const INF = 1e9, best = Array.from({ length: L }, () => new Float64Array(n).fill(INF));
  const end = n - 40;
  for (let l = 0; l < L; l++) for (let c = end; c < n; c++) best[l][c] = 0;
  for (let c = end - 1; c >= 0; c--) {
    const K = Kat(c);
    for (let l = 0; l < L; l++) {
      if (blocked[l][c]) continue;
      let b = blocked[l][c + 1] ? INF : best[l][c + 1];
      for (const d of [-1, 1]) {
        const t = l + d; if (t < 0 || t >= L || c + K >= n) continue;
        let free = true; for (let k = 0; k <= K; k++) if (blocked[l][c + k] || blocked[t][c + k]) { free = false; break; }
        if (free && best[t][c + K] + 1 < b) b = best[t][c + K] + 1;
      }
      best[l][c] = b;
    }
  }
  // giocatore pigro
  const acts = []; let l = 1, c = Math.floor(WORLD.LEAD_IN / CELL);
  while (c < end) {
    if (!blocked[l][c + 1] && best[l][c + 1] <= best[l][c]) { c++; continue; }
    const K = Kat(c); let moved = false;
    for (const d of [-1, 1]) { const t = l + d; if (t < 0 || t >= L) continue; if (best[t][c + K] + 1 === best[l][c]) { let free = true; for (let k = 0; k <= K; k++) if (blocked[l][c + k] || blocked[t][c + k]) free = false; if (free) { acts.push(c * CELL); l = t; c += K; moved = true; break; } } }
    if (!moved) { c++; }
  }
  for (const d of ducks) acts.push(d);
  acts.sort((a, b) => a - b);
  for (let i = 1; i < acts.length; i++) {
    const a = acts[i - 1], b = acts[i], sp = speedAt((a + b) / 2), st = lapStat(lapOf(b));
    st.gaps.push((b - a) / sp);
  }
  for (const a of acts) lapStat(lapOf(a)).actions++;
}
for (let m = 0; m < LENGTH / 10; m += 5) { const st = lapStat(lapOf(m * 10)); const sp = speedAt(m * 10) / 10; st.speedMin = Math.min(st.speedMin, sp); st.speedMax = Math.max(st.speedMax, sp); }
const res = {};
for (const [k, st] of Object.entries(out.laps)) {
  const g = st.gaps.sort((a, b) => a - b), q = (p) => g[Math.floor(p * (g.length - 1))];
  const meters = Math.min(1600, LENGTH / 10 - k * 1600) * SEEDS;
  res['giro ' + (+k + 1)] = { speed_ms: [+st.speedMin.toFixed(1), +st.speedMax.toFixed(1)], obst_per_100m: +(100 * st.obstacles / meters).toFixed(1), actions_per_100m: +(100 * st.actions / meters).toFixed(1),
    gap_p5_s: +q(0.05).toFixed(2), gap_median_s: +q(0.5).toFixed(2), under_0_5s_pct: +(100 * g.filter((x) => x < 0.5).length / g.length).toFixed(1), under_0_65s_pct: +(100 * g.filter((x) => x < 0.65).length / g.length).toFixed(1), gap_min_s: +g[0].toFixed(2) };
}
if (process.env.HIST) { const g = out.laps[2].gaps; const h = new Array(12).fill(0); for (const x of g) h[Math.min(11, Math.floor(x / 0.25))]++; console.log(JSON.stringify(h.map((v) => v / g.length))); } else console.log(JSON.stringify(res, null, 1));
