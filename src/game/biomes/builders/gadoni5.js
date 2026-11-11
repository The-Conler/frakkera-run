// =====================================================================
// v5 stage 23c (target5-*): due luoghi veri di Gadoni alla fine del paese, attraversati dalla via.
//  - vicolo: muri d'intonaco consumato ai due lati, portone verde a due ante sotto un arco di pietra con
//    lunetta a raggiera; piu' avanti il Monumento ai Caduti (al posto della casa con porta azzurra).
//  - cappella tonda: piccolo edificio ocra arrotondato con gronda di coppi scuri, porta di legno marrone con
//    architrave scuro, croce di ferro battuto sul muro; la via si divide attorno (ramo lastricato a destra),
//    lampioni di ferro, case bianche con balconi dietro.
// Coordinate del monumento: x come la via (0 = centro), z = 0 al punto "at", negativo = piu' avanti.
// Tutto fuori dalle corsie (|x| > 6.9 m): le corsie restano libere e leggibili.
// =====================================================================
import * as THREE from 'three';
import { Kit, G, rng, tree, shrub, cypress, LEAF } from './common.js';

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
  // v5s45 (17): tolta la casa alta color sabbia col grande portone ad arco verde-azzurro sul lato SINISTRO (prima del
  // monumento): al suo posto un muretto basso d'orto, arretrato, con siepi e due alberi bassi. Niente muri alti a corridoio,
  // il Monumento ai Caduti (z -21) si vede gia' da lontano. I numeri casuali della vecchia casa si consumano lo stesso.
  const L = -1, r2 = rng(5145);
  for (let z0 = 0; z0 > -len; z0 -= 3.25) { r.pick([0, 1, 2, 3]); const zc = z0 - 1.6; if (zc < -10) continue; r.range(-0.4, 0.4); }
  k.add(G.box(0.5, 0.9, 15.5), '#a89a86', { x: L * (E + 0.25), y: 0.45, z: -7.75, vary: 0.2 });          // muretto d'orto sul filo del marciapiede
  k.add(G.box(0.6, 0.12, 15.5), '#8e8272', { x: L * (E + 0.25), y: 0.94, z: -7.75 });                    // copertina
  for (const [za, zb] of [[-22.5, -len]]) k.add(G.box(0.5, 0.9, za - zb), '#a89a86', { x: L * (E + 0.25), y: 0.45, z: (za + zb) / 2, vary: 0.2 });
  k.add(G.box(9, 0.08, 15.5), '#5d6b3c', { x: L * (E + 5), y: 0.0, z: -7.75 });                          // orto (terra erbosa)
  for (let i = 0; i < 14; i++) k.add(G.ico(r2.range(0.45, 0.85), 0), r2.pick(['#4f7a2c', '#5f8a34', '#3f6a28']), { x: L * (E + r2.range(1.2, 3.2)), y: r2.range(0.5, 0.9), z: -r2.range(0.5, 15), flat: true, vary: 0.2 });   // siepe dietro il muretto
  // v5s46b: tolti i due alberi dell'orto: da chi corre coprivano il Monumento ai Caduti (statua, base e bandiere)
  for (let i = 0; i < 6; i++) k.add(G.ico(r.range(0.5, 0.9), 0), r.pick(['#4f7a2c', '#5f8a34', '#3f6a28']), { x: L * (E + r.range(1.5, 6)), y: r.range(0.4, 0.8), z: -r.range(23.5, len - 1), flat: true, vary: 0.2 });
  // case pallide a destra della chiesa: tolte. Al loro posto un boschetto (lecci e cipressi),
  // arretrato sul marciapiede destro cosi' non copre ne' la chiesa in fondo ne' il monumento a sinistra.
  // Si consumano gli stessi numeri casuali delle vecchie case: il resto del vicolo non si sposta.
  const R = 1;
  for (let z0 = 0; z0 > -len; z0 -= 3.25) {
    if (z0 < -12) r.pick(['#d9b8a0', '#e0c2a8', '#cfa98e']); else r.pick(['#c8b49a', '#bfa98d']);
    r.range(-0.4, 0.4);
  }
  const gt = rng(5191);
  k.add(G.box(9.5, 0.08, len + 1), '#5d6b3c', { x: R * (E + 6.2), y: 0.02, z: -len / 2, vary: 0.12 });
  k.add(G.box(0.42, 0.72, len), '#8d8478', { x: R * (E + 0.35), y: 0.36, z: -len / 2, vary: 0.16 });
  k.add(G.box(0.5, 0.1, len), '#6e675c', { x: R * (E + 0.35), y: 0.74, z: -len / 2 });
  const nGrove = Math.max(6, Math.round(len / 3.4));
  for (let i = 0; i < nGrove; i++) {
    const z = -1.2 - (i + 0.35) * ((len - 2.2) / nGrove);
    const x = R * (E + 3.6 + (i % 3) * 1.7);
    if (i % 4 === 0) cypress(k, gt, x, 0, z, 0.85 + (i % 3) * 0.12);
    else tree(k, gt, x, 0, z, 1.05 + (i % 3) * 0.22, LEAF.holm);
    shrub(k, gt, x - R * 1.3, 0, z + 0.6, 0.55, ['#3f6a28', '#4f7a32', '#2f5520'], 0.35);
  }
  const bz = -21;
  // v5s44e: monumento di sbieco verso chi arriva, piu' vicino al marciapiede (fuori dalle corsie)
  caduti(k, rng(5401), -8.8, bz, -0.72);
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
  // Cappella tonda ocra (porta scura, croce, tetto di coppi) e le due case bianche col tetto rosso
  // stavano subito dietro il Monumento ai Caduti. Non ci sono piu': dietro la statua resta il cielo.
  // Il sorteggio del colore delle case si consuma lo stesso.
  r.pick(['#eeeae2', '#e6e2d8', '#f2efe8']); r.pick(['#eeeae2', '#e6e2d8', '#f2efe8']);
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

