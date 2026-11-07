// v5s43: pietre, strettoie rocciose, gruppi e detriti lasciano sempre almeno 2 corsie libere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Generator, speedAt } from '../src/systems/generator.js';
import { WORLD, PX_PER_METER, BIOME_OBST as BO } from '../src/config.js';
import { CYCLE } from '../src/game/biomes/config.js';

const ROCK = new Set(['sasso', 'narrow', 'botti', 'botte', 'muretto', 'bottecoricata', 'rollin', 'bagnato']);

function span(e) {
  let a = e.d / PX_PER_METER, b = (e.d + (e.len || 0)) / PX_PER_METER;
  if (e.kind === 'sasso') a -= (speedAt(e.d) * BO.ROCK_LEAD_S + 40) / PX_PER_METER;
  if (e.kind === 'rollin') a -= (BO.ROLL_ROWS * WORLD.ROW) / PX_PER_METER;
  return [Math.min(a, b), Math.max(a, b)];
}

test('rocks leave at least two lanes passable on seeds 12345, 7919 and 15838 over 5 laps', () => {
  for (const seed of [12345, 7919, 15838]) {
    const g = new Generator(seed), ents = [];
    g.fillUntil(CYCLE * 5 * PX_PER_METER + 800, (e) => ents.push(e));
    let where = null;
    for (let m = 0; m < CYCLE * 5; m += 1) {
      const lanes = new Set();
      for (const e of ents) {
        if (!ROCK.has(e.kind) || e.lane == null) continue;
        const [a, b] = span(e);
        if (a < m && b > m) lanes.add(e.lane);
      }
      if (lanes.size > 1) { where = { seed, m, lanes: [...lanes] }; break; }
    }
    assert.equal(where, null, 'only one free lane ' + JSON.stringify(where));
  }
});
