// Verifica automatica del generatore, su molti seed:
// 1) il percorso e' SEMPRE percorribile SENZA usare la pistola (esiste una
//    sequenza di corsie che evita ogni ostacolo, pozzanghere comprese), con
//    cambi corsia fisicamente possibili alla velocita' massima;
// 2) materiali, tappeti e pistole non si sovrappongono mai a un ostacolo;
// 3) ogni pistola e' raggiungibile; i tappeti sono raggiungibili;
// 4) dopo un tappeto fuori dal sentiero la corsia resta libera (niente trappole).
// Uso: node tests/generator.test.mjs
import { Generator, SOLID } from '../src/systems/generator.js';
import { WORLD, DIFFICULTY } from '../src/config.js';

const CELL = 5;
const L = WORLD.LANES;
const SEEDS = 400;
const LENGTH = 60000; // px (6000 m)
const switchS = Math.log(20) / WORLD.LANE_EASE;               // cambio corsia al 95%
const switchPx = switchS * DIFFICULTY.SPEED_MAX;
const K = Math.ceil(switchPx / CELL) + 1;
const PAD = 1;
const MOVING = new Set(['goat', 'rollbarrel']);

let failures = 0, totalObs = 0, totalPick = 0, kinds = {}, carpetsReach = 0, carpetsTot = 0, pistols = 0;
for (let s = 1; s <= SEEDS; s++) {
  const g = new Generator(s * 7919);
  const ents = [];
  g.fillUntil(LENGTH, (e) => ents.push(e));
  const n = Math.ceil(LENGTH / CELL) + 10;
  const blocked = Array.from({ length: L }, () => new Uint8Array(n));
  for (const e of ents) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    if (e.pickup) { totalPick++; continue; }
    totalObs++;
    if (MOVING.has(e.kind)) continue; // verificati a parte: finestra calma
    const c0 = Math.max(0, Math.floor(e.d / CELL) - PAD), c1 = Math.ceil((e.d + e.len) / CELL) + PAD;
    for (let c = c0; c <= c1 && c < n; c++) blocked[e.lane][c] = 1;
  }
  let ok = true;
  // DP di raggiungibilita' (bitmask di corsie per cella)
  const reach = new Uint8Array(n);
  reach[0] = 0b010;
  for (let c = 0; c < n - K - 1; c++) {
    let next = 0;
    for (let l = 0; l < L; l++) {
      if (!(reach[c] >> l & 1)) continue;
      if (!blocked[l][c + 1]) next |= 1 << l;
      for (const d of [-1, 1]) {
        const t = l + d;
        if (t < 0 || t >= L) continue;
        let free = true;
        for (let k = 0; k <= K; k++) if (blocked[l][c + k] || blocked[t][c + k]) { free = false; break; }
        if (free) for (let k = 1; k <= K; k++) reach[c + k] |= 1 << t;
      }
    }
    reach[c + 1] |= next;
    if (!reach[c + 1]) { ok = false; console.log(`seed ${s}: bloccato a ${c * CELL}px`); break; }
  }
  for (const e of ents) {
    if (!e.pickup) continue;
    // controllo stretto: nessuna sovrapposizione reale (senza margine)
    for (const o of ents) {
      if (o.pickup || MOVING.has(o.kind) || o.lane !== e.lane) continue;
      if (o.d < e.d + e.len && o.d + o.len > e.d) { ok = false; console.log(`seed ${s}: ${e.kind} sovrapposto a ${o.kind} @${e.d}`); }
    }
    const cm = Math.floor((e.d + e.len / 2) / CELL);
    const reachable = cm < n && (reach[cm] >> e.lane & 1);
    if (e.kind === 'tappeto') { carpetsTot++; if (reachable) carpetsReach++; }
    if (e.kind === 'pistola') { pistols++; if (!reachable) { ok = false; console.log(`seed ${s}: pistola irraggiungibile @${e.d}`); } }
    if (e.kind === 'tappeto') {
      // la corsia deve restare libera per almeno 25 px dopo il tappeto
      const after = ents.find((o) => !o.pickup && !MOVING.has(o.kind) && o.lane === e.lane && o.d >= e.d + e.len && o.d < e.d + e.len + 25);
      if (after) { ok = false; console.log(`seed ${s}: trappola dopo un tappeto @${e.d} (${after.kind})`); }
    }
  }
  for (const e of ents.filter((x) => MOVING.has(x.kind))) {
    const near = ents.filter((x) => !x.pickup && x !== e && !MOVING.has(x.kind) && SOLID[x.kind] !== undefined &&
      x.d + x.len > e.d - 2 * WORLD.ROW && x.d < e.d + 2 * WORLD.ROW);
    if (near.length) { ok = false; console.log(`seed ${s}: ostacolo vicino a ${e.kind} @${e.d}`); }
  }
  if (!ok) failures++;
}
console.log(`seed testati: ${SEEDS}, metri per seed: ${LENGTH / 10}, ostacoli: ${totalObs}, pickup: ${totalPick}`);
console.log('tipi:', JSON.stringify(kinds));
console.log(`tappeti raggiungibili: ${(100 * carpetsReach / carpetsTot).toFixed(2)}%  pistole: ${pistols} (tutte raggiungibili)`);
console.log(failures === 0 ? 'OK: nessun percorso impossibile (senza pistola), nessuna sovrapposizione, nessuna trappola' : `FALLITO: ${failures} seed con problemi`);
process.exit(failures === 0 ? 0 : 1);
