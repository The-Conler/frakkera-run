// v5s40: strettoie-casa nel paese per giro (corsa continua di 5 giri, bot che schiva)
import { Sim } from '../src/game/sim.js';
import { WORLD, PX_PER_METER } from '../src/config.js';
import { biomeAt } from '../src/game/biomes/config.js';
const per = {}, ramo = {}; const hitsLap = {};
for (let seed = 1; seed <= +(process.argv[2] || 6); seed++) {
  const s = new Sim((t, d) => {
    if (t === 'spawn' && d.kind === 'narrow') { const bi = biomeAt((d.d - s.genOffset) / PX_PER_METER); if (bi.b.id === 'village') per[bi.lap] = (per[bi.lap] || 0) + 1; }
    if (t === 'spawn' && d.kind === 'ramo' && (d.variant || 0) % 2) { const bi = biomeAt((d.d - s.genOffset) / PX_PER_METER); ramo[bi.lap] = (ramo[bi.lap] || 0) + 1; }
    if (t === 'hit') { const bi = biomeAt(s.runD / PX_PER_METER); const k = `L${bi.lap}:${d.e.kind}`; hitsLap[k] = (hitsLap[k] || 0) + 1; }
  });
  s.startRun(seed * 31);
  while (biomeAt(s.runD / PX_PER_METER).lap < 5 && s.step < 400000) { s.fuel = 100; s.invuln = 1; if (s.mode === 'dance') s.skipDance(); if (s.mode === 'shop') s.exitShop(); s.tick(WORLD.FIXED_DT); }
}
console.log('branch tree on void/water side per lap', JSON.stringify(ramo));
console.log('narrow-house in village per lap', JSON.stringify(per));
