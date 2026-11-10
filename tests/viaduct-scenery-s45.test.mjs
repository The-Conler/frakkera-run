// v5s45 (QA10 #9): sul viadotto la scenografia ai lati (pendio a sinistra, salto sul fiume a destra) non entra
// entro 6.2 m dall'asse sopra l'altezza del muretto a secco (0.9-1.05 m). Il "masso" visto in QA era la strettoia
// (ostacolo 'narrow' in corsia 2), non scenografia. La geometria del viadotto (stage4) non e' toccata.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../src/game/biomes/builders/nature.js';
const FACADE = 11 / 2 + 1.45;   // = env.js FACADE (ROAD_W/2 + WALK_W)

const VALLEY = { Hs: 16, dist: 30, trees: 0.22, rocks: 0.5, wall: true, wallH: 0.9, ferns: 0.05, seed: 13, conifers: true, skirt: -50 };

test('viaduct side scenery stays beyond |x| 6.2 m above the drystone wall', () => {
  let worst = null;
  for (let W = 750; W < 1000; W += 6) for (const [name, g] of [['slope', N.slopePiece(W, 10, VALLEY)], ['river', N.riverDropPiece(W, 10, { depth: 4 })]]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const wx = FACADE - p.getX(i), y = p.getY(i);   // il pezzo e' montato a s*FACADE e specchiato verso l'esterno
      if (y > 1.1 && wx < 6.2 && (!worst || wx < worst.wx)) worst = { name, W, wx: +wx.toFixed(2), y: +y.toFixed(2) };
    }
  }
  assert.equal(worst, null, JSON.stringify(worst));
});
