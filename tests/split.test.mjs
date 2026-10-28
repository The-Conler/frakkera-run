// v5 split: vicolo e cappella tonda in mezzo alla via (corsia centrale chiusa, laterali libere)
import assert from 'node:assert';
import { Generator, splitAt, SOLID } from '../src/systems/generator.js';
import { SPLIT, PX_PER_METER, WORLD, FESTA } from '../src/config.js';
import { CYCLE, BIOMES } from '../src/game/biomes/config.js';
import { buildVicolo, buildCappella, BLOCK_LEN, BLOCK_W, CAP_RAD, CAP_LEN } from '../src/game/biomes/builders/gadoni5.js';
import { Sim } from '../src/game/sim.js';

const village = BIOMES.find((b) => b.id === 'village');
assert.ok(SOLID.split, 'split e solido');
// posizioni: dentro il paese, dopo la festa e il ballo, prima di Santa Marta (240 m)
for (const s of SPLIT.SPOTS) {
  assert.ok(s.from >= FESTA.TO_M + 30, `${s.id}: dopo la festa e il ballo`);
  assert.ok(s.from + s.len + SPLIT.CLEAR_AFTER_M <= 235, `${s.id}: prima di Santa Marta`);
  assert.ok(s.from + s.len <= village.to - village.from);
}
assert.strictEqual(BLOCK_LEN, SPLIT.SPOTS[0].len); assert.strictEqual(CAP_LEN, SPLIT.SPOTS[1].len);
// geometria: il blocco sta in mezzo, ma non invade le corsie laterali (a 3.4 m) sotto i 2.6 m d'altezza
const laneSide = WORLD.LANE_W / PX_PER_METER;
for (const [n, g, len] of [['vicolo', buildVicolo(26), BLOCK_LEN], ['cappella', buildCappella(), CAP_LEN]]) {
  const p = g.attributes.position; let centre = 0, bad = 0;
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(p.getX(i)), y = p.getY(i), z = p.getZ(i);
    if (x < 1 && y > 1 && z < -1 && z > -len + 1) centre++;
    if (y > 0.2 && y < 2.6 && x > laneSide - 0.9 && x < laneSide + 0.9) bad++;
  }
  assert.ok(centre > 20, `${n}: c'e' qualcosa in mezzo`);
  assert.strictEqual(bad, 0, `${n}: corsie laterali libere`);
  assert.ok(p.count < 20000, `${n}: geometria leggera (${p.count})`);
}
assert.ok(BLOCK_W * PX_PER_METER <= SPLIT.HALF_W + 1 && CAP_RAD * PX_PER_METER <= SPLIT.HALF_W + 1);

// generatore: un blocco per giro e per luogo, alla posizione fissa; nessun altro ostacolo nel tratto
for (const seed of [1, 7, 42, 1234, 99991]) {
  const g = new Generator(seed), ents = [];
  g.fillUntil((CYCLE * 2 + 260) * PX_PER_METER, (e) => ents.push(e));
  const splits = ents.filter((e) => e.kind === 'split');
  assert.strictEqual(splits.length, 3 * SPLIT.SPOTS.length, `seed ${seed}: due blocchi per giro (${splits.length})`);
  for (const sp of splits) {
    const spot = SPLIT.SPOTS.find((s) => s.id === sp.spot);
    const want = (sp.lap * CYCLE + village.from + spot.from) * PX_PER_METER;
    assert.ok(Math.abs(sp.d - want) <= 1, `seed ${seed}: ${sp.spot} a ${spot.from} m (${sp.d} vs ${want})`);
    assert.strictEqual(sp.lane, 1); assert.strictEqual(sp.len, spot.len * PX_PER_METER);
    const a = sp.d - (SPLIT.CLEAR_BEFORE_M - 27) * PX_PER_METER, b = sp.d + sp.len;
    const other = ents.filter((e) => e.kind !== 'split' && SOLID[e.kind] !== undefined && e.d + e.len > a && e.d < b);
    assert.deepStrictEqual(other.map((e) => `${e.kind}@${e.d}`), [], `seed ${seed}: tratto libero attorno a ${sp.spot}`);
    const inside = ents.filter((e) => e.pickup && e.lane === 1 && e.d + e.len > sp.d && e.d < b);
    assert.strictEqual(inside.length, 0, `seed ${seed}: niente premi dentro il blocco`);
  }
  // deterministico
  const g2 = new Generator(seed), e2 = []; g2.fillUntil((CYCLE + 260) * PX_PER_METER, (e) => e2.push(e));
  assert.deepStrictEqual(e2.filter((e) => e.kind === 'split').map((e) => e.d), splits.slice(0, 4).map((e) => e.d));
}
assert.ok(splitAt(village.from + 200) && !splitAt(village.from + 100));

// sim: nel mezzo si urta, a lato si passa (log 'a' con il lato)
const DT = WORLD.FIXED_DT;
function base() { const sim = new Sim(() => {}); sim.startRun(5); for (let i = 0; i < 60; i++) sim.tick(DT); sim.entities = []; sim.gen.fillUntil = () => {}; return sim; }
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
for (const lane of [0, 2]) {
  const sim = base(); sim.lane = sim.targetLane = lane; sim.px = (lane - 1) * WORLD.LANE_W;
  const e = put(sim, { kind: 'split', lane: 1, len: 200, spot: 'cappella' }, 80);
  for (let i = 0; i < 3000 && !e.done; i++) sim.tick(DT);
  assert.ok(e.done && !e.hit && sim.stats.hits === 0, `lato ${lane}: si passa`);
  assert.ok(sim.events.some((x) => x[1] === 'a' && x[2] === lane), `lato ${lane}: log a`);
  assert.strictEqual(sim.stats.splits, 1);
}
{
  const sim = base(); const h0 = sim.stats.hits;
  const e = put(sim, { kind: 'split', lane: 1, len: 200, spot: 'vicolo' }, 80);
  for (let i = 0; i < 3000 && !e.done; i++) sim.tick(DT);
  assert.ok(e.hit && sim.stats.hits > h0, 'in mezzo: urto');
  assert.ok(!sim.events.some((x) => x[1] === 'a'));
}
console.log('split ok');
