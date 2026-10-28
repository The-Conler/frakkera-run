// Verifica automatica del generatore, su molti seed:
// 1) il percorso e' SEMPRE percorribile SENZA usare la pistola (esiste una
//    sequenza di corsie che evita ogni ostacolo, pozzanghere comprese), con
//    cambi corsia fisicamente possibili alla velocita' massima;
// 2) materiali, tappeti e pistole non si sovrappongono mai a un ostacolo;
// 3) ogni pistola e' raggiungibile; i tappeti sono raggiungibili;
// 4) dopo un tappeto fuori dal sentiero la corsia resta libera (niente trappole).
// Uso: node tests/generator.test.mjs
import { Generator, SOLID, SIDE_KINDS } from '../src/systems/generator.js';
import { WORLD, DIFFICULTY } from '../src/config.js';

const CELL = 5;
const L = WORLD.LANES;
const SEEDS = +(process.env.SEEDS || 400);
const LENGTH = 60000; // px (6000 m)
const switchS = Math.log(20) / WORLD.LANE_EASE;               // cambio corsia al 95%
const switchPx = switchS * DIFFICULTY.SPEED_MAX;
const K = Math.ceil(switchPx / CELL) + 1;
const PAD = 1;
const MOVING = new Set(['goat', 'rollbarrel', 'maimoni', 'pecora', 'maialetto']);   // v5s24: anche gregge e maialetto
const HELPERS = { pastore: 1, cane: 1, canepastore: 1 };   // v5s24: animali fuori dalle corsie / senza collisione
const DUCKABLE = new Set(['trave', 'fune']);   // v5s10: la fune degli Stramaionis si passa come la trave
import { biomeAt } from '../src/game/biomes/config.js';
let parades = 0; const paradeLaps = {};

