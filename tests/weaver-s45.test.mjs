// stage45 (15): la tessitrice al telaio e' un ostacolo IN MEZZO alla via (corsia 1), girata verso chi corre.
// Urto: perdi il 25% dei tappeti (min 1, max 5), popup, suono, inciampo. Schivata: tappeto e testo. Corsie 0 e 2 libere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, laneX } from '../src/game/sim.js';
import { Generator, SOLID, PICKUP_KINDS, SIDE_KINDS, speedAt } from '../src/systems/generator.js';
import { WORLD, PX_PER_METER, VILLAGE, PACE, CICCIO, DANCE } from '../src/config.js';
import { CYCLE, biomeAt } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT;
const ACTION = (e) => !e.pickup && !PICKUP_KINDS[e.kind] && !SIDE_KINDS[e.kind] && e.kind !== 'cane' && e.kind !== 'tessitrice' && e.kind !== 'festone';
test('generator: one weaver per village lap, middle lane, lanes 0 and 2 open, PACE gap, 300 seeds', () => {
  let laps = 0, found = 0;
  for (let s = 1; s <= 300; s++) {
    const g = new Generator(s * 7919), out = []; g.fillUntil((3 * CYCLE) * PX_PER_METER, (e) => out.push({ ...e }));
    const ws = out.filter((e) => e.kind === 'tessitrice');
    const per = {};
    for (const w of ws) {
      const bi = biomeAt(w.d / PX_PER_METER); per[bi.lap] = (per[bi.lap] || 0) + 1;
      assert.equal(w.lane, 1); assert.equal(w.side, 0); assert.equal(bi.b.id, 'village');
      const [f, t] = bi.lap === CICCIO.LAP ? [VILLAGE.WEAVER_LAP2_FROM_M, VILLAGE.WEAVER_LAP2_TO_M] : [VILLAGE.WEAVER_FROM_M, VILLAGE.WEAVER_TO_M];
      assert.ok(bi.local >= f && bi.local <= t + 1, `seed ${s} weaver at ${bi.local.toFixed(1)}`);
      const v = speedAt(w.d);
      for (const e of out) {
        if (!ACTION(e)) continue;
        const dt = Math.abs(e.d - w.d) / v;   // come PACE: da inizio a inizio
        const overlap = e.d < w.d + w.len && e.d + (e.len || 0) > w.d;
        if (overlap || dt < PACE.ANY_S - 0.02) assert.fail(`seed ${s}: ${e.kind} lane ${e.lane} ${(dt).toFixed(2)} s from the weaver at ${bi.local.toFixed(1)} m lap ${bi.lap}`);
      }
    }
    for (const lap of [0, 1, 2]) { laps++; if (per[lap]) { found++; assert.equal(per[lap], 1); } }
  }
  assert.ok(found / laps > 0.85, `weaver present in ${(100 * found / laps).toFixed(0)}% of laps`);
});
function meet(lane, carpets) {
  const fx = []; let wallet = carpets;
  const sim = new Sim((t, d) => fx.push([t, d]), { carpetTotal: carpets, spendCarpets: (n) => (n > wallet ? -1 : (wallet -= n)), addCarpets: (n) => (wallet += n) });
  sim.startRun(5); for (let i = 0; i < 240; i++) sim.tick(DT); sim.clearEntities(); sim.gen.fillUntil = () => {};
  sim.targetLane = lane; sim.lane = lane; sim.px = laneX(lane); sim.invuln = 0;
  const w = { kind: 'tessitrice', lane: 1, side: 0, d: sim.T + 160 - sim.genOffset, len: VILLAGE.WEAVER_LEN }; sim.spawn(w);
  for (let i = 0; i < 300; i++) { sim.fuel = 100; sim.tick(DT); }
  return { sim, fx, w, wallet };
}
test('hit: lose 25% of carpets (min 1, max 5) with popup, sound and stumble; no death', () => {
  for (const [have, lost] of [[0, 0], [1, 1], [3, 1], [8, 2], [12, 3], [40, 5]]) {
    const { sim, fx, w, wallet } = meet(1, have);
    assert.ok(w.hit, `hit with ${have}`);
    assert.equal(sim.stats.carpetsLost, lost, `have ${have}`);
    assert.equal(wallet, have - lost); assert.equal(sim.carpetTotal, have - lost);
    assert.ok(fx.some((f) => f[0] === 'popup' && /TELAIO/.test(f[1].text)));
    assert.ok(fx.some((f) => f[0] === 'sound' && f[1] === 'weaverHit'));
    assert.ok(fx.some((f) => f[0] === 'weaverHit'));
    assert.equal(sim.mode, 'run');
  }
});
test('dodge from lane 0 or 2: reward carpet and text, no loss', () => {
  for (const lane of [0, 2]) {
    const { sim, fx, w } = meet(lane, 5);
    assert.ok(!w.hit && w.thrown);
    assert.equal(sim.stats.weaverDodges, 1); assert.equal(sim.stats.carpetsLost, 0);
    assert.ok(fx.some((f) => f[0] === 'popup' && /BRAVU/.test(f[1].text)));
  }
});
test('dance now starts right after the Su Nascimentu vista, before the weaver', () => {
  assert.ok(DANCE.AT_M > 58 + 10 && DANCE.AT_M < 100, `dance at ${DANCE.AT_M}`);
  assert.ok(VILLAGE.WEAVER_LAP2_FROM_M >= DANCE.AT_M + DANCE.CLEAR_AFTER_M);
});
