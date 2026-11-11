// "Pelli" degli ostacoli per ambiente: stessa collisione e stesso
// comportamento in sim.js, aspetto adatto al luogo (massi e tronchi in
// montagna, casse sotto il viadotto, fusti e carrelli nella miniera).
// Ogni pelle ha le stesse misure d'ingombro della botte originale.
import * as THREE from 'three';
import { Kit, G, rng, rockGeom, addRock, shrub, ROCK, LEAF } from './common.js';

const cache = new Map();
const once = (key, f) => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key); };
export function disposeSkins() { for (const g of cache.values()) g.dispose?.(); cache.clear(); }

function boulder(seed, pal, moss) {
  const k = new Kit(seed); const r = rng(seed);
  k.add(rockGeom(r, 0.95, { detail: 1, squash: 0.95, rough: 0.28 }), r.pick(pal), { y: 0.85, vary: 0.2 });
  addRock(k, r, 0.55, 0.3, 0.45, 0.42, pal, { squash: 0.7 });
  addRock(k, r, -0.5, 0.25, -0.4, 0.36, pal, { squash: 0.7 });
  if (moss) for (let i = 0; i < 7; i++) k.add(G.ico(r.range(0.25, 0.42), 0), r.pick(['#5f9a30', '#6faa3a', '#86b84a']), { x: r.range(-0.5, 0.5), y: 1.5 + r.range(-0.1, 0.2), z: r.range(-0.5, 0.5), sy: 0.45, flat: true });
  return k.build({ ao: 0.25 });
}
function boulderPile(seed, pal, moss) {
  const k = new Kit(seed); const r = rng(seed);
  for (const [x, z, s] of [[-0.8, 0.9, 0.95], [0.8, 0.9, 0.9], [-0.75, -0.9, 0.9], [0.8, -0.85, 1.0], [0, 0, 1.1]]) k.add(rockGeom(r, s, { squash: 0.85, rough: 0.3 }), r.pick(pal), { x, y: s * 0.8 + (x === 0 ? 0.9 : 0), z, vary: 0.2 });
  if (moss) for (let i = 0; i < 9; i++) k.add(G.ico(r.range(0.3, 0.5), 0), r.pick(['#5f9a30', '#6faa3a']), { x: r.range(-1, 1), y: 2.4, z: r.range(-1, 1), sy: 0.4, flat: true });
  else for (let i = 0; i < 3; i++) shrub(k, r, r.range(-1.2, 1.2), 0, r.range(-1.4, 1.4), 0.45, LEAF.dry);
  return k.build({ ao: 0.25 });
}
// tronco caduto di traverso sulla corsia (asse x), con rami spezzati
function log(seed, rolling) {
  const k = new Kit(seed); const r = rng(seed);
  const bark = ['#5a4430', '#4a3828', '#6b5038'];
  if (rolling) {           // asse y centrato in 0 (come la botte nel perno che rotola)
    k.add(G.cyl(0.66, 0.7, 1.9, 10), r.pick(bark), { vary: 0.15 });
    for (const s of [-1, 1]) k.add(G.cyl(0.6, 0.6, 0.04, 10), '#c8a06a', { y: s * 0.96 });
    k.add(G.cyl(0.25, 0.25, 0.05, 10), '#a07a4a', { y: 0.98 });
    return k.build();
  }
  k.add(G.cyl(0.5, 0.58, 2.5, 9), r.pick(bark), { y: 0.6, rz: Math.PI / 2, vary: 0.15, flat: true });
  for (const s of [-1, 1]) k.add(G.cyl(0.47, 0.47, 0.05, 9), '#c8a06a', { x: s * 1.26, y: 0.6, rz: Math.PI / 2 });
  for (let i = 0; i < 3; i++) k.add(G.cyl(0.08, 0.13, r.range(0.8, 1.4), 5), bark[0], { x: r.range(-0.8, 0.8), y: 1.05, z: r.range(-0.3, 0.3), rz: r.range(-0.8, 0.8), rx: r.range(-0.6, 0.6) });
  for (let i = 0; i < 5; i++) k.add(G.ico(r.range(0.2, 0.35), 0), r.pick(LEAF.holm), { x: r.range(-1, 1), y: r.range(1.0, 1.5), z: r.range(-0.4, 0.4), flat: true });
  for (const x of [-1.2, 1.2]) addRock(k, r, x, 0.15, 0.3, 0.25, ROCK.granite, { squash: 0.6 });
  return k.build({ ao: 0.2 });
}
function crate(seed, big) {
  const k = new Kit(seed); const r = rng(seed);
  const wood = ['#a8814f', '#9a7444', '#b58d58'], dark = '#6a4a2a';
  const one = (x, y, z, s, ry) => {
    k.add(G.box(s, s, s), r.pick(wood), { x, y: y + s / 2, z, ry, vary: 0.12 });
    for (const yy of [0.08, 0.92]) for (const zz of [-1, 1]) k.add(G.box(s + 0.04, 0.1, 0.1), dark, { x, y: y + s * yy, z: z + zz * s / 2, ry });
    for (const xx of [-1, 1]) for (const zz of [-1, 1]) k.add(G.box(0.1, s, 0.1), dark, { x: x + xx * s / 2 * Math.cos(ry) + zz * s / 2 * Math.sin(ry), y: y + s / 2, z: z - xx * s / 2 * Math.sin(ry) + zz * s / 2 * Math.cos(ry) });
    k.add(G.box(s * 1.2, 0.1, 0.1), dark, { x, y: y + s / 2, z: z + s / 2 + 0.02, rz: 0.78, ry });
  };
  if (!big) { one(0, 0, 0, 1.55, 0.1); return k.build({ ao: 0.25 }); }
  for (const [x, z] of [[-0.75, 0.9], [0.75, 0.9], [-0.75, -0.9], [0.75, -0.9]]) one(x, 0, z, 1.45, r.range(-0.1, 0.1));
  one(0, 1.45, 0, 1.35, 0.3);
  return k.build({ ao: 0.25 });
}
// fusto di ferro arrugginito (stessa sagoma della botte, senza pancia)
function drum(seed, rolling) {
  const k = new Kit(seed); const r = rng(seed);
  const rust = ['#8a4a2a', '#7a3e22', '#9a5a32'];
  const y0 = rolling ? -0.9 : 0;
  k.add(G.cyl(0.7, 0.7, 1.8, 16), r.pick(rust), { y: y0 + 0.9, vary: 0.12 });
  for (const t of [0.04, 0.36, 0.64, 0.96]) k.add(G.cyl(0.74, 0.74, 0.08, 16), '#5a2e1a', { y: y0 + 1.8 * t });
  k.add(G.cyl(0.68, 0.68, 0.02, 16), '#4a2a1a', { y: y0 + 1.81 });
  k.add(G.box(0.5, 0.4, 0.02), '#d8c050', { y: y0 + 1.1, z: 0.71 });
  return k.build();
}
// carrello da miniera (vagoncino) - singolo o grande carico di minerale
function cart(seed, big) {
  const k = new Kit(seed); const r = rng(seed);
  const rust = '#8a4a2a', rust2 = '#6a3820', dark = '#2a1a12', ore = ['#5a5650', '#6a6258', '#4a4640', '#7a6a58'];
  const W = big ? 2.6 : 1.5, L = big ? 3.4 : 1.8, H = big ? 1.5 : 1.25;
  k.add(G.box(W, H, L), rust, { y: 0.45 + H / 2, vary: 0.1 });
  k.add(G.box(W + 0.18, 0.12, L + 0.18), rust2, { y: 0.45 + H });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(G.cyl(0.32, 0.32, 0.14, 12), dark, { x: sx * (W / 2 - 0.1), y: 0.34, z: sz * (L / 2 - 0.35), rz: Math.PI / 2 });
  for (const sz of [-1, 1]) k.add(G.box(W * 0.6, 0.3, 0.16), rust2, { y: 0.6, z: sz * (L / 2 + 0.1) });
  for (let i = 0; i < (big ? 14 : 6); i++) addRock(k, r, r.range(-W / 2.6, W / 2.6), 0.45 + H + r.range(-0.1, 0.15), r.range(-L / 2.6, L / 2.6), r.range(0.2, 0.38), ore, { squash: 0.7 });
  k.add(G.box(0.08, 0.32, 0.42), '#f4e27a', { x: W / 2 + 0.02, y: 0.7 + H * 0.35, z: 0.1 });   // v5s46d (295): numero dipinto
  k.add(G.box(0.04, 0.2, 0.06), '#2a2418', { x: W / 2 + 0.06, y: 0.7 + H * 0.35, z: 0.02 });
  k.add(G.box(0.04, 0.2, 0.06), '#2a2418', { x: W / 2 + 0.06, y: 0.7 + H * 0.35, z: 0.18 });
  k.add(G.cyl(0.03, 0.03, 0.8, 5), '#6a4a28', { x: -W / 2 + 0.15, y: H * 0.6, z: L / 2 - 0.1, rz: 0.6 });
  return k.build({ ao: 0.2 });
}
// travi di legno accatastate di traverso (corsia), su due zeppe
function timbers(seed) {
  const k = new Kit(seed); const r = rng(seed);
  const wood = ['#7a5a36', '#6b4a2e', '#8a6a42'];
  for (const [y, z] of [[0.3, -0.32], [0.3, 0.32], [0.82, 0]]) k.add(G.box(2.4, 0.5, 0.55), r.pick(wood), { y, z, vary: 0.12, ry: r.range(-0.04, 0.04) });
  for (const x of [-1.0, 1.0]) k.add(G.box(0.3, 0.3, 1.1), '#4a3420', { x, y: 0.12 });
  return k.build({ ao: 0.2 });
}
function rubble(seed, pal, blue) {
  const k = new Kit(seed); const r = rng(seed);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
    const x = -1.2 + i * 0.48 + row * 0.24;
    k.add(rockGeom(r, r.range(0.3, 0.42), { detail: 0, squash: 0.75 }), r.pick(pal), { x, y: 0.28 + row * 0.4, z: r.range(-0.15, 0.15), vary: 0.2 });
  }
  if (blue) for (let i = 0; i < 6; i++) k.add(G.box(0.08, 0.08, 0.08), '#8fa6ff', { x: r.range(-1.2, 1.2), y: r.range(0.3, 1.2), z: 0.35, unlit: true });
  return k.build({ ao: 0.25 });
}
// carrello a mano (si muove di traverso come la capra)
function trolley(seed) {
  const k = new Kit(seed);
  k.add(G.box(1.5, 0.15, 0.9), '#6b4a2e', { y: 0.65 });
  k.add(G.box(0.1, 0.9, 0.9), '#3a3a3a', { x: 0.75, y: 1.1 });
  k.add(G.cyl(0.04, 0.04, 0.9, 6), '#3a3a3a', { x: 0.8, y: 1.55, rx: Math.PI / 2 });
  for (const [x, z] of [[-0.5, 0.48], [0.5, 0.48], [-0.5, -0.48], [0.5, -0.48]]) k.add(G.cyl(0.28, 0.28, 0.1, 10), '#222', { x, y: 0.3, z, rx: Math.PI / 2 });
  k.add(G.box(0.6, 0.4, 0.5), '#5a5650', { x: -0.2, y: 0.95 });
  k.add(G.box(0.4, 0.3, 0.4), '#7a6a58', { x: 0.25, y: 0.88, z: 0.1 });
  return k.build();
}
// ---- v5s6: travi basse (tutta la strada; sotto a ~2.2 u: si passa solo abbassandosi) ----
const BEAM_Y = 2.25, HALF = 6.3;
function beamTimber(seed) {           // miniera: trave squadrata su due montanti, con lanterna
  const k = new Kit(seed); const r = rng(seed);
  const wood = ['#7a5a36', '#6b4a2e', '#8a6a42'];
  k.add(G.box(HALF * 2 + 0.6, 0.62, 0.62), r.pick(wood), { y: BEAM_Y + 0.31, vary: 0.1 });
  // montanti fuori dalle corsie (bordo corsia ~5.1 m), basi affondate, brace che tocca la trave. Il filo della trave resta a BEAM_Y.
  const px = 5.65;
  for (const s of [-1, 1]) {
    k.add(G.box(1.05, 3.5, 1.05), '#c49a62', { x: s * px, y: 1.2, vary: 0.06 });
    k.add(G.box(1.9, 0.46, 1.55), '#2e2218', { x: s * px, y: -0.06 });
    k.add(G.box(0.32, 0.32, 1.35), '#c49a62', { x: s * 5.15, y: 2.2, rz: s * 0.48 });
  }
  for (let i = 0; i < 4; i++) k.add(G.box(0.05, 0.5, 0.64), '#3a2a1a', { x: -4.5 + i * 3, y: BEAM_Y + 0.31 });
  k.add(G.box(0.3, 0.4, 0.3), '#ffcf6a', { x: 0, y: BEAM_Y - 0.25, unlit: true });
  for (const x of [-2.2, 2.2]) k.add(G.box(0.7, 0.08, 0.66), '#d8a040', { x, y: BEAM_Y + 0.05, unlit: true }); // fasce gialle di pericolo
  return k.build({ ao: 0.2 });
}
function beamVillage(seed) {          // v5s44c: festoni/bandiere della festa tra due pali (non un ponte/balcone)
  const k = new Kit(seed); const r = rng(seed);
  const px = 6.35;
  for (const s of [-1, 1]) {
    k.add(G.cyl(0.13, 0.16, 5.4, 8), r.pick(['#e2c49a', '#d4b888']), { x: s * px, y: 2.7 });
    k.add(G.box(0.62, 0.2, 0.62), '#8a6240', { x: s * px, y: 0.08 });
  }
  k.add(G.box(px * 2 + 0.2, 0.045, 0.045), '#e8e2d4', { y: BEAM_Y + 1.15 });   // filo alto
  const cols = ['#c8283a', '#2f6fb0', '#f0b030', '#2f8a4a', '#f3ead6', '#c8283a'];
  for (let i = 0; i < 7; i++) {
    const x = -5.1 + i * 1.52, w = 1.22, h = 1.12, sag = Math.sin((i / 6) * Math.PI) * 0.12;
    k.add(G.box(w, h, 0.05), r.pick(cols), { x, y: BEAM_Y + h / 2 - sag });   // bandiere: il bordo basso e' a BEAM_Y (stesso urto)
    k.add(G.box(w, 0.07, 0.06), r.pick(['#f3ead6', '#2a2a2a', '#c8283a']), { x, y: BEAM_Y + h * 0.72 - sag });
  }
  for (let i = 0; i < 11; i++) {
    const q = i / 10, x = -HALF + q * HALF * 2, sag = Math.sin(q * Math.PI) * 0.3;
    k.add(G.ico(0.08, 0), i % 2 ? '#ffe9a0' : '#ffd36a', { x, y: BEAM_Y - 0.04 - sag, z: 0.18, unlit: true });
  }
  return k.build({ ao: 0.15 });
}
function beamTrunk(seed, moss) {      // roccia / fiume / viadotto: tronco caduto appoggiato su due massi
  const k = new Kit(seed); const r = rng(seed);
  const bark = ['#5a4430', '#4a3828', '#6b5038'];
  k.add(G.cyl(0.42, 0.55, HALF * 2 + 1.2, 10), r.pick(bark), { y: BEAM_Y + 0.42, rz: Math.PI / 2, vary: 0.12, flat: true });
  for (const s of [-1, 1]) k.add(G.cyl(0.4, 0.5, 0.05, 10), '#c8a06a', { x: s * (HALF + 0.62), y: BEAM_Y + 0.42, rz: Math.PI / 2 });
  for (let i = 0; i < 5; i++) k.add(G.cyl(0.06, 0.12, r.range(0.8, 1.5), 5), bark[0], { x: r.range(-5, 5), y: BEAM_Y + 0.85, z: r.range(-0.3, 0.3), rz: r.range(-0.9, 0.9), rx: r.range(-0.6, 0.6) });
  for (let i = 0; i < 8; i++) k.add(G.ico(r.range(0.2, 0.36), 0), r.pick(moss ? ['#5f9a30', '#6faa3a', '#86b84a'] : LEAF.holm), { x: r.range(-5.5, 5.5), y: BEAM_Y + r.range(0.7, 1.1), z: r.range(-0.4, 0.4), flat: true });
  const px = 5.65;
  for (const s of [-1, 1]) {
    k.add(G.cyl(0.74, 0.86, 3.4, 8), '#b8895a', { x: s * px, y: 1.22 });
    k.add(G.box(1.75, 0.42, 1.5), '#2a2218', { x: s * px, y: -0.06 });
    k.add(rockGeom(r, 1.05, { detail: 1, squash: 0.5, rough: 0.25 }), r.pick(moss ? ROCK.limestone : ROCK.granite), { x: s * px, y: 0.22, vary: 0.08 });
  }
  return k.build({ ao: 0.2 });
}
// pietre bagnate (piscina): lastre piatte lucide di acqua, con muschio
function wetStones(seed) {
  const k = new Kit(seed); const r = rng(seed);
  const wet = ['#5d6e6a', '#6b7c76', '#4f605c', '#7a8a80'];
  for (const [x, z, s] of [[-0.6, 0.4, 0.6], [0.5, 0.3, 0.55], [0, -0.45, 0.65], [0.7, -0.6, 0.4], [-0.75, -0.5, 0.42]]) k.add(rockGeom(r, s, { detail: 1, squash: 0.35, rough: 0.2 }), r.pick(wet), { x, y: 0.1, z, vary: 0.12 });
  for (let i = 0; i < 6; i++) k.add(G.ico(r.range(0.1, 0.18), 0), r.pick(['#5f9a30', '#6faa3a']), { x: r.range(-0.9, 0.9), y: 0.2, z: r.range(-0.7, 0.7), sy: 0.4, flat: true });
  for (let i = 0; i < 5; i++) k.add(G.box(0.22, 0.02, 0.06), '#e8fbff', { x: r.range(-0.7, 0.7), y: 0.3, z: r.range(-0.5, 0.5), ry: r.range(0, 3), unlit: true }); // riflessi
  return k.build({ ao: 0.15 });
}
// masso che cade (roccia): piu' grande del masso fermo
function fallRock(seed) {
  const k = new Kit(seed); const r = rng(seed);
  k.add(rockGeom(r, 1.15, { detail: 1, squash: 0.9, rough: 0.32 }), r.pick(ROCK.granite), { y: 1.0, vary: 0.2 });
  addRock(k, r, 0.6, 0.3, 0.5, 0.4, ROCK.granite, { squash: 0.7 });
  addRock(k, r, -0.6, 0.25, -0.3, 0.35, ROCK.granite, { squash: 0.7 });
  return k.build({ ao: 0.25 });
}
// sporgenza di roccia nella corsia (al posto dell'angolo di casa)
export function outcropGeometry(seed, len, width, pal, o = {}) {
  const k = new Kit(seed); const r = rng(seed);
  for (let z = -0.8; z > -len + 0.4; z -= r.range(1.1, 1.7)) {
    const h = r.range(o.hMin ?? 3.5, o.hMax ?? 6.5);
    k.add(rockGeom(r, 1, { detail: 1, squash: 1, rough: 0.3 }), r.pick(pal), { x: -width / 2, y: h / 2, z, sx: width * 0.62, sy: h * 0.62, sz: 1.3, vary: 0.2 });
    if (o.moss && r.chance(0.7)) k.add(G.ico(r.range(0.6, 1.0), 0), r.pick(['#5f9a30', '#6faa3a', '#86b84a']), { x: -width * 0.4, y: h * 0.95, z, sy: 0.5, flat: true });
    if (o.shrubs && r.chance(0.5)) shrub(k, r, -width * 0.5, h * 0.9, z, 0.7, o.leaf || LEAF.holm);
    if (o.blue) for (let i = 0; i < 3; i++) k.add(G.box(0.1, 0.1, 0.1), '#9db0ff', { x: r.range(-0.4, 0), y: r.range(0.5, h * 0.8), z: z + r.range(-0.5, 0.5), unlit: true });
  }
  k.add(G.box(width, 0.5, len), r.pick(pal), { x: -width / 2, y: 0.25, z: -len / 2, vary: 0.1 });
  return k.build({ ao: 0.2 });
}
// colori delle schegge quando la pistola distrugge l'ostacolo
export const SHARDS = {
  barrel: { pieces: ['#a8672f', '#8f5426', '#b5733a', '#6b3c1b'], iron: '#33302e', splash: '#6e1428', dust: '#d8c8b0' },
  stone: { pieces: ['#a39a8a', '#b2a893', '#8f877a', '#c2b8a3'], iron: '#7a7468', splash: '#b8b0a0', dust: '#c8c0b0' },
  moss: { pieces: ['#9a9284', '#6faa3a', '#8f877a', '#5f9a30'], iron: '#7a7468', splash: '#9ac25a', dust: '#b8c0a0' },
  wood: { pieces: ['#a8814f', '#9a7444', '#b58d58', '#6a4a2a'], iron: '#6a4a2a', splash: '#d8c090', dust: '#d8c8a8' },
  rust: { pieces: ['#8a4a2a', '#7a3e22', '#9a5a32', '#5a2e1a'], iron: '#2a1a12', splash: '#5a5650', dust: '#9a8a78' },
};
// pelle -> { make(): geometria (o null = usa il modello originale), shards, rolling }
export const SKINS = {
  barrel: { orig: true, shards: 'barrel' }, barrels: { orig: true, shards: 'barrel' }, barrelLying: { orig: true, shards: 'barrel' },
  boulder: { make: () => once('boulder', () => boulder(11, ROCK.granite)), shards: 'stone' },
  boulders: { make: () => once('boulders', () => boulderPile(12, ROCK.granite)), shards: 'stone' },
  mossBoulder: { make: () => once('mossBoulder', () => boulder(13, ROCK.limestone, true)), shards: 'moss' },
  mossBoulders: { make: () => once('mossBoulders', () => boulderPile(14, ROCK.limestone, true)), shards: 'moss' },
  log: { make: (rolling) => once('log' + (rolling ? 'R' : ''), () => log(15, rolling)), shards: 'wood' },
  crate: { make: () => once('crate', () => crate(16, false)), shards: 'wood' },
  crates: { make: () => once('crates', () => crate(17, true)), shards: 'wood' },
  drum: { make: (rolling) => once('drum' + (rolling ? 'R' : ''), () => drum(18, rolling)), shards: 'rust' },
  cart: { make: () => once('cart', () => cart(19, false)), shards: 'rust' },
  oreCart: { make: () => once('oreCart', () => cart(20, true)), shards: 'rust' },
  timbers: { make: () => once('timbers', () => timbers(21)), shards: 'wood' },
  wall: { orig: true }, mossWall: { make: () => once('mossWall', () => rubble(22, ['#a39a8a', '#6faa3a', '#8f877a', '#b2a893'])) },
  rubble: { make: () => once('rubble', () => rubble(23, ROCK.mine)) },
  rubbleBlue: { make: () => once('rubbleBlue', () => rubble(24, ['#2433a8', '#2f45c8', '#c08a4a', '#1c2a8a'], true)) },
  goat: { orig: true }, trolley: { make: () => once('trolley', () => trolley(25)) },
  puddle: { orig: true }, darkPuddle: { orig: true, puddle: '#2e2a26', dry: true }, bluePuddle: { orig: true, puddle: '#2a2a3a', dry: true },   // v5s34: in miniera niente acqua: mucchio di polvere di carbone (stesso effetto: spegne un po' la fiamma)
  house: { orig: true },
  // v5s6
  rollBarrel: { orig: true, shards: 'barrel' },
  fallRock: { make: () => once('fallRock', () => fallRock(31)), shards: 'stone' },
  wetStone: { make: () => once('wetStone', () => wetStones(32)), shards: 'moss' },
  beamTimber: { make: () => once('beamTimber', () => beamTimber(33)), beam: true },
  beamVillage: { make: () => once('beamVillage', () => beamVillage(34)), beam: true },
  beamTrunk: { make: () => once('beamTrunk', () => beamTrunk(35, false)), beam: true },
  beamTrunkMoss: { make: () => once('beamTrunkMoss', () => beamTrunk(36, true)), beam: true },
  outcrop: { narrow: { pal: ROCK.granite, shrubs: true } },
  mossOutcrop: { narrow: { pal: ROCK.limestone, moss: true } },
  tunnelRock: { narrow: { pal: ROCK.mine, hMin: 4, hMax: 7 } },
  tunnelBlue: { narrow: { pal: ['#2433a8', '#2f45c8', '#1c2a8a', '#c08a4a'], blue: true, hMin: 4, hMax: 7 } },
};
