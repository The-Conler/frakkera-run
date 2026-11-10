// stage45 (18): Ciccio col pickup bianco: solo nel giro 2 (lap index 1) nel paese, avviso ~2 s prima,
// sempre schivabile (2 corsie su 3 libere, nessun altro ostacolo nel tratto), urto = morte immediata.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, laneX } from '../src/game/sim.js';
import { Generator, SOLID, PICKUP_KINDS, SIDE_KINDS } from '../src/systems/generator.js';
import { WORLD, PX_PER_METER, CICCIO, DANCE, SANTAMARTA } from '../src/config.js';
import { CYCLE, biomeAt } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT;
function drive(offM, seed, policy, maxS = 40) {
  const fx = []; const sim = new Sim((t, d) => fx.push([t, d, sim.runTime]), { mapOffsetM: offM }); sim.startRun(seed);
  sim.gen.fillUntil = () => {};
  for (let i = 0; i < maxS / DT && sim.mode !== 'over'; i++) { if (sim.mode === 'run') { sim.fuel = 100; sim.entities = sim.entities.filter((e) => e.kind === 'ciccio'); } policy?.(sim, fx); sim.tick(DT); }
  return { sim, fx };
}
test('Ciccio appears only in lap 2 (lap index 1), in the village, once', () => {
  for (const [off, want] of [[100, 0], [CYCLE + 100, 1], [2 * CYCLE + 100, 0]]) {
    const { sim, fx } = drive(off, 3, (s) => { if (s.mode === 'dance') s.skipDance(); s.targetLane = 0; }, 30);
    const warns = fx.filter((f) => f[0] === 'ciccioWarn');
    assert.equal(warns.length, want, `offset ${off}`);
    if (want) {
      const m = sim.events.find((e) => e[1] === 'cW'); assert.ok(m);
      const tr = fx.find((f) => f[0] === 'spawn' && f[1].kind === 'ciccio');
      const bi = biomeAt(off + (tr[1].d - (CICCIO.SPEED_PX_S + 0) * 0) / PX_PER_METER);
      assert.equal(bi.b.id, 'village');
      assert.ok(fx.some((f) => f[0] === 'popup' && f[1].text === CICCIO.BANNER));
      assert.ok(fx.some((f) => f[0] === 'sound' && f[1] === 'horn'));
      assert.equal(sim.stats.ciccioDodged, 1);
    }
  }
});
test('warning lead time is ~2 s at the current speed and the truck spawns before Santa Marta', () => {
  for (const seed of [9, 21]) {
    let warn = null, tMeet = null;
    const sim = new Sim((t, d) => { if (t === 'ciccioWarn') warn = { t: sim.runTime, spawnM: (d.e.d - sim.genOffset) / PX_PER_METER + CYCLE + 60, atM: sim.runD / PX_PER_METER + CYCLE + 60, v: sim.currentSpeed }; }, { mapOffsetM: CYCLE + 60 });
    sim.startRun(seed); sim.gen.fillUntil = () => {};
    for (let i = 0; i < 40 / DT && sim.mode !== 'over'; i++) {
      if (sim.mode === 'dance') sim.skipDance();
      if (sim.mode === 'run') { sim.fuel = 100; sim.entities = sim.entities.filter((e) => e.kind === 'ciccio'); sim.targetLane = 1; }
      const c = sim.cic; if (c && tMeet == null && c.d <= sim.T + 5) tMeet = sim.runTime;
      sim.tick(DT);
    }
    assert.ok(warn && tMeet != null);
    const lead = tMeet - warn.t, local = biomeAt(warn.spawnM).local, wl = biomeAt(warn.atM).local;
    assert.ok(lead >= 1.8 && lead <= 2.3, `lead ${lead.toFixed(2)} s`);
    assert.ok(wl >= CICCIO.WARN_M && wl > DANCE.AT_M + DANCE.CLEAR_AFTER_M, `warn at ${wl.toFixed(1)} m`);
    assert.ok(local < SANTAMARTA.FROM_M - 20, `truck spawns at ${local.toFixed(1)} m (nave at ${SANTAMARTA.FROM_M})`);
    console.log(`seed ${seed}: warn at ${wl.toFixed(1)} m, speed ${(warn.v / 10).toFixed(1)} m/s, truck spawns at ${local.toFixed(1)} m, lead ${lead.toFixed(2)} s`);
  }
});
test('hit = instant death even with shield and invulnerability; reason reported', () => {
  let over = null;
  const fx = []; const sim = new Sim((t, d) => { fx.push([t, d]); if (t === 'over') over = d; }, { mapOffsetM: CYCLE + 100 }); sim.startRun(4);
  sim.gen.fillUntil = () => {};
  for (let i = 0; i < 40 / DT && sim.mode !== 'over'; i++) {
    if (sim.mode === 'run') { sim.fuel = 100; sim.shield = 3; sim.invuln = 5; sim.entities = sim.entities.filter((e) => e.kind === 'ciccio'); sim.targetLane = CICCIO.LANE; sim.px = laneX(CICCIO.LANE); }
    if (sim.mode === 'dance') sim.skipDance();
    sim.tick(DT);
  }
  assert.equal(sim.mode, 'over');
  assert.equal(sim.deathReason, 'ciccio');
  assert.ok(over && over.reason === CICCIO.REASON);
  assert.equal(fx.filter((f) => f[0] === 'die').length, 1);
});
test('always dodgeable: from the truck lane, reacting 0.7 s after the banner, the player survives (10 seeds x 3 lanes)', () => {
  for (let seed = 1; seed <= 10; seed++) for (const start of [0, 1, 2]) {
    let warnT = null;
    const { sim } = drive(CYCLE + 100, seed, (s, fx) => {
      if (s.mode === 'dance') s.skipDance();
      if (s.mode !== 'run') return;
      if (warnT == null) { s.targetLane = start; s.px = laneX(start); if (s.cic) warnT = s.runTime; }
      else if (s.runTime - warnT > 0.7 && s.targetLane === CICCIO.LANE) s.move(-1);
    }, 30);
    assert.notEqual(sim.deathReason, 'ciccio', `seed ${seed} start lane ${start}`);
    assert.equal(sim.stats.ciccioDodged, 1);
  }
});
test('generator keeps the Ciccio stretch clear in lap 2 (no obstacles, no pickups in his lane) - 200 seeds', () => {
  let n = 0;
  for (let s = 1; s <= 200; s++) {
    const g = new Generator(s * 104729), out = []; g.fillUntil((CYCLE + 260) * PX_PER_METER, (e) => out.push({ ...e }));
    for (const e of out) {
      const a = e.d / PX_PER_METER, b = (e.d + (e.len || 0)) / PX_PER_METER;
      if (b < CYCLE + CICCIO.CLEAR_FROM_M || a > CYCLE + CICCIO.CLEAR_TO_M) continue;
      if (SIDE_KINDS[e.kind] || e.kind === 'cane') continue;
      if (e.pickup || PICKUP_KINDS[e.kind]) { assert.notEqual(e.lane, CICCIO.LANE, `seed ${s}: ${e.kind} in Ciccio's lane at ${a.toFixed(1)}`); continue; }
      n++; assert.fail(`seed ${s}: ${e.kind} lane ${e.lane} at ${(a - CYCLE).toFixed(1)} m in the Ciccio stretch`);
    }
  }
  assert.equal(n, 0);
});
