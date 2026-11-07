// v5 stage 26: la capra scesa dalla roccia si colpisce con la pistola: +10, corsia libera, log 'aS', deterministico
import { Sim } from '../src/game/sim.js';
import { WORLD, ANIMALS } from '../src/config.js';
let fail = 0; const ok = (n, c, i = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (i ? ` [${i}]` : '')); if (!c) fail++; };
function run() {
  const fx = []; const s = new Sim((t, d) => fx.push(t), { mapOffsetM: 260 }); s.startRun(11); s.gen.fillUntil = () => {};
  for (let i = 0; i < 30; i++) { s.entities = []; s.fuel = 100; s.tick(WORLD.FIXED_DT); }
  s.ammo = 3; s.entities = []; const e = { kind: 'caprarupe', lane: 1, side: 1, d: s.T + 90 - s.genOffset, len: 12, animal: 1 }; s.spawn(e); s.entities.push(e);
  s.px = 0; const sc0 = s.score; let fired = false;
  for (let i = 0; i < 240 && !e.done; i++) { s.fuel = 100; s.px = s.entX(e) + 5; if (!fired) fired = s.fire(); s.tick(WORLD.FIXED_DT); }
  return { s, e, fx, sc0 };
}
const a = run(), b = run();
ok('colpita', a.e.done && a.e.scared && a.s.stats.hits === 0);
ok('log aS', a.s.events.some((v) => v[1] === 'aS' && v[2] === ANIMALS.ROCKGOAT_SHOT_PTS));
ok('fugge di lato', a.fx.includes('rockGoatFlee') && a.fx.includes('goatScared'));
ok('deterministico', JSON.stringify(a.s.events) === JSON.stringify(b.s.events));
if (fail) process.exit(1); console.log('goat-shot-s26 ok');