// =====================================================================
// v5s44e: Monumento ai Caduti di Gadoni (basso-poligonale, un draw call via Kit).
// Piazzetta rialzata, muretto + ringhiera, basamento a due piani con lapidi,
// roccia, gruppo bronzeo (soldato con elmetto che sorregge un compagno ferito),
// due pennoni (tricolore e Quattro Mori), alberi dietro, rose davanti, cannone.
// Di sbieco verso chi arriva (come la vecchia casa), vicino al marciapiede, cima ~7 m.
// Tutto a sinistra della via, fuori dalle corsie (|x| > 5.5).
// =====================================================================
function placedKit(k, cx, cz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    add(geo, col, o = {}) {
      const lx = o.x || 0, lz = o.z || 0;
      return k.add(geo, col, { ...o, x: cx + lx * c + lz * s, z: cz - lx * s + lz * c, ry: (o.ry || 0) + yaw });
    }
  };
}
function caduti(k, r, cx, cz, yaw = -0.72) {
  k = placedKit(k, cx, cz, yaw);
  cx = 0; cz = 0;
  const COBB = ['#8a8680', '#7c7870', '#969288', '#6e6a64'];
  // piazzetta rialzata lastricata (locale: +x verso la via; yaw la gira verso chi arriva)
  k.add(G.box(4.0, 0.2, 4.4), '#7a766c', { x: cx, y: 0.1, z: cz, vary: 0.12 });
  for (let i = 0; i < 18; i++) {
    k.add(G.box(r.range(0.35, 0.6), 0.05, r.range(0.28, 0.5)), r.pick(COBB), {
      x: cx + r.range(-1.7, 1.8), y: 0.22, z: cz + r.range(-1.9, 1.9), ry: r.range(-0.4, 0.4), vary: 0.15
    });
  }
  // basamento in granito, aperto verso la via (niente muretto davanti: lapide e statua restano in vista)
  k.add(G.box(2.55, 0.32, 3.15), '#9e9a92', { x: cx + 0.05, y: 0.28, z: cz, vary: 0.07 });
  k.add(G.box(2.05, 1.02, 2.55), '#c8c4ba', { x: cx + 0.08, y: 0.9, z: cz, vary: 0.05 });
  k.add(G.box(2.2, 0.1, 2.7), '#d4d0c6', { x: cx + 0.08, y: 1.44, z: cz });
  // due ritratti e il mazzo tricolore sul piano del basamento, come nella foto
  for (const s of [-1, 1]) {
    k.add(G.box(0.06, 0.34, 0.26), '#2c2824', { x: cx + 0.55, y: 1.64, z: cz + s * 0.72 });
    k.add(G.box(0.04, 0.26, 0.18), '#c4b8a4', { x: cx + 0.59, y: 1.64, z: cz + s * 0.72 });
  }
  k.add(G.ico(0.16, 0), '#c8283a', { x: cx + 0.55, y: 1.62, z: cz, flat: true });
  k.add(G.ico(0.12, 0), '#f4f0e6', { x: cx + 0.62, y: 1.7, z: cz + 0.08, flat: true });
  k.add(G.ico(0.12, 0), '#2f8a4a', { x: cx + 0.6, y: 1.58, z: cz - 0.08, flat: true });
  // mucchio di roccia: gli stessi sorteggi di colore di prima (le rose non si spostano), forma nuova
  const RS = ['#8a8680', '#7a766e', '#949088', '#6e6a64', '#5f5b54'];
  const MS = ['#4a6a32', '#3f5a2c', '#5a7a3a'];
  for (let i = 0; i < 13; i++) r.pick(RS);
  for (let i = 0; i < 4; i++) r.pick(MS);
  const look = rng(5488);
  const mound = [
    [0.05, 0.55, 0.0, 0.95], [0.42, 0.38, 0.28, 0.62], [-0.38, 0.42, -0.22, 0.7],
    [0.22, 0.95, -0.18, 0.58], [-0.18, 1.15, 0.16, 0.55], [0.08, 1.55, 0.02, 0.5],
    [0.32, 1.25, 0.3, 0.42], [-0.28, 0.85, 0.32, 0.4], [0.02, 1.95, -0.08, 0.46],
    [-0.08, 2.25, 0.06, 0.38], [0.12, 2.5, 0.02, 0.32],
  ];
  for (const [dx, dy, dz, s] of mound) {
    k.add(G.ico(s, 1), look.pick(['#9a968e', '#8b877f', '#aea89e', '#7a766e', '#b3aea4']), {
      x: cx + 0.1 + dx, y: 1.5 + dy, z: cz + dz, flat: true, vary: 0.16, sy: 0.78
    });
  }
  for (const [dx, dy, dz, s] of [[0.2, 0.7, 0.3, 0.16], [-0.3, 0.9, -0.1, 0.14], [0.05, 1.6, 0.2, 0.12], [-0.1, 2.0, -0.15, 0.1]]) {
    k.add(G.ico(s, 0), look.pick(MS), { x: cx + 0.1 + dx, y: 1.5 + dy, z: cz + dz, flat: true });
  }
  // gruppo bronzeo sui massi. Le figure guardano +x locale (verso la via e chi arriva).
  figurePair(k, cx + 0.22, 4.4, cz, 0);
  // una bandiera, di lato e un po' indietro: non passa davanti alla statua
  flagPole(k, cx - 0.15, cz + 1.55, 'mori');
  // niente casa alle spalle. Due lecci ben dietro il gruppo (le chiome non arrivano davanti alla statua).
  // I due alberi vecchi restano su un kit scartato: consumano gli stessi numeri casuali delle rose.
  { const kx = new Kit(1); tree(kx, r, cx - 2.45, 0, cz - 1.25, 1.55, LEAF.holm); tree(kx, r, cx - 2.25, 0, cz + 1.3, 1.7, LEAF.holm); }
  tree(k, look, cx - 7.2, 0, cz - 1.7, 1.35, LEAF.holm);
  tree(k, look, cx - 7.4, 0, cz + 1.8, 1.45, LEAF.holm);
  shrub(k, look, cx - 2.4, 0.05, cz - 1.2, 0.55, ['#3a6a28', '#4e7a34'], 0);
  shrub(k, look, cx - 2.2, 0.05, cz + 1.15, 0.5, ['#3a6a28', '#4e7a34'], 0);
  // rose rosse davanti al basamento, basse: non coprono la lapide ne' la statua
  for (const tz of [-1.5, -0.5, 0.5, 1.5]) {
    shrub(k, r, cx + 1.85, 0.02, cz + tz, 0.36, ['#3a6a28', '#4a7a30', '#2f5a22'], 0);
    for (let i = 0; i < 4; i++) k.add(G.ico(0.09, 0), r.pick(['#c8283a', '#e04050', '#a01828']), {
      x: cx + 1.85 + r.range(-0.18, 0.18), y: 0.22 + r.range(0, 0.22), z: cz + tz + r.range(-0.18, 0.18), flat: true
    });
  }
  // vecchio cannone da campagna, un lato
  cannon(k, cx - 0.25, 0.2, cz + 2.4);
}

