// =====================================================================
// v5s16: frakkere accese lungo il percorso. Falo' a terra (fascio di canne e
// asfodelo legato, cerchio di pietre) e paesano con la frakkera in braccio.
// Geometrie Kit statiche (colori per vertice, materiali condivisi), fiamma con lo
// stesso shader della frakkera del giocatore (materiali condivisi tra tutte le viste).
// =====================================================================
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';

let cache = null;
function bundle(k, r, x, z, h, rad, lean = 0) {
  const cols = ['#c9a86a', '#b8925a', '#d6bc84', '#a88450'];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, rr = rad * (0.4 + 0.6 * ((i * 37) % 10) / 10);
    k.add(G.cyl(0.05, 0.07, h, 5), r.pick(cols), { x: x + Math.cos(a) * rr, y: h / 2, z: z + Math.sin(a) * rr, rz: lean + r.range(-0.05, 0.05), vary: 0.15 });
  }
  for (const t of [0.22, 0.5, 0.78]) k.add(G.torus(rad + 0.05, 0.04, 4, 12), '#7a3a22', { x, y: h * t, z, rx: Math.PI / 2 });
}
function bonfireGeom() {
  const k = new Kit(161), r = rng(161);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; k.add(G.ico(0.24, 0), r.pick(['#8c857a', '#a39b8e', '#77716a']), { x: Math.cos(a) * 0.95, y: 0.12, z: Math.sin(a) * 0.95, sy: 0.7, flat: true, vary: 0.2 }); }
  // tronchetti appoggiati a capanna
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; k.add(G.cyl(0.09, 0.11, 1.5, 6), r.pick(['#5a3a22', '#6b4429', '#4a301c']), { x: Math.cos(a) * 0.35, y: 0.6, z: Math.sin(a) * 0.35, rx: Math.sin(a) * 0.55, rz: -Math.cos(a) * 0.55, vary: 0.2 }); }
  k.add(G.ico(0.55, 0), '#2a1a12', { y: 0.2, sy: 0.4 });                    // brace
  k.add(G.ico(0.42, 0), '#ff8a2a', { y: 0.32, sy: 0.4, unlit: true });
  return k.build({ ao: 0.1 });
}
function villagerGeom() {
  const k = new Kit(162);
  const shirt = '#efe8da', vest = '#1c1a1a', trou = '#262422', skin = '#d9a582';
  for (const x of [-0.14, 0.14]) { k.add(G.cyl(0.11, 0.1, 0.9, 7), trou, { x, y: 0.45 }); k.add(G.box(0.18, 0.1, 0.3), '#120f0d', { x, y: 0.05, z: 0.05 }); }
  k.add(G.cyl(0.27, 0.24, 0.3, 9), trou, { y: 0.98 });
  k.add(G.cyl(0.3, 0.27, 0.7, 9), shirt, { y: 1.42 });
  k.add(G.cyl(0.315, 0.285, 0.62, 9), vest, { y: 1.45, sz: 0.95 });
  k.add(G.box(0.16, 0.5, 0.05), shirt, { y: 1.5, z: 0.29 });                // camicia aperta sul gilet
  k.add(G.cyl(0.08, 0.09, 0.14, 7), skin, { y: 1.83 });
  k.add(G.sph(0.17, 10, 8), skin, { y: 2.0 });
  k.add(G.cyl(0.18, 0.19, 0.08, 10), '#141212', { y: 2.13 });               // berritta
  k.add(G.cone(0.17, 0.42, 8), '#141212', { y: 2.36, z: -0.08, rx: -0.5 });
  k.add(G.box(0.2, 0.05, 0.05), '#3a2a20', { y: 1.93, z: 0.16 });           // baffi
  // braccia attorno alla frakkera (a destra del paesano, lato strada)
  k.add(G.cyl(0.075, 0.075, 0.62, 6), shirt, { x: 0.3, y: 1.45, z: 0.12, rx: -1.1, rz: -0.25 });
  k.add(G.cyl(0.075, 0.075, 0.62, 6), shirt, { x: -0.05, y: 1.3, z: 0.25, rz: 1.25 });
  const r = rng(163);
  bundle(k, r, 0.42, 0.3, 3.3, 0.2, 0);
  return k.build({ ao: 0.12 });
}
export function fireGeoms() {
  if (!cache) cache = { bonfire: bonfireGeom(), villager: villagerGeom() };
  return cache;
}
// punto della fiamma (coordinate locali della vista) per variante
export const FLAME_AT = [{ x: 0, y: 0.55, z: 0, s: 1.05 }, { x: 0.5, y: 3.96, z: 0.36, s: 0.8 }];
