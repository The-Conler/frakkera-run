// v5 stage 24: calamita, scudo di finocchio, scarponi del calzolaio, ramo caduto.
// Uso: node tests/sim-power.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator } from '../src/systems/generator.js';
import { biomeAt } from '../src/game/biomes/config.js';
import { WORLD, POWER, PX_PER_METER } from '../src/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const PW = { calamita: 1, finocchio: 1, scarponi: 1 };
const genAll = (seed, rows, patch) => { const g = new Generator(seed); if (patch) patch(g); const out = []; g.fillUntil(WORLD.LEAD_IN + rows * WORLD.ROW, (e) => out.push(e)); return out; };
{
  const a = genAll(777, 3000), b = genAll(777, 3000);
  const pa = a.filter((e) => PW[e.kind] || e.kind === 'ramo');
  ok('deterministico', JSON.stringify(pa) === JSON.stringify(b.filter((e) => PW[e.kind] || e.kind === 'ramo')));
  const pw = a.filter((e) => PW[e.kind]), br = a.filter((e) => e.kind === 'ramo');
  ok('potenziamenti rari (5-25 in 3000 file)', pw.length >= 5 && pw.length <= 25, pw.length);
  ok('tutti e tre i tipi su piu\' seed', new Set([...pw, ...genAll(12, 3000).filter((e) => PW[e.kind])].map((e) => e.kind)).size === 3);
  ok('rami solo su roccia/fiume', br.length > 0 && br.every((e) => POWER.BRANCH_BIOMES.includes(biomeAt(e.d / PX_PER_METER).b.id)), br.length);
  const clash = br.filter((r) => a.some((e) => e !== r && !e.side && e.d < r.d + r.len + 5 && e.d + e.len > r.d - 5 && !['scambio', 'carrello'].includes(e.kind)));
  ok('ramo da solo sulla fila', clash.length === 0, clash.length);
  const base = genAll(777, 3000, (g) => { g.maybePower = () => {}; });
  ok('senza maybePower niente potenziamenti ne rami', base.every((e) => !PW[e.kind] && e.kind !== 'ramo' && e.kind !== 'acqua'));
}
const mk = () => { const sim = new Sim(() => {}); sim.startRun(5); for (let i = 0; i < 120; i++) sim.tick(DT); sim.clearEntities(); sim.gen.fillUntil = () => {}; return sim; };
const at = (sim, ahead) => sim.T - sim.genOffset + ahead;
{ // calamita
  const sim = mk();
  sim.spawn({ kind: 'calamita', lane: sim.targetLane, d: at(sim, 40), len: 12, pickup: true });
  for (let i = 0; i < 60; i++) sim.tick(DT);
  ok('calamita attiva 10 s', sim.stats.magnets === 1 && sim.magnetT > 8.5, sim.magnetT.toFixed(2));
  const other = [0, 1, 2].filter((l) => l !== sim.targetLane);
  for (const l of other) sim.spawn({ kind: 'tappeto', lane: l, d: at(sim, 200), len: 12, pickup: true });
  const c0 = sim.stats.carpets; for (let i = 0; i < Math.ceil(4 / DT); i++) sim.tick(DT);
  ok('tappeti da altre corsie attirati', sim.stats.carpets - c0 === 2, sim.stats.carpets - c0);
  ok('log G', sim.events.some((e) => e[1] === 'G'));
}
{ // finocchio
  const sim = mk(); sim.shield = 0;
  sim.spawn({ kind: 'finocchio', lane: sim.targetLane, d: at(sim, 40), len: 12, pickup: true });
  sim.spawn({ kind: 'muretto', lane: sim.targetLane, d: at(sim, 200), len: 12 });
  const f0 = sim.fuel; for (let i = 0; i < Math.ceil(4 / DT); i++) sim.tick(DT);
  ok('finocchio para un urto', sim.stats.fennelBlocks === 1 && sim.stats.hits === 0 && sim.fennelT === 0);
  ok('log I e W', sim.events.some((e) => e[1] === 'I') && sim.events.some((e) => e[1] === 'W'));
  const s2 = mk(); s2.fennelT = 0.01; for (let i = 0; i < 5; i++) s2.tick(DT);
  ok('finocchio scade', s2.fennelT === 0);
  void f0;
}
{ // scarponi
  const sim = mk(); const ref = mk();
  sim.spawn({ kind: 'scarponi', lane: sim.targetLane, d: at(sim, 30), len: 12, pickup: true });
  for (let i = 0; i < Math.ceil(1.2 / DT); i++) { sim.tick(DT); ref.tick(DT); }
  ok('scarponi: piu\' veloce', sim.bootsT > 0 && sim.currentSpeed > ref.currentSpeed * 1.15, `${sim.currentSpeed.toFixed(0)} vs ${ref.currentSpeed.toFixed(0)}`);
  for (let i = 0; i < Math.ceil(4 / DT); i++) sim.tick(DT);
  ok('scarponi: punti extra e fine', sim.stats.bootsPts >= POWER.BOOTS_PTS * 6 && sim.bootsT === 0, sim.stats.bootsPts);
}
{ // ramo
  const sim = mk(); sim.shield = 0;
  sim.spawn({ kind: 'ramo', lane: 1, d: at(sim, 60), len: 10 });
  let ducked = false;
  for (let i = 0; i < 120; i++) { const e = sim.entities[0]; if (!ducked && e && e.d - sim.T < 25) ducked = sim.duck(); sim.tick(DT); }
  ok('ramo: abbassandosi si passa', sim.stats.branches === 1 && sim.stats.hits === 0);
  const s2 = mk(); s2.shield = 0; s2.spawn({ kind: 'ramo', lane: 1, d: at(s2, 60), len: 10 });
  for (let i = 0; i < 120; i++) s2.tick(DT);
  ok('ramo: senza abbassarsi e\' un urto', s2.stats.hits === 1);
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK'); process.exit(fail ? 1 : 0);
