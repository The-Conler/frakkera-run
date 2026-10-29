// =====================================================================
// v5 stage 23c (target5-*): due luoghi veri di Gadoni alla fine del paese, attraversati dalla via.
//  - vicolo: muri d'intonaco consumato ai due lati, portone verde a due ante sotto un arco di pietra con
//    lunetta a raggiera; piu' avanti porta azzurra e balcone di ferro azzurro.
//  - cappella tonda: piccolo edificio ocra arrotondato con gronda di coppi scuri, porta di legno marrone con
//    architrave scuro, croce di ferro battuto sul muro; la via si divide attorno (ramo lastricato a destra),
//    lampioni di ferro, case bianche con balconi dietro.
// Coordinate del monumento: x come la via (0 = centro), z = 0 al punto "at", negativo = piu' avanti.
// Tutto fuori dalle corsie (|x| > 6.9 m): le corsie restano libere e leggibili.
// =====================================================================
import * as THREE from 'three';
import { Kit, G, rng } from './common.js';

const E = 6.95;            // filo delle facciate (FACADE)
const arcGeo = (r, t, arc) => new THREE.TorusGeometry(r, t, 5, 12, arc);

// lampione di ferro con braccio e lanterna (vetro acceso)
function streetLamp(k, x, z, side) {
  const iron = '#2a2d31';
  k.add(G.cyl(0.09, 0.13, 5.2, 7), iron, { x, y: 2.6, z });
  k.add(G.cyl(0.18, 0.2, 0.4, 7), iron, { x, y: 0.2, z });
  k.add(G.box(1.1, 0.07, 0.07), iron, { x: x - side * 0.5, y: 5.05, z });
  k.add(G.cyl(0.05, 0.3, 0.28, 8), iron, { x: x - side * 1.0, y: 4.85, z });
  k.add(G.cyl(0.14, 0.1, 0.3, 8), '#ffe3a0', { x: x - side * 1.0, y: 4.6, z, unlit: true });
}
// balcone di ferro (soletta + ringhiera a bacchette)
function balcony(k, x, y, z, w, side, col) {
  k.add(G.box(1.0, 0.12, w), '#9a948a', { x: x + side * 0.5, y, z });
  k.add(G.box(0.05, 0.06, w), col, { x: x + side * 0.98, y: y + 0.95, z });
  for (let i = 0; i <= Math.round(w / 0.16); i++) k.add(G.box(0.03, 0.9, 0.03), col, { x: x + side * 0.98, y: y + 0.5, z: z - w / 2 + i * 0.16 });
  for (const zz of [z - w / 2, z + w / 2]) k.add(G.box(1.0, 0.05, 0.05), col, { x: x + side * 0.5, y: y + 0.95, z: zz });
}
// finestra con persiane (aperte o chiuse)
function windowFace(k, x, y, z, side, shut, open = false) {
  k.add(G.box(0.08, 1.25, 0.95), '#3a3634', { x: x + side * 0.02, y, z });
  k.add(G.box(0.1, 0.12, 1.15), '#d9d2c4', { x: x + side * 0.05, y: y - 0.68, z });
  if (open) for (const s of [-1, 1]) k.add(G.box(0.06, 1.25, 0.47), shut, { x: x + side * 0.07, y, z: z + s * 0.72 });
  else k.add(G.box(0.07, 1.2, 0.9), shut, { x: x + side * 0.05, y, z, vary: 0.1 });
}

