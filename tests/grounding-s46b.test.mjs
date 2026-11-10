// v5s46b: nessun tronco/ramo caduto sospeso: ai due capi deve esserci appoggio continuo fino a terra
// (tronco a terra, massi o ceppo sotto la punta). Controllo sulla geometria di ogni variante e skin.
import assert from 'node:assert/strict';
import { branchGeom } from '../src/game/power3d.js';
import { SKINS } from '../src/game/biomes/builders/skins.js';

function check(name, g, halfSpan) {
  const P = g.attributes.position;
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < P.count; i++) { minX = Math.min(minX, P.getX(i)); maxX = Math.max(maxX, P.getX(i)); }
  // il tronco attraversa in x: ai capi (ultimi 1.4 m) l'appoggio va da terra (<= 0.05) fino alla quota del tronco
  for (const [lo, hi, end] of [[minX, minX + 1.4, 'sinistro'], [maxX - 1.4, maxX, 'destro']]) {
    const ys = [];
    for (let i = 0; i < P.count; i += 3) {   // triangoli: intervallo verticale coperto
      let tlo = Infinity, thi = -Infinity, inside = false;
      for (let j = 0; j < 3; j++) { const x = P.getX(i + j), y = P.getY(i + j); if (x >= lo && x <= hi) inside = true; tlo = Math.min(tlo, y); thi = Math.max(thi, y); }
      if (inside) ys.push([tlo, thi]);
    }
    assert.ok(ys.length, `${name}: nessuna geometria al capo ${end}`);
    ys.sort((a, b) => a[0] - b[0]);
    assert.ok(ys[0][0] <= 0.05, `${name}: capo ${end} staccato da terra (${ys[0][0].toFixed(2)} m)`);
    // copertura continua da terra fino a meta' altezza del tronco (gap max 0.05 m)
    let reach = ys[0][1]; const top = Math.max(...ys.map((v) => v[1])) * 0.5;
    for (const [a, b] of ys) { if (a > reach + 0.05) break; reach = Math.max(reach, b); }
    assert.ok(reach >= top, `${name}: capo ${end} sospeso (appoggio fino a ${reach.toFixed(2)} m, tronco a ${top.toFixed(2)} m)`);
  }
}
let n = 0;
for (let v = 0; v < 8; v++) { check('ramo' + v, branchGeom(v), 6.3); n++; }
for (const [name, sk] of Object.entries(SKINS)) {
  if (!sk.make) continue;
  if (!(sk.beam || /^(log|beamTrunk)/.test(name))) continue;
  for (const rolling of [false]) { check(name, sk.make(rolling), 6.3); n++; }
}
console.log(`grounding-s46b: ok (${n} tronchi/rami/travi a terra ai due capi)`);
