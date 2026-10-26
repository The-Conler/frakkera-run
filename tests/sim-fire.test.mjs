// v5 stage 16: frakkere accese a bordo strada (falo' e paesani). Sfiorandole nella corsia
// laterale la fiamma riprende fuoco: +FIRE.BONUS (tetto 100), punti, log 'F', una volta sola.
// Generate dal generatore con un flusso RNG separato: deterministiche.
// Uso: node tests/sim-fire.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator } from '../src/systems/generator.js';
import { WORLD, FIRE, FUEL } from '../src/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
function base(seed = 777) {
  const fx = [];
  const sim = new Sim((t, d) => fx.push([t, d]));
  sim.startRun(seed);
  for (let i = 0; i < 60; i++) sim.tick(DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  return { sim, fx };
}
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
const run = (sim, n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); sim.tick(DT); } };

// 1) sfiorata nella corsia laterale: +fuoco, punti, log, effetti
{
  const { sim, fx } = base();
  sim.targetLane = 0; sim.lane = 0; sim.px = -WORLD.LANE_W;
  const f = put(sim, { kind: 'falo', lane: 0, side: -1, len: 16, variant: 0 }, 80);
  run(sim, 5); sim.fuel = 50; const s0 = sim.score;
  run(sim, 200, () => {});
  const gain = sim.events.filter((e) => e[1] === 'F');
  ok('falo\': preso sfiorandolo (log F)', f.lit && gain.length === 1 && sim.stats.fires === 1);
  ok('falo\': fuoco +BONUS (meno il consumo)', sim.fuel > 50 + FIRE.BONUS - 8 && sim.fuel <= 50 + FIRE.BONUS, sim.fuel.toFixed(1));
  ok('falo\': punti', sim.score - s0 >= FIRE.PTS);
  ok('effetti: fireBonus, +FUOCO, suono', fx.some((x) => x[0] === 'fireBonus') && fx.some((x) => x[0] === 'popup' && x[1].text === '+FUOCO') && fx.some((x) => x[0] === 'sound' && x[1] === 'fireBonus'));
}
// 2) corsia centrale: niente bonus, niente urto
{
  const { sim } = base();
  const f = put(sim, { kind: 'falo', lane: 0, side: -1, len: 16, variant: 1 }, 80);
  run(sim, 200);
  ok('corsia centrale: nessun bonus e nessun urto', !f.lit && sim.stats.fires === 0 && sim.stats.hits === 0 && f.done);
}
// 3) tetto a FUEL.MAX
{
  const { sim } = base();
  sim.targetLane = 2; sim.lane = 2; sim.px = WORLD.LANE_W;
  put(sim, { kind: 'falo', lane: 2, side: 1, len: 16, variant: 0 }, 60);
  sim.fuel = 99; run(sim, 150);
  ok('tetto 100', sim.fuel <= FUEL.MAX && sim.stats.fires === 1);
}
// 4) generatore: deterministico e il flusso separato non cambia il resto del percorso
{
  const a = [], b = [];
  new Generator(4242).fillUntil(30000, (e) => a.push(e));
  new Generator(4242).fillUntil(30000, (e) => b.push(e));
  ok('generatore deterministico (frakkere comprese)', JSON.stringify(a) === JSON.stringify(b));
  const fires = a.filter((e) => e.kind === 'falo');
  const vil = fires.filter((e) => e.variant === 1).length;
  ok('frakkere presenti, falo\' e paesani', fires.length > 10 && vil > 0 && vil < fires.length, `${fires.length} (${vil} paesani)`);
}
// 5) partita lunga simulata: log riproducibile con le frakkere
{
  const play = () => {
    const sim = new Sim(() => {}); sim.startRun(9001);
    for (let i = 0; i < 120 * 40; i++) { sim.fuel = Math.max(sim.fuel, 60); sim.invuln = 1; if (i % 240 === 0) sim.targetLane = (i / 240) % 2 ? 0 : 2; sim.tick(DT); }
    return sim;
  };
  const s1 = play(), s2 = play();
  ok('replay identico (eventi)', JSON.stringify(s1.events) === JSON.stringify(s2.events));
  ok('in corsa si prendono frakkere', s1.stats.fires > 0, `${s1.stats.fires} prese, +${s1.stats.fireFuel.toFixed(0)} fuoco in ${s1.meters ?? ''}`);
}
console.log(fail ? `FALLITO: ${fail}` : 'OK: frakkere accese a bordo strada');
process.exit(fail ? 1 : 0);