function figurePair(k, ox, oy, oz, faceRy) {
  const c = Math.cos(faceRy), s = Math.sin(faceRy);
  // patina di bronzo (verde-grigio), non il marrone di un manichino
  const BZ = '#8eaea0', BD = '#6a8c80', BL = '#d5e4dc', BH = '#3e564c';
  const SC = 1.55;
  const P = (lx, ly, lz, geo, col, o = {}) => {
    k.add(geo, col, {
      x: ox + lx * SC * c + lz * SC * s, y: oy + ly * SC, z: oz - lx * SC * s + lz * SC * c,
      ry: (o.ry || 0) + faceRy, rx: o.rx, rz: o.rz,
      sx: (o.sx ?? 1) * SC, sy: (o.sy ?? 1) * SC, sz: (o.sz ?? 1) * SC,
      vary: o.vary, flat: o.flat
    });
  };
  // soldato in piedi: gamba indietro dritta, ginocchio avanti alzato, elmetto
  P(-0.02, 0.42, -0.1, G.box(0.16, 0.78, 0.16), BD);                 // gamba d'appoggio
  P(-0.02, 0.06, -0.04, G.box(0.18, 0.1, 0.32), BH);                  // stivale
  P(0.22, 0.72, 0.04, G.box(0.46, 0.16, 0.16), BZ, { rz: -0.55 });    // coscia alzata
  P(0.4, 0.42, 0.06, G.box(0.15, 0.5, 0.15), BD);                     // stinco
  P(0.42, 0.12, 0.12, G.box(0.18, 0.1, 0.3), BH);
  P(0.02, 0.98, 0, G.box(0.34, 0.26, 0.28), BD);                      // fianchi
  P(0.04, 1.42, 0.02, G.box(0.4, 0.62, 0.3), BZ);                     // giubba
  P(0.06, 1.15, 0.04, G.box(0.42, 0.08, 0.32), BH);                   // cintura
  P(0.08, 1.15, 0.16, G.box(0.1, 0.16, 0.08), BD);                    // giberna
  P(0.06, 1.88, 0.02, G.sph(0.15, 10, 8), BL);                        // volto
  P(0.06, 2.0, 0.0, G.sph(0.18, 10, 8), BH, { sy: 0.72 });            // elmetto
  P(0.08, 1.9, 0.02, G.cyl(0.22, 0.22, 0.05, 10), BH);            // tesa
  // braccia che reggono il compagno, in avanti
  P(0.28, 1.38, 0.18, G.box(0.42, 0.12, 0.12), BZ, { rz: -0.35 });
  P(0.26, 1.32, -0.16, G.box(0.4, 0.12, 0.12), BD, { rz: -0.25 });
  // compagno esanime di traverso sulle braccia: testa reclinata, braccio e gambe a penzoloni
  P(0.48, 1.28, 0.02, G.box(0.62, 0.26, 0.24), BZ, { rz: 0.15 });     // busto abbandonato
  P(0.72, 1.42, 0.16, G.sph(0.13, 8, 6), BL);                         // testa china
  P(0.74, 1.52, 0.16, G.sph(0.14, 8, 6), BH, { sy: 0.7, rz: 0.4 });   // elmetto inclinato
  P(0.55, 0.95, 0.2, G.box(0.1, 0.52, 0.1), BD);                      // braccio che pende
  P(0.55, 0.66, 0.2, G.box(0.09, 0.1, 0.12), BL);                     // mano
  P(0.22, 0.95, -0.02, G.box(0.12, 0.55, 0.13), BD, { rz: 0.35 });    // gamba che pende
  P(0.12, 0.58, -0.06, G.box(0.12, 0.42, 0.12), BZ, { rz: 0.15 });
  P(0.1, 0.34, -0.04, G.box(0.16, 0.08, 0.24), BH);
  P(0.38, 0.88, -0.12, G.box(0.12, 0.48, 0.12), BD, { rz: -0.2 });
  P(0.46, 0.55, -0.14, G.box(0.11, 0.38, 0.11), BZ);
  P(0.5, 0.34, -0.12, G.box(0.16, 0.08, 0.24), BH);
}

