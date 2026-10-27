// v5 stage 23: livelli di neve per giro (solo grafica: la simulazione non legge la neve)
import assert from 'node:assert';
import { snowAt } from '../src/game/snow.js';
import { CYCLE } from '../src/game/biomes/config.js';
import { readFileSync } from 'node:fs';
const at = (lap, f) => snowAt(lap * CYCLE + f * CYCLE);
assert.deepStrictEqual([at(0, 0.1).ground, at(0, 0.9).fall], [0, 0], 'giro 1 senza neve');
assert.ok(at(1, 0.5).fall > 0.5 && at(1, 0.5).ground > 0.05 && at(1, 0.99).ground < 0.45, 'giro 2: nevica, spolverata');
assert.ok(at(2, 0.1).ground > 0.99 && at(3, 0.5).ground === 1, 'giro 3: tutto bianco');
for (let b = 0; b < 4 * CYCLE; b += 7) { const a = snowAt(b), c = snowAt(b + 7); assert.ok(c.ground >= a.ground - 1e-9, 'la neve non cala'); }
assert.ok(!/snow/i.test(readFileSync(new URL('../src/game/sim.js', import.meta.url), 'utf8')), 'la sim non dipende dalla neve');
console.log('snow-s23 ok');
