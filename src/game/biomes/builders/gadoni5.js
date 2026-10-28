// =====================================================================
// v5 stage 23c (target5-*): due luoghi veri di Gadoni alla fine del paese, attraversati dalla via.
//  - vicolo: muri d'intonaco consumato ai due lati, portone verde a due ante sotto un arco di pietra con
//    lunetta a raggiera; piu' avanti porta azzurra e balcone di ferro azzurro.
//  - cappella tonda: piccolo edificio ocra arrotondato con gronda di coppi scuri, porta di legno marrone con
//    architrave scuro, croce di ferro battuto sul muro; la via si divide attorno (ramo lastricato a destra),
//    lampioni di ferro, case bianche con balconi dietro.
// Coordinate del monumento: x come la via (0 = centro), z = 0 al punto "at", negativo = piu' avanti.
// v5 split: vicolo e cappella stanno IN MEZZO alla via (|x| <= 1.9 m): la corsia centrale e' chiusa, le laterali libere.
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
    const zc = z0 - 1.6, rec = 0;
    k.add(G.box(6, 9.5 + r.range(-0.4, 0.4), 3.3), c, { x: L * (E + 3 + rec), y: 4.75, z: zc, vary: 0.12 });
  }
  for (const [za, zb] of [[-26, -len]]) { k.add(G.box(0.25, 0.7, za - zb), '#6d655a', { x: L * (E + 0.05), y: 0.35, z: (za + zb) / 2, vary: 0.2 }); k.add(G.box(0.35, 0.25, za - zb), '#8a7e6c', { x: L * (E + 0.05), y: 9.4, z: (za + zb) / 2 }); }
  for (let i = 0; i < 6; i++) k.add(G.box(0.06, r.range(0.6, 1.6), r.range(0.8, 2.2)), r.pick(['#9c8467', '#a88f72', '#d0bea0']), { x: L * (E - 0.01), y: r.range(1.5, 7.5), z: -r.range(26.5, len - 0.5) });   // macchie d'umido
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
  windowFace(k, R * E, 6.4, -6, -R, '#2f8cf0', true); windowFace(k, R * E, 3.6, -3, -R, '#6b5a44');
  // lampada a braccio sul muro destro
  k.add(G.box(0.9, 0.06, 0.06), '#2a2d31', { x: R * (E - 0.45), y: 6.2, z: -23 });
  k.add(G.cyl(0.05, 0.32, 0.2, 8), '#c8ccd0', { x: R * (E - 0.95), y: 6.05, z: -23 });
  k.add(G.cyl(0.14, 0.14, 0.06, 8), '#fff0c8', { x: R * (E - 0.95), y: 5.94, z: -23, unlit: true });
  // lastre di scisto sui marciapiedi (pavimento del vicolo ai lati)
  for (let i = 0; i < 26; i++) { const s = r.chance(0.5) ? -1 : 1; k.add(G.box(r.range(0.6, 1.1), 0.05, r.range(0.6, 1.2)), r.pick(['#6f6a62', '#7d776d', '#625d56']), { x: s * r.range(5.8, 6.8), y: 0.16, z: -r.range(0.5, len - 0.5), ry: r.range(-0.4, 0.4) }); }
  centralBlock(k, r, BLOCK_LEN);
  return k.build({ ao: 0.25 });
}