// facciata di sbieco (45 gradi) rivolta verso chi arriva: side -1 = muro sinistro, +1 = destro.
// F(d, t, y, geo, col): d = distanza davanti alla facciata, t = lungo la facciata (positivo = verso chi arriva)
function slanted(k, cx, cz, side) {
  const NX = -side * Math.SQRT1_2, NZ = Math.SQRT1_2;
  const tx = -NZ * side * -1, tz = NX * side * -1;   // tangente (perpendicolare a N nel piano)
  const RY = side < 0 ? -Math.PI / 4 : Math.PI / 4;
  return (d, t, y, geo, col, o = {}) => k.add(geo, col, { x: cx + NX * d + tx * t, y, z: cz + NZ * d + tz * t, ry: RY, ...o });
}
export function buildVicolo(len = 26) {
  const k = new Kit(5101), r = rng(5101);
  // --- muro sinistro: casa alta d'intonaco ocra-grigio consumato, zoccolo in pietra
  const L = -1;
  for (let z0 = 0; z0 > -len; z0 -= 3.25) {
    const c = r.pick(['#b9a183', '#c4ab88', '#ad9677', '#c9b394']);
    const zc = z0 - 1.6, rec = zc > -26 && zc < -3 ? 4 : 0;          // slargo davanti al portone verde
    k.add(G.box(6, 9.5 + r.range(-0.4, 0.4), 3.3), c, { x: L * (E + 3 + rec), y: 4.75, z: zc, vary: 0.12 });
  }
  for (const [za, zb] of [[-26, -len]]) { k.add(G.box(0.25, 0.7, za - zb), '#6d655a', { x: L * (E + 0.05), y: 0.35, z: (za + zb) / 2, vary: 0.2 }); k.add(G.box(0.35, 0.25, za - zb), '#8a7e6c', { x: L * (E + 0.05), y: 9.4, z: (za + zb) / 2 }); }
  for (let i = 0; i < 6; i++) k.add(G.box(0.06, r.range(0.6, 1.6), r.range(0.8, 2.2)), r.pick(['#9c8467', '#a88f72', '#d0bea0']), { x: L * (E - 0.01), y: r.range(1.5, 7.5), z: -r.range(26.5, len - 0.5) });   // macchie d'umido
  // portone verde a due ante sotto l'arco di pietra, su un risvolto di muro di sbieco verso chi arriva
  const dz = -8, dw = 3.4, dh = 4.6;
  { const F = slanted(k, -8.6, dz, -1);
    F(-0.4, 0, 4.6, G.box(0.8, 9.2, 5.6), '#b39b7c', { vary: 0.1 });                 // risvolto di muro consumato
    F(0.02, 0, (dh + 0.3) / 2, G.box(0.1, dh + 0.3, dw + 0.4), '#3a2e24');          // vano
    for (const sd of [-1, 1]) F(0.12, sd * (dw / 2 + 0.3), (dh + 0.4) / 2, G.box(0.3, dh + 0.4, 0.4), '#c2b6a2');   // stipiti di pietra
    for (const sd of [-1, 1]) {
      F(0.1, sd * dw / 4, dh / 2, G.box(0.1, dh, dw / 2 - 0.05), '#1d8a76', { unlit: true });
      for (const [py, ph] of [[0.8, 1.1], [2.5, 1.5]]) F(0.17, sd * dw / 4, py, G.box(0.05, ph, dw / 2 - 0.4), '#27a088', { unlit: true });
    }
    F(0.2, 0.2, 1.6, G.box(0.06, 0.06, 0.3), '#c8b070');                              // maniglia
    F(0.12, 0, dh + 0.08, G.box(0.2, 0.18, dw + 0.4), '#4a3a2c');                    // traversa
    F(0.1, 0, dh + 0.17, new THREE.CylinderGeometry(dw / 2, dw / 2, 0.1, 14, 1, false, 0, Math.PI), '#3a2a1e', { rz: Math.PI / 2 });   // lunetta
    for (let i = 1; i < 8; i++) for (const rr of [0.35, 0.65, 0.95]) { const a = (i / 8) * Math.PI; F(0.18, Math.cos(a) * rr * dw / 2, dh + 0.17 + Math.sin(a) * rr * dw / 2, G.box(0.05, 0.12, 0.12), '#9a7a50'); }
    F(0.15, 0, dh + 0.17, arcGeo(dw / 2 + 0.3, 0.3, Math.PI), '#c2b6a2', { ry: (-Math.PI / 4) + Math.PI / 2 });
    F(0.1, -dw / 2 - 0.9, 2.5, G.box(0.06, 0.3, 0.3), '#2a5a50'); }
  windowFace(k, L * E, 6.3, -29.5, -L, '#6b5a44'); windowFace(k, L * (E + 4), 6.3, -3, -L, '#6b5a44', true);
  k.add(G.box(0.1, 1.5, 0.6), '#8a3a2a', { x: L * E, y: 0.75, z: -29, vary: 0.2 });                            // mattoni a vista
  // --- muro destro: casa rosata scrostata con porta azzurra e balcone di ferro azzurro
  const R = 1;
  for (let z0 = 0; z0 > -len; z0 -= 3.25) {
    const c = z0 < -12 ? r.pick(['#d9b8a0', '#e0c2a8', '#cfa98e']) : r.pick(['#c8b49a', '#bfa98d']);
    const zc = z0 - 1.6, rec = 0;          // slargo davanti alla porta azzurra
    k.add(G.box(6, 10 + r.range(-0.4, 0.4), 3.3), c, { x: R * (E + 3 + rec), y: 5, z: zc, vary: 0.12 });
  }
  for (const [za, zb] of [[0, -8], [-20, -len]]) { k.add(G.box(0.25, 0.7, za - zb), '#6d655a', { x: R * (E + 0.05), y: 0.35, z: (za + zb) / 2, vary: 0.2 }); k.add(G.box(0.35, 0.25, za - zb), '#8a7e6c', { x: R * (E + 0.05), y: 9.9, z: (za + zb) / 2 }); }
  const bz = -21;
  // casa con porta azzurra e balcone di ferro azzurro, di sbieco verso chi arriva
  { const F = slanted(k, -9.0, bz, -1);   // a SINISTRA: a destra la coprirebbe la fiamma
    F(-0.5, 0, 5, G.box(1.0, 10, 6.0), '#d4b49c', { vary: 0.08 });
    F(0.03, 0, 1.6, G.box(0.1, 3.2, 2.5), '#e2ddd2');                                  // cornice chiara
    for (const sd of [-1, 1]) { F(0.1, sd * 0.55, 1.45, G.box(0.1, 2.85, 1.05), '#2a7ad8', { unlit: true });
      for (let j = 0; j < 4; j++) F(0.16, sd * 0.55, 0.5 + j * 0.65, G.box(0.04, 0.05, 0.9), '#1d60b0', { unlit: true }); }
    F(0.03, 0, 3.75, G.box(0.1, 0.9, 1.6), '#3a3634');                               // sopraluce
    F(0.5, 0, 4.6, G.box(1.0, 0.14, 3.0), '#9a948a');                                // soletta del balcone
    F(1.0, 0, 5.55, G.box(0.06, 0.07, 3.0), '#2468d0', { unlit: true });
    for (let i = 0; i <= 16; i++) F(1.0, -1.5 + i * 0.1875, 5.1, G.box(0.04, 0.9, 0.04), '#2468d0', { unlit: true });
    for (const sd of [-1, 1]) F(0.5, sd * 1.5, 5.55, G.box(1.0, 0.06, 0.06), '#2468d0', { unlit: true });
    for (const sd of [-1, 1]) F(0.12, sd * 0.42, 5.7, G.box(0.1, 2.1, 0.8), '#2a7ad8', { unlit: true });   // porta-finestra azzurra
    F(0.05, 2.6, 4.75, G.cyl(0.05, 0.05, 9.5, 5), '#c97a6a'); }
  windowFace(k, R * E, 6.4, -6, -R, '#2f8cf0', true); windowFace(k, R * E, 3.6, -3, -R, '#6b5a44');
  // lampada a braccio sul muro destro
  k.add(G.box(0.9, 0.06, 0.06), '#2a2d31', { x: R * (E - 0.45), y: 6.2, z: -23 });
  k.add(G.cyl(0.05, 0.32, 0.2, 8), '#c8ccd0', { x: R * (E - 0.95), y: 6.05, z: -23 });
  k.add(G.cyl(0.14, 0.14, 0.06, 8), '#fff0c8', { x: R * (E - 0.95), y: 5.94, z: -23, unlit: true });
  // lastre di scisto sui marciapiedi (pavimento del vicolo ai lati)
  for (let i = 0; i < 26; i++) { const s = r.chance(0.5) ? -1 : 1; k.add(G.box(r.range(0.6, 1.1), 0.05, r.range(0.6, 1.2)), r.pick(['#6f6a62', '#7d776d', '#625d56']), { x: s * r.range(5.8, 6.8), y: 0.16, z: -r.range(0.5, len - 0.5), ry: r.range(-0.4, 0.4) }); }
  return k.build({ ao: 0.25 });
}

