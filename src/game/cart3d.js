// =====================================================================
// v5s18: carrello della miniera (vuoto, ci sale il giocatore) e binari interrotti agli
// scambi: respingente a strisce, binario crollato (rotaie piegate e sassi), frana con
// puntelli spezzati. Geometrie Kit statiche, materiali condivisi.
// =====================================================================
import { Kit, G, rng } from './kit.js';

let cache = null;
function rideCart() {
  const k = new Kit(181);
  const rust = '#7a4226', rust2 = '#5a3018', dark = '#22180f', iron = '#3a3634';
  const W = 2.3, L = 2.8, H = 1.05, y0 = 0.42;
  // cassone aperto (pareti, niente coperchio) leggermente svasato
  k.add(G.box(W, 0.12, L), rust2, { y: y0 + 0.06 });
  for (const sx of [-1, 1]) k.add(G.box(0.12, H, L), rust, { x: sx * W / 2, y: y0 + H / 2, rz: -sx * 0.08, vary: 0.1 });
  for (const sz of [-1, 1]) k.add(G.box(W, H, 0.12), rust, { z: sz * L / 2, y: y0 + H / 2, rx: sz * 0.08, vary: 0.1 });
  for (const sz of [-1, 1]) k.add(G.box(W + 0.2, 0.1, 0.16), iron, { z: sz * (L / 2 + 0.02), y: y0 + H });   // bordi rinforzati
  for (const sx of [-1, 1]) k.add(G.box(0.16, 0.1, L + 0.2), iron, { x: sx * (W / 2 + 0.02), y: y0 + H });
  for (const z of [-0.6, 0.6]) for (const sx of [-1, 1]) k.add(G.box(0.05, H * 0.9, 0.12), iron, { x: sx * (W / 2 + 0.07), y: y0 + H / 2, z });  // costole
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.add(G.cyl(0.3, 0.3, 0.12, 12), dark, { x: sx * (W / 2 - 0.15), y: 0.32, z: sz * (L / 2 - 0.45), rz: Math.PI / 2 });
    k.add(G.cyl(0.1, 0.1, 0.14, 8), '#8a7a60', { x: sx * (W / 2 - 0.13), y: 0.32, z: sz * (L / 2 - 0.45), rz: Math.PI / 2 });
  }
  for (const sz of [-1, 1]) k.add(G.box(0.5, 0.22, 0.22), iron, { y: 0.5, z: sz * (L / 2 + 0.15) });            // respingenti
  k.add(G.box(0.4, 0.3, 0.06), '#d8c8a0', { x: 0.55, y: y0 + 0.62, z: L / 2 + 0.07 });                           // targhetta numero
  k.add(G.box(0.3, 0.06, 0.02), '#2a2018', { x: 0.55, y: y0 + 0.62, z: L / 2 + 0.11 });
  return k.build({ ao: 0.15 });
}
function bufferStop(seed) {
  const k = new Kit(seed), r = rng(seed);
  const wood = '#6a4a2a';
  for (const x of [-1.15, 1.15]) k.add(G.box(0.3, 1.9, 0.3), wood, { x, y: 0.95, vary: 0.1 });
  for (const x of [-1.15, 1.15]) k.add(G.box(0.24, 0.24, 1.6), wood, { x, y: 0.4, z: -0.7, rx: 0.5 });   // puntoni
  // trave a strisce bianche e rosse
  for (let i = 0; i < 6; i++) k.add(G.box(0.46, 0.5, 0.32), i % 2 ? '#e8e0d0' : '#c0282c', { x: -1.15 + 0.23 + i * 0.46, y: 1.35, z: 0.05 });
  k.add(G.box(2.7, 0.3, 0.3), '#3a2a1a', { y: 0.55 });
  for (const x of [-0.6, 0.6]) k.add(G.box(0.45, 0.24, 0.24), '#3a3634', { x, y: 0.55, z: 0.2 });          // tamponi
  // croce di Sant'Andrea (binario chiuso)
  k.add(G.box(1.4, 0.16, 0.06), '#e8e0d0', { y: 2.3, z: 0.1, rz: 0.6 }); k.add(G.box(1.4, 0.16, 0.06), '#e8e0d0', { y: 2.3, z: 0.1, rz: -0.6 });
  k.add(G.box(0.12, 2.4, 0.12), '#2a2a2a', { x: 0, y: 1.2, z: -0.25 });
  for (let i = 0; i < 6; i++) k.add(G.ico(r.range(0.2, 0.42), 0), r.pick(['#5a5048', '#6a6058', '#4a4038']), { x: r.range(-1.2, 1.2), y: 0.15, z: r.range(-1.4, -0.4), flat: true, vary: 0.2 });
  return k.build({ ao: 0.2 });
}
function collapsed(seed) {
  const k = new Kit(seed), r = rng(seed);
  const rail = '#6a625a', rock = ['#5a5048', '#6a6058', '#4a4038', '#7a6e62'];
  // rotaie strappate e piegate verso l'alto, traversine sparse
  for (const x of [-0.75, 0.75]) { k.add(G.box(0.14, 0.14, 1.6), rail, { x, y: 0.5, z: 0.6, rx: -0.6, rz: x * 0.25 }); k.add(G.box(0.14, 0.14, 1.4), rail, { x: x * 1.3, y: 0.9, z: -0.6, rx: 0.9, ry: x * 0.6 }); }
  for (let i = 0; i < 4; i++) k.add(G.box(2.2, 0.16, 0.3), '#4a3220', { y: 0.1 + r.range(0, 0.3), z: r.range(-1, 1), ry: r.range(-0.6, 0.6), rz: r.range(-0.3, 0.3), vary: 0.15 });
  // buca e mucchio di sassi
  k.add(G.cyl(1.3, 1.1, 0.06, 10), '#0e0b09', { y: 0.03 });
  for (let i = 0; i < 14; i++) k.add(G.ico(r.range(0.25, 0.6), 0), r.pick(rock), { x: r.range(-1.3, 1.3), y: r.range(0.1, 1.1), z: r.range(-1.2, 0.2), flat: true, vary: 0.2 });
  k.add(G.box(0.22, 2.0, 0.22), '#6a4a2a', { x: 0.9, y: 0.6, z: -0.3, rz: 1.1 });                           // puntello spezzato
  return k.build({ ao: 0.2 });
}
function rockfall(seed) {
  const k = new Kit(seed), r = rng(seed);
  const rock = ['#5a5048', '#6a6058', '#4a4038', '#7a6e62'];
  for (let i = 0; i < 20; i++) { const h = r.range(0, 1); k.add(G.ico(r.range(0.3, 0.75) * (1 - h * 0.4), 0), r.pick(rock), { x: r.range(-1.4, 1.4) * (1 - h * 0.5), y: 0.2 + h * 1.6, z: r.range(-1.2, 0.6), flat: true, vary: 0.2 }); }
  k.add(G.box(0.24, 2.6, 0.24), '#6a4a2a', { x: -0.4, y: 1.0, z: 0.3, rz: 0.9 }); k.add(G.box(2.4, 0.24, 0.24), '#6a4a2a', { y: 1.9, z: 0.1, rz: -0.25 });
  return k.build({ ao: 0.2 });
}
export function cartGeoms() {
  if (!cache) cache = { cart: rideCart(), dead: [bufferStop(191), collapsed(192), rockfall(193)] };
  return cache;
}
