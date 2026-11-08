// v5s34: nella natura meno alberi caduti (ma qualcuno resta) e nessuna frakkera a bordo strada.
import { Generator, biomeIdAt } from '../src/systems/generator.js';
import { byId } from '../src/game/biomes/config.js';
let beams = 0, logs = 0, branches = 0, fires = 0, km = 0;
for (let s = 1; s <= 150; s++) { km += 4.8; new Generator(s * 7919).fillUntil(48000, (e) => {
  const b = biomeIdAt(e.d), sk = byId[b]?.skins || {};
  if (e.kind === 'falo' && b !== 'village') fires++;
  if (e.kind === 'trave' && /Trunk/.test(sk.trave || '')) beams++;
  if ((e.kind === 'bottecoricata' || e.kind === 'rollbarrel') && sk[e.kind] === 'log') logs++;
  if (e.kind === 'ramo') branches++;
}); }
const r = (x) => +(x / km).toFixed(2), res = { beams: r(beams), logs: r(logs), branches: r(branches), fires };
// v5s44c: il ritmo piu' largo dirada un poco i tronchi; ne deve restare qualcuno
const ok = fires === 0 && res.beams > 0.5 && res.beams < 2 && res.logs > 0.7 && res.logs < 4 && res.branches > 0.1 && res.branches < 0.7;
console.log(JSON.stringify(res), ok ? 'OK: alberi caduti diradati, niente frakkere nella natura' : 'FALLITO');
process.exit(ok ? 0 : 1);