export function buildCappella() {
  const k = new Kit(5201), r = rng(5201);
  // ramo della via che si stacca a destra e gira attorno alla cappella (lastricato chiaro + guide di pietra)
  k.add(G.box(13, 0.12, 22), '#a9a49a', { x: 13.5, y: 0.03, z: -9 });
  for (let i = 0; i < 40; i++) k.add(G.box(r.range(0.5, 0.9), 0.04, r.range(0.4, 0.7)), r.pick(['#9a958b', '#b7b2a6', '#8d887f']), { x: r.range(7.2, 19.5), y: 0.1, z: -r.range(-1.5, 19.5), ry: r.range(-0.3, 0.3) });
  for (const z of [-1.2, -17]) k.add(G.box(10, 0.06, 0.45), '#d8d4ca', { x: 13, y: 0.11, z });
  // cappella tonda: corpo ocra arrotondato (mezzo cilindro + parte dritta), gronda di coppi scuri
  const cx = 11.4, cz = -9, rad = 4.6, H = 7.0, OCHRE = '#f9d488';
  k.add(G.cyl(rad, rad, H, 22), OCHRE, { x: cx, y: H / 2, z: cz, vary: 0.04 });
  k.add(G.cyl(rad + 0.05, rad + 0.05, 0.45, 22), '#c69a58', { x: cx, y: 0.22, z: cz });                          // zoccolo
  k.add(G.cyl(rad + 0.45, rad + 0.3, 0.32, 22), '#3e2a20', { x: cx, y: H + 0.1, z: cz });                        // gronda
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; k.add(G.box(0.18, 0.12, 0.5), '#2c1f18', { x: cx + Math.cos(a) * (rad + 0.4), y: H - 0.1, z: cz + Math.sin(a) * (rad + 0.4), ry: -a }); }   // mensole
  k.add(G.cone(rad + 0.35, 1.3, 22), '#5a3a2a', { x: cx, y: H + 0.9, z: cz });                                   // tetto di coppi
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; k.add(G.box(0.12, 0.08, rad * 0.95), '#6e4632', { x: cx + Math.cos(a) * rad * 0.5, y: H + 0.95, z: cz + Math.sin(a) * rad * 0.5, ry: -a + Math.PI / 2, rx: 0.32 }); }
  // fronte di sbieco verso chi arriva (+z) e verso la via (-x): porta di legno, architrave scuro, gradino, croce di ferro
  const NX = -Math.SQRT1_2, NZ = Math.SQRT1_2, TX = Math.SQRT1_2, TZ = Math.SQRT1_2, RY = Math.PI / 4;
  const F = (d, t, y, geo, col, o = {}) => k.add(geo, col, { x: cx + NX * (rad + d) + TX * t, y, z: cz + NZ * (rad + d) + TZ * t, ry: RY, ...o });
  F(0.04, 0, 1.5, G.box(0.1, 2.6, 1.7), '#c9c1b0');                      // cornice chiara
  F(0.1, 0, 1.4, G.box(0.14, 2.6, 1.4), '#7a4a26', { vary: 0.05 });      // porta di legno
  for (let j = 0; j < 3; j++) for (const sd of [-1, 1]) F(0.18, sd * 0.32, j ? 2.3 - (j - 1) * 0.5 : 0.75, G.box(0.05, j ? 0.42 : 0.7, 0.44), j ? '#3d4a50' : '#6a3e20');
  F(0.14, 0, 2.95, G.box(0.24, 0.26, 2.1), '#3a2a20');                    // architrave
  F(0.4, 0, 0.1, G.box(0.8, 0.2, 2.4), '#8a7a66');                       // gradino
  const ct = -2.1;                                                       // croce di ferro battuto accanto alla porta
  F(0.06, ct, 3.4, G.box(0.06, 1.4, 0.1), '#1e1b1a'); F(0.06, ct, 3.7, G.box(0.06, 0.1, 0.9), '#1e1b1a');
  for (const [dy, dt] of [[0, 0.5], [0, -0.5], [0.72, 0], [-0.7, 0]]) F(0.06, ct + dt, 3.7 + dy, G.box(0.05, 0.2, 0.2), '#1e1b1a', { rx: Math.PI / 4 });
  F(0.03, 2.3, 2.6, G.box(0.08, 1.1, 0.35), '#ece6d8');                  // finestrella stretta
  // lampioni di ferro
  // v5s26: niente lampioni davanti alla cappella (la coprivano)
  // case bianche con balconi dietro, e di la' dal ramo
  for (const [x, z, w, h, d] of [[21, -4, 7, 8.5, 7], [21, -13.5, 7, 9.5, 8]]) {
    k.add(G.box(d, h, w), r.pick(['#eeeae2', '#e6e2d8', '#f2efe8']), { x, y: h / 2, z, vary: 0.05 });
    k.add(G.box(d + 0.4, 0.3, w + 0.4), '#b3593c', { x, y: h + 0.15, z });
    k.add(G.cone(Math.max(w, d) * 0.72, 1.4, 4), '#a8503a', { x, y: h + 1, z, ry: Math.PI / 4, sz: w / d });
    for (const yy of [2.2, 5.2]) for (const zz of [-w / 4, w / 4]) windowFace(k, x - d / 2, yy, z + zz, -1, '#8a7a5e', yy > 4);
    balcony(k, x - d / 2, 4.3, z, w * 0.55, -1, '#2a2d31');
  }
  // camino rosso
  k.add(G.cyl(0.3, 0.3, 1.8, 8), '#c0402a', { x: 21, y: 10.2, z: -2 });
  return k.build({ ao: 0.22 });
}

// lato sinistro davanti alla cappella: casa bianca con balcone di ferro (facciata verso la via)
export function buildCappellaLeft() {
  const k = new Kit(5301);
  for (const [z, w, h] of [[-4, 8, 8], [-13.5, 8, 9]]) {   // v5s26: spazio per la navatella destra di Santa Marta
    const x = -(E + 3.5);
    k.add(G.box(7, h, w), '#ece8df', { x, y: h / 2, z, vary: 0.05 });
    k.add(G.box(7.4, 0.3, w + 0.4), '#b3593c', { x, y: h + 0.15, z });
    k.add(G.box(0.3, 0.6, w), '#9a948a', { x: -E - 0.1, y: 0.3, z });
    for (const yy of [2.3, 5.4]) for (const zz of [-w / 4, w / 4]) windowFace(k, -E, yy, z + zz, 1, '#7a6a52', yy > 4);
    balcony(k, -E, 4.4, z, w * 0.5, 1, '#2a2d31');
  }
  return k.build({ ao: 0.22 });
}
