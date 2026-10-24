// v5 stage 5: un colpo della pistola Broccu fa scappare la capra che attraversa la strada.
// Deterministico (passo fisso), registrato nel log ('g'), bonus SCORE.GOAT, la capra non e' piu' un ostacolo.
// Uso: node tests/sim-goat.test.mjs
import { Sim, laneX } from '../src/game/sim.js';
import { SCORE, WORLD, PISTOL } from '../src/config.js';

function scenario() {
  const fx = [];
  const sim = new Sim((t, d) => fx.push(t));
  sim.startRun(424242);
  for (let i = 0; i < 120; i++) sim.tick(WORLD.FIXED_DT);
  // strada libera davanti, poi una capra che sta attraversando proprio davanti al giocatore
  sim.entities = sim.entities.filter((e) => e.d < sim.T - 50 || e.d > sim.T + 400);
  sim.gen.fillUntil = () => {};                       // niente altri ostacoli nel test
  sim.spawn({ kind: 'goat', d: sim.T - sim.genOffset + 140, len: 14, lane: 1, dir: 1, vx: 0 });
  const goat = sim.entities[sim.entities.length - 1]; goat.x = sim.px - 5; goat.vx = 0;
  sim.ammo = PISTOL.AMMO; sim.fireCd = 0;
  const fired = sim.fire();
  let hitsBefore = sim.stats.hits;
  for (let i = 0; i < 400; i++) sim.tick(WORLD.FIXED_DT);
  return { sim, goat, fired, fx, hitsBefore };
}
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const a = scenario(), b = scenario();
ok('colpo sparato', a.fired);
ok('capra colpita e messa in fuga (done/scared)', a.goat.done && a.goat.scared);
ok('stats.goats = 1', a.sim.stats.goats === 1, String(a.sim.stats.goats));
const ev = a.sim.events.find((e) => e[1] === 'g');
ok('evento g nel log con il bonus', ev && ev[2] === SCORE.GOAT, JSON.stringify(ev));
ok('nessun urto con la capra dopo il colpo', a.sim.stats.hits === a.hitsBefore, `${a.hitsBefore} -> ${a.sim.stats.hits}`);
ok('effetto grafico goatScared emesso', a.fx.includes('goatScared'));
ok('deterministico (stesso log in due esecuzioni)', JSON.stringify(a.sim.events) === JSON.stringify(b.sim.events));
ok('bonus capra minore di una botte', SCORE.GOAT > 0 && SCORE.GOAT < SCORE.BARREL);
console.log(fail ? `FALLITO: ${fail}` : 'OK: la pistola fa scappare la capra');
process.exit(fail ? 1 : 0);
