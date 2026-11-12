// feat-village: panni della nonna, tessitrice, processione di Santa Marta, paesani alle finestre.
// Uso: node tests/village-feat.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator, SOLID, biomeIdAt } from '../src/systems/generator.js';
import { WORLD, VILLAGE, FUEL } from '../src/config.js';
import { biomeAt } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const VK = { panni: 1, tessitrice: 1, processione: 1 };
const genAll = (seed, m) => { const g = new Generator(seed), out = []; g.fillUntil(m * 10, (e) => out.push(e)); return out; };
{
  const all = [], counts = { panni: 0, tessitrice: 0, processione: 0 }; let same = true, inVillage = true, side = true, laps = {};
  for (let s = 1; s <= 40; s++) {
    const a = genAll(s * 131, 6000).filter((e) => VK[e.kind]), b = genAll(s * 131, 6000).filter((e) => VK[e.kind]);
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
    for (const e of a) {
      counts[e.kind]++;
      if (biomeIdAt(e.d) !== 'village') inVillage = false;
      if (e.kind === 'tessitrice' && !(e.side === 0 && e.lane === 1)) side = false;   // v5s45 (15): in mezzo alla via
      if (e.kind === 'processione') { const k = s + ':' + biomeAt(e.d / 10).lap; laps[k] = (laps[k] || 0) + 1; }
    }
    all.push(...a);
  }
  ok('deterministico (flusso vrng)', same);
  ok('niente panni in paese, tessitrice e processione ci sono', counts.panni === 0 && counts.tessitrice > 0 && counts.processione > 0, JSON.stringify(counts));
  ok('solo nel paese', inVillage);
  ok('tessitrice in mezzo alla via (corsia 1)', side);
  ok('processione rara: al massimo una per giro', Object.values(laps).every((n) => n === 1), `${counts.processione} su 40 seed x 6000 m`);
  ok('panni e processione non fermano (SOLID false)', SOLID.panni === false && SOLID.processione === false);
  // lo stesso seed senza la vita del paese ha la stessa strada fuori dal paese
}
function base(off = 0) { const fx = []; const sim = new Sim((t, d) => fx.push([t, d]), { mapOffsetM: off }); sim.startRun(5); for (let i = 0; i < 60; i++) sim.tick(DT); sim.entities = []; sim.gen.fillUntil = () => {}; return { sim, fx }; }
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
const run = (sim, n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); sim.tick(DT); } };
{ // panni: abbassandosi si passa
  const { sim } = base(); const p = put(sim, { kind: 'panni', lane: 1, len: 10 }, 60);
  run(sim, 200, () => { if (p.d - sim.T < 30 && sim.duckT <= 0 && !p.hit) sim.duck?.(); sim.fuel = 100; });
  ok('panni: abbassandosi (log vL)', p.ducked && sim.stats.laundry === 1 && sim.events.some((e) => e[1] === 'vL') && sim.stats.hits === 0);
}
{ // panni: senza abbassarsi si prende in pieno
  const { sim } = base(); put(sim, { kind: 'panni', lane: 1, len: 10 }, 60); const f0 = sim.fuel;
  run(sim, 200);
  ok('panni: in pieno = urto', sim.stats.hits === 1 && sim.events.some((e) => e[1] === 'h' && e[2] === FUEL.HIT_BEAM));
}
{ // v5s45 (15): tessitrice schivata (corsia laterale): applauso e un tappeto
  const { sim, fx } = base(); sim.targetLane = 0; sim.lane = 0; sim.px = -WORLD.LANE_W;
  const w = put(sim, { kind: 'tessitrice', lane: 1, side: 0, len: VILLAGE.WEAVER_LEN }, 80); const c0 = sim.carpetTotal, s0 = sim.score;
  run(sim, 200);
  ok('tessitrice: tappeto bonus (log vW)', w.thrown && sim.stats.weaverCarpets === 1 && sim.stats.carpets === 1 && sim.events.some((e) => e[1] === 'vW') && sim.score - s0 >= VILLAGE.WEAVER_PTS);
  ok('tessitrice: effetto e nessun urto', fx.some((x) => x[0] === 'weaverThrow') && sim.stats.hits === 0);
}
{ const { sim } = base(); sim.carpetTotal = 12; const w = put(sim, { kind: 'tessitrice', lane: 1, side: 0, len: VILLAGE.WEAVER_LEN }, 80); run(sim, 200);
  ok('tessitrice: in pieno dalla corsia centrale niente tappeto, se ne perdono', !w.thrown && w.hit && sim.stats.carpetsLost === 3 && sim.carpetTotal === 9); }
{ // processione: urto = fuoco, non morte, niente frenata
  const { sim } = base(); const p = put(sim, { kind: 'processione', lane: 1, len: VILLAGE.PROC_LEN }, 60);
  let minF = 99; run(sim, 220, () => { if (!p.hit) sim.fuel = 5; else minF = Math.min(minF, sim.fuel + 0.5); if (p.hit && minF < 99) sim.fuel = Math.max(sim.fuel, 0.95); });
  ok('processione: urto (log vI), fuoco mai sotto 1', p.hit && sim.stats.procHits === 1 && sim.events.some((e) => e[1] === 'vI' && e[2] <= 4) && minF >= 0.9 && sim.mode === 'run', `fuoco min ${minF.toFixed(2)}`);
  ok('processione: non conta come urto solido', sim.stats.hits === 0);
}
{ const { sim } = base(); sim.targetLane = 0; sim.lane = 0; sim.px = -WORLD.LANE_W; const p = put(sim, { kind: 'processione', lane: 1, len: VILLAGE.PROC_LEN }, 60);
  run(sim, 260, () => { sim.fuel = 100; });
  ok('processione schivata: VIVA SANTA MARTA (log vi)', p.done && !p.hit && sim.stats.procClean === 1 && sim.events.some((e) => e[1] === 'vi')); }
{ // finestre: scia di tappeti nel paese fuori dalla festa
  const { sim, fx } = base(180);
  for (let i = 0; i < VILLAGE.CHEER_STREAK; i++) put(sim, { kind: 'tappeto', lane: 1, len: 8, pickup: true }, 40 + i * 14);
  run(sim, 240, () => { sim.fuel = 100; });
  ok('scia nel paese: esultano dalle finestre (log vV)', sim.stats.windowCheers === 1 && sim.events.some((e) => e[1] === 'vV') && fx.some((x) => x[0] === 'windowCheer'), `${sim.stats.carpets} tappeti`);
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK');
process.exit(fail ? 1 : 0);
