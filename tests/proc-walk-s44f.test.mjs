// v5s44f: la processione di Santa Marta viene VERSO chi corre (corsia destra), lasciando sempre libero il passaggio.
import assert from 'node:assert';
import { Sim } from '../src/game/sim.js';
import { Generator, SOLID } from '../src/systems/generator.js';
import { WORLD, VILLAGE } from '../src/config.js';

// 1) generatore: corsia destra, e nel tratto che il corteo percorre (fino a PROC_WALK_MAX_PX indietro) le corsie 0 e 1
//    non sono mai chiuse insieme da ostacoli solidi (restano almeno 2 corsie su 3 percorribili)
let procs = 0, blocked = 0;
for (let s = 1; s <= 40; s++) {
  const g = new Generator(s * 131), ev = []; g.fillUntil(60000, (e) => ev.push(e));
  for (const p of ev.filter((e) => e.kind === 'processione')) {
    procs++;
    assert.strictEqual(p.lane, 2, 'corteo sulla corsia destra');
    const a = p.d - VILLAGE.PROC_WALK_MAX_PX - 10, b = p.d + p.len + 10;
    const solidIn = (l) => ev.some((e) => e !== p && e.lane === l && SOLID[e.kind] && e.d + e.len >= a && e.d <= b);
    if (solidIn(0) && solidIn(1)) blocked++;
  }
}
assert.ok(procs > 80, `processioni presenti (${procs})`);
assert.strictEqual(blocked, 0, 'mai corsie 0 e 1 chiuse insieme accanto al corteo');

// 2) sim: il corteo avanza verso il giocatore (d diminuisce) e si ferma dopo PROC_WALK_MAX_PX
const sim = new Sim(() => {}, {}); sim.startRun(5);
for (let i = 0; i < 60; i++) sim.tick(WORLD.FIXED_DT);
sim.entities = []; sim.gen.fillUntil = () => {};
sim.spawn({ kind: 'processione', lane: 2, len: VILLAGE.PROC_LEN, d: sim.T - sim.genOffset + 300 });
const e = sim.entities.at(-1), d0 = e.d;
sim.targetLane = 0; sim.lane = 0; sim.px = -WORLD.LANE_W;
let minD = d0;
for (let i = 0; i < 4000 && !e.done; i++) { sim.tick(WORLD.FIXED_DT); sim.fuel = 100; minD = Math.min(minD, e.d); }
assert.ok(minD < d0 - 5, `il corteo cammina verso il giocatore (${d0} -> ${minD})`);
assert.ok(minD >= d0 - VILLAGE.PROC_WALK_MAX_PX - 0.01, 'corsa limitata');
assert.ok(e.done && !e.hit && sim.stats.procClean === 1, 'schivato dalla corsia sinistra: VIVA SANTA MARTA ' + JSON.stringify({ done: e.done, hit: e.hit, clean: sim.stats.procClean, d: e.d, T: sim.T, mode: sim.mode }));
console.log('proc-walk-s44f ok', { procs, walked: +(d0 - minD).toFixed(1) });
