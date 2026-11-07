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
// v5s41: test aggiornato. Dalla v5s37 il bounding box della vista comprende anche il lastricato a terra (y ~0.03) che si
// allarga oltre il vuoto: il vecchio controllo sul box (con 5 m di margine) falliva senza una compenetrazione reale.
// Ora: nessuna parte SOPRA terra (y > 0.2 m) della chiesa/piazzetta nella striscia delle case (x > -16.5 m) fuori dal vuoto
// sinistro che la contiene (tolti 0.5 m di gronda delle case vicine).
const vg = buildVista(1), P = vg.attributes.position, X = VISTA.X;
assert.ok(VISTA.AT_M < 80, 'chiesa col campanile all\'inizio del paese');
const gap = V.gaps.left.find(([a, z]) => a <= VISTA.AT_M && z >= VISTA.AT_M);
assert.ok(gap, 'vuoto a sinistra alla chiesa');
let out = 0; for (let i = 0; i < P.count; i++) { const W = VISTA.AT_M - P.getZ(i); if (P.getY(i) > 0.2 && P.getX(i) + X > -16.5 && (W < gap[0] + 0.5 || W > gap[1] - 0.5)) out++; }
assert.ok(out === 0, `chiesa/piazzetta fuori dal vuoto [${gap}] nella striscia delle case: ${out} vertici`);
// 3) i vuoti di uno stesso lato non si sovrappongono e sono ordinati
for (const side of ['left', 'right']) { const gs = V.gaps[side]; for (let i = 1; i < gs.length; i++) assert.ok(gs[i][0] >= gs[i - 1][1], `vuoti ${side} sovrapposti`); }
console.log('village-overlap-s27 ok');
