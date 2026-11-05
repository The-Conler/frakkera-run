import test from 'node:test';
import assert from 'node:assert/strict';
import { towerLookK } from '../src/game/camRules.js';
test('sguardo alla torre solo al primo giro', () => {
  let any0 = 0;
  for (let l = -20; l < 260; l += 1) { any0 = Math.max(any0, towerLookK('rock', l, 0));
    for (const lap of [1, 2, 3, 7]) assert.equal(towerLookK('rock', l, lap), 0, `giro ${lap} metro ${l}`); }
  assert.ok(any0 > 0.9, 'al primo giro la camera guarda la torre');
  assert.equal(towerLookK('village', 50, 0), 0);
});
