// v5s45 (QA10 #4): il portale di Santa Marta lascia passare chi corre in corsia 0 o 2 con la frakkera in spalla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSantaMarta } from '../src/game/biomes/builders/santamarta.js';
import { laneX } from '../src/game/sim.js';
import { WORLD } from '../src/config.js';

test('Santa Marta portal leaves the side lanes clear (runner + frakkera, 1.05 m beyond lane centre)', () => {
  const g = buildSantaMarta(1);
  const p = g.attributes.position;
  const clearX = Math.abs(laneX(0)) * 0.1 + 1.05;      // 3.4 m + corpo e fascio di ferula
  let bad = null;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z < -1.4 || z > 4.5) continue;                 // facciata, gradini e vasi davanti al portone
    if (y < 0.6 || y > 4.2) continue;                  // sopra i gradini, fino alla punta della frakkera
    if (Math.abs(x) < clearX) { bad = { x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) }; break; }
  }
  assert.equal(WORLD.LANE_W, 34);
  assert.equal(bad, null, 'geometry in the lane corridor at ' + JSON.stringify(bad));
});
