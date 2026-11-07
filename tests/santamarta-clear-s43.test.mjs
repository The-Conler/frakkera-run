// v5s43: navata di Santa Marta, 230-285 m locali su ogni giro, senza ostacoli, pickup o maschere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Generator } from '../src/systems/generator.js';
import { PX_PER_METER } from '../src/config.js';
import { CYCLE } from '../src/game/biomes/config.js';

const FROM = 230, TO = 285;

function hitsNave(e) {
  let a = e.d / PX_PER_METER, b = (e.d + (e.len || 0)) / PX_PER_METER;
  if (a > b) { const t = a; a = b; b = t; }
  for (let lap = Math.floor(a / CYCLE) - 1; lap <= Math.floor(b / CYCLE) + 1; lap++) {
    if (a < lap * CYCLE + TO && b > lap * CYCLE + FROM) return true;
  }
  return false;
}

test('Santa Marta 230-285 m has no obstacles, pickups or masks on any lap', () => {
  for (const seed of [12345, 7919, 15838]) {
    const g = new Generator(seed), ents = [];
    g.fillUntil(CYCLE * 5 * PX_PER_METER + 800, (e) => ents.push(e));
    const hits = ents.filter(hitsNave);
    assert.equal(hits.length, 0, hits.slice(0, 4).map((e) => e.kind + '@' + (e.d / PX_PER_METER).toFixed(1)).join(','));
  }
});
