// v5s39: nessun albero/cespuglio del paese interseca l'impronta di una casa (margine incluso), giri 0-2, entrambi i lati.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));
const probe = join(dir, '../tools/tree_house_overlap_probe.mjs');
const r = spawnSync(process.execPath, [probe, '--apply'], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr || r.stdout);
const j = JSON.parse(r.stdout);
assert.equal(j.totalOverlaps, 0, `overlaps=${j.totalOverlaps} ${JSON.stringify(j.laps.map((l) => l.samples))}`);
console.log('village-trees-s39 ok', { houses: j.laps[0].houses, plants: j.laps[0].plants, laps: j.laps.length });
