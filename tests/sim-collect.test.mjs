// v5 stage 19: collezionabili rari (campanacci, facciole) e costume di su Stramaioni.
// Flusso RNG separato: il resto del percorso non cambia; raccolta registrata nel log ('k').
// Uso: node tests/sim-collect.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator } from '../src/systems/generator.js';
import { WORLD, COLLECT, SKINS } from '../src/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const genAll = (seed, rows) => { const g = new Generator(seed), out = []; g.fillUntil(WORLD.LEAD_IN + rows * WORLD.ROW, (e) => out.push(e)); return out; };

// 1) determinismo e rarita'
{
  const a = genAll(4242, 1500), b = genAll(4242, 1500);
  const ca = a.filter((e) => COLLECT.KINDS[e.kind]), cb = b.filter((e) => COLLECT.KINDS[e.kind]);
  ok('stesso seed: stessi collezionabili', JSON.stringify(ca) === JSON.stringify(cb), ca.length);
  ok('rari: tra 15 e 45 in 1500 file', ca.length >= 15 && ca.length <= 45, ca.length);
  ok('entrambi i tipi', ca.some((e) => e.kind === 'campanaccio') && ca.some((e) => e.kind === 'facciola'));
  // non sovrapposti ad altro nella stessa corsia e fila
  const clash = ca.filter((c) => a.some((e) => e !== c && e.lane === c.lane && !e.side && Math.abs(e.d - c.d) < 10 && !['falo', 'minatore', 'lampada', 'scambio', 'carrello'].includes(e.kind)));
  ok('mai sopra un altro oggetto', clash.length === 0, clash.length);
  // percorso principale invariato rispetto a un generatore senza collezionabili
  const g = new Generator(4242); g.maybeCollect = () => {}; const base = []; g.fillUntil(WORLD.LEAD_IN + 1500 * WORLD.ROW, (e) => base.push(e));
  const PW = (e) => ['calamita', 'finocchio', 'scarponi', 'ramo'].includes(e.kind);   // v5s24: hanno un flusso proprio, ma usano le celle libere
  ok('resto del percorso identico', JSON.stringify(base.filter((e) => !PW(e))) === JSON.stringify(a.filter((e) => !COLLECT.KINDS[e.kind] && !PW(e))));
}
// 2) raccolta: conteggio salvato, log, punti
{
  const saved = { bell: 0, sweet: 0 };
  const fx = [];
  const sim = new Sim((t, d) => fx.push([t, d]), { addCollectible: (k, n) => { saved[k] += n; return { ...saved }; } });
  sim.startRun(9); for (let i = 0; i < 60; i++) sim.tick(DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  sim.spawn({ kind: 'campanaccio', lane: 1, d: sim.T - sim.genOffset + 60, len: 12, pickup: true });
  sim.spawn({ kind: 'facciola', lane: 1, d: sim.T - sim.genOffset + 140, len: 12, pickup: true });
  const s0 = sim.score;
  for (let i = 0; i < 300; i++) sim.tick(DT);
  ok('campanaccio e facciola raccolti', sim.stats.bells === 1 && sim.stats.sweets === 1);
  ok('salvati subito', saved.bell === 1 && saved.sweet === 1);
  ok('log k', sim.events.filter((e) => e[1] === 'k').length === 2);
  ok('punti', sim.score - s0 >= 2 * COLLECT.PTS);
  ok('effetti', fx.some((x) => x[0] === 'collectible') && fx.some((x) => x[0] === 'popup' && x[1].text === 'CAMPANACCIO!'));
}
// 3) costume: su Stramaioni corre piu' veloce, registrato nel log
{
  const run = (skin) => { const sim = new Sim(); sim.skin = skin; sim.startRun(77); for (let i = 0; i < 600; i++) sim.tick(DT); return sim; };
  const a = run('base'), b = run('stramaioni');
  const k = SKINS.find((s) => s.id === 'stramaioni').speedK;
  ok('log S del costume', a.events.some((e) => e[1] === 'S' && e[2] === 0) && b.events.some((e) => e[1] === 'S' && e[2] === 1));
  ok('su Stramaioni piu veloce', b.runD > a.runD * (k - 0.02), `${a.runD.toFixed(0)} vs ${b.runD.toFixed(0)}`);
  const c = new Sim(); c.skin = 'boh'; c.startRun(1); ok('costume sconosciuto -> base', c.skin === 'base');
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK');
process.exit(fail ? 1 : 0);
