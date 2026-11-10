// stage45 (12): dopo la salita sul carrello niente ostacoli per almeno ~2.5 s, primo scambio morbido (un solo binario interrotto)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Generator, cartAt, speedAt, SOLID, PICKUP_KINDS, SIDE_KINDS } from '../src/systems/generator.js';
import { WORLD, PX_PER_METER, CART } from '../src/config.js';
const CYCLE = 1600;
const boardM = (lap) => { for (let m = lap * CYCLE; m < (lap + 1) * CYCLE; m += 0.1) { const c = cartAt(m); if (c && c.local >= 0) return m; } return null; };
test('no obstacle within 2.5 s of cart boarding and first junction blocks one track only, 200 seeds x 3 laps', () => {
  const boards = [0, 1, 2].map(boardM);
  assert.ok(boards.every((b) => b != null));
  let worst = 99;
  for (let seed = 1; seed <= 200; seed++) {
    const g = new Generator(seed * 7919), out = [];
    g.fillUntil(boards[2] * PX_PER_METER + 1500, (e) => out.push({ ...e }));
    for (const bm of boards) {
      const bD = bm * PX_PER_METER, v = speedAt(bD) * CART.SPEED_K;
      const obst = out.filter((e) => !PICKUP_KINDS[e.kind] && !SIDE_KINDS[e.kind] && e.kind !== 'carrello' && (SOLID[e.kind] || e.kind === 'deadend' || e.kind === 'rollin') && e.d + (e.len || 0) >= bD && e.d < bD + 3 * v);
      for (const e of obst) { const t = (e.d - bD) / v; worst = Math.min(worst, t); assert.ok(t >= 2.5, `seed ${seed} board ${bm.toFixed(0)} m: ${e.kind} lane ${e.lane} after ${t.toFixed(2)} s`); }
      const first = out.filter((e) => e.kind === 'deadend' && e.d >= bD).sort((a, b) => a.d - b.d)[0];
      if (first) assert.equal(out.filter((e) => e.kind === 'deadend' && e.junction === first.junction && Math.abs(e.d - first.d) < 1).length, 1, `seed ${seed}: first junction blocks 2 tracks`);
    }
  }
  console.log('min grace s', worst);
});
