// stage46 (113): nessun ostacolo semplice nascosto dietro uno alto sulla stessa corsia (entro HIDE.BEHIND_M), 200 seed x 3 giri
import test from 'node:test';
import assert from 'node:assert/strict';
import { Generator, HIDE } from '../src/systems/generator.js';
import { PX_PER_METER } from '../src/config.js';
test('no simple obstacle hidden behind a tall one in the same lane', () => {
  let simple = 0;
  for (let s = 1; s <= 200; s++) {
    const g = new Generator(s * 7919), out = []; g.fillUntil(3 * 1600 * PX_PER_METER, (e) => out.push({ ...e }));
    const tall = out.filter((e) => HIDE.TALL[e.kind] && !e.pickup);
    for (const b of out) {
      if (!HIDE.SIMPLE[b.kind] || b.pickup || b.group) continue; simple++;
      for (const a of tall) {
        if (a === b || a.lane !== b.lane || !(b.d > a.d)) continue;
        assert.ok(b.d > a.d + (a.len || 0) + HIDE.BEHIND_M * PX_PER_METER, `seed ${s}: ${b.kind} lane ${b.lane} hidden behind ${a.kind} (${((b.d - a.d - (a.len || 0)) / PX_PER_METER).toFixed(1)} m)`);
      }
    }
  }
  assert.ok(simple > 15000, `still plenty of obstacles (${simple})`);
});
