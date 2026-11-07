// v5 stage 24: Santa Marta attraversata: navata libera da ostacoli e falo', tappeti si', deterministico, geometria in strada
// Uso: node tests/sim-santamarta.test.mjs
import { Generator, santaMartaAt, SOLID, MASK_KINDS } from '../src/systems/generator.js';
import { WORLD, PX_PER_METER, SANTAMARTA } from '../src/config.js';
import { BIOMES, CYCLE } from '../src/game/biomes/config.js';
import { buildSantaMarta, SM } from '../src/game/biomes/builders/santamarta.js';
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const genAll = (seed, rows) => { const g = new Generator(seed), out = []; g.fillUntil(WORLD.LEAD_IN + rows * WORLD.ROW, (e) => out.push(e)); return out; };
const v = BIOMES.find((b) => b.id === SANTAMARTA.BIOME);
ok('facciata dentro il paese', SANTAMARTA.FROM_M < v.to - v.from);
ok('santaMartaAt', santaMartaAt(v.from + SANTAMARTA.FROM_M + 1)?.lap === 0 && !santaMartaAt(v.from + SANTAMARTA.FROM_M - 20) && santaMartaAt(CYCLE + v.from + SANTAMARTA.FROM_M + 5)?.lap === 1);
for (const seed of [3, 17, 99]) {
  const a = genAll(seed, 2500), b = genAll(seed, 2500);
  ok('deterministico ' + seed, JSON.stringify(a) === JSON.stringify(b));
  const inNave = a.filter((e) => santaMartaAt(e.d / PX_PER_METER, SANTAMARTA.LEAD_M - 2, 0));
  const bad = inNave.filter((e) => !MASK_KINDS[e.kind] && SOLID[e.kind] || e.kind === 'falo' || e.kind === 'pozza' || e.kind === 'trave');
  ok('navata libera, salvo il corteo delle maschere (seed ' + seed + ')', bad.length === 0, bad.map((e) => e.kind).join(','));
  ok('niente pickup ne maschere nella navata (seed ' + seed + ')', !inNave.some((e) => e.kind === 'tappeto' || e.pickup || MASK_KINDS[e.kind]), inNave.map((e) => e.kind).join(','));
}
const g = buildSantaMarta(1); g.computeBoundingBox(); const bb = g.boundingBox;
ok('la navata contiene la strada', SM.HW >= 6 && bb.min.x < -6 && bb.max.x > 6 && bb.min.z <= -SANTAMARTA.LEN_M + 0.5);
ok('low-poly', g.attributes.position.count < 60000, g.attributes.position.count);
if (fail) { console.log(fail + ' FAIL'); process.exit(1); } console.log('sim-santamarta ok');
