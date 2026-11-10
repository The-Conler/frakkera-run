// v5s45 (#10 "a volte non si salta"): lo swipe su non viene mai ignorato in silenzio quando il salto e' possibile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/game/sim.js';
import { WORLD, JUMP } from '../src/config.js';

function runSim() {
  const sim = new Sim(() => {}, {}); sim.startRun(5);
  for (let i = 0; i < 60; i++) sim.tick(WORLD.FIXED_DT);
  sim.entities = []; sim.gen.fillUntil = () => {};
  return sim;
}
const ticks = (sim, s) => { for (let t = 0; t < s; t += WORLD.FIXED_DT) { sim.tick(WORLD.FIXED_DT); sim.fuel = 100; } };

test('swipe up while landing is buffered and fires right after touchdown', () => {
  const sim = runSim();
  assert.ok(sim.jump());
  ticks(sim, JUMP.TIME_S - 0.1);                       // ancora in aria, 100 ms all'atterraggio
  const n = sim.stats.jumps;
  assert.ok(sim.jump(), 'input accepted while landing');
  ticks(sim, 0.1 + JUMP.COOLDOWN_S + 0.05);
  assert.equal(sim.stats.jumps, n + 1, 'buffered jump executed');
  assert.ok(sim.jumpT > 0, 'airborne again');
});

test('swipe up during the cooldown right after landing is not lost', () => {
  const sim = runSim();
  sim.jump(); ticks(sim, JUMP.TIME_S + 0.02);          // atterrato, nel cooldown
  const n = sim.stats.jumps;
  assert.ok(sim.jump());
  ticks(sim, JUMP.COOLDOWN_S + 0.05);
  assert.equal(sim.stats.jumps, n + 1);
});

test('swipe up while crouching cancels the crouch and jumps', () => {
  const sim = runSim();
  assert.ok(sim.duck());
  ticks(sim, 0.1);
  assert.ok(sim.jump(), 'jump from crouch');
  assert.equal(sim.duckT, 0); assert.ok(sim.jumpT > 0);
});

test('jump is refused only when impossible (cart)', () => {
  const sim = runSim();
  sim.cart = { lap: 0, ok: 0, j: 0, t: 0 };
  assert.equal(sim.jump(), false);
});

test('a slightly diagonal swipe up is a jump, not a lane change', async () => {
  const { classifySwipe } = await import('../src/systems/swipe.js');
  assert.equal(classifySwipe(21, -15), null, 'too short yet: wait');
  assert.equal(classifySwipe(18, -30), 'up');
  assert.equal(classifySwipe(-14, -23), 'up');
  assert.equal(classifySwipe(30, -12), 'right');
  assert.equal(classifySwipe(4, 26), 'down');
});
