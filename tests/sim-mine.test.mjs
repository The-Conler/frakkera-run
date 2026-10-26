// v5 stage 17: minatori di Funtana Raminosa e lampade a muro della miniera.
// Solo nella miniera, fuori dalle corsie (nessun urto), deterministici; le lampade si accendono
// quando il giocatore arriva a MINE.LAMP_ON_PX. Uso: node tests/sim-mine.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator } from '../src/systems/generator.js';
import { WORLD, MINE, PX_PER_METER } from '../src/config.js';
import { biomeAt } from '../src/game/biomes/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
{
  const a = [], b = [];
  new Generator(31337).fillUntil(20000, (e) => a.push(e));
  new Generator(31337).fillUntil(20000, (e) => b.push(e));
  const m = a.filter((e) => e.kind === 'minatore'), l = a.filter((e) => e.kind === 'lampada');
  ok('generatore deterministico (minatori e lampade)', JSON.stringify(a) === JSON.stringify(b));
  ok('minatori e lampade presenti', m.length > 5 && l.length > 10, `${m.length} minatori, ${l.length} lampade`);
  ok('solo nella miniera', [...m, ...l].every((e) => biomeAt(e.d / PX_PER_METER).b.id.startsWith('mine')));
  ok('lampade solo in galleria', l.every((e) => biomeAt(e.d / PX_PER_METER).b.id !== 'mine-ext'));
  ok('pose diverse', new Set(m.map((e) => e.variant)).size >= 3);
  ok('lampade alternate sui due lati', l.some((e) => e.side < 0) && l.some((e) => e.side > 0));
}
{
  const sim = new Sim(() => {}); sim.startRun(5); for (let i = 0; i < 60; i++) sim.tick(DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  const put = (e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
  sim.targetLane = 0; sim.lane = 0; sim.px = -WORLD.LANE_W;
  const lamp = put({ kind: 'lampada', lane: 0, side: -1, len: 6 }, 400), mn = put({ kind: 'minatore', lane: 0, side: -1, len: 10, variant: 3 }, 300);
  let litAhead = null;
  for (let i = 0; i < 900; i++) { sim.fuel = 100; sim.tick(DT); if (lamp.lit && litAhead === null) litAhead = lamp.d - sim.T; }
  ok('lampada si accende al passaggio', lamp.lit && litAhead !== null && litAhead <= MINE.LAMP_ON_PX && litAhead > MINE.LAMP_ON_PX - 10, litAhead && litAhead.toFixed(0));
  ok('minatore visto, nessun urto anche nella corsia laterale', mn.seen && sim.stats.hits === 0 && sim.stats.miners === 1 && sim.stats.lamps === 1);
}
console.log(fail ? `FALLITO: ${fail}` : 'OK: minatori e lampade della miniera');
process.exit(fail ? 1 : 0);