function flagPole(k, x, z) {
  // bandiera dei Quattro Mori, di lato: il telo va lungo z, non davanti alla statua
  const H = 7.15;
  k.add(G.cyl(0.05, 0.07, H, 6), '#e4e0d8', { x, y: H / 2, z });
  k.add(G.cyl(0.12, 0.14, 0.1, 6), '#c8c4bc', { x, y: 0.06, z });
  k.add(G.sph(0.055, 6, 5), '#f2eee6', { x, y: H + 0.03, z });
  const fy = H - 0.72, fh = 0.92, fw = 1.25;
  const zz = z + fw / 2 + 0.04;
  k.add(G.box(0.03, fh, fw), '#f7f4ee', { x, y: fy, z: zz });
  k.add(G.box(0.045, fh * 0.14, fw * 0.92), '#c41e3a', { x: x + 0.02, y: fy, z: zz });
  k.add(G.box(0.045, fh * 0.9, fw * 0.12), '#c41e3a', { x: x + 0.02, y: fy, z: zz });
  for (const [dz, dy] of [[-0.26, 0.22], [0.26, 0.22], [-0.26, -0.22], [0.26, -0.22]]) {
    k.add(G.cyl(0.09, 0.09, 0.04, 7), '#1a1a1a', { x: x + 0.03, y: fy + dy * fh, z: zz + dz * fw, rx: Math.PI / 2 });
    k.add(G.box(0.04, 0.03, 0.16), '#f7f4ee', { x: x + 0.04, y: fy + dy * fh + 0.03, z: zz + dz * fw });
  }
}

