// v5s45 (QA10 #6/#7): la molla della frakkera resta stabile anche a 3-4 fps e dopo un urto la frakkera resta in spalla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepCarrySpring, SPRING_MAX } from '../src/game/carrySpring.js';
import { readFileSync } from 'node:fs';

function run(dt, kickA, kickP, secs = 4) {
  const sg = { a: 0, v: kickA, p: 0, pv: kickP }; let peak = 0;
  for (let t = 0; t < secs; t += dt) { stepCarrySpring(sg, 0, dt); peak = Math.max(peak, Math.abs(sg.a), Math.abs(sg.p)); }
  return { peak, end: Math.max(Math.abs(sg.a), Math.abs(sg.p)) };
}

test('carry spring is stable and settles at 60, 10 and 4 fps (dt up to the 0.25 s cap)', () => {
  for (const dt of [1 / 60, 0.1, 0.25]) {
    const r = run(dt, 0.9, 0);                 // cambio corsia
    assert.ok(r.peak < 0.35, `lane-change peak ${r.peak} at dt ${dt}`);
    assert.ok(r.end < 0.01, `does not settle at dt ${dt}: ${r.end}`);
  }
});

test('hit knock-back keeps the frakkera within 0.3 rad (no flip), any frame rate', () => {
  const src = readFileSync(new URL('../src/game/world3d.js', import.meta.url), 'utf8');
  const m = src.match(/HIT_KICK = \{ a: ([0-9.]+), p: ([0-9.]+) \}/);
  assert.ok(m, 'HIT_KICK constant');
  for (const dt of [1 / 60, 0.1, 0.25]) {
    const r = run(dt, +m[1], +m[2]);
    assert.ok(r.peak < 0.3, `hit peak ${r.peak} at dt ${dt}`);
    assert.ok(r.peak <= SPRING_MAX);
  }
});
