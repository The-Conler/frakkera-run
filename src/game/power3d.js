// v5s24: modelli low-poly dei potenziamenti (calamita, scudo di finocchio, scarponi) e del ramo caduto.
import { Kit, G, rng } from './kit.js';

export function magnetGeom() {        // calamita a ferro di cavallo rossa con punte d'acciaio
  const k = new Kit(241), red = '#d8342c', steel = '#dfe4ec';
  k.add(G.torus(0.42, 0.15, 6, 14), red, { y: 0.15 });
  for (const s of [-1, 1]) { k.add(G.box(0.3, 0.5, 0.3), red, { x: s * 0.42, y: -0.2 }); k.add(G.box(0.31, 0.2, 0.31), steel, { x: s * 0.42, y: -0.52 }); }
  return k.build();
}
export function fennelGeom() {        // corona intrecciata di finocchio selvatico con fiorellini gialli
  const k = new Kit(242), r = rng(242);
  for (let i = 0; i < 3; i++) k.add(G.torus(0.55, 0.07, 4, 14), ['#7fa83a', '#6a9630', '#94b84a'][i], { rz: i * 0.5, rx: Math.PI / 2 + (i - 1) * 0.18 });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.add(G.ico(0.09), r.chance(0.5) ? '#f5d53a' : '#e8b92a', { x: Math.cos(a) * 0.55, z: Math.sin(a) * 0.55, y: 0.08, flat: true }); }
  k.add(G.cyl(0.36, 0.36, 0.05, 8), '#b9d47a', { unlit: false });
  return k.build();
}
export function bootsGeom() {         // scarpone di cuoio del calzolaio con suola chiodata e alette
  const k = new Kit(243), leather = '#7a4a26', dark = '#4a2c16';
  k.add(G.box(0.4, 0.75, 0.42), leather, { y: 0.15 });
  k.add(G.box(0.75, 0.3, 0.44), leather, { x: 0.18, y: -0.3 });
  k.add(G.box(0.8, 0.08, 0.48), dark, { x: 0.18, y: -0.48 });
  k.add(G.box(0.44, 0.08, 0.46), dark, { y: 0.52 });
  for (const s of [-1, 1]) k.add(G.cone(0.14, 0.4, 4), '#f3f0e6', { x: -0.05, y: 0.35, z: s * 0.28, rx: s * 1.2 });   // alette (velocita')
  return k.build();
}
// ramo di leccio spezzato: dal tronco a bordo strada attraversa la strada, si passa abbassandosi
export function branchGeom(variant = 0, half = 6.3) {
  const k = new Kit(250 + variant), r = rng(250 + variant), bark = ['#5a4430', '#4a3828', '#6b5038'];
  const s = variant % 2 ? -1 : 1, Y = 2.25;
  k.add(G.cyl(0.5, 0.7, 4.2, 8), bark[1], { x: s * (half + 0.8), y: 2.1, vary: 0.1, flat: true });           // tronco del leccio
  for (let i = 0; i < 6; i++) k.add(G.ico(r.range(0.8, 1.2), 0), r.pick(['#3f7a2e', '#4c8a34', '#356a28']), { x: s * (half + 0.8) + r.range(-1, 1), y: 4.2 + r.range(0, 1.2), z: r.range(-0.8, 0.8), flat: true });
  k.add(G.cyl(0.24, 0.42, half * 2 + 1, 7), bark[0], { y: Y + 0.3, rz: Math.PI / 2 - s * 0.05, vary: 0.12, flat: true });  // il ramo
  k.add(G.cyl(0.3, 0.3, 0.06, 7), '#d2aa70', { x: -s * (half + 0.5), y: Y + 0.25, rz: Math.PI / 2 });       // punto di rottura chiaro
  // v5s46b: la punta spezzata non resta sospesa: poggia su una pila di massi muschiati sul bordo (fuori dalle corsie)
  for (const [dy, rs, col] of [[0.5, 0.82, '#8f877a'], [1.3, 0.7, '#9a9080'], [1.95, 0.56, '#857f72']]) k.add(G.ico(rs, 1), col, { x: -s * (half - 0.35), y: dy, z: 0, sy: 0.82, flat: true, vary: 0.12 });
  for (let i = 0; i < 4; i++) k.add(G.ico(r.range(0.18, 0.28), 0), '#5f8a34', { x: -s * (half - 0.35) + r.range(-0.4, 0.4), y: r.range(0.2, 2.3), z: r.range(-0.55, 0.55), sy: 0.5, flat: true });
  for (let i = 0; i < 7; i++) { const x = r.range(-half, half); k.add(G.cyl(0.05, 0.1, r.range(0.7, 1.3), 5), bark[2], { x, y: Y + 0.75, z: r.range(-0.3, 0.3), rz: r.range(-0.8, 0.8), rx: r.range(-0.5, 0.5) }); }
  for (let i = 0; i < 14; i++) k.add(G.ico(r.range(0.25, 0.45), 0), r.pick(['#4f8a30', '#5f9a3a', '#3f7a2e', '#a07a3a']), { x: r.range(-half, half), y: Y + r.range(0.55, 1.2), z: r.range(-0.5, 0.5), flat: true });
  for (let i = 0; i < 6; i++) k.add(G.ico(r.range(0.12, 0.2), 0), '#5a8a30', { x: r.range(-half, half), y: r.range(0.06, 0.12), z: r.range(-1.2, 1.2), flat: true });  // foglie a terra
  return k.build();
}