function cannon(k, x, y, z) {
  const GR = '#3a4a2c', IR = '#2a2a28', WD = '#4a3a28';
  for (const s of [-1, 1]) {
    k.add(G.cyl(0.4, 0.4, 0.11, 9), WD, { x, y: y + 0.4, z: z + s * 0.42, rx: Math.PI / 2 });
    k.add(G.cyl(0.1, 0.1, 0.13, 6), IR, { x, y: y + 0.4, z: z + s * 0.42, rx: Math.PI / 2 });
  }
  k.add(G.cyl(0.055, 0.055, 0.9, 6), IR, { x, y: y + 0.4, z, rx: Math.PI / 2 });
  k.add(G.box(1.05, 0.11, 0.2), WD, { x: x - 0.5, y: y + 0.22, z, rz: 0.18 });
  k.add(G.cyl(0.11, 0.13, 1.45, 8), GR, { x: x + 0.4, y: y + 0.7, z, rz: Math.PI / 2 - 0.14 });
  k.add(G.cyl(0.15, 0.15, 0.16, 8), IR, { x: x + 1.05, y: y + 0.8, z, rz: Math.PI / 2 - 0.14 });
}

export function buildCaduti() {
  const k = new Kit(5401);
  caduti(k, rng(5401), 0, 0);
  return k.build({ ao: 0.2 });
}

