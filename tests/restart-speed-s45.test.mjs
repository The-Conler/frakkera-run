// stage45 (11): ogni nuova partita (retry senza ricaricare) parte alla stessa velocità.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/game/sim.js';
import { PX_PER_METER } from '../src/config.js';
const DT = 1 / 120;
const speedAt10 = (sim) => { for (let i = 0; i < 20000 && sim.runD < 10 * PX_PER_METER; i++) { sim.fuel = 50; sim.invuln = 1; sim.tick(DT); } return sim.currentSpeed; };
test('speed at 10 m is identical across consecutive restarts on one Sim', () => {
  const sim = new Sim(() => {}, {});
  const v = [];
  for (let r = 0; r < 5; r++) {
    sim.startRun(1000 + r);
    v.push(speedAt10(sim));
    for (let i = 0; i < 6000; i++) { sim.fuel = 50; sim.invuln = 1; sim.tick(DT); }   // corri ~50 s, poi riparti
    sim.speedStep = 3; sim.cartSpK = 0.5; sim.slowT = 0; sim.wetT = 2;              // stato sporco a fine partita
  }
  for (const s of v) assert.ok(Math.abs(s - v[0]) < 1e-6, `start speeds differ: ${v.join(', ')}`);
  const fresh = new Sim(() => {}, {}); fresh.startRun(1000);
  assert.ok(Math.abs(speedAt10(fresh) - v[0]) < 1e-6);
});
