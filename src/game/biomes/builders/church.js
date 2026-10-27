// =====================================================================
//  CHIESA PARROCCHIALE E CAMPANILE DI GADONI (piazza) - modello isolato
//  Fonte primaria: reference/gadoni/foto-chiesa-campanile.jpg
//  - campanile quadrato in pietra a vista (muratura irregolare grigio-bruna)
//  - fasce e cornici in intonaco rosa-salmone (fascia bassa, cornice
//    aggettante sotto la cella dell'orologio, cornice di coronamento)
//  - cella campanaria ad arco incorniciata di rosa con la campana
//  - orologio bianco tondo sotto la cuspide in coppi a profilo "a bulbo"
//    (piramide a 4 falde incurvate) con croce
//  - chiesa intonacata rosa, facciata a capanna semplice, una finestra
//    ad arco, tetto in coppi
//  - davanti: capanna rustica del presepe (pali di legno, pietre, tetto
//    d'erba con bordo di coppi); pavimento a quadrotti; fili di luci
//    che partono dalla cima del campanile e attraversano la piazza.
//  Per rifinirlo basta modificare questo file: le misure sono in metri.
//  Convenzione: piazza a SINISTRA della strada (x < 0), z locale da 0
//  (inizio piazza) a -LEN (avanti nella corsa).
// =====================================================================
import * as THREE from 'three';
import { Kit, G, rng, gridSurface, addColored, tree, shrub, addRock, ROCK } from './common.js';

export const SQUARE = { LEN: 52, EDGE: -6.95, BACK: -40 };
const C = {
  pink: '#e8a08c', pinkD: '#d98c78', pinkL: '#f0b4a0',
  church: '#eaa595', churchD: '#dc9484',
  stone: ['#8c8273', '#7a7064', '#9a8f7e', '#6e665a', '#a39684', '#857a68', '#93887a'],
  mortar: '#a69c8c',
  tile: ['#c9773a', '#bf6c34', '#d48544', '#b8622e'],
  roof: ['#b9603a', '#c46c42', '#a9553a'],
  wood: ['#5a3f28', '#6b4a2e', '#4a3420'], grass: ['#5f7f36', '#6b8a3c', '#4f6e2e', '#7a8f48'],
  bulb: '#fff0c4', wire: '#3a3530', bronze: '#8a6a3a', dark: '#2a2420',
};
export const TOWER = { x: -10.4, z: -22.0, W: 4.4, H: 21.5 };   // misure del modello (H = cornice di coronamento)
// v5 stage 5 (target2-villaggio): il campanile sta dall'ALTRA parte della via rispetto alla chiesa (a sinistra
// di chi corre, quindi poco a sinistra del centro dell'inquadratura e mai dietro la fiamma, che e' a destra),
// ingrandito (x TOWER_S) perche' domini la fine del rettilineo. Coordinate del costruttore: x > 0 = lato opposto.
export const TOWER_S = 1.5;
export const TOWER_AT = { x: 10.3, z: -22.0 };
export const CHURCH = { x0: -11.0, x1: -29, z0: -21.4, z1: -35.6, eave: 9.5, ridge: 13.0 };

