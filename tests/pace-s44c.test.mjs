// v5s44c: ritmo degli ostacoli su tutti i giri. Semi 12345, 7919, 15838 x 5 giri:
// niente accovacciate ravvicinate, niente salti ravvicinati in corsia, max 3 azioni nella finestra.
import { Generator, speedAt, SOLID, SIDE_KINDS, PICKUP_KINDS } from '../src/systems/generator.js';
import { PACE, WORLD } from '../src/config.js';

const CROUCH = { trave: 1, panni: 1, ramo: 1, fune: 1 };
const JUMPP = { botte: 1, bottecoricata: 1, muretto: 1, sasso: 1, botti: 1 };
function atype(k) {
  if (CROUCH[k]) return 'crouch';
  if (JUMPP[k]) return 'jump';
  if (PICKUP_KINDS[k] || SIDE_KINDS[k] || k === 'deadend') return null;
  if (SOLID[k] || k === 'processione') return 'lane';
  return null;
}

function analyze(seed, laps = 5) {
  const g = new Generator(seed);
  const ev = [];
  g.fillUntil((laps * 1600 + 80) * 10, (e) => ev.push(e));
  const items = ev.filter((e) => atype(e.kind)).sort((a, b) => a.d - b.d);
  let cc = 0, jj = 0;
  const lastC = { d: -1e9 }, lastJ = {};
  for (const e of items) {
    if (CROUCH[e.kind]) {
      if (lastC.d > 0 && e.d - lastC.d > 5 && (e.d - lastC.d) / Math.max(40, speedAt(lastC.d)) < PACE.SAME_S) cc++;
      lastC.d = e.d;
    }
    if (JUMPP[e.kind]) {
      const prev = lastJ[e.lane];
      if (prev != null && e.d - prev > 5 && (e.d - prev) / Math.max(40, speedAt(prev)) < PACE.SAME_S) jj++;
      lastJ[e.lane] = e.d;
    }
  }
  const waveKey = (d) => Math.floor((d + 0.01 - WORLD.LEAD_IN) / WORLD.ROW);
  const waves = [];
  for (const e of items) {
    if (!waves.length || waveKey(e.d) !== waveKey(waves[waves.length - 1].d)) waves.push(e);
  }
  let maxChain = 0;
  for (let i = 0; i < waves.length; i++) {
    let n = 1;
    for (let j = i + 1; j < waves.length; j++) {
      const dt = (waves[j].d - waves[i].d) / Math.max(40, speedAt(waves[i].d));
      if (dt < PACE.CHAIN_WINDOW_S) n++; else break;
    }
    if (n > maxChain) maxChain = n;
  }
  return { cc, jj, maxChain, n: items.length };
}

const seeds = [12345, 7919, 15838];
let fail = 0;
const rows = seeds.map((s) => analyze(s, 5));
for (const r of rows) {
  if (r.cc !== 0) { console.log('FAIL crouch pairs', r); fail++; }
  if (r.jj !== 0) { console.log('FAIL jump pairs', r); fail++; }
  if (r.maxChain > PACE.CHAIN_N) { console.log('FAIL max chain', r); fail++; }
}
const sum = rows.reduce((a, r) => ({ cc: a.cc + r.cc, jj: a.jj + r.jj, maxChain: Math.max(a.maxChain, r.maxChain) }), { cc: 0, jj: 0, maxChain: 0 });
if (fail) { console.log('pace-s44c FAIL', sum); process.exit(1); }
console.log('pace-s44c ok', { seeds, sum, same: PACE.SAME_S, window: PACE.CHAIN_WINDOW_S, chainN: PACE.CHAIN_N });
