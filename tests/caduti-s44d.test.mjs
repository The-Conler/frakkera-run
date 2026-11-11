// v5s44d: Monumento ai Caduti al posto della casa con porta azzurra (unica, non prefab)
// La statua non e' piu' nel kit: e' un cartellone (cadutiStatue) con la foto vera.
import assert from 'node:assert';
import { buildVicolo, buildCaduti, cadutiStatue } from '../src/game/biomes/builders/gadoni5.js';

const g = buildCaduti();
const p = g.attributes.position;
let maxY = -Infinity;
for (let i = 0; i < p.count; i++) if (p.getY(i) > maxY) maxY = p.getY(i);
assert.ok(p.count < 14000, `geometria leggera (${p.count} vertici)`);

const st = cadutiStatue(null);
assert.strictEqual(st.name, 'memorial-statue');
const sp = st.geometry.attributes.position;
let minY = Infinity, maxS = -Infinity, minX = Infinity, maxX = -Infinity;
for (let i = 0; i < sp.count; i++) {
  minY = Math.min(minY, sp.getY(i)); maxS = Math.max(maxS, sp.getY(i));
  minX = Math.min(minX, sp.getX(i)); maxX = Math.max(maxX, sp.getX(i));
}
const h = maxS - minY, w = maxX - minX;
assert.ok(Math.abs(w / h - 348 / 595) < 0.01, `proporzioni 348:595 (${w.toFixed(2)}x${h.toFixed(2)})`);
assert.ok(h > 3.4 && h < 4.3, `altezza statua ${h.toFixed(2)}`);
const plate = st.position.y + minY;
assert.ok(plate > 2.95 && plate < 3.4, `lastra sul masso a y=${plate.toFixed(2)}`);
const statueTop = st.position.y + maxS;
assert.ok(statueTop >= 6.6 && statueTop <= 8.0, `cima della statua ${statueTop.toFixed(2)}`);

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
console.log('caduti-s44d ok', { statueTop: +statueTop.toFixed(2), plate: +plate.toFixed(2), maxY: +maxY.toFixed(2), cadutiV: p.count, vicoloV: vp.count, leftHi });
