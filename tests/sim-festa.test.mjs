// v5 stage 21: festa a Gadoni (bancarelle, festoni, folla che applaude). Flusso RNG separato,
// tutto fuori dalle corsie; applauso passando nella corsia laterale (log H), esultanza per le scie (log Y).
// Uso: node tests/sim-festa.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator, festaAt, SOLID } from '../src/systems/generator.js';
import { WORLD, FESTA, PX_PER_METER } from '../src/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const genAll = (seed, rows) => { const g = new Generator(seed), out = []; g.fillUntil(WORLD.LEAD_IN + rows * WORLD.ROW, (e) => out.push(e)); return out; };
const FK = { bancarella: 1, folla: 1, festone: 1 };
{
  const a = genAll(31, 1200), b = genAll(31, 1200);
  const fa = a.filter((e) => FK[e.kind]);
  ok('deterministico', JSON.stringify(fa) === JSON.stringify(b.filter((e) => FK[e.kind])), fa.length);
  ok('bancarelle, folla e festoni presenti', ['bancarella', 'folla', 'festone'].every((k) => fa.some((e) => e.kind === k)));
  ok('solo nel tratto in festa', fa.every((e) => festaAt(e.d / PX_PER_METER)), fa.filter((e) => !festaAt(e.d / PX_PER_METER)).length);
  ok('niente di solido (corsie leggibili)', fa.every((e) => !SOLID[e.kind]));
  ok('sempre sui marciapiedi o in alto', fa.every((e) => e.kind === 'festone' || (e.side && (e.lane === 0 || e.lane === 2))));
  // le bancarelle non si sovrappongono sullo stesso lato
  const st = fa.filter((e) => e.kind !== 'festone').sort((x, y) => x.d - y.d); let ov = 0;
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length && st[j].d < st[i].d + st[i].len; j++) if (st[j].side === st[i].side) ov++;
  ok('niente sovrapposizioni tra bancarelle e folla', ov === 0, ov);
}
function base() { const fx = []; const sim = new Sim((t, d) => fx.push([t, d])); sim.startRun(5); for (let i = 0; i < 60; i++) sim.tick(DT); sim.entities = []; sim.gen.fillUntil = () => {}; return { sim, fx }; }
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
{
  const { sim, fx } = base(); sim.targetLane = 0; sim.lane = 0; sim.px = -WORLD.LANE_W;
  const c = put(sim, { kind: 'folla', lane: 0, side: -1, len: 14, n: 4 }, 80); const s0 = sim.score;
  for (let i = 0; i < 200; i++) sim.tick(DT);
  ok('folla: applauso nella corsia laterale (log H)', c.cheered && sim.stats.cheers === 1 && sim.events.some((e) => e[1] === 'H'));
  ok('applauso: punti ed effetti', sim.score - s0 >= FESTA.PTS && fx.some((x) => x[0] === 'cheer') && fx.some((x) => x[0] === 'sound' && x[1] === 'cheer'));
  ok('nessun urto con folla', sim.stats.hits === 0);
}
{
  const { sim } = base(); const c = put(sim, { kind: 'folla', lane: 0, side: -1, len: 14, n: 4 }, 80);
  const b = put(sim, { kind: 'bancarella', lane: 2, side: 1, len: 24 }, 60);
  for (let i = 0; i < 200; i++) sim.tick(DT);
  ok('corsia centrale: niente applauso, niente urti', !c.cheered && sim.stats.hits === 0 && c.done && b.done);
}
{ // esultanza per la scia di tappeti nel tratto in festa
  const sim = new Sim(() => {}, { mapOffsetM: FESTA.FROM_M + 2 }); sim.startRun(3); for (let i = 0; i < 30; i++) sim.tick(DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  for (let i = 0; i < FESTA.STREAK; i++) put(sim, { kind: 'tappeto', lane: 1, len: 8, pickup: true }, 40 + i * 14);
  for (let i = 0; i < 240; i++) { sim.fuel = 100; sim.tick(DT); }
  ok('scia nella festa: la folla esulta (log Y)', sim.stats.roars === 1 && sim.events.some((e) => e[1] === 'Y'), `${sim.stats.carpets} tappeti`);
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK');
process.exit(fail ? 1 : 0);
