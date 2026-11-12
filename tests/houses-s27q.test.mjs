// v5s27q: nessuna casa della piazza della chiesa (ne' le file a bordo via) sopra la via o i marciapiedi, su nessun giro.
// Le case sono prefab fissi (indipendenti dal giro): si verifica la posizione finale come in env.js (radice specchiata).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildChurchSquare } from '../src/game/biomes/builders/church.js';
import { endWallMural } from '../src/game/biomes/muralWall.js';
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
// v5s29: anche le file di case a bordo via (prefab del paese e orti): a terra niente oltre il bordo della via (x = 5.5)
test('case a bordo via fuori dalla carreggiata, ogni prefab', () => {
  const ROAD = 11 / 2;
  const chk = (g, name) => { const p = g.attributes.position; for (let j = 0; j < p.count; j++) if (p.getY(j) < 2.6) assert.ok(FACADE - p.getX(j) >= ROAD - 0.01, `${name} sporge sulla via`); };
  for (let i = 1; i <= 26; i++) chk(M.buildHouse(i).geom, 'casa ' + i);
  for (let i = 1; i <= 5; i++) chk(M.buildGarden(i).geom, 'orto ' + i);
});
test('il murale di Tolu copre il muro di testa, in proporzione, con la faccia intera', () => {
  const pf = M.buildHouse(19);
  const fit = endWallMural(pf.geom);
  assert.ok(Math.abs(fit.cx - -3) < 0.02, 'centrato sulla profondita\'');
  assert.ok(fit.w > 5.8 && fit.w < 6, `bordo a bordo, largo ${fit.w.toFixed(2)}`);
  assert.ok(fit.cy - fit.h / 2 < 0.4, 'zoccolo basso');
  assert.ok(fit.cy + fit.h / 2 > pf.h - 0.2, 'arriva sotto la gronda');
  const imgA = 768 / 1010;
  const shownA = ((fit.u1 - fit.u0) * imgA) / (fit.v1 - fit.v0);
  assert.ok(Math.abs(shownA - fit.w / fit.h) < 1e-3, 'niente stiramento');
  assert.equal(fit.u0, 0, 'il viso a sinistra resta nel quadro');
  assert.ok(fit.u1 > 0.8, 'il fascio resta visibile');
});
test('l\'ultimo lampione davanti al murale di Tolu non c\'e\' piu\'', () => {
  const sq = buildChurchSquare(1);
  const nearMural = sq.lamps.filter((l) => Math.abs(l[0] - 8) < 0.4 && l[2] > -22 && l[2] < -16);
  assert.equal(nearMural.length, 0, 'palo ancora davanti al murale: ' + JSON.stringify(nearMural));
  const row = sq.lamps.filter((l) => Math.abs(l[0] - 8) < 0.4 && l[1] > 3);
  assert.equal(row.length, 1, 'la fila verso il murale tiene il palo piu\' avanti');
  assert.ok(row[0][2] < -22, 'il palo rimasto non e\' quello lontano dal murale');
});