// paramento in pietra irregolare su una faccia piana (corsi sfalsati, giunti chiari)
function masonryFace(k, r, o) {
  // o: origine, u (vettore larghezza), v (su), n (normale), W, H, cell
  const { W, H } = o; const cell = 0.3;
  const nu = Math.round(W / cell), nv = Math.round(H / cell);
  const pal = C.stone; const seed = r() * 1000;
  const courseH = 0.34;
  const colorAt = (x, y) => {
    const c = Math.floor(y / courseH); const off = (c * 0.53 + seed) % 1;
    const bw = 0.55 + ((c * 7) % 5) * 0.12;
    const b = Math.floor(x / bw + off);
    const fy = (y / courseH) - c, fx = (x / bw + off) - b;
    if (fy < 0.12 || fx < 0.07) return C.mortar;               // giunti
    const h = Math.abs(Math.sin(c * 12.9898 + b * 78.233 + seed) * 43758.5453) % 1;
    return pal[Math.floor(h * pal.length)];
  };
  const P = (u, v) => {
    const x = u * W, y = v * H;
    const fy = (y / courseH) % 1;
    const rel = fy < 0.12 ? -0.03 : 0.0;
    return [o.ox + o.ux * x + o.nx * rel, o.oy + y, o.oz + o.uz * x + o.nz * rel];
  };
  const pos = [], col = [];
  const cc = new THREE.Color();
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = P(i / nu, j / nv), b = P((i + 1) / nu, j / nv), c = P((i + 1) / nu, (j + 1) / nv), d = P(i / nu, (j + 1) / nv);
    if (o.hole && o.hole((i + 0.5) / nu * W, (j + 0.5) / nv * H)) continue;
    cc.set(colorAt((i + 0.5) / nu * W, (j + 0.5) / nv * H)).multiplyScalar(0.92 + r() * 0.16);
    for (const p of [a, b, c, a, c, d]) { pos.push(...p); col.push(cc.r, cc.g, cc.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // normale costante (la faccia e' piana)
  const n = new Float32Array(pos.length); for (let i = 0; i < n.length; i += 3) { n[i] = o.nx; n[i + 1] = 0; n[i + 2] = o.nz; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  addColored(k, g);
}

// ------------------------------------------------------------------ campanile
export function buildBellTower(k, r, T = TOWER) {
  const { x, z, W, H } = T; const h2 = W / 2;
  // nucleo (riempie gli spigoli) + 4 facce in pietra a vista
  k.add(G.box(W - 0.06, H, W - 0.06), '#7f7566', { x, y: H / 2, z });
  const belfry = { y0: 12.3, y1: 14.7, w: 1.3 };
  const hole = (u, y) => y > belfry.y0 && y < belfry.y1 + 0.35 && Math.abs(u - W / 2) < belfry.w / 2 && (y < belfry.y1 || Math.hypot(u - W / 2, (y - belfry.y1) * 1.6) < belfry.w / 2);
  const faces = [
    { ox: x - h2, oz: z + h2, ux: 1, uz: 0, nx: 0, nz: 1, hole },     // verso la camera che arriva (+z)
    { ox: x + h2, oz: z + h2, ux: 0, uz: -1, nx: 1, nz: 0, hole },    // verso la strada (+x)
  ];
  for (const f of faces) masonryFace(k, r, { ...f, oy: 0, W, H });
  // pietre sporgenti sugli spigoli (cantonali)
  for (let y = 0.2; y < H - 0.3; y += 0.62) for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1]]) {
    const big = Math.floor(y / 0.62) % 2;
    k.add(G.box(big ? 0.8 : 0.5, 0.32, big ? 0.5 : 0.8), r.pick(C.stone), { x: x + sx * (h2 - 0.2), y, z: z + sz * (h2 - 0.2), vary: 0.12, sx: 1.04, sz: 1.04 });
  }
  // zoccolo
  k.add(G.box(W + 0.3, 0.7, W + 0.3), '#8a8070', { x, y: 0.35, z, vary: 0.05 });
  // fascia rosa bassa
  k.add(G.box(W + 0.14, 0.55, W + 0.14), C.pink, { x, y: 6.5, z });
  k.add(G.box(W + 0.2, 0.1, W + 0.2), C.pinkD, { x, y: 6.8, z });
  // cella campanaria: cornice rosa ad arco, vano scuro, campana (facce +z e +x)
  const by = (belfry.y0 + belfry.y1) / 2;
  for (const f of [{ nx: 0, nz: 1 }, { nx: 1, nz: 0 }]) {
    const fx = x + f.nx * (h2 + 0.02), fz = z + f.nz * (h2 + 0.02);
    const along = f.nz ? { ax: 1, az: 0 } : { ax: 0, az: 1 };
    const fw = belfry.w + 0.7;
    // stipiti e davanzale
    for (const s of [-1, 1]) k.add(G.box(f.nx ? 0.12 : 0.35, belfry.y1 - belfry.y0 + 0.2, f.nz ? 0.12 : 0.35), C.pink, { x: fx + along.ax * s * (belfry.w / 2 + 0.17), y: by, z: fz + along.az * s * (belfry.w / 2 + 0.17) });
    k.add(G.box(f.nx ? 0.16 : fw, 0.3, f.nz ? 0.16 : fw), C.pink, { x: fx, y: belfry.y0 - 0.12, z: fz });
    // arco (segmenti)
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * i / 8, rr = belfry.w / 2 + 0.17;
      k.add(G.box(f.nx ? 0.12 : 0.36, 0.36, f.nz ? 0.12 : 0.36), C.pink, { x: fx + along.ax * Math.cos(a) * rr, y: belfry.y1 + Math.sin(a) * rr * 0.62, z: fz + along.az * Math.cos(a) * rr, rz: f.nz ? a - Math.PI / 2 : 0, rx: f.nx ? -(a - Math.PI / 2) : 0 });
    }
    // cornice esterna rosa piatta attorno al vano (come nella foto)
    k.add(G.box(f.nx ? 0.05 : fw + 0.2, belfry.y1 - belfry.y0 + 1.5, f.nz ? 0.05 : fw + 0.2), C.pinkL, { x: fx - f.nx * 0.03, y: by + 0.3, z: fz - f.nz * 0.03 });
    // targa bianca sotto la cella
    k.add(G.box(f.nx ? 0.08 : 0.9, 0.5, f.nz ? 0.08 : 0.9), '#e9e4da', { x: fx, y: belfry.y0 - 1.05, z: fz });
  }
  // vano interno scuro e campana
  k.add(G.box(W - 0.5, belfry.y1 - belfry.y0 + 0.6, W - 0.5), C.dark, { x, y: by + 0.2, z });
  const bell = new THREE.LatheGeometry([[0.05, 0.9], [0.22, 0.85], [0.3, 0.6], [0.34, 0.25], [0.46, 0.02], [0.47, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
  k.add(bell, C.bronze, { x, y: by - 0.75, z, vary: 0.05 });
  k.add(G.box(0.12, 0.5, 0.12), '#2a2a2a', { x, y: by + 0.45, z });
  // cornice aggettante rosa (sotto la cella dell'orologio)
  k.add(G.box(W + 0.55, 0.42, W + 0.55), C.pink, { x, y: 16.0, z });
  k.add(G.box(W + 0.3, 0.2, W + 0.3), C.pinkD, { x, y: 15.7, z });
  k.add(G.box(W + 0.7, 0.14, W + 0.7), C.pinkL, { x, y: 16.25, z });
  // orologio tondo bianco (facce +z e +x)
  const cy = 18.7;
  for (const f of [{ nx: 0, nz: 1 }, { nx: 1, nz: 0 }]) {
    const fx = x + f.nx * (h2 + 0.04), fz = z + f.nz * (h2 + 0.04);
    const rot = f.nz ? { rx: Math.PI / 2 } : { rz: Math.PI / 2 };
    k.add(G.cyl(0.98, 0.98, 0.1, 24), C.pink, { x: fx, y: cy, z: fz, ...rot });
    k.add(G.cyl(0.82, 0.82, 0.14, 24), '#f4f1ea', { x: fx + f.nx * 0.03, y: cy, z: fz + f.nz * 0.03, ...rot });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const along = f.nz ? [Math.cos(a), 0] : [0, -Math.cos(a)]; k.add(G.box(f.nx ? 0.05 : 0.08, 0.08, f.nz ? 0.05 : 0.08), '#2a2a30', { x: fx + f.nx * 0.1 + along[0] * 0.68, y: cy + Math.sin(a) * 0.68, z: fz + f.nz * 0.1 + along[1] * 0.68 }); }
    // lancette (circa le 10 e 10)
    for (const [len, a] of [[0.5, 2.2], [0.68, 0.95]]) {
      const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      k.add(G.box(f.nx ? 0.04 : len, 0.06, f.nz ? 0.04 : len), '#1e1e24', { x: fx + f.nx * 0.12 + (f.nz ? dx : 0), y: cy + dy, z: fz + f.nz * 0.12 + (f.nx ? -dx : 0), rz: f.nz ? a : 0, rx: f.nx ? a : 0 });
    }
  }
  // cornice di coronamento rosa
  k.add(G.box(W + 0.3, 0.22, W + 0.3), C.pinkD, { x, y: H - 0.35, z });
  k.add(G.box(W + 0.62, 0.42, W + 0.62), C.pink, { x, y: H - 0.05, z });
  // cuspide in coppi a profilo incurvato (piramide a 4 falde)
  const prof = [[3.0, 0], [2.85, 0.3], [2.45, 1.0], [1.85, 1.85], [1.2, 2.75], [0.7, 3.55], [0.34, 4.25], [0.1, 4.75], [0.02, 4.85]];
  const spire = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 4, Math.PI / 4);
  k.add(spire, C.tile[0], { x, y: H + 0.15, z, flat: true, vary: 0.06 });
  // file di coppi (righe orizzontali piu' scure)
  for (let i = 1; i < 7; i++) {
    const t = i / 7, y = H + 0.15 + t * 4.4;
    let rr = 3; for (let j = 0; j < prof.length - 1; j++) if (prof[j + 1][1] >= t * 4.4) { const q = (t * 4.4 - prof[j][1]) / (prof[j + 1][1] - prof[j][1]); rr = prof[j][0] + (prof[j + 1][0] - prof[j][0]) * q; break; }
    k.add(new THREE.CylinderGeometry(rr * 1.0, rr * 1.03, 0.09, 4, 1, true), r.pick(['#a95a2a', '#b86634']), { x, y, z, ry: Math.PI / 4 });
  }
  // pomo e croce di ferro
  const top = H + 0.15 + 4.85;
  k.add(G.sph(0.16, 8, 6), '#6a5a40', { x, y: top + 0.05, z });
  k.add(G.box(0.08, 1.3, 0.08), '#2a2828', { x, y: top + 0.7, z });
  k.add(G.box(0.08, 0.08, 0.7), '#2a2828', { x, y: top + 0.95, z });
  k.add(G.box(0.7, 0.08, 0.08), '#2a2828', { x, y: top + 0.95, z });
  return { top: new THREE.Vector3(x, H + 0.4, z) };
}

