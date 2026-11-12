// v5 stage 6: ostacoli d'ambiente (tutti distruttibili), trave bassa da passare abbassandosi,
// gradini di velocita' per ambiente. Tutto deterministico nella sim (passo fisso) e nel log.
// Uso: node tests/sim-s6.test.mjs
import { Sim } from '../src/game/sim.js';
import { speedAt } from '../src/systems/generator.js';
import { SCORE, WORLD, PISTOL, DUCK, SPEED_STEPS, DIFFICULTY } from '../src/config.js';

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
const keep = (sim) => { sim.fuel = 100; };
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
const run = (sim, n, f) => { for (let i = 0; i < n; i++) { keep(sim); if (f) f(i); sim.tick(DT); } };

// 1) trave bassa: senza abbassarsi = urto; abbassandosi al momento giusto = passa (log 'u')
{
  const { sim } = base(); const t = put(sim, { kind: 'trave', lane: 1, len: DUCK.BEAM_LEN }, 120);
  run(sim, 300);
  ok('trave: senza abbassarsi = urto (h)', t.hit && sim.stats.hits === 1 && sim.events.some((e) => e[1] === 'h'));
  const b = base(); const t2 = put(b.sim, { kind: 'trave', lane: 1, len: DUCK.BEAM_LEN }, 120);
  let ducked = false;
  run(b.sim, 300, () => { if (!ducked && t2.d - b.sim.T < b.sim.currentSpeed * 0.25) ducked = b.sim.duck(); });
  ok('trave: abbassato = passa senza urto (u)', t2.ducked && b.sim.stats.hits === 0 && b.sim.events.some((e) => e[1] === 'u'), JSON.stringify(b.sim.stats));
  ok('abbassata registrata negli input (D)', b.sim.inputs.some((x) => x[1] === 'D'));
  const c = base(); put(c.sim, { kind: 'trave', lane: 1, len: DUCK.BEAM_LEN }, 100);
  c.sim.ammo = 3; c.sim.fire(); run(c.sim, 200);
  ok('trave: non si distrugge con la pistola', c.sim.stats.obst === 0 && c.sim.stats.barrels === 0);
}
// 2) botte / carrello che rotola verso il giocatore + colpo
{
  const { sim } = base(); const r = put(sim, { kind: 'rollin', lane: 0, len: 14, sweep: 110 }, 400);
  const d0 = r.d; run(sim, 200);
  ok('rollin: si muove verso il giocatore', r.moving && r.d < d0 - 5, `${d0} -> ${r.d.toFixed(1)}`);
  const b = base(); const r2 = put(b.sim, { kind: 'rollin', lane: 1, len: 14, sweep: 110 }, 300);
  b.sim.ammo = PISTOL.AMMO; b.sim.fire(); run(b.sim, 200);
  ok('rollin: distrutto dalla pistola (o)', r2.destroyed && b.sim.events.some((e) => e[1] === 'o' && e[2] === SCORE.OBST_BIOME));
}
// 3) masso che cade: ombra prima, poi atterra ben prima del giocatore; colpibile
{
  const { sim, fx } = base(); const s = put(sim, { kind: 'sasso', lane: 1, len: 14 }, 500);
  let landedAhead = null;
  run(sim, 900, () => { if (s.landed && landedAhead === null) landedAhead = s.d - sim.T; });
  ok('sasso: cade con anticipo (>= 0.6 s di reazione)', landedAhead !== null && landedAhead >= sim.currentSpeed * 0.6, `${landedAhead && landedAhead.toFixed(0)} px`);
  ok('sasso: effetto rockFall emesso', fx.some((f) => f[0] === 'rockFall'));
  const b = base(); const s2 = put(b.sim, { kind: 'sasso', lane: 1, len: 14 }, 200);
  b.sim.ammo = PISTOL.AMMO; b.sim.fire(); run(b.sim, 200);
  ok('sasso: distrutto dalla pistola', s2.destroyed && b.sim.stats.obst === 1);
}
// 4) pietra bagnata: scivolata (cambio corsia lento), nessun danno; colpibile
{
  const { sim } = base(); const w = put(sim, { kind: 'bagnato', lane: 1, len: 14 }, 60);
  run(sim, 150);
  ok('bagnato: scivolata registrata (k), niente urto', w.hit && sim.stats.slips === 1 && sim.stats.hits === 0 && sim.events.some((e) => e[1] === 'k'));
  sim.slipT = 0.9; const x0 = sim.px; sim.move(1); for (let i = 0; i < 12; i++) sim.tick(DT);
  const slow = Math.abs(sim.px - x0);
  const b = base(); const y0 = b.sim.px; b.sim.move(1); for (let i = 0; i < 12; i++) b.sim.tick(DT);
  ok('bagnato: cambio corsia piu\' lento', slow < Math.abs(b.sim.px - y0) * 0.7, `${slow.toFixed(1)} vs ${Math.abs(b.sim.px - y0).toFixed(1)}`);
  const c = base(); const w2 = put(c.sim, { kind: 'bagnato', lane: 1, len: 14 }, 200);
  c.sim.ammo = PISTOL.AMMO; c.sim.fire(); run(c.sim, 200);
  ok('bagnato: frantumato dalla pistola', w2.destroyed && c.sim.stats.obst === 1);
}
// 5) gradini di velocita': uno per ogni ambiente nuovo, banner e log 'v'
{
  const fx = []; const sim = new Sim((t, d) => fx.push([t, d])); sim.startRun(99);
  sim.gen.fillUntil = () => {};
  let steps = 0;
  while (sim.runD < 16100) { sim.fuel = 100; sim.tick(DT); steps++; if (steps > 400000) break; }
  const ev = sim.events.filter((e) => e[1] === 'v').map((e) => e[2]);
  ok('gradini: 7 cambi d\'ambiente fino al paese (giro 2)', JSON.stringify(ev) === '[1,2,3,4,5,6,7]', JSON.stringify(ev));
  ok('banner PIU\' VELOCE! emesso', fx.filter((f) => f[0] === 'popup' && f[1].text === SPEED_STEPS.BANNER).length === 7);
  const t1600 = sim.runTime;
  ok('a 400 m gia\' piu\' veloce del vecchio giro 1 (> 130 px/s)', speedAt(4000) > 130, speedAt(4000).toFixed(1));
  ok('a 1600 m piu\' veloce di prima e sotto il tetto', speedAt(16000) > 200 && speedAt(16000) <= DIFFICULTY.SPEED_MAX, speedAt(16000).toFixed(1));
  ok('la velocita\' continua a salire nel giro 2', speedAt(24000) > speedAt(16000) - 0.01, speedAt(24000).toFixed(1));
  ok('tetto di velocita\' rispettato', speedAt(10 * 9000) <= DIFFICULTY.SPEED_MAX);
  console.log(`  info: 1600 m in ${t1600.toFixed(0)} s di corsa, velocita' ${speedAt(16000).toFixed(0)} px/s (prima ~175 a fine giro 1)`);
}
// 6) determinismo con i nuovi input
{
  const go = () => { const sim = new Sim(() => {}); sim.startRun(31337); let i = 0;
    while (i < 12000) { sim.fuel = 100; if (i % 400 === 100) sim.duck(); if (i % 333 === 7) sim.move(i % 2 ? 1 : -1); sim.tick(DT); i++; }
    return JSON.stringify([sim.events, sim.inputs, sim.T]); };
  ok('deterministico (stesso log con abbassate e cambi corsia)', go() === go());
}
console.log(fail ? `FALLITO: ${fail}` : 'OK: ostacoli d\'ambiente, travi e gradini di velocita\'');
process.exit(fail ? 1 : 0);
