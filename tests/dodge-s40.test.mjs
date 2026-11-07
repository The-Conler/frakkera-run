// v5s40: un giocatore che va nella corsia libera che VEDE (senza prevedere il moto) supera ogni attraversamento di
// capre, pecore, maialetti, tronchi che rotolano e ogni salto delle capre dalla roccia, su 5 giri e piu' seed.
import { play } from '../tools/policy_bot.mjs';
import { BIOMES, CYCLE } from '../src/game/biomes/config.js';
const ANIM = new Set(['goat', 'pecora', 'caprarupe', 'maialetto', 'rollbarrel']);
let bad = 0; const per = {};
for (const pred of [false, true]) for (let lap = 0; lap < 5; lap++) for (const b of BIOMES) if (['rock', 'river', 'viaduct', 'village'].includes(b.id)) for (let seed = 1; seed <= 6; seed++) {
  const { hits } = play(seed * 7919 + lap, lap * CYCLE + b.from + 5, 34, null, pred);
  for (const h of hits) if (ANIM.has(h.kind)) { bad++; per[lap] = (per[lap] || 0) + 1; console.log('UNAVOIDABLE', lap, b.id, seed, h.kind); }
}
console.log(bad ? `FALLITO: ${bad} urti inevitabili ${JSON.stringify(per)}` : 'dodge-s40 ok: 0 urti inevitabili con animali/tronchi su 5 giri');
process.exit(bad ? 1 : 0);