// ------------------------------------------------------------------ chiesa
export function buildChurch(k, r) {
  const { x0, x1, z0, z1, eave, ridge } = CHURCH;
  const D = x0 - x1, Wd = z0 - z1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  k.add(G.box(D, eave, Wd), C.church, { x: cx, y: eave / 2, z: cz, vary: 0.02 });
  // timpano della facciata (verso la strada, +x) e posteriore
  for (const gx of [x0, x1]) {
    const gg = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-Wd / 2, 0), new THREE.Vector2(Wd / 2, 0), new THREE.Vector2(0, ridge - eave)]), { depth: 0.3, bevelEnabled: false });
    k.add(gg, C.church, { x: gx - 0.3, y: eave, z: cz, ry: Math.PI / 2 });
  }
  // cornice sottile del timpano
  const sl = Math.atan2(ridge - eave, Wd / 2), len = Math.hypot(ridge - eave, Wd / 2);
  for (const s of [-1, 1]) k.add(G.box(0.4, 0.28, len + 0.4), C.churchD, { x: x0 + 0.08, y: eave + (ridge - eave) / 2, z: cz + s * Wd / 4, rx: s * sl });
  // tetto in coppi a due falde
  for (const s of [-1, 1]) {
    k.add(G.box(D + 0.8, 0.28, len + 0.7), C.roof[0], { x: cx, y: eave + (ridge - eave) / 2 + 0.2, z: cz + s * Wd / 4, rx: s * sl, vary: 0.05 });
    for (let i = 0; i < 9; i++) k.add(G.box(D + 0.85, 0.08, 0.12), '#9a4a2e', { x: cx, y: eave + 0.3 + (ridge - eave) * (i / 9), z: cz + s * (Wd / 2) * (1 - i / 9), vary: 0.05 });
  }
  k.add(G.box(D + 0.9, 0.22, 0.3), '#9a4a2e', { x: cx, y: ridge + 0.32, z: cz });
  // finestra ad arco sulla facciata (vetro scuro con telaio di legno)
  const wy = 7.3;
  k.add(G.box(0.2, 1.9, 1.5), '#5a4030', { x: x0 + 0.06, y: wy, z: cz });
  k.add(G.cyl(0.75, 0.75, 0.2, 14, 1, false), '#5a4030', { x: x0 + 0.06, y: wy + 0.95, z: cz, rz: Math.PI / 2 });
  k.add(G.box(0.22, 1.7, 1.28), '#9a7a4a', { x: x0 + 0.1, y: wy, z: cz });
  k.add(G.box(0.24, 0.06, 1.28), '#4a3424', { x: x0 + 0.12, y: wy + 0.2, z: cz });
  k.add(G.box(0.24, 1.7, 0.06), '#4a3424', { x: x0 + 0.12, y: wy, z: cz });
  // portone con cornice in pietra
  k.add(G.box(0.25, 3.8, 2.6), '#9a8f7e', { x: x0 + 0.06, y: 1.9, z: cz });
  k.add(G.box(0.3, 3.3, 2.0), '#5a3a22', { x: x0 + 0.1, y: 1.65, z: cz, vary: 0.05 });
  k.add(G.box(0.6, 0.18, 3.2), '#8a8070', { x: x0 + 0.3, y: 0.09, z: cz });
  // finestre laterali (lato +z, visibile arrivando)
  for (const xx of [x0 - 5, x0 - 10, x0 - 14.5]) {
    k.add(G.box(1.1, 2.2, 0.16), '#f0b8a8', { x: xx, y: 6.2, z: z0 + 0.05 });
    k.add(G.box(0.8, 1.8, 0.18), '#3a3040', { x: xx, y: 6.2, z: z0 + 0.06 });
  }
  // zoccolo leggermente piu' scuro
  k.add(G.box(D + 0.1, 0.6, Wd + 0.1), C.churchD, { x: cx, y: 0.3, z: cz });
}

