// v5s45 (QA10 #2): in galleria (miniera interna) tubo blu e cavo corrono lungo le pareti, non sopra la camera
// (camera a ~6.4 m, fino a ~1.2 m di lato): niente bande diagonali in cima allo schermo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tunnelProps, PIPE, CABLE, TUNNEL } from '../src/game/biomes/builders/structures.js';

test('mine-int pipe and cable stay >= 3.5 m (was 1.7-2.9 m) from the camera path and inside the rock vault', () => {
  const g = tunnelProps(1200, 10, 'rock', [], {});
  const p = g.attributes.position;
  let bad = null;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const d = Math.min(...[-1.2, 0, 1.2].map((cx) => Math.hypot(x - cx, y - 6.4)));
    if (d < 3.5) { bad = { x: +x.toFixed(2), y: +y.toFixed(2), d: +d.toFixed(2) }; break; }
  }
  assert.equal(bad, null, 'prop too close to the camera ' + JSON.stringify(bad));
  // davanti alla parete: la roccia puo' sporgere verso l'interno fino a 0.7 m dal profilo nominale
  for (const o of [PIPE, CABLE]) {
    const a = Math.asin((o.y - TUNNEL.wallH) / TUNNEL.crown), wallX = Math.cos(a) * TUNNEL.halfW;
    assert.ok(Math.abs(o.x) + 0.12 < wallX - 0.7 * 0.87, `${JSON.stringify(o)} hidden in the rock (wall at ${wallX.toFixed(2)})`);
  }
});
