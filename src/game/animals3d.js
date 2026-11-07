// v5s24: animali low-poly (rivolti verso +x): pecora sarda, maialetto, cane randagio, cane pastore, su pastore.
import { Kit, G } from './kit.js';
const cache = {};
const legs = (k, pts, h, w, col, hoof = '#2a2420') => { for (const [x, z] of pts) { k.add(G.box(w, h, w), col, { x, y: h / 2, z }); k.add(G.box(w * 1.05, 0.1, w * 1.05), hoof, { x, y: 0.05, z }); } };
export function sheepGeom(v = 0) {
  const key = 'sheep' + v; if (cache[key]) return cache[key];
  const k = new Kit(300 + v), wool = ['#f1ece0', '#e6dfcf', '#d9d2c4'][v % 3];
  k.add(G.dode(0.62), wool, { y: 1.05, sx: 1.35, sy: 0.85, sz: 0.95, vary: 0.05, flat: true });
  for (const [x, z] of [[-0.35, 0.25], [0.3, -0.25], [0.05, 0.3], [-0.2, -0.3]]) k.add(G.dode(0.32), wool, { x, y: 1.35, z, flat: true, vary: 0.05 });
  k.add(G.box(0.36, 0.38, 0.32), '#2c2622', { x: 0.88, y: 1.25, rz: -0.25 });            // muso scuro (pecora sarda)
  for (const z of [-0.2, 0.2]) k.add(G.box(0.08, 0.06, 0.24), '#2c2622', { x: 0.82, y: 1.36, z: z * 1.3, ry: z > 0 ? 0.4 : -0.4 });
  k.add(G.cyl(0.07, 0.09, 0.14, 6), '#c8a040', { x: 0.62, y: 0.92 });                   // campanaccio
  legs(k, [[0.4, 0.2], [0.4, -0.2], [-0.4, 0.2], [-0.4, -0.2]], 0.62, 0.12, '#3a322c');
  return (cache[key] = k.build({ ao: 0.1 }));
}
export function pigGeom() {
  if (cache.pig) return cache.pig;
  const k = new Kit(320), P = '#e7a8a0', D = '#5a3a30';
  k.add(G.box(1.0, 0.55, 0.55), P, { y: 0.6, vary: 0.04 });
  k.add(G.box(0.4, 0.3, 0.56), D, { x: -0.15, y: 0.72 });                               // macchie (maialetto sardo)
  k.add(G.box(0.38, 0.4, 0.44), P, { x: 0.62, y: 0.68 });
  k.add(G.cyl(0.13, 0.13, 0.1, 8), '#d88a86', { x: 0.84, y: 0.62, rz: Math.PI / 2 });
  for (const z of [-0.14, 0.14]) { k.add(G.cone(0.08, 0.18, 4), P, { x: 0.6, y: 0.96, z }); k.add(G.sph(0.035, 5, 4), '#1a1412', { x: 0.82, y: 0.78, z: z * 0.9 }); }
  k.add(G.torus(0.07, 0.025, 4, 8), P, { x: -0.55, y: 0.75, ry: Math.PI / 2 });
  legs(k, [[0.32, 0.17], [0.32, -0.17], [-0.32, 0.17], [-0.32, -0.17]], 0.36, 0.11, P, '#4a3430');
  return (cache.pig = k.build());
}
// v = 0 cane randagio (fulvo), 1 cane pastore (nero e bianco)
export function dogGeom(v = 0) {
  const key = 'dog' + v; if (cache[key]) return cache[key];
  const k = new Kit(340 + v), A = v ? '#1e1c1c' : '#b9783a', B = v ? '#f2eee6' : '#e8c890';
  k.add(G.box(1.0, 0.42, 0.4), A, { y: 0.78, vary: 0.04 });
  k.add(G.box(0.5, 0.3, 0.42), B, { x: 0.25, y: 0.66 });                                // petto
  k.add(G.box(0.36, 0.36, 0.36), A, { x: 0.62, y: 1.12 });
  k.add(G.box(0.26, 0.18, 0.22), B, { x: 0.86, y: 1.04 });
  k.add(G.box(0.08, 0.08, 0.1), '#141010', { x: 1.0, y: 1.1 });
  for (const z of [-0.12, 0.12]) { k.add(G.cone(0.08, 0.2, 4), A, { x: 0.56, y: 1.38, z, rz: v ? 0.2 : 0.9 }); k.add(G.sph(0.03, 5, 4), '#101010', { x: 0.8, y: 1.18, z }); }
  k.add(G.box(0.4, 0.08, 0.08), A, { x: -0.62, y: 1.0, rz: 0.6 });                       // coda alta
  if (!v) k.add(G.box(0.06, 0.12, 0.44), '#c8283a', { x: 0.45, y: 0.98 });               // fazzoletto rosso
  legs(k, [[0.35, 0.14], [0.35, -0.14], [-0.35, 0.14], [-0.35, -0.14]], 0.6, 0.1, A, B);
  return (cache[key] = k.build());
}
// su pastore: berritta, giacca scura di orbace, gambali, bastone (vincastro)
export function shepherdGeom() {
  if (cache.shep) return cache.shep;
  const k = new Kit(360), J = '#262426', S = '#e9e2d2', F = '#c99a78';
  for (const z of [-0.16, 0.16]) { k.add(G.box(0.2, 0.9, 0.22), '#3a3632', { y: 0.45, z }); k.add(G.box(0.24, 0.5, 0.26), '#191717', { y: 0.25, z }); }   // gambali
  k.add(G.box(0.46, 0.25, 0.6), S, { y: 1.0 });                                          // camicia sotto
  k.add(G.box(0.5, 0.75, 0.66), J, { y: 1.45, vary: 0.03 });                              // giacca
  k.add(G.box(0.52, 0.06, 0.68), '#7a5a3a', { y: 1.08 });                                 // cinta
  k.add(G.box(0.3, 0.3, 0.3), F, { y: 2.0 });
  k.add(G.box(0.08, 0.12, 0.3), '#4a3a32', { x: 0.15, y: 1.92 });                         // baffi/barba
  k.add(G.cyl(0.17, 0.17, 0.12, 8), J, { y: 2.2 });
  k.add(G.cone(0.17, 0.75, 6), J, { x: -0.2, y: 2.38, rz: 1.1 });                          // berritta ripiegata
  for (const z of [-0.36, 0.36]) k.add(G.box(0.16, 0.66, 0.16), J, { x: 0.05, y: 1.45, z, rz: z > 0 ? 0.35 : 0.05 });
  k.add(G.cyl(0.035, 0.035, 2.4, 5), '#6b4a2c', { x: 0.42, y: 1.2, z: 0.45 });            // bastone
  k.add(G.torus(0.12, 0.035, 4, 8), '#6b4a2c', { x: 0.32, y: 2.4, z: 0.45, ry: Math.PI / 2 });
  return (cache.shep = k.build({ ao: 0.1 }));
}