// ------------------------------------------------------------------ capanna del presepe
export function buildNativityHut(k, r, lamps) {
  const x0 = -8.6, x1 = -16.6, z0 = -2.5, z1 = -17.5, h = 3.0;     // davanti al campanile, verso chi arriva
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // muretti di pietra bassi e pali di tronco
  for (let z = z0; z >= z1; z -= 2.5) for (const xx of [x0, x1]) {
    k.add(G.cyl(0.18, 0.24, h, 6), r.pick(C.wood), { x: xx, y: h / 2, z, rz: r.range(-0.05, 0.05), flat: true, vary: 0.2 });
  }
  for (const xx of [x0, x1]) for (let z = z0; z > z1; z -= 0.6) addRock(k, r, xx + r.range(-0.15, 0.15), 0.3, z, 0.35, ROCK.granite, { squash: 0.7 });
  // fondo scuro (interno) con lucine calde
  k.add(G.box(0.2, h, z0 - z1), '#2e241c', { x: x1 + 0.3, y: h / 2, z: cz });
  for (let i = 0; i < 6; i++) { const lz = z0 - 2 - i * 3.3; k.add(G.box(0.18, 0.22, 0.18), '#ffc86a', { x: x1 + 1.2, y: 1.6 + r.range(-0.3, 0.3), z: lz, unlit: true }); lamps.push([x1 + 1.2, 1.6, lz, 1.4]); }
  // tetto a una falda in coppi di terracotta (target2-villaggio), travi sporgenti verso la strada
  const rw = x0 - x1 + 2.2, rd = z0 - z1 + 1.6, tilt = 0.2;
  k.add(G.box(rw, 0.3, rd), '#6b5236', { x: cx + 0.4, y: h + 0.3, z: cz, rz: tilt });
  for (let xx = -rw / 2 + 0.25; xx < rw / 2; xx += 0.42) {
    const yy = h + 0.5 - Math.sin(tilt) * xx * 1.0;
    k.add(G.cyl(0.16, 0.16, rd, 6, 1, true), r.pick(C.tile), { x: cx + 0.4 + xx * Math.cos(tilt), y: yy, z: cz, rx: Math.PI / 2, vary: 0.1 });
  }
  for (let z = z0 + 0.6; z > z1 - 0.6; z -= 2.5) k.add(G.box(1.2, 0.2, 0.22), r.pick(C.wood), { x: x0 + 0.9, y: h + 0.05, z });
  // fioriere e vasi sul bordo verso la strada
  for (let z = z0 - 0.8; z > z1; z -= 2.5) {
    k.add(G.box(0.6, 0.45, 1.6), '#8a5a36', { x: x0 + 0.9, y: 0.23, z, vary: 0.1 });
    for (let i = 0; i < 4; i++) k.add(G.ico(0.22, 0), r.pick(['#e83a4a', '#f06a8a', '#ffffff', '#ffd23a', '#d8244a']), { x: x0 + 0.9 + r.range(-0.2, 0.2), y: 0.6, z: z + r.range(-0.6, 0.6), flat: true });
    k.add(G.ico(0.3, 0), r.pick(C.grass), { x: x0 + 0.9, y: 0.52, z, sy: 0.6, flat: true });
  }
  // tronchi e pietre davanti (allestimento)
  for (let i = 0; i < 7; i++) k.add(G.cyl(0.22, 0.25, r.range(1.5, 3), 6), r.pick(C.wood), { x: x0 + r.range(1, 2.5), y: 0.25, z: z0 - r.range(1, 19), rx: Math.PI / 2, ry: r.range(-0.5, 0.5), flat: true });
  for (let i = 0; i < 12; i++) addRock(k, r, x0 + r.range(0.8, 3), 0.2, z0 - r.range(0, 20), r.range(0.25, 0.55), ROCK.limestone, { squash: 0.6 });
  for (let i = 0; i < 8; i++) shrub(k, r, x0 + r.range(1, 2.6), 0, z0 - r.range(0, 20), 0.6, ['#4f6e2e', '#5f7f36', '#3f5a28']);
}

