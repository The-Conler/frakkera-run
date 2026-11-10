// v5s46c QA gate - regole del generatore su 60 seed x 3 giri (parte "node" del gate permanente, vedi qa/gate.sh)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Generator, SOLID, biomeIdAt } from '../src/systems/generator.js';
import { WORLD, PX_PER_METER, CARPETS } from '../src/config.js';
import { CYCLE } from '../src/game/biomes/config.js';

const SEEDS = Array.from({ length: 60 }, (_, i) => 1009 + i * 7919);
const LAPS = 3;
const runs = SEEDS.map((seed) => { const g = new Generator(seed), ents = []; g.fillUntil(CYCLE * LAPS * PX_PER_METER + 200, (e) => ents.push(e)); return { seed, ents }; });
const NATURE = new Set(['rock', 'river', 'viaduct']);
const span = (e) => [e.d, e.d + (e.len || 0)];

test('no pickup sits inside a solid obstacle (same lane, overlapping span) - 60 seeds x 3 laps', () => {
  const bad = [];
  for (const { seed, ents } of runs) {
    const MOVING = new Set(['goat', 'rollbarrel', 'pecora', 'maialetto', 'caprarupe', 'cane']);   // si spostano di corsia: dodge-s40 li controlla
    const solids = ents.filter((e) => SOLID[e.kind] && e.lane != null && !e.pickup && !MOVING.has(e.kind) && !e.vx);
    for (const p of ents) { if (!p.pickup || p.lane == null || p.kind === 'tappeto' && p.mx !== undefined) continue;
      const [a, b] = span(p);
      const hit = solids.find((o) => o.lane === p.lane && o.d < b && o.d + (o.len || 0) > a);
      if (hit) bad.push({ seed, m: Math.round(p.d / PX_PER_METER), p: p.kind, o: hit.kind });
    }
  }
  assert.equal(bad.length, 0, 'pickup inside obstacle: ' + JSON.stringify(bad.slice(0, 8)));
});

test('village street is thinned: one carpet per row (worth PER_ROW) and fuel pickups >= 5 rows apart', () => {
  const bad = [];
  for (const { seed, ents } of runs) {
    let last = -1e9;
    for (const e of ents) {
      const v = biomeIdAt(e.d - (e.kind === 'tappeto' ? 3 : 9)) === 'village' && biomeIdAt(e.d - WORLD.ROW - 9) === 'village';   // biome of the generator row (D), as in generator.js
      if (e.kind === 'tappeto' && v && e.mx === undefined && !e.weaver && e.value !== CARPETS.PER_ROW) bad.push({ seed, m: Math.round(e.d / PX_PER_METER), why: 'carpet value ' + e.value });
      if ((e.kind === 'asfodelo' || e.kind === 'ferula') && v) { if (e.d - last < 5 * WORLD.ROW - 1) bad.push({ seed, m: Math.round(e.d / PX_PER_METER), why: 'fuel too close' }); last = e.d; }
    }
  }
  assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 8)));
});

test('fuel total is preserved by thinning (doubled bundles make up for skipped ones)', () => {
  for (const { seed, ents } of runs.slice(0, 12)) {
    const n = ents.filter((e) => e.kind === 'asfodelo' || e.kind === 'ferula').reduce((s, e) => s + (e.mult || 1), 0);
    assert.ok(n > 30 * LAPS, 'too little fuel on seed ' + seed + ': ' + n);
  }
});

test('no frakkera holders / fires on the LEFT in the village, none at all in nature zones', () => {
  const bad = [];
  for (const { seed, ents } of runs) for (const e of ents) if (e.kind === 'falo') {
    const z = biomeIdAt(e.d);
    if ((z === 'village' && e.side < 0) || NATURE.has(z)) bad.push({ seed, m: Math.round(e.d / PX_PER_METER), z, side: e.side });
  }
  assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 8)));
});

test('user rules in source: no bunting/pennant strings over the street, no junction arrows', () => {
  const w3 = fs.readFileSync(new URL('../src/game/world3d.js', import.meta.url), 'utf8');
  const fest = w3.slice(w3.indexOf("} else if (kind === 'festone') {"), w3.indexOf("} else if (kind === 'panni') {"));
  assert.ok(fest.length > 0 && !/new THREE\.(Mesh|Sprite|Line|Points)/.test(fest), 'festone view must stay empty');
  for (const f of ['world3d.js', 'biomes/env.js', 'village3d.js', 'festa3d.js']) {
    const s = fs.readFileSync(new URL('../src/game/' + f, import.meta.url), 'utf8');
    assert.ok(!/arrowTexture\(/.test(s), 'junction arrow texture used in ' + f);
  }
});
