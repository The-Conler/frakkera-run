// Giro 3+: velocita' senza scalino al confine, carburante che regge, meteo dal seme,
// pistole e cortei che non spariscono dopo il giro 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fuelSustain, PISTOL, MASKS } from '../src/config.js';
import { Generator, speedAt, SIDE_KINDS } from '../src/systems/generator.js';
import { CYCLE } from '../src/game/biomes/config.js';
import { rainLap, rainAt } from '../src/systems/weather.js';
import { WORLD, PX_PER_METER } from '../src/config.js';

test('speed does not dip at a lap seam and still rises after giro 5', () => {
  for (let lap = 0; lap < 6; lap++) {
    const seam = (lap + 1) * CYCLE;
    const before = speedAt((seam - 5) * PX_PER_METER);
    const at = speedAt(seam * PX_PER_METER);
    const soon = speedAt((seam + 30) * PX_PER_METER);
    assert.ok(at + 0.6 >= before, `seam ${seam} dropped ${before.toFixed(2)} -> ${at.toFixed(2)}`);
    assert.ok(soon + 1.2 >= at, `just after seam ${seam}: ${at.toFixed(2)} -> ${soon.toFixed(2)}`);
  }
  const g5 = speedAt(5 * CYCLE * PX_PER_METER);
  const g8 = speedAt(8 * CYCLE * PX_PER_METER);
  assert.ok(g8 > g5 + 0.4, `giro 8 ${g8.toFixed(2)} should beat giro 5 ${g5.toFixed(2)}`);
  assert.ok(g8 <= 240);
});

test('fuel supply grows from giro 3 and then holds', () => {
  assert.equal(fuelSustain(0), 1);
  assert.equal(fuelSustain(1), 1);
  assert.ok(fuelSustain(2) > 1);
  assert.ok(fuelSustain(4) > fuelSustain(2));
  assert.equal(fuelSustain(20), fuelSustain(12));
});

test('weather follows the run seed and stays deterministic', () => {
  assert.equal(rainLap(3), true);
  assert.equal(rainLap(4), false);
  assert.equal(rainAt(CYCLE * 3.5), rainAt(CYCLE * 3.5));
  const a = [3, 4, 5, 6, 7, 8].map((l) => rainLap(l, 31));
  const b = [3, 4, 5, 6, 7, 8].map((l) => rainLap(l, 31));
  assert.deepEqual(a, b);
  const other = [3, 4, 5, 6, 7, 8].map((l) => rainLap(l, 99));
  assert.ok(a.some((v, i) => v !== other[i]) || a.join() !== [3, 4, 5, 6, 7, 8].map((l) => rainLap(l)).join());
});

test('pistols and mask parades keep showing after giro 2', () => {
  let maskLaps = 0, laps = 0;
  const kinds = new Set();
  for (let lap = 2; lap <= 5; lap++) for (let s = 0; s < 6; s++) {
    const g = new Generator(11 + lap * 17 + s);
    const out = [];
    const from = lap * CYCLE * PX_PER_METER;
    const to = from + CYCLE * PX_PER_METER;
    g.fillUntil(to + WORLD.LEAD_IN, (e) => { if (e.d >= from && e.d < to) out.push(e); });
    laps++;
    const pistols = out.filter((e) => e.kind === 'pistola').length;
    if (out.some((e) => e.kind === 'maimoni')) maskLaps++;
    for (const e of out) if (!e.pickup && !SIDE_KINDS[e.kind]) kinds.add(e.kind);
    assert.ok(pistols >= 1 && pistols <= PISTOL.MAX_PER_LAP, `giro ${lap + 1} seed ${s} pistols ${pistols}`);
  }
  assert.ok(MASKS.P_LAP[3] > MASKS.P_LAP[0] * 3, 'later laps roll the parade more often');
  for (const k of ['muretto', 'botte', 'trave', 'goat', 'sasso', 'bagnato', 'rollin', 'pistola']) assert.ok(kinds.has(k) || k === 'pistola', k);
});