// Lastra coi nomi (catalogo ICCD del Monumento ai Caduti di Gadoni) e la dedica sul fianco.
// Coordinate del vicolo, stesso yaw del gruppo bronzeo: la lapide guarda la via.
const CADUTI_POSE = { x: -8.8, z: -21, yaw: -0.72 };
function cadutiWorld(lx, ly, lz) {
  const { x: cx, z: cz, yaw } = CADUTI_POSE, c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: cx + lx * c + lz * s, y: ly, z: cz - lx * s + lz * c, ry: yaw };
}
let plaqueTex = null, quoteTex = null;
function plaqueTexture() {
  if (plaqueTex || typeof document === 'undefined') return plaqueTex;
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e1d4'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#6e6a62'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#2a2622'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 34px Georgia, "Times New Roman", serif';
  g.fillText('GADONI AI SUOI FIGLI CADUTI EROICAMENTE PER LA PATRIA', W / 2, 40);
  const col = (title, names, x, y0) => {
    g.font = '700 22px Georgia, "Times New Roman", serif';
    g.fillText(title, x, y0);
    g.font = '600 16px Georgia, "Times New Roman", serif';
    names.forEach((n, i) => g.fillText(n, x, y0 + 32 + i * 20));
  };
  col('1915 – 1918', [
    'SOLD. DEIDDA BATTISTA', 'SOLD. FLORIS FRANCESCO', 'SOLD. FLORIS ANTIOCO',
    'SOLD. MARIOTTI GIACOMO', 'SOLD. MELIS GIUSEPPE LUIGI', 'SOLD. MELIS MARTINO',
    'SERG. MORO FRANCESCO', 'SOLD. MORO GIUSEPPE', 'SOLD. MORO MICHELE DI GIUS.',
  ], 250, 78);
  col('', [
    'SOLD. MORO MICHELE DI RAFF.', 'SOLD. MORO SALVATORE', 'SOLD. MURENU ANTONIO',
    'SOLD. ORTU ANTONIO', 'CAP. ORTU GIUSEPPE ANTIOCO', 'SOLD. ORTU RAFFAELE',
    'SOLD. POLLA ANTIOCO', 'SOLD. SECCI INNOCENZO', 'SOLD. VACCA ANTONIO',
  ], 560, 78);
  col('1940 – 1945', [
    'AGUS ANTONIO', 'BOI VINCENZO', 'SECCI GIOVANNI', 'TISTI GIOVANNI',
  ], 860, 78);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  plaqueTex = t; return t;
}
function quoteTexture() {
  if (quoteTex || typeof document === 'undefined') return quoteTex;
  const W = 768, H = 384, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e1d4'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#6e6a62'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#2a2622'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 28px Georgia, "Times New Roman", serif';
  const lines = ['O VIVENTI CHE PASSATE', 'SE PER VOI NON DURI E NON CRESCA', 'LA GLORIA DELLA PATRIA', 'NOI SAREMO MORTI INVANO.'];
  lines.forEach((ln, i) => g.fillText(ln, W / 2, 90 + i * 52));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  quoteTex = t; return t;
}
function plaqueMesh(tex, w, h, lx, ly, lz, ry) {
  const p = cadutiWorld(lx, ly, lz);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, emissive: '#4a4038', emissiveMap: tex, emissiveIntensity: 0.22 }));
  m.position.set(p.x, p.y, p.z); m.rotation.y = p.ry + ry;
  m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; m.material.polygonOffsetUnits = -2;
  return m;
}
export function cadutiDecals() {
  const names = plaqueTexture(), quote = quoteTexture();
  if (!names) return [];
  // fronte del basamento (normale +x locale) e dedica sul fianco verso chi arriva (+z locale)
  return [
    plaqueMesh(names, 2.2, 0.86, 1.14, 0.9, 0, Math.PI / 2),
    plaqueMesh(quote, 1.35, 0.62, 0.08, 0.95, 1.32, 0),
  ];
}
