// stage45 (13): nella miniera ogni corsia ha il suo binario (prima mancava la corsia sinistra)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RAIL_X, BIOMES } from '../src/game/biomes/config.js';
import { laneX } from '../src/game/sim.js';
import { WORLD } from '../src/config.js';
test('rails under every lane in every railed biome', () => {
  for (let l = 0; l < WORLD.LANES; l++) assert.ok(RAIL_X.some((x) => Math.abs(x - laneX(l) / 10) < 0.05), `lane ${l} has no rail`);
  assert.ok(BIOMES.filter((b) => b.ground.rails).length >= 3);
  assert.match(readFileSync(new URL('../src/game/biomes/env.js', import.meta.url), 'utf8'), /if \(g\.rails\) for \(const lx of RAIL_X\)/);
});