// ------------------------------------------------------------------ fili di luci
function catenary(k, a, b, sag, bulbs, lamps, every = 0.9, glowEvery = 9) {
  const N = Math.max(6, Math.round(a.distanceTo(b) / 2.5));
  const P = (t) => new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < N; i++) {
    const p0 = P(i / N), p1 = P((i + 1) / N), mid = p0.clone().add(p1).multiplyScalar(0.5), d = p1.clone().sub(p0);
    const g = new THREE.CylinderGeometry(0.02, 0.02, d.length(), 3);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    k.add(g, C.wire, { x: mid.x, y: mid.y, z: mid.z });
  }
  const L = a.distanceTo(b); const n = Math.floor(L / every);
  for (let i = 1; i < n; i++) {
    const p = P(i / n);
    k.add(G.box(0.1, 0.13, 0.1), C.bulb, { x: p.x, y: p.y - 0.08, z: p.z, unlit: true });
    if (i % glowEvery === 0) lamps.push([p.x, p.y - 0.08, p.z, 1.1]);
  }
}

// piazza completa: { geom, lamps, houses } (case del bordo piazza: prefab del paese)
export function buildChurchSquare(seed = 1) {
  const r = rng(seed * 977 + 3);
  const k = new Kit(seed + 400);
  const lamps = [];
  const { LEN, EDGE, BACK } = SQUARE;
  // pavimento a quadrotti chiari/scuri (con leggera irregolarita')
  const T = 2.0;
  for (let x = EDGE - T / 2; x > BACK; x -= T) for (let z = -T / 2; z > -LEN; z -= T) {
    const i = Math.round((EDGE - x) / T), j = Math.round(-z / T);
    k.add(G.box(T - 0.05, 0.12, T - 0.05), (i + j) % 2 ? r.pick(['#d9d6cf', '#e2dfd8', '#cfcbc3']) : r.pick(['#8e8c88', '#9a9792', '#85837f']), { x, y: 0.03, z, vary: 0.04 });
  }
  // gradino verso la strada
  k.add(G.box(0.4, 0.25, LEN), '#9a8e80', { x: EDGE + 0.15, y: 0.12, z: -LEN / 2 });
  // campanile (ingrandito, ruotato in modo che le facce in pietra guardino strada e chi arriva)
  // v5s12: il campanile vero e' ora il fondale centrato in fondo alla via (buildVista); qui niente doppione
  const kt = new Kit(seed + 401);
  const mT = new THREE.Matrix4().makeRotationY(-Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(TOWER_S, TOWER_S, TOWER_S)).premultiply(new THREE.Matrix4().makeTranslation(TOWER_AT.x, 0, TOWER_AT.z));
  for (const g of kt.lit) { g.applyMatrix4(mT); k.lit.push(g); }
  const tw = { top: new THREE.Vector3(TOWER_AT.x, (TOWER.H + 0.4) * TOWER_S, TOWER_AT.z) };
  // piazzetta del campanile sul lato opposto della via (vuoto "left" di config.js: locale 150-176)
  const PX0 = -EDGE, PX1 = 21, PZ0 = -10, PZ1 = -36;
  for (let x = PX0 + T / 2; x < PX1; x += T) for (let z = PZ0 - T / 2; z > PZ1; z -= T) {
    const i = Math.round((x - PX0) / T), j = Math.round(-z / T);
    k.add(G.box(T - 0.05, 0.12, T - 0.05), (i + j) % 2 ? r.pick(['#d9d6cf', '#e2dfd8', '#cfcbc3']) : r.pick(['#8e8c88', '#9a9792', '#85837f']), { x, y: 0.03, z, vary: 0.04 });
  }
  k.add(G.box(0.4, 0.25, PZ0 - PZ1), '#9a8e80', { x: PX0 - 0.15, y: 0.12, z: (PZ0 + PZ1) / 2 });
  for (const [vx, vz] of [[8.2, -12], [8.2, -16], [8.2, -28], [8.2, -32], [14.5, -12.5], [14.5, -31.5]]) {   // vasi di fiori
    k.add(G.cyl(0.42, 0.32, 0.7, 10), '#a8603a', { x: vx, y: 0.35, z: vz, vary: 0.08 });
    shrub(k, r, vx, 0.55, vz, 0.55, ['#4f6e2e', '#5f7f36'], 1);
    for (let i = 0; i < 6; i++) k.add(G.ico(0.16, 0), r.pick(['#e83a4a', '#f06a8a', '#ffffff', '#ffd23a']), { x: vx + r.range(-0.35, 0.35), y: 1.0 + r.range(0, 0.3), z: vz + r.range(-0.35, 0.35), flat: true });
  }
  tree(k, r, 18, 0, -14, 1.7);
  tree(k, r, 18.5, 0, -31, 1.5);
  // grande albero sul lato della chiesa, dietro la capanna (come nel target)
  tree(k, r, -21, 0, -3, 2.3);
  tree(k, r, -30, 0, -44, 1.3);
  for (const [bx, bz] of [[-9.5, -40], [-9.5, -46], [-20, -19]]) {
    k.add(G.box(0.5, 0.08, 2), '#7a5434', { x: bx, y: 0.5, z: bz });
    for (const s of [-0.8, 0.8]) k.add(G.box(0.45, 0.45, 0.12), '#555050', { x: bx, y: 0.25, z: bz + s });
  }
  // tanti fili di luci a raggiera dalla cima del campanile: attraverso la via verso la chiesa, la capanna,
  // le case dei due lati prima e dopo la piazza
  // v5s12: fili di luci a zig-zag ATTRAVERSO la via (target4), da una facciata all'altra
  for (let z = 30; z > -70; z -= 4.5) {
    const y1 = 7.6 + r.range(-0.5, 0.5), y2 = 7.6 + r.range(-0.5, 0.5);
    catenary(k, new THREE.Vector3(7.0, y1, z), new THREE.Vector3(-7.0, y2, z - 2.2), r.range(1.2, 2.0), true, lamps, 0.9, 7);
  }
  // v5s12: pergolato di legno con bancarella, botti e vasi di fiori sul bordo della piazza (target4, a destra)
  {
    const px = -10.5, pz = -6, PW = 4.2, PL = 7;
    for (const [dx, dz] of [[0, 0], [-PW, 0], [0, -PL], [-PW, -PL]]) k.add(G.box(0.22, 2.9, 0.22), '#6b4a2e', { x: px + dx, y: 1.45, z: pz + dz, vary: 0.06 });
    for (const dx of [0, -PW]) k.add(G.box(0.2, 0.2, PL + 0.6), '#5a3f28', { x: px + dx, y: 2.95, z: pz - PL / 2 });
    for (let i = 0; i <= 8; i++) k.add(G.box(PW + 0.6, 0.12, 0.14), '#6b4a2e', { x: px - PW / 2, y: 3.1, z: pz + 0.3 - i * (PL + 0.6) / 8 });
    for (let i = 0; i < 26; i++) k.add(G.ico(r.range(0.35, 0.6), 0), r.pick(C.grass), { x: px - r.range(0, PW), y: 3.25 + r.range(-0.1, 0.2), z: pz - r.range(0, PL), flat: true });
    k.add(G.box(1.0, 0.9, PL - 1.2), '#7a5434', { x: px - 0.7, y: 0.45, z: pz - PL / 2 });           // banco
    for (let i = 0; i < 7; i++) k.add(G.box(0.4, 0.3, 0.6), r.pick(['#e8a23a', '#c94a3a', '#e6d49a', '#9a6a3a']), { x: px - 0.7, y: 1.05, z: pz - 1.1 - i * 0.75, vary: 0.08 });
    for (const [bx, bz] of [[px + 0.9, pz + 1.2], [px + 1.5, pz + 0.2], [px + 0.9, pz - PL - 0.8]]) {
      k.add(G.cyl(0.42, 0.42, 1.0, 12), '#7a4e2c', { x: bx, y: 0.5, z: bz, vary: 0.06 });
      k.add(G.cyl(0.47, 0.47, 0.06, 12), '#3a3530', { x: bx, y: 0.25, z: bz }); k.add(G.cyl(0.47, 0.47, 0.06, 12), '#3a3530', { x: bx, y: 0.75, z: bz });
    }
    for (const [vx, vz] of [[px + 0.6, pz - 2.5], [px + 0.6, pz - 4.8], [-8, -20], [-8, -36]]) {
      k.add(G.cyl(0.35, 0.27, 0.55, 10), '#a8603a', { x: vx, y: 0.28, z: vz });
      for (let i = 0; i < 7; i++) k.add(G.ico(0.15, 0), r.pick(['#e83a4a', '#f06a8a', '#ffffff', '#ffd23a', '#c04ad0']), { x: vx + r.range(-0.3, 0.3), y: 0.7 + r.range(0, 0.3), z: vz + r.range(-0.3, 0.3), flat: true });
    }
    for (let i = 0; i < 8; i++) { const t = i / 7; const g = new THREE.Vector3(px - t * PW, 2.8 - Math.sin(t * Math.PI) * 0.4, pz + 0.3); k.add(G.ico(0.1, 0), C.bulb, { x: g.x, y: g.y, z: g.z, unlit: true }); }
    lamps.push([px - PW / 2, 2.6, pz - PL / 2, 3.2]);
  }
  // pali con lanterna ai bordi della piazza e della piazzetta
  for (const [lx, lz] of [[-8.2, -30], [-8.2, -48], [-30, -2], [8.0, -20], [8.0, -24.5]]) {
    k.add(G.cyl(0.08, 0.1, 3.6, 6), '#2b2a33', { x: lx, y: 1.8, z: lz });
    k.add(G.box(0.36, 0.46, 0.36), '#ffcf6a', { x: lx, y: 3.8, z: lz, unlit: true });
    k.add(G.cone(0.3, 0.3, 4), '#2b2a33', { x: lx, y: 4.2, z: lz, ry: Math.PI / 4 });
    lamps.push([lx, 3.8, lz, 2.6]);
  }
  // case sul bordo della piazza (indici dei prefab del paese, posizione, rotazione)
  const houses = [
    { seed: 3, x: -14.5, z: 0.2, ry: Math.PI / 2 },
    { seed: 7, x: -22.5, z: 0.2, ry: Math.PI / 2 },
    { seed: 11, x: -30.5, z: 0.2, ry: Math.PI / 2 },
    { seed: 5, x: -14.5, z: -LEN - 6.2, ry: -Math.PI / 2, flipZ: true },
    { seed: 9, x: -22.5, z: -LEN - 6.2, ry: -Math.PI / 2, flipZ: true },
    { seed: 13, x: -30.5, z: -LEN - 6.2, ry: -Math.PI / 2, flipZ: true },
    // fondale della piazzetta del campanile: case con la facciata verso la via (lato opposto)
    { seed: 15, x: PX1, z: PZ0, road: true }, { seed: 17, x: PX1, z: null, road: true }, { seed: 19, x: PX1, z: null, road: true },
  ];
  return { geom: k.build({ ao: 0.25 }), lamps, houses, len: LEN, tower: { ...TOWER, ...TOWER_AT, S: TOWER_S } };
}

