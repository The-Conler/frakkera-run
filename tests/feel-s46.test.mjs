// stage46 (104): dopo un urto si rallenta subito, si resta lenti un attimo (HIT_HOLD_S) e si torna a piena velocita' entro HIT_RECOVER_S
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/game/sim.js';
import { WORLD } from '../src/config.js';
const DT = WORLD.FIXED_DT;
test('hit: short slowdown, brief hold, full recovery', () => {
  const sim = new Sim(() => {}, {}); sim.startRun(11);
  for (let i = 0; i < 4 / DT; i++) { sim.fuel = 100; sim.invuln = 1; sim.tick(DT); }
  sim.clearEntities(); sim.gen.fillUntil = () => {};
  const base = () => { const s = sim.slowT; sim.slowT = 99; sim.tick(0); const v = sim.currentSpeed; sim.slowT = s; return v; };
  sim.invuln = 0; sim.fuel = 100; sim.hitSolid({ kind: 'muretto', lane: sim.targetLane, d: sim.T, len: 10, id: -1 });
  assert.equal(sim.slowT, 0);
  const at = (t) => { for (let n = 0; n < 2000 && sim.slowT < Math.min(t, WORLD.HIT_RECOVER_S) - 1e-9; n++) { sim.fuel = 100; sim.tick(DT); } return sim.currentSpeed / base(); };
  const k1 = at(WORLD.HIT_EASE_S + 0.05), k2 = at(WORLD.HIT_EASE_S + WORLD.HIT_HOLD_S), k3 = at(WORLD.HIT_RECOVER_S + 0.05);
  console.log('speed ratio after hit', k1.toFixed(2), k2.toFixed(2), k3.toFixed(2));
  assert.ok(k1 < WORLD.HIT_SLOW + 0.03 && k2 < WORLD.HIT_SLOW + 0.03, `slow right after the hit (${k1.toFixed(2)}, ${k2.toFixed(2)})`);
  assert.ok(k3 > 0.99, `recovered (${k3.toFixed(2)})`);
});