// v5 split: blocco di case IN MEZZO alla via (da z = 0 a z = -len, |x| <= BW): la strada si divide in due
// vicoli stretti. Lato sinistro: portone verde ad arco con lunetta a raggiera; lato destro: porta azzurra e
// balcone di ferro azzurro; in testa (verso chi arriva) uno spigolo d'intonaco consumato con finestra e lampione.
export const BLOCK_LEN = 20, BLOCK_W = 1.9;
function centralBlock(k, r, len) {
  const BW = BLOCK_W, H = 9.5;
  for (let z0 = 0; z0 > -len; z0 -= 4) {
    const c = z0 > -10 ? r.pick(['#b9a183', '#c4ab88', '#ad9677']) : r.pick(['#d9b8a0', '#e0c2a8', '#cfa98e']);
    k.add(G.box(BW * 2, H + r.range(-0.5, 0.5), Math.min(4, len + z0)), c, { x: 0, y: H / 2, z: z0 - Math.min(4, len + z0) / 2, vary: 0.1 });
  }
  k.add(G.box(BW * 2 + 0.3, 0.3, len + 0.3), '#8a7e6c', { x: 0, y: H + 0.4, z: -len / 2 });                      // cornicione
  k.add(G.box(BW * 2 + 0.1, 0.7, len), '#6d655a', { x: 0, y: 0.35, z: -len / 2, vary: 0.2 });                     // zoccolo di pietra
  // testa verso chi arriva: finestra con persiane, macchie d'umido, piccola croce di pietra
  k.add(G.box(0.95, 1.25, 0.08), '#3a3634', { x: 0.4, y: 6.4, z: 0.02 }); k.add(G.box(1.15, 0.12, 0.12), '#d9d2c4', { x: 0.4, y: 5.72, z: 0.05 });
  for (const sd of [-1, 1]) k.add(G.box(0.47, 1.25, 0.06), '#6b5a44', { x: 0.4 + sd * 0.72, y: 6.4, z: 0.06 });
  k.add(G.box(1.2, 1.4, 0.06), '#a88f72', { x: -0.9, y: 2.2, z: 0.02 });
  k.add(G.box(BW * 2, 0.08, 0.1), '#2a2d31', { x: 0, y: 4.2, z: 0.05 });
  // --- lato SINISTRO (x = -BW): portone verde a due ante sotto l'arco di pietra
  const S = -1, x = S * BW, dz = -6.5, dw = 2.6, dh = 3.8;
  const F = (d, t, y, geo, col, o = {}) => k.add(geo, col, { x: x + S * d, y, z: dz + t, ...o });
  F(0.02, 0, (dh + 0.3) / 2, G.box(0.1, dh + 0.3, dw + 0.4), '#3a2e24');
  for (const sd of [-1, 1]) F(0.1, sd * (dw / 2 + 0.3), (dh + 0.4) / 2, G.box(0.3, dh + 0.4, 0.4), '#c2b6a2');
  for (const sd of [-1, 1]) {
    F(0.08, sd * dw / 4, dh / 2, G.box(0.1, dh, dw / 2 - 0.05), '#1d8a76', { unlit: true });
    for (const [py, ph] of [[0.7, 0.9], [2.1, 1.3]]) F(0.14, sd * dw / 4, py, G.box(0.05, ph, dw / 2 - 0.35), '#27a088', { unlit: true });
  }
  F(0.16, 0.2, 1.4, G.box(0.06, 0.06, 0.25), '#c8b070');
  F(0.1, 0, dh + 0.08, G.box(0.2, 0.18, dw + 0.4), '#4a3a2c');
  F(0.08, 0, dh + 0.17, new THREE.CylinderGeometry(dw / 2, dw / 2, 0.1, 14, 1, false, 0, Math.PI), '#3a2a1e', { rz: Math.PI / 2, ry: Math.PI / 2 });
  for (let i = 1; i < 8; i++) for (const rr of [0.35, 0.65, 0.95]) { const a = (i / 8) * Math.PI; F(0.14, Math.cos(a) * rr * dw / 2, dh + 0.17 + Math.sin(a) * rr * dw / 2, G.box(0.05, 0.1, 0.1), '#9a7a50'); }
  F(0.12, 0, dh + 0.17, arcGeo(dw / 2 + 0.25, 0.25, Math.PI), '#c2b6a2', { ry: Math.PI / 2 });
  windowFace(k, x, 7, -14, S, '#6b5a44'); windowFace(k, x, 7, -3, S, '#2a5a50', true);
  for (let i = 0; i < 5; i++) k.add(G.box(0.06, r.range(0.6, 1.4), r.range(0.8, 2)), r.pick(['#9c8467', '#a88f72', '#d0bea0']), { x: x - 0.01, y: r.range(1.2, 8), z: -r.range(10, len - 1) });
  // --- lato DESTRO (x = +BW): porta azzurra con cornice chiara, balcone di ferro azzurro e porta-finestra
  const R = 1, xr = R * BW, bz = -13;
  const P = (d, t, y, geo, col, o = {}) => k.add(geo, col, { x: xr + R * d, y, z: bz + t, ...o });
  P(0.03, 0, 1.6, G.box(0.1, 3.2, 2.4), '#e2ddd2');
  for (const sd of [-1, 1]) { P(0.08, sd * 0.53, 1.45, G.box(0.1, 2.85, 1.0), '#2a7ad8', { unlit: true });
    for (let j = 0; j < 4; j++) P(0.14, sd * 0.53, 0.5 + j * 0.65, G.box(0.04, 0.05, 0.85), '#1d60b0', { unlit: true }); }
  P(0.03, 0, 3.7, G.box(0.1, 0.8, 1.5), '#3a3634');
  // balcone sporgente poco (la corsia destra resta libera: sta in alto, sopra la testa)
  P(0.35, 0, 4.6, G.box(0.7, 0.14, 2.8), '#9a948a');
  P(0.68, 0, 5.55, G.box(0.06, 0.07, 2.8), '#2468d0', { unlit: true });
  for (let i = 0; i <= 15; i++) P(0.68, -1.4 + i * 0.1867, 5.1, G.box(0.04, 0.9, 0.04), '#2468d0', { unlit: true });
  for (const sd of [-1, 1]) P(0.35, sd * 1.4, 5.55, G.box(0.7, 0.06, 0.06), '#2468d0', { unlit: true });
  for (const sd of [-1, 1]) P(0.1, sd * 0.4, 5.7, G.box(0.1, 2.1, 0.75), '#2a7ad8', { unlit: true });
  P(0.05, 2.4, 4.75, G.cyl(0.05, 0.05, 9.5, 5), '#c97a6a');
  windowFace(k, xr, 6.4, -4, R, '#2f8cf0', true); windowFace(k, xr, 3.4, -4, R, '#6b5a44');
  // lastricato di scisto dei due vicoli
  for (let i = 0; i < 30; i++) { const s = r.chance(0.5) ? -1 : 1; k.add(G.box(r.range(0.6, 1.1), 0.05, r.range(0.6, 1.2)), r.pick(['#6f6a62', '#7d776d', '#625d56']), { x: s * r.range(2.3, 5.2), y: 0.14, z: -r.range(0.5, len - 0.5), ry: r.range(-0.4, 0.4) }); }
}

