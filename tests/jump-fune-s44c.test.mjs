// v5s44c: la fune bassa (~0.5 m) si supera con un salto normale a piu' velocita'.
import { Sim } from '../src/game/sim.js';
import { WORLD, DUCK, MASKS, JUMP } from '../src/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0;
const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };

function base(seed = 777) {
  const sim = new Sim(() => {});
  sim.startRun(seed);
  for (let i = 0; i < 60; i++) sim.tick(DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  return sim;
}
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };

{
  const sim = base();
  const f = put(sim, { kind: 'fune', lane: 1, len: DUCK.BEAM_LEN }, 100);
  for (let i = 0; i < 250; i++) { sim.fuel = 100; sim.tick(DT); }
  ok('fune: senza salto ne accovacciata = urto', f.hit && !f.jumped && !f.ducked && sim.stats.hits >= 1);
}
{
  const speeds = [0, 400, 1600, 3200];   // metri di corsa -> velocita' crescente
  for (const meters of speeds) {
    const sim = base();
    sim.T = sim.genOffset + meters * 10;
    const f = put(sim, { kind: 'fune', lane: 1, len: DUCK.BEAM_LEN }, 160);
    let did = false;
    for (let i = 0; i < 400; i++) {
      sim.fuel = 100;
      if (!did && f.d - sim.T < (sim.currentSpeed || 80) * 0.32) did = sim.jump();
      sim.tick(DT);
    }
    ok(`fune: salto a ~${meters} m supera (jumpH max ${JUMP.H_PX} > ${MASKS.FUNE_CLEAR_PX})`,
      f.jumped && sim.stats.hits === 0 && !f.ducked, JSON.stringify({ jumped: f.jumped, hits: sim.stats.hits, ducked: f.ducked, speed: sim.currentSpeed?.toFixed(1) }));
  }
}
ok('clearance sotto l\'apice del salto', MASKS.FUNE_CLEAR_PX < JUMP.H_PX * 0.5);
if (fail) { console.log('jump-fune-s44c FAIL'); process.exit(1); }
console.log('jump-fune-s44c ok');