import { FIRE } from '../src/config.js';
const totalMine = {};
let totalFires = 0, ok0 = true; const fireBiomes = {};
let failures = 0, totalObs = 0, totalPick = 0, kinds = {}, carpetsReach = 0, carpetsTot = 0, pistols = 0;
for (let s = 1; s <= SEEDS; s++) {
  const g = new Generator(s * 7919);
  const ents = [], beams = [];
  const fires = [];
  const mines = [];
  const helpers = [];
  const festa = [];   // v5s21: bancarelle, folla e festoni (provati in sim-festa)
  g.fillUntil(LENGTH, (e) => (HELPERS[e.kind] ? helpers : e.kind === 'falo' ? fires : ['bancarella', 'folla', 'festone'].includes(e.kind) ? festa : SIDE_KINDS[e.kind] ? mines : ents).push(e));
  for (const f of festa) if (biomeAt(f.d / 10).b.id !== 'village') { ok0 = false; console.log(`seed ${s}: ${f.kind} fuori dal paese @${f.d}`); }
  for (const m of mines) { totalMine[m.kind] = (totalMine[m.kind] || 0) + 1; const bid = biomeAt(m.d / 10).b.id; if (!bid.startsWith('mine') || (m.kind === 'lampada' && bid === 'mine-ext')) { ok0 = false; console.log(`seed ${s}: ${m.kind} fuori dalla miniera @${m.d} (${bid})`); } if (m.kind === 'minatore' && ents.some((o) => o.kind === 'narrow' && o.lane === m.lane && o.d < m.d + m.len && o.d + o.len > m.d)) { ok0 = false; console.log(`seed ${s}: minatore dentro la roccia @${m.d}`); } }
  // v5s16: frakkere a bordo strada: solo negli ambienti previsti, sul lato giusto, mai dentro una casa che sporge
  for (const f of fires) {
    totalFires++;
    const bid = biomeAt(f.d / 10).b.id, cfg = FIRE.BIOMES[bid];
    if (!cfg || !cfg.sides.includes(f.side)) { ok0 = false; console.log(`seed ${s}: falo' fuori posto @${f.d} (${bid} lato ${f.side})`); }
    if (f.lane !== (f.side < 0 ? 0 : L - 1)) { ok0 = false; console.log(`seed ${s}: falo' con corsia sbagliata @${f.d}`); }
    if (ents.some((o) => o.kind === 'narrow' && o.lane === f.lane && o.d < f.d + f.len && o.d + o.len > f.d)) { ok0 = false; console.log(`seed ${s}: falo' dentro una casa @${f.d}`); }
  }
  fireBiomes[fires.length ? 'con' : 'senza'] = (fireBiomes[fires.length ? 'con' : 'senza'] || 0) + 1;
  const n = Math.ceil(LENGTH / CELL) + 10;
  const blocked = Array.from({ length: L }, () => new Uint8Array(n));
  for (const e of ents) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    if (e.pickup) { totalPick++; continue; }
    totalObs++;
    if (MOVING.has(e.kind)) continue; // verificati a parte: finestra calma
    if (DUCKABLE.has(e.kind)) { beams.push(e); continue; }
    if (e.kind === 'fuso' && e.idle) continue;     // sa Grastula senza lancio: non ferma // si passa abbassandosi in qualunque corsia (controllata a parte)
    // botte / carrello che rotola verso il giocatore: occupa la corsia per tutto il tratto che percorre
    const d0 = e.kind === 'rollin' ? e.d - e.sweep : e.d;
    const c0 = Math.max(0, Math.floor(d0 / CELL) - PAD), c1 = Math.ceil((e.d + e.len) / CELL) + PAD;
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
      if (o.pickup || MOVING.has(o.kind) || DUCKABLE.has(o.kind) || o.lane !== e.lane) continue;
      if (o.d < e.d + e.len && o.d + o.len > e.d) { ok = false; console.log(`seed ${s}: ${e.kind} sovrapposto a ${o.kind} @${e.d}`); }
    }
    const cm = Math.floor((e.d + e.len / 2) / CELL);
    const reachable = cm < n && (reach[cm] >> e.lane & 1);
    if (e.kind === 'tappeto') { carpetsTot++; if (reachable) carpetsReach++; }
    if (e.kind === 'pistola') { pistols++; if (!reachable) { ok = false; console.log(`seed ${s}: pistola irraggiungibile @${e.d}`); } }
    if (e.kind === 'tappeto') {
      // la corsia deve restare libera per almeno 25 px dopo il tappeto
      const after = ents.find((o) => !o.pickup && !MOVING.has(o.kind) && !DUCKABLE.has(o.kind) && o.lane === e.lane && o.d >= e.d + e.len && o.d < e.d + e.len + 25);
      if (after) { ok = false; console.log(`seed ${s}: trappola dopo un tappeto @${e.d} (${after.kind})`); }
    }
  }
  for (const e of ents.filter((x) => MOVING.has(x.kind))) {
    const near = ents.filter((x) => !x.pickup && x !== e && !MOVING.has(x.kind) && SOLID[x.kind] !== undefined &&
      x.d + x.len > e.d - 2 * WORLD.ROW && x.d < e.d + 2 * WORLD.ROW);
    if (near.length) { ok = false; console.log(`seed ${s}: ostacolo vicino a ${e.kind} @${e.d}`); }
  }
  // v5s6: nessun ostacolo (fermo) sulla stessa fila della trave, in nessuna corsia: abbassarsi basta sempre
  for (const t of beams) {
    const clash = ents.find((o) => !o.pickup && o !== t && !DUCKABLE.has(o.kind) && !MOVING.has(o.kind) && o.d < t.d + t.len + 4 && o.d + o.len > t.d - 4 && o.kind !== 'rollin' && o.kind !== 'narrow');
    if (clash) { ok = false; console.log(`seed ${s}: ostacolo sotto la trave @${t.d} (${clash.kind})`); }
  }
  // v5s10: ogni corteo = Maimoni + fune + fuso (ultimo), tutti nel paese e nell'ordine giusto
  const groups = {};
  for (const e of ents) if (e.group) (groups[e.group] || (groups[e.group] = [])).push(e);
  for (const [gid, m] of Object.entries(groups)) {
    const ks = m.map((x) => x.kind).join(',');
    if (ks !== 'maimoni,fune,fuso' || !m[2].last) { ok = false; console.log(`seed ${s}: corteo ${gid} incompleto (${ks})`); }
    for (const x of m) if (biomeAt(x.d / 10).b.id !== 'village' && biomeAt((x.d - 400) / 10).b.id !== 'village') { ok = false; console.log(`seed ${s}: maschera fuori dal paese @${x.d}`); }
    parades++; const lap = biomeAt(m[0].d / 10).lap; paradeLaps[lap] = (paradeLaps[lap] || 0) + 1;
  }
  for (const e of ents) if (e.kind === 'fuso' && !e.idle && ents.some((o) => o !== e && !o.pickup && o.lane === e.lane && !MOVING.has(o.kind) && o.d < e.d + e.len + 2 && o.d + o.len > e.d - 2)) { ok = false; console.log(`seed ${s}: fuso sovrapposto @${e.d}`); }
  if (!ok || !ok0) failures++; ok0 = true;
}
console.log(`frakkere a bordo strada: ${totalFires} (${(totalFires / SEEDS).toFixed(1)} per seed su ${LENGTH / 10} m)`);
console.log(`miniera: ${JSON.stringify(totalMine)}`);
if (!totalMine.minatore || !totalMine.lampada) { console.log('FALLITO: niente minatori/lampade'); failures++; }
if (!totalFires) { console.log('FALLITO: nessuna frakkera'); failures++; }
console.log(`cortei di Gadoni: ${parades}  per giro: ${JSON.stringify(paradeLaps)}`);
if (!parades) { console.log('FALLITO: nessun corteo'); failures++; }
console.log(`seed testati: ${SEEDS}, metri per seed: ${LENGTH / 10}, ostacoli: ${totalObs}, pickup: ${totalPick}`);
console.log('tipi:', JSON.stringify(kinds));
console.log(`tappeti raggiungibili: ${(100 * carpetsReach / carpetsTot).toFixed(2)}%  pistole: ${pistols} (tutte raggiungibili)`);
console.log(failures === 0 ? 'OK: nessun percorso impossibile (senza pistola), nessuna sovrapposizione, nessuna trappola' : `FALLITO: ${failures} seed con problemi`);
process.exit(failures === 0 ? 0 : 1);
