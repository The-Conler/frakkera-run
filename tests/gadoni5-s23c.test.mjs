// v5 stage 23c: vicolo delle porte e cappella tonda fuori dalle corsie (|x| > meta' strada)
import assert from 'node:assert';
import { buildVicolo, buildCappella, buildCappellaLeft } from '../src/game/biomes/builders/gadoni5.js';
const HALF = 5.5;
for (const [n, g, side] of [['vicolo', buildVicolo(26), 0], ['cappella', buildCappella(), 1], ['cappellaL', buildCappellaLeft(), -1]]) {
  const p = g.attributes.position; let bad = 0;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < HALF && p.getY(i) > 0.2) bad++;
  assert.strictEqual(bad, 0, `${n}: niente sopra le corsie`);
  assert.ok(p.count < 40000, `${n}: geometria leggera (${p.count} vertici)`);
}
console.log('gadoni5-s23c ok');
