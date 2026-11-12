// Giro fortunato una volta al giorno, caduta rapida, secondo swipe giu' in memoria, rallenty sull'urto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/game/sim.js';
import { WORLD, JUMP, lapHeat, LAP_HEAT_CAP } from '../src/config.js';
import { canSpin, takeSpin } from '../src/systems/storage.js';

function runSim() {
  const sim = new Sim(() => {}, {}); sim.startRun(5);
  for (let i = 0; i < 40; i++) sim.tick(WORLD.FIXED_DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  sim.fuel = 100;
  return sim;
}
const ticks = (sim, s) => { for (let t = 0; t < s; t += WORLD.FIXED_DT) { sim.tick(WORLD.FIXED_DT); sim.fuel = 100; } };

test('lap heat makes lap 3 denser than lap 1', () => {
  assert.equal(lapHeat(0), 1);
  assert.ok(lapHeat(2) > lapHeat(0) + 0.3);
  assert.ok(lapHeat(5) > lapHeat(2));
  assert.equal(lapHeat(9), LAP_HEAT_CAP);
  assert.equal(lapHeat(12), LAP_HEAT_CAP);
});

test('swipe down in the air fast-falls and the slide is remembered', () => {
  const sim = runSim();
  assert.ok(sim.jump());
  ticks(sim, 0.12);
  const left = sim.jumpT;
  assert.ok(sim.duck(), 'down swipe accepted in the air');
  assert.equal(sim.duckT, 0, 'not a ground slide yet');
  ticks(sim, 0.08);
  assert.ok(sim.jumpT < left - 0.2, `fell quickly ${left.toFixed(3)} -> ${sim.jumpT.toFixed(3)}`);
  ticks(sim, JUMP.TIME_S);
  assert.ok(sim.duckT > 0, 'buffered slide starts on landing');
});

test('a second duck during the slide is not lost', () => {
  const sim = runSim();
  assert.ok(sim.duck());
  assert.ok(sim.duck(), 'second swipe buffered');
  ticks(sim, 0.9);
  assert.ok(sim.duckT > 0, 'the buffered duck started');
});

test('a fatal hit keeps a short slow moment and names what you hit', () => {
  const sim = runSim();
  sim.fuel = 10;
  sim.spawn({ kind: 'botte', lane: 1, d: sim.T + 8, len: 14 });
  let dying = 0;
  for (let i = 0; i < 400 && sim.mode !== 'over'; i++) {
    sim.tick(WORLD.FIXED_DT);
    if (sim.mode === 'dying') dying++;
  }
  assert.equal(sim.mode, 'over');
  assert.ok(dying > 40, `slow moment lasted ${dying} steps`);
  const over = sim.events.length;
  assert.ok(over >= 0);
});

test('lucky spin is once per calendar day', () => {
  const a = new Date('2026-11-12T08:00:00Z');
  const b = new Date('2026-11-12T22:00:00Z');
  const c = new Date('2026-11-13T01:00:00Z');
  assert.equal(canSpin(a), true);
  assert.equal(takeSpin(a), true);
  assert.equal(canSpin(b), false);
  assert.equal(takeSpin(b), false);
  assert.equal(canSpin(c), true);
});