export const CAP_RAD = 1.9, CAP_LEN = 11;
export function buildCappella() {
  const k = new Kit(5201), r = rng(5201);
  // v5 split: cappella tonda IN MEZZO alla via (pianta ovale, da z = 0 a z = -CAP_LEN): si gira a sinistra o a destra
  const rad = CAP_RAD, H = 5.2, OCHRE = '#f9d488', z1 = -rad, z2 = -(CAP_LEN - rad), mid = (z1 + z2) / 2, st = z1 - z2;
  for (const zc of [z1, z2]) {
    k.add(G.cyl(rad, rad, H, 22), OCHRE, { x: 0, y: H / 2, z: zc, vary: 0.04 });
    k.add(G.cyl(rad + 0.05, rad + 0.05, 0.45, 22), '#c69a58', { x: 0, y: 0.22, z: zc });
    k.add(G.cyl(rad + 0.4, rad + 0.25, 0.3, 22), '#3e2a20', { x: 0, y: H + 0.1, z: zc });
    k.add(G.cone(rad + 0.3, 1.2, 22), '#5a3a2a', { x: 0, y: H + 0.85, z: zc });
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; k.add(G.box(0.16, 0.12, 0.45), '#2c1f18', { x: Math.cos(a) * (rad + 0.35), y: H - 0.1, z: zc + Math.sin(a) * (rad + 0.35), ry: -a }); }
  }
  k.add(G.box(rad * 2, H, st), OCHRE, { x: 0, y: H / 2, z: mid, vary: 0.04 });
  k.add(G.box(rad * 2 + 0.1, 0.45, st), '#c69a58', { x: 0, y: 0.22, z: mid });
  k.add(G.box(rad * 2 + 0.8, 0.3, st), '#3e2a20', { x: 0, y: H + 0.1, z: mid });
  k.add(G.box(rad * 2 + 0.6, 1.2, st), '#5a3a2a', { x: 0, y: H + 0.85, z: mid, sx: 0.75 });
  for (let i = 0; i < 8; i++) for (const sd of [-1, 1]) k.add(G.box(0.12, 0.08, rad * 0.9), '#6e4632', { x: sd * rad * 0.5, y: H + 1.0, z: z1 - (i + 0.5) * st / 8, ry: Math.PI / 2, rz: sd * -0.45 });
  // fronte verso chi arriva (+z): porta di legno, architrave scuro, gradino, croce di ferro, finestrella
  const F = (t, y, geo, col, o = {}) => k.add(geo, col, { x: t, y, z: 0.02 + (o.dz || 0), ...o });
  F(0, 1.45, G.box(1.6, 2.6, 0.1), '#c9c1b0');
  F(0, 1.35, G.box(1.3, 2.5, 0.14), '#7a4a26', { dz: 0.06, vary: 0.05 });
  for (let j = 0; j < 3; j++) for (const sd of [-1, 1]) F(sd * 0.3, j ? 2.2 - (j - 1) * 0.5 : 0.7, G.box(0.42, j ? 0.4 : 0.65, 0.05), j ? '#3d4a50' : '#6a3e20', { dz: 0.14 });
  F(0, 2.85, G.box(2.0, 0.24, 0.22), '#3a2a20', { dz: 0.06 });
  F(0, 0.1, G.box(2.4, 0.2, 0.8), '#8a7a66', { dz: 0.35 });
  const ct = 1.35;
  F(ct, 3.6, G.box(0.1, 1.3, 0.06), '#1e1b1a', { dz: 0.04 }); F(ct, 3.9, G.box(0.8, 0.1, 0.06), '#1e1b1a', { dz: 0.04 });
  F(-1.35, 3.1, G.box(0.32, 1.0, 0.08), '#ece6d8', { dz: 0.02 });
  // lampioni di ferro ai due lati dello sdoppiamento
  streetLamp(k, -1.5, 0.6, 1); streetLamp(k, 1.5, 0.6, -1);
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
