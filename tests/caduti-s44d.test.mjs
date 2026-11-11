// v5s44d: Monumento ai Caduti al posto della casa con porta azzurra (unica, non prefab)
import assert from 'node:assert';
import { buildVicolo, buildCaduti } from '../src/game/biomes/builders/gadoni5.js';

const g = buildCaduti();
const p = g.attributes.position, c = g.attributes.color;
let maxY = -Infinity, statueTop = -Infinity, bronze = 0;
for (let i = 0; i < p.count; i++) {
  const y = p.getY(i), r = c.getX(i), gv = c.getY(i), b = c.getZ(i);
  if (y > maxY) maxY = y;
  // patina di bronzo verde-grigio in spazio lineare (g >= r), non il marrone scuro di prima
  if (y > 5.0 && r > 0.02 && r < 0.7 && gv >= r * 0.9 && gv <= r * 1.6 && b > r * 0.7 && b < gv * 1.15) {
    bronze++;
    if (y > statueTop) statueTop = y;
  }
}
assert.ok(bronze > 30, `gruppo bronzeo presente (${bronze} vertici)`);
assert.ok(statueTop >= 6.6 && statueTop <= 7.6, `cima della statua ${statueTop.toFixed(2)} (atteso ~7 m)`);
assert.ok(p.count < 14000, `geometria leggera (${p.count} vertici)`);

const HALF = 5.5;
const v = buildVicolo(32);
const vp = v.attributes.position;
let bad = 0, leftHi = 0;
for (let i = 0; i < vp.count; i++) {
  const x = vp.getX(i), y = vp.getY(i), z = vp.getZ(i);
  if (Math.abs(x) < HALF && y > 0.2) bad++;
  if (x < -6.0 && y > 5.8 && z < -14 && z > -28) leftHi++;
}
assert.strictEqual(bad, 0, 'vicolo+caduti: niente sopra le corsie');
assert.ok(leftHi > 10, `statua a sinistra nel vicolo vicino a z=-21 (${leftHi} vertici alti)`);
assert.ok(vp.count < 40000, `vicolo ancora leggero (${vp.count} vertici)`);
console.log('caduti-s44d ok', { statueTop: +statueTop.toFixed(2), maxY: +maxY.toFixed(2), bronze, cadutiV: p.count, vicoloV: vp.count, leftHi });
