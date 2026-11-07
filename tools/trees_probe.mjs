// Conta frakkere a bordo strada e "alberi caduti" (trave-tronco, ramo, tronco a terra, tronco che rotola) per ambiente.
import { Generator, biomeIdAt } from '../src/systems/generator.js';
import { byId } from '../src/game/biomes/config.js';
const SEEDS = +(process.argv[2] || 200), LEN = 48000, km = (LEN / 10 / 1000) * SEEDS;
const c = {};
const add = (k) => (c[k] = (c[k] || 0) + 1);
for (let s = 1; s <= SEEDS; s++) new Generator(s * 7919).fillUntil(LEN, (e) => {
  const b = biomeIdAt(e.d), sk = byId[b]?.skins || {};
  const tree = e.kind === 'ramo' || (e.kind === 'trave' && /Trunk/.test(sk.trave || '')) || ((e.kind === 'bottecoricata' || e.kind === 'rollbarrel') && sk[e.kind] === 'log');
  if (e.kind === 'falo') add(`falo ${b === 'village' ? 'paese' : 'natura'}`);
  if (tree) add(`${e.kind === 'trave' ? 'tronco da abbassarsi' : e.kind === 'ramo' ? 'ramo caduto' : e.kind === 'rollbarrel' ? 'tronco che rotola' : 'tronco a terra'}`);
});
const out = {}; for (const k of Object.keys(c).sort()) out[k] = +(c[k] / km).toFixed(2);
console.log(JSON.stringify(out));
