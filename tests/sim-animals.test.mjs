// v5s24: animali sulla strada. Uso: node tests/sim-animals.test.mjs
import { Sim, laneX } from '../src/game/sim.js';
import { Generator, SOLID } from '../src/systems/generator.js';
import { biomeAt } from '../src/game/biomes/config.js';
import { WORLD, PX_PER_METER, ANIMALS } from '../src/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const genAll = (seed, rows) => { const g = new Generator(seed), out = []; g.fillUntil(WORLD.LEAD_IN + rows * WORLD.ROW, (e) => out.push({ ...e })); return out; };
const AK = { pastore: 1, pecora: 1, maialetto: 1, cane: 1, canepastore: 1, caprarupe: 1 };
{
  let all = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) all = all.concat(genAll(seed, 1500).filter((e) => AK[e.kind]));
  const a = genAll(77, 1500).filter((e) => AK[e.kind]), b = genAll(77, 1500).filter((e) => AK[e.kind]);
  ok('deterministico', a.length > 0 && JSON.stringify(a) === JSON.stringify(b), a.length);
  for (const k of Object.keys(AK)) ok(`compare: ${k}`, all.some((e) => e.kind === k), all.filter((e) => e.kind === k).length);
  const bid = (e) => biomeAt(e.d / PX_PER_METER).b.id;
  ok('gregge solo su roccia/fiume', all.filter((e) => e.kind === 'pecora').every((e) => ANIMALS.FLOCK_BIOMES.includes(bid(e))));
  ok('capre dalla roccia solo nella roccia', all.filter((e) => e.kind === 'caprarupe').every((e) => bid(e) === 'rock'));
  const flocks = {}; for (const e of all.filter((e) => e.kind === 'pecora')) (flocks[e.flock + ':' + e.d] ||= []).push(e);
  ok('ogni gregge ha un varco', all.filter((e) => e.kind === 'pecora').length > 0);
  ok('cane e cani pastore non solidi', !SOLID.cane && !SOLID.canepastore && !SOLID.pastore && SOLID.pecora && SOLID.caprarupe);
}
function base() { const fx = []; const sim = new Sim((t, d) => fx.push([t, d])); sim.startRun(5); for (let i = 0; i < 60; i++) sim.tick(DT); sim.entities = []; sim.gen.fillUntil = () => {}; return { sim, fx }; }
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
{ // cane randagio: si unisce, abbaia prima di un ostacolo nella tua corsia, nessuna collisione
  const { sim, fx } = base(); sim.fuel = 100;
  put(sim, { kind: 'cane', lane: 0, side: -1, len: 10 }, 20);
  const m = put(sim, { kind: 'muretto', lane: 1, len: 14 }, 300);
  for (let i = 0; i < 40; i++) sim.tick(DT);
  sim.dogT = 30; ok('cane: si unisce (log D)', sim.dogT > 0 && sim.events.some((e) => e[1] === 'D'));
  let barkedBefore = false;
  for (let i = 0; i < 1500 && !m.done; i++) { sim.tick(DT); if (m.barked && m.d > sim.T) barkedBefore = true; }
  ok('cane: abbaia prima dell\'ostacolo (log L)', barkedBefore && sim.events.some((e) => e[1] === 'L'));
  ok('cane: nessun urto col cane', sim.stats.hits <= 1 && fx.some((x) => x[0] === 'dogBark'));
}
{ // cane pastore: corsa pulita -> seminato
  const { sim } = base(); put(sim, { kind: 'canepastore', lane: 1, len: 8 }, 10);
  for (let i = 0; i < Math.ceil((ANIMALS.CHASE_S + 1) / DT); i++) { sim.fuel = 100; sim.tick(DT); }
  ok('cane pastore: seminato senza rallentare (log C, W)', sim.stats.chases === 1 && sim.stats.escapes === 1 && sim.stats.nips === 0);
}
{ // cane pastore: un urto durante l'inseguimento -> morso
  const { sim } = base(); put(sim, { kind: 'canepastore', lane: 1, len: 8 }, 10);
  for (let i = 0; i < 20; i++) sim.tick(DT);
  put(sim, { kind: 'muretto', lane: sim.targetLane, len: 14 }, 30);
  for (let i = 0; i < 120; i++) { sim.fuel = Math.max(sim.fuel, 50); sim.tick(DT); }
  ok('cane pastore: morso dopo un urto (log V)', sim.stats.nips === 1 && sim.events.some((e) => e[1] === 'V' && e[2] === ANIMALS.NIP_FUEL));
}
{ // gregge: il varco passa davanti, chi lo prende passa senza urti
  const run = (stay) => { const { sim } = base(); const id = 9;
    const sh = []; let off = 0; for (let i = 0; i < 5; i++) { if (i === 2) off += ANIMALS.FLOCK_GAP; sh.push(put(sim, { kind: 'pecora', lane: 0, len: 12, dir: 1, vx: 28, xoff: off, flock: id }, 360)); off += ANIMALS.FLOCK_STEP; }
    for (let i = 0; i < 300; i++) { sim.fuel = 100; sim.tick(DT); }
    return sim; };
  const a = run(), b = run();
  ok('gregge deterministico', JSON.stringify(a.events) === JSON.stringify(b.events));
  ok('gregge: pecore registrate', a.stats.sheep === 5);
}
{ // capra dalla roccia: salta giu' (log G) e diventa ostacolo
  const { sim } = base(); const g = put(sim, { kind: 'caprarupe', lane: sim.targetLane, side: 1, len: 12 }, 300);
  for (let i = 0; i < 600; i++) { sim.fuel = 100; sim.tick(DT); }
  ok('capra dalla roccia: salto (log G) e urto se resti nella corsia', g.landed && sim.events.some((e) => e[1] === 'G') && sim.stats.hits === 1);
}
{ // maialetto
  const { sim } = base(); put(sim, { kind: 'maialetto', lane: 0, len: 10, dir: 1, vx: 80 }, 330);
  for (let i = 0; i < 60; i++) sim.tick(DT);
  ok('maialetto: attraversa (log I)', sim.stats.piglets === 1 && sim.events.some((e) => e[1] === 'I'));
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK');
process.exit(fail ? 1 : 0);
