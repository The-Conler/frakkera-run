// v5 stage 27: nessun edificio del paese si compenetra (case a lato, chiesa col campanile, piazze)
import assert from 'node:assert';
import * as THREE from 'three';
import { buildHouse } from '../src/game/models.js';
import { buildVista, VISTA } from '../src/game/biomes/builders/church.js';
import { BIOMES } from '../src/game/biomes/config.js';
const V = BIOMES.find((b) => b.id === 'village');
// 1) (gronde e cornicioni sporgono al massimo 0.5 m) ogni prefab di casa/giardino resta dentro la sua striscia [0, w] lungo la via (case contigue non si incastrano)
// corpo dell'edificio (dietro la facciata, sotto la gronda): x < -0.7, y < h
const body = (g, h) => { const p = g.attributes.position, b = new THREE.Box3(); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.x < -0.7 && v.y < h - 0.05) b.expandByPoint(v); } return b; };
for (let i = 1; i <= 26; i++) {
  const h = buildHouse(i); const b = body(h.geom, h.h);
  assert.ok(b.max.z <= 0.05 && b.min.z >= -h.w - 0.05, `casa ${i}: z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)} fuori da [-${h.w}, 0]`);
}
// (i giardini sono bassi e aperti: alberi e siepi possono sporgere, non sono edifici)
// 2) la chiesa col campanile (all'inizio del paese, a sinistra) sta tutta in un vuoto del lato sinistro: niente case dentro
const vg = buildVista(1), vb = vg.boundingBox;
const W0 = VISTA.AT_M - vb.max.z, W1 = VISTA.AT_M - vb.min.z;
assert.ok(VISTA.AT_M < 80, 'chiesa col campanile all\'inizio del paese');
assert.ok(V.gaps.left.some(([a, z]) => a <= W0 - 5 && z >= W1 + 5), `vuoto a sinistra che contiene la chiesa [${W0.toFixed(1)}, ${W1.toFixed(1)}]`);
// 3) i vuoti di uno stesso lato non si sovrappongono e sono ordinati
for (const side of ['left', 'right']) { const gs = V.gaps[side]; for (let i = 1; i < gs.length; i++) assert.ok(gs[i][0] >= gs[i - 1][1], `vuoti ${side} sovrapposti`); }
console.log('village-overlap-s27 ok');
