// v5s27q: nessuna casa della piazza della chiesa (ne' le file a bordo via) sopra la via o i marciapiedi, su nessun giro.
// Le case sono prefab fissi (indipendenti dal giro): si verifica la posizione finale come in env.js (radice specchiata).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildChurchSquare } from '../src/game/biomes/builders/church.js';
import * as M from '../src/game/models.js';
const FACADE = 11 / 2 + 1.45;   // via + marciapiede (env.js)
test('case della piazza fuori dal corridoio della via, giri 0-2', () => {
  for (let lap = 0; lap < 3; lap++) {
    const sq = buildChurchSquare(1); let chainZ = 0;
    for (const h of sq.houses) {
      const pf = M.buildHouse(h.seed % 26 + 1); pf.geom.computeBoundingBox(); const m = new THREE.Mesh(pf.geom);
      if (h.road) { const z = h.z ?? chainZ; m.scale.x = -1; m.position.set(h.x, 0, z); chainZ = z - pf.w; }
      else { m.rotation.y = h.ry; if (h.ry > 0) m.position.set(h.x, 0, h.z); else m.position.set(h.x - pf.w, 0, h.z); }
      const root = new THREE.Group(); root.scale.x = -1; root.add(m); root.updateMatrixWorld(true);
      const b = pf.geom.boundingBox.clone().applyMatrix4(m.matrixWorld);
      assert.ok(b.min.x >= FACADE - 0.01 || b.max.x <= -FACADE + 0.01, `giro ${lap} casa ${h.seed} sulla via: x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)}`);
    }
  }
});