// v5 stage 12 (target4-confronto-villaggio): "fondale" del paese - campanile grande e chiesa rosa centrati
// in fondo alla via. Coordinate: campanile centrato in x=0, faccia con orologio verso +z (chi arriva),
// chiesa con la facciata a capanna verso +z, a SINISTRA (a destra la coprirebbe la fiamma). world3d lo tiene davanti alla camera.
// v5s23b: oggetto FISSO nel mondo, a sinistra della strada, facciate rivolte verso la via (non la attraversa): campanile a sinistra, chiesa a destra
export const VISTA = { S: 1.25, AT_M: 335, EDGE: -8.2, RY: 0.55, CS: 0.62, X: 0 };
export function buildVista(seed = 1) {
  const r = rng(seed * 131 + 7);
  const kt = new Kit(seed + 501);
  buildBellTower(kt, r, { ...TOWER, x: 0, z: 0 });
  const k = new Kit(seed + 502);
  const mT = new THREE.Matrix4().makeScale(VISTA.S, VISTA.S, VISTA.S);
  for (const g of kt.lit) { g.applyMatrix4(mT); k.lit.push(g); }
  for (const g of kt.unlit || []) { g.applyMatrix4(mT); k.unlit.push(g); }
  const kc = new Kit(seed + 503);
  buildChurch(kc, r);
  const gs = [...kc.lit];
  const bb = new THREE.Box3();
  const rot = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  for (const g of gs) { g.applyMatrix4(rot); g.computeBoundingBox(); bb.union(g.boundingBox); }
  // facciata (max z) poco dietro la faccia del campanile, lato sinistro attaccato al campanile
  const tw = TOWER.W * VISTA.S / 2;
  const mv = new THREE.Matrix4().makeTranslation((tw - 0.3) / VISTA.CS - bb.min.x, 0, 1.5 - bb.max.z);
  const sc = new THREE.Matrix4().makeScale(VISTA.CS, VISTA.CS, VISTA.CS);
  for (const g of gs) { g.applyMatrix4(mv); g.applyMatrix4(sc); k.lit.push(g); }
  for (const g of kc.unlit || []) { g.applyMatrix4(rot); g.applyMatrix4(mv); g.applyMatrix4(sc); k.unlit.push(g); }
  // basamento e case basse ai piedi (chiude il fondo della via)
  k.add(G.box(12, 0.4, 12), '#9a8e80', { x: 3, y: 0.2, z: -4 });
  const out = k.build({ ao: 0.2 });
  // ruotato di sbieco (facciate verso chi arriva e verso la via): campanile a sinistra, chiesa a destra, a lato della strada
  out.rotateY(VISTA.RY); out.computeBoundingBox(); out.computeBoundingSphere();
  VISTA.X = VISTA.EDGE - out.boundingBox.max.x;
  return out;
}
