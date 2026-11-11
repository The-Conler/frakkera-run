// v5s24: ogni codice del registro della corsa appartiene a un solo evento (doppioni storici ammessi: stesso evento in due punti)
import { readFileSync } from 'fs';
const src = readFileSync(new URL('../src/game/sim.js', import.meta.url), 'utf8');
const codes = [...src.matchAll(/this\.log\('([A-Za-z0-9]+)'/g)].map((m) => m[1]);
const LEGACY = new Set(['A', 'H', 'K', 'T', 'Y', 'k']);
const cnt = {}; for (const c of codes) cnt[c] = (cnt[c] || 0) + 1;
const dup = Object.keys(cnt).filter((c) => cnt[c] > 1 && !LEGACY.has(c));
if (dup.length) { console.log('FAIL codici doppi: ' + dup.join(' ')); process.exit(1); }
for (const c of ['aF', 'aP', 'aC', 'aN', 'aE', 'aG', 'aS', 'vL', 'vW', 'vI', 'vi', 'vV', 'G', 'I', 'U', 'L', 'W', 'V', 'd', 'a']) if (!cnt[c]) { console.log('FAIL manca ' + c); process.exit(1); }
console.log(`TUTTI OK (${Object.keys(cnt).length} codici)`);
