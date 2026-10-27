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

export function buildVicolo(len = 26) {
  const k = new Kit(5101), r = rng(5101);
  // --- muro sinistro: casa alta d'intonaco ocra-grigio consumato, zoccolo in pietra
  const L = -1;
  for (let z0 = 0; z0 > -len; z0 -= 3.25) {
    const c = r.pick(['#b9a183', '#c4ab88', '#ad9677', '#c9b394']);
    k.add(G.box(6, 9.5 + r.range(-0.4, 0.4), 3.3), c, { x: L * (E + 3), y: 4.75, z: z0 - 1.6, vary: 0.12 });
  }
  k.add(G.box(0.25, 0.7, len), '#6d655a', { x: L * (E + 0.05), y: 0.35, z: -len / 2, vary: 0.2 });   // zoccolo
  k.add(G.box(0.35, 0.25, len), '#8a7e6c', { x: L * (E + 0.05), y: 9.4, z: -len / 2 });              // cornicione
  for (let i = 0; i < 6; i++) k.add(G.box(0.06, r.range(0.6, 1.6), r.range(0.8, 2.2)), r.pick(['#9c8467', '#a88f72', '#d0bea0']), { x: L * (E - 0.01), y: r.range(1.5, 7.5), z: -r.range(1, len - 1) });   // macchie d'umido
  // portone verde a due ante sotto l'arco di pietra con lunetta a raggiera
  const dz = -9, dw = 2.6, dh = 3.6, dX = L * (E - 0.04);
  k.add(G.box(0.3, dh + 0.2, dw + 0.5), '#5a4a3a', { x: L * (E + 0.1), y: dh / 2, z: dz });
  for (const s of [-1, 1]) k.add(G.box(0.55, dh + 0.3, 0.35), '#b7ab98', { x: L * (E - 0.2), y: (dh + 0.3) / 2, z: dz + s * (dw / 2 + 0.3), vary: 0.08 });   // stipiti di pietra sporgenti                       // vano
  for (const s of [-1, 1]) {
    k.add(G.box(0.12, dh, dw / 2 - 0.04), '#2f7f72', { x: dX, y: dh / 2, z: dz + s * dw / 4, vary: 0.06 });
    for (const [py, ph] of [[0.75, 1.0], [2.2, 1.3]]) k.add(G.box(0.05, ph, dw / 2 - 0.36), '#3a9282', { x: dX + 0.08, y: py, z: dz + s * dw / 4 });
  }
  k.add(G.box(0.08, 0.05, 0.25), '#b8a060', { x: dX + 0.1, y: 1.5, z: dz - 0.15 });                              // maniglia
  k.add(G.box(0.2, 0.16, dw + 0.3), '#4a3a2c', { x: dX, y: dh + 0.08, z: dz });                                  // traversa
  // lunetta: mezzo disco scuro + raggi di legno
  k.add(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.1, 14, 1, false, 0, Math.PI), '#3a2a1e', { x: dX, y: dh + 0.16, z: dz, rz: Math.PI / 2 });
  for (let i = 1; i < 8; i++) { const a = (i / 8) * Math.PI; k.add(G.box(0.06, dw / 2 - 0.1, 0.05), '#7a5a3a', { x: dX + 0.06, y: dh + 0.16 + Math.sin(a) * (dw / 4 - 0.05), z: dz + Math.cos(a) * (dw / 4 - 0.05), rx: -(a - Math.PI / 2) }); }
  k.add(arcGeo(dw / 2 + 0.3, 0.3, Math.PI), '#b7ab98', { x: dX + 0.15, y: dh + 0.16, z: dz, ry: Math.PI / 2 });   // arco di pietra
  k.add(G.box(0.12, 0.3, 0.3), '#2a5a50', { x: dX, y: 2.5, z: dz - dw / 2 - 0.6 });                              // targhetta del civico
  windowFace(k, L * E, 6.3, -3, -L, '#6b5a44'); windowFace(k, L * E, 6.3, -13, -L, '#6b5a44', true); windowFace(k, L * E, 6.3, -20, -L, '#5a6a6a');
  k.add(G.box(0.1, 1.5, 0.6), '#8a3a2a', { x: L * E, y: 0.75, z: -14, vary: 0.2 });                            // mattoni a vista
  // --- muro destro: casa rosata scrostata con porta azzurra e balcone di ferro azzurro
  const R = 1;
  for (let z0 = 0; z0 > -len; z0 -= 3.25) {
    const c = z0 < -12 ? r.pick(['#d9b8a0', '#e0c2a8', '#cfa98e']) : r.pick(['#c8b49a', '#bfa98d']);
    k.add(G.box(6, 10 + r.range(-0.4, 0.4), 3.3), c, { x: R * (E + 3), y: 5, z: z0 - 1.6, vary: 0.12 });
  }
  k.add(G.box(0.25, 0.7, len), '#6d655a', { x: R * (E + 0.05), y: 0.35, z: -len / 2, vary: 0.2 });
  k.add(G.box(0.35, 0.25, len), '#8a7e6c', { x: R * (E + 0.05), y: 9.9, z: -len / 2 });
  const bz = -18, bX = R * (E - 0.04);
  k.add(G.box(0.3, 3.0, 2.3), '#d8d2c6', { x: R * (E + 0.05), y: 1.5, z: bz });
  for (const s of [-1, 1]) k.add(G.box(0.5, 3.1, 0.3), '#d8d2c6', { x: R * (E - 0.2), y: 1.55, z: bz + s * 1.15 });                                 // cornice chiara
  for (const s of [-1, 1]) {
    k.add(G.box(0.12, 2.7, 0.92), '#3f86d0', { x: bX, y: 1.35, z: bz + s * 0.47, vary: 0.05 });
    for (let j = 0; j < 4; j++) k.add(G.box(0.04, 0.04, 0.8), '#2f6fb0', { x: bX - 0.07, y: 0.45 + j * 0.62, z: bz + s * 0.47 });
  }
  windowFace(k, R * E, 3.8, bz, -R, '#3f86d0');
  balcony(k, R * E, 4.5, bz, 2.6, -R, '#3a78c8');
  k.add(G.box(0.08, 1.9, 0.95), '#3f86d0', { x: bX, y: 5.5, z: bz });                                          // porta-finestra azzurra
  k.add(G.cyl(0.04, 0.04, 9.5, 5), '#c97a6a', { x: R * (E - 0.1), y: 4.75, z: bz + 1.8 });                     // pluviale rosa
  windowFace(k, R * E, 6.4, -6, -R, '#3f86d0', true); windowFace(k, R * E, 3.6, -9, -R, '#6b5a44');
  // lampada a braccio sul muro destro
  k.add(G.box(0.9, 0.06, 0.06), '#2a2d31', { x: R * (E - 0.45), y: 6.2, z: -12 });
  k.add(G.cyl(0.05, 0.32, 0.2, 8), '#c8ccd0', { x: R * (E - 0.95), y: 6.05, z: -12 });
  k.add(G.cyl(0.14, 0.14, 0.06, 8), '#fff0c8', { x: R * (E - 0.95), y: 5.94, z: -12, unlit: true });
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
  const cx = 11.8, cz = -9, rad = 4.2, H = 4.4, OCHRE = '#dfb36a';
  k.add(G.cyl(rad, rad, H, 22), OCHRE, { x: cx, y: H / 2, z: cz, vary: 0.04 });
  k.add(G.cyl(rad + 0.05, rad + 0.05, 0.45, 22), '#c69a58', { x: cx, y: 0.22, z: cz });                          // zoccolo
  k.add(G.cyl(rad + 0.45, rad + 0.3, 0.32, 22), '#3e2a20', { x: cx, y: H + 0.1, z: cz });                        // gronda
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; k.add(G.box(0.18, 0.12, 0.5), '#2c1f18', { x: cx + Math.cos(a) * (rad + 0.4), y: H - 0.1, z: cz + Math.sin(a) * (rad + 0.4), ry: -a }); }   // mensole
  k.add(G.cone(rad + 0.35, 1.3, 22), '#5a3a2a', { x: cx, y: H + 0.9, z: cz });                                   // tetto di coppi
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; k.add(G.box(0.12, 0.08, rad * 0.95), '#6e4632', { x: cx + Math.cos(a) * rad * 0.5, y: H + 0.95, z: cz + Math.sin(a) * rad * 0.5, ry: -a + Math.PI / 2, rx: 0.32 }); }
  // fronte verso la via (-x): porta di legno marrone, architrave scuro, gradino, croce di ferro battuto
  const fx = cx - rad + 0.02;
  k.add(G.box(0.16, 2.5, 1.35), '#7a4a26', { x: fx - 0.02, y: 1.5, z: cz, vary: 0.05 });
  for (let j = 0; j < 3; j++) for (const s of [-1, 1]) k.add(G.box(0.05, j ? 0.42 : 0.7, 0.42), j ? '#3d4a50' : '#6a3e20', { x: fx - 0.1, y: j ? 2.2 - (j - 1) * 0.5 : 0.75, z: cz + s * 0.3 });
  k.add(G.box(0.22, 0.22, 2.0), '#3a2a20', { x: fx - 0.06, y: 2.88, z: cz });                                    // architrave
  k.add(G.box(0.08, 2.6, 1.6), '#c9c1b0', { x: fx + 0.02, y: 1.5, z: cz });                                      // cornice chiara
  k.add(G.box(0.7, 0.2, 2.4), '#8a7a66', { x: fx - 0.3, y: 0.1, z: cz });                                        // gradino
  k.add(G.box(0.05, 1.2, 0.08), '#2a2624', { x: fx - 0.02, y: 3.55, z: cz - 1.9 });
  k.add(G.box(0.05, 0.08, 0.75), '#2a2624', { x: fx - 0.02, y: 3.8, z: cz - 1.9 });
  for (const [dy, dz] of [[0, 0.42], [0, -0.42], [0.6, 0], [-0.6, 0]]) k.add(G.box(0.04, 0.16, 0.16), '#2a2624', { x: fx - 0.02, y: 3.8 + dy, z: cz - 1.9 + dz, rx: Math.PI / 4 });   // ricci
  k.add(G.box(0.08, 1.1, 0.35), '#ece6d8', { x: fx + 0.3, y: 2.6, z: cz + 2.4, ry: 0.5 });                       // finestrella stretta
  // lampioni di ferro
  streetLamp(k, 7.6, -1.6, 1); streetLamp(k, 7.6, -16.5, 1);
  // case bianche con balconi dietro, e di la' dal ramo
  for (const [x, z, w, h, d] of [[21, -4, 7, 8.5, 7], [21, -13.5, 7, 9.5, 8], [16.5, -24, 9, 8, 6]]) {
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
  for (const [z, w, h] of [[-4, 8, 8], [-14, 9, 9], [-24, 8, 7.5]]) {
    const x = -(E + 3.5);
    k.add(G.box(7, h, w), '#ece8df', { x, y: h / 2, z, vary: 0.05 });
    k.add(G.box(7.4, 0.3, w + 0.4), '#b3593c', { x, y: h + 0.15, z });
    k.add(G.box(0.3, 0.6, w), '#9a948a', { x: -E - 0.1, y: 0.3, z });
    for (const yy of [2.3, 5.4]) for (const zz of [-w / 4, w / 4]) windowFace(k, -E, yy, z + zz, 1, '#7a6a52', yy > 4);
    balcony(k, -E, 4.4, z, w * 0.5, 1, '#2a2d31');
  }
  return k.build({ ao: 0.22 });
}
