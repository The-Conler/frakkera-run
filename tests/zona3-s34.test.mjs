// v5s34: zona 3 (dal terzo giro) giusta: velocita' sotto il tetto, almeno ZONE3.MIN_GAP_S tra due
// file di ostacoli (azioni obbligate), mai due corsie bloccate col sentiero su una corsia esterna,
// e il percorso resta sempre percorribile. Uso: node tests/zona3-s34.test.mjs
import { Generator, SOLID, SIDE_KINDS, speedAt, ZONE3_FROM_M, cartAt } from '../src/systems/generator.js';
import { WORLD, ZONE3, DIFFICULTY } from '../src/config.js';
const SEEDS = +(process.env.SEEDS || 300), ROW = WORLD.ROW, FROM = ZONE3_FROM_M * 10, TO = FROM + 16000;
const MOVING = new Set(['goat', 'rollbarrel', 'maimoni', 'pecora', 'maialetto', 'caprarupe']);
const ACTION = (e) => !e.pickup && !SIDE_KINDS[e.kind] && !MOVING.has(e.kind) && e.kind !== 'falo' && e.kind !== 'acqua' && e.kind !== 'processione' && !(e.kind === 'fuso' && e.idle) && e.kind !== 'deadend' && (SOLID[e.kind] !== undefined || e.kind === 'pozza');
let fail = 0, pairs = 0, minS = Infinity;
// 1) velocita': mai sopra il tetto della zona, e uguale a prima fuori zona
for (let px = FROM; px < TO + 40000; px += 50) { const v = speedAt(px); if (v > ZONE3.SPEED_CAP_MAX + 1e-9 && px > FROM + ZONE3.EASE_M * 10) { fail++; console.log('velocita oltre il tetto', px, v); break; } }
if (speedAt(FROM - 10) > DIFFICULTY.SPEED_MAX) fail++;
for (let s = 1; s <= SEEDS; s++) {
  const g = new Generator(s * 7919), ents = [];
  g.fillUntil(TO + 400, (e) => ents.push(e));
  const rowOf = (e) => Math.floor((e.d - WORLD.LEAD_IN) / ROW);
  const rows = [...new Set(ents.filter((e) => ACTION(e) && e.d >= FROM + 300 && e.d < TO && !cartAt(e.d / 10, 4, 4)).map((e) => (e.kind === 'rollin' ? null : rowOf(e))).filter((r) => r !== null))].sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i++) {
    const D = WORLD.LEAD_IN + rows[i] * ROW, t = ((rows[i] - rows[i - 1]) * ROW) / speedAt(D);
    pairs++; minS = Math.min(minS, t);
    if (t < ZONE3.MIN_GAP_S - 0.01) { fail++; if (fail < 8) console.log(`seed ${s}: file a ${t.toFixed(2)} s @${D}`); }
  }
  // 2) niente doppio scarto: con 2 corsie bloccate nella stessa fila, la libera e' quella centrale
  const byRow = {};
  for (const e of ents) if (ACTION(e) && !['trave', 'fune', 'ramo', 'panni', 'rollin', 'narrow', 'botti'].includes(e.kind) && e.d >= FROM + 300 && e.d < TO) (byRow[rowOf(e)] ||= new Set()).add(e.lane);
  for (const [r, ls] of Object.entries(byRow)) if (ls.size >= 2 && ls.has(1)) { fail++; if (fail < 8) console.log(`seed ${s}: doppio scarto alla fila ${r} (${[...ls]})`); }
}
console.log(`zona 3: ${SEEDS} seed, ${pairs} intervalli tra file di ostacoli, minimo ${minS.toFixed(2)} s (richiesto ${ZONE3.MIN_GAP_S} s)`);
console.log(fail ? `FALLITO: ${fail} problemi` : 'OK: zona 3 con ritmo leggibile e velocita sotto il tetto');
process.exit(fail ? 1 : 0);
