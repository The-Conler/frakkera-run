// v5 stage 23b: chiesa+campanile fissi nel mondo, fuori dalla strada, campanile a sinistra della chiesa
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildVista, VISTA } from '../src/game/biomes/builders/church.js';
const g = buildVista(1), bb = g.boundingBox;
assert.ok(VISTA.X + bb.max.x <= -5.5 - 1.4, 'non tocca la strada (resta oltre il marciapiede sinistro)');
assert.ok(VISTA.X < 0, 'a sinistra della strada');
const w = readFileSync(new URL('../src/game/world3d.js', import.meta.url), 'utf8');
assert.ok(!/camPos\.z - VISTA/.test(w), 'nessuna distanza costante dalla camera');
assert.ok(/vistaZ/.test(w), 'posizione fissata una volta per giro');
assert.ok(!/campanile e chiesa\n/.test(readFileSync(new URL('../src/game/models.js', import.meta.url), 'utf8')), 'nessun campanile nel fondale che segue la camera');
console.log('vista-s23b ok');
