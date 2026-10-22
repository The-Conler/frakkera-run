// Strutture: viadotto di Gadoni (pile alte e snelle in calcestruzzo,
// impalcato lungo e dritto), ingresso della Miniera Fenice (arco in
// pietra nella parete rocciosa, porticina con architrave, colonna di
// ferro arrugginita, insegna, carrello sui binari), gallerie (roccia
// grigia e galleria blu con luce minerale propria), uscita.
import * as THREE from 'three';
import { Kit, G, rng, fbm, noise3, addRock, shrub, grassTuft, dryWall, gridSurface, addColored, LEAF, ROCK } from './common.js';

const _c = new THREE.Color(), _c2 = new THREE.Color();
const pickN = (pal, t) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)))];

// ------------------------------------------------------------------ viadotto
// coordinate locali: punto in cui l'impalcato passa sopra il sentiero = (0, deckY, 0)
export const VIADUCT = { deckY: 47, dirX: 0.86, dirZ: -0.51, spacing: 37, sMin: -300, sMax: 320, pillarW: 2.9, pillarD: 5.2, deckW: 12, deckH: 3.3 };
export function buildViaduct(terrainY = () => -6) {
  const V = VIADUCT; const k = new Kit(77); const r = rng(77);
  const ang = Math.atan2(-V.dirZ, V.dirX);             // rotazione attorno a y dell'asse dell'impalcato
  const concrete = ['#e3e0d8', '#d8d5cc', '#ecebe4'], shade = '#b9b6ad';
  // pile (si salta quella che cadrebbe sul sentiero)
  for (let s = V.sMin + 12; s < V.sMax; s += V.spacing) {
    const x = s * V.dirX, z = s * V.dirZ;
    if (Math.abs(x) < 11) continue;
    const y0 = terrainY(x, z) - 2, h = V.deckY - V.deckH - y0;
    k.add(G.box(V.pillarW, h, V.pillarD), r.pick(concrete), { x, y: y0 + h / 2, z, ry: ang, vary: 0.03 });
    // giunti verticali del cassero e lato in ombra
    for (const o of [-0.35, 0.35]) k.add(G.box(V.pillarW + 0.04, h, 0.06), shade, { x: x + Math.sin(ang) * o * V.pillarD, y: y0 + h / 2, z: z + Math.cos(ang) * o * V.pillarD, ry: ang });
    k.add(G.box(V.pillarW + 0.5, 1.2, V.pillarD + 0.6), '#cfccc3', { x, y: V.deckY - V.deckH - 0.6, z, ry: ang });     // pulvino
    k.add(G.box(V.pillarW + 1.4, 1.5, V.pillarD + 1.6), '#a8a49a', { x, y: y0 + 0.75, z, ry: ang });                 // plinto
  }
  // impalcato a cassone (in tratti per seguire l'asse)
  const L = V.sMax - V.sMin, N = 24;
  for (let i = 0; i < N; i++) {
    const s0 = V.sMin + (L * i) / N, sl = L / N + 0.05, sc = s0 + sl / 2;
    const x = sc * V.dirX, z = sc * V.dirZ;
    k.add(G.box(sl, V.deckH, V.deckW * 0.62), '#c9c6bd', { x, y: V.deckY - V.deckH / 2, z, ry: ang });          // cassone
    k.add(G.box(sl, 0.5, V.deckW), '#eeebe2', { x, y: V.deckY + 0.05, z, ry: ang });                               // soletta (bordo chiaro)
    k.add(G.box(sl, 0.9, 0.25), '#efece4', { x: x + Math.sin(ang) * V.deckW / 2, y: V.deckY + 0.6, z: z + Math.cos(ang) * V.deckW / 2, ry: ang }); // cordolo
    k.add(G.box(sl, 0.9, 0.25), '#efece4', { x: x - Math.sin(ang) * V.deckW / 2, y: V.deckY + 0.6, z: z - Math.cos(ang) * V.deckW / 2, ry: ang });
    k.add(G.box(sl, 0.08, 0.1), '#55575c', { x: x + Math.sin(ang) * V.deckW / 2, y: V.deckY + 1.5, z: z + Math.cos(ang) * V.deckW / 2, ry: ang }); // guardrail
    k.add(G.box(sl, 0.08, 0.1), '#55575c', { x: x - Math.sin(ang) * V.deckW / 2, y: V.deckY + 1.5, z: z - Math.cos(ang) * V.deckW / 2, ry: ang });
    k.add(G.box(sl, 0.2, V.deckW * 0.66), '#8f8c84', { x, y: V.deckY - V.deckH - 0.05, z, ry: ang });          // intradosso in ombra
  }
  return k.build();
}

// ------------------------------------------------------------------ galleria (segmento)
// profilo a volta: pareti quasi verticali fino a 3.2 m, calotta fino a ~9.6 m
const PROF_N = 26;   // (profilo di riferimento)
export const TUNNEL = { halfW: 6.8, wallH: 3.2, crown: 6.4 };
function profilePoint(t) {               // t 0..1 da pavimento sinistro a pavimento destro
  const { halfW, wallH, crown } = TUNNEL;
  const per = wallH * 2 + Math.PI * (halfW + crown) / 2; // perimetro approssimato
  const s = t * per;
  if (s < wallH) return [-halfW - 0.2 + s * 0.06, s, -1, 0];
  if (s > per - wallH) { const q = per - s; return [halfW + 0.2 - q * 0.06, q, 1, 0]; }
  const a = Math.PI * (1 - (s - wallH) / (per - 2 * wallH));
  const x = Math.cos(a) * halfW, y = wallH + Math.sin(a) * crown;
  const nx = Math.cos(a) / halfW, ny = Math.sin(a) / crown, l = Math.hypot(nx, ny);
  return [x, y, nx / l, ny / l];
}
const PAL_ROCK = ['#62706c', '#56625f', '#6f7670', '#525c5a', '#7d8078', '#5f6e6a', '#6c726c'];   // grigio-verde come nella foto
const PAL_BLUE = ['#0a1248', '#101d6a', '#172c92', '#1f3fc0', '#2a58ea', '#0d175a', '#1a36b0'];   // dal blu notte al blu elettrico
const PAL_GOLD = ['#b8742e', '#9a5a26', '#d08a42', '#7a4620', '#a86a34'];   // ocra / ruggine come nella foto
// lamps: [[W, x, y]] posizioni delle lampade (per la luce "cotta" nei vertici)
export function tunnelSegment(W0, len, type = 'rock', lamps = []) {
  const blue = type === 'blue';
  const PROF_N = blue ? 44 : 26;                       // la galleria blu ha piu' facce (lastre piu' piccole)
  const nr = Math.max(2, Math.ceil(len / (blue ? 0.62 : 0.9)) + 1);
  const amp = blue ? 1.15 : 0.75;
  const P = []; const col = []; const glow = [];
  const ring = [];
  for (let j = 0; j < nr; j++) {
    const W = W0 + (len * j) / (nr - 1);
    const row = [];
    for (let i = 0; i <= PROF_N; i++) {
      const t = i / PROF_N;
      const [x0, y0, nx, ny] = profilePoint(t);
      let d = fbm(W / 3.2, t * 9, blue ? 5 : 2, 3) * amp + noise3(W / 1.1, t * 30, 9) * amp * 0.35;
      if (blue) {
        // grandi lastre e massi sfaccettati: rumore "a gradini" => salti netti tra piani inclinati diversi
        const q = noise3(W / 2.4, t * 10, 31) * 0.5 + 0.5, q2 = noise3(W / 5.5, t * 5, 3) * 0.5 + 0.5;
        d = d * 0.45 + (Math.floor(q * 4) / 4) * 1.5 - 0.55 + (Math.floor(q2 * 3) / 3) * 0.8 + noise3(W / 0.8, t * 36, 9) * 0.22;
      }
      d = Math.max(-0.7, Math.min(blue ? 2.1 : 1.2, d));
      if (blue) d = Math.max(d, -0.95 + 0.3 * Math.abs(t - 0.5));
      const edge = y0 < 0.3 ? y0 / 0.3 : 1;                            // al pavimento la roccia tocca il suolo
      const x = x0 + nx * d * edge, y = Math.max(0, y0 + ny * d * edge);
      row.push([x, y, -W]);
      // colore
      const n = fbm(W / 4.5, t * 7, 21, 2) * 0.5 + 0.5, n2 = noise3(W / 1.6, t * 18, 4) * 0.5 + 0.5;
      let g1 = 0, g2 = 0;
      if (blue) {
        const goldT = noise3(W / 7, t * 5 + (x < 0 ? 2.5 : 0), 13) * 0.5 + 0.5 + (x < 0 ? 0.12 : -0.05);
        if (goldT > 0.68) { _c.set(pickN(PAL_GOLD, n)).multiplyScalar(0.8); g2 = 0.22; }
        else { _c.set(pickN(PAL_BLUE, n)); if (n2 > 0.82) _c.lerp(_c2.set('#4f9cff'), 0.45); g2 = 0.3 + n2 * 0.8; }
        if (d < -0.1) { _c.multiplyScalar(0.45); g2 *= 0.35; }       // le fessure tra le lastre restano scure
        if (n2 < 0.15) _c.multiplyScalar(0.55);
      } else {
        _c.set(pickN(PAL_ROCK, n));
        if (n2 > 0.84) _c.lerp(_c2.set('#9a7a52'), 0.4);              // ossido
        if (n2 < 0.16) _c.multiplyScalar(0.6);
      }
      if (y < 0.6) _c.multiplyScalar(0.7);
      // luce delle lampade "cotta" nei vertici
      for (const [lw, lx, ly] of lamps) { const dd = (W - lw) * (W - lw) + (x - lx) * (x - lx) + (y - ly) * (y - ly); if (dd < 64) g1 += Math.max(0, 1 - Math.sqrt(dd) / 8) * 0.9; }
      col.push(_c.r, _c.g, _c.b); glow.push(Math.min(1.2, g1), g2);
      ring.push(0);
    }
    P.push(row);
  }
  const pos = [], cc = [], gg = [];
  const idx = (j, i) => (j * (PROF_N + 1) + i);
  for (let j = 0; j < nr - 1; j++) for (let i = 0; i < PROF_N; i++) {
    const quad = [[j, i], [j, i + 1], [j + 1, i + 1], [j, i], [j + 1, i + 1], [j + 1, i]];
    for (const [jj, ii] of quad) { const p = P[jj][ii]; pos.push(p[0], p[1], p[2]); const q = idx(jj, ii); cc.push(col[q * 3], col[q * 3 + 1], col[q * 3 + 2]); gg.push(glow[q * 2], glow[q * 2 + 1]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(gg, 2));
  g.computeVertexNormals();
  // le normali devono guardare verso l'asse della galleria
  const n = g.attributes.normal, p = g.attributes.position;
  if (n.getX(0) * (0 - p.getX(0)) + n.getY(0) * (5 - p.getY(0)) < 0) {
    for (let i = 0; i < p.count; i += 3) for (const a of [p, n, g.attributes.color, g.attributes.aGlow]) {
      const s = a.itemSize; for (let c = 0; c < s; c++) { const t = a.array[(i + 1) * s + c]; a.array[(i + 1) * s + c] = a.array[(i + 2) * s + c]; a.array[(i + 2) * s + c] = t; }
    }
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}

// accessori della galleria per un segmento: tubo blu sulla volta, cavo, lampade, centine di legno
export function tunnelProps(W0, len, type, lamps, o = {}) {
  const k = new Kit(Math.floor(W0) + 3); const r = rng(Math.floor(W0 * 3) + 1);
  if (type === 'rock') {
    k.add(G.cyl(0.16, 0.16, len, 8), '#3d6fb8', { x: 2.4, y: 8.0, z: -len / 2, rx: Math.PI / 2 });       // tubo blu (come nella foto)
    k.add(G.cyl(0.06, 0.06, len, 4), '#2a2a2a', { x: -2.0, y: 8.3, z: -len / 2, rx: Math.PI / 2 });
    for (let z = -r() * 4; z > -len; z -= 4) k.add(G.box(0.08, 0.6, 0.08), '#2f3d55', { x: 2.4, y: 8.4, z });
  }
  for (const [lw, lx, ly] of lamps) {
    if (lw < W0 || lw >= W0 + len) continue;
    const z = -(lw - W0), s = Math.sign(lx);
    k.add(G.box(0.3, 0.3, 0.6), '#2a2a2a', { x: lx - s * 0.12, y: ly + 0.25, z });
    k.add(G.box(0.22, 0.32, 0.5), type === 'blue' ? '#ffc070' : '#ffe6b8', { x: lx, y: ly, z, unlit: true });
    k.add(G.cyl(0.03, 0.03, 3.5, 4), '#222', { x: lx - s * 0.1, y: ly + 2, z });
  }
  if (type === 'blue') {                // botti e massi ai lati dei binari, fuori dalle corsie
    for (let z = -r.range(0, 6); z > -len; z -= r.range(5, 11)) {
      const s = r.chance(0.5) ? 1 : -1;
      if (r.chance(0.45)) { const n = 1 + r.int(2); for (let q = 0; q < n; q++) k.add(G.cyl(0.42, 0.42, 1.05, 10), r.pick(['#6b4426', '#5a3820', '#7a5030']), { x: s * (5.1 + q * 0.2), y: 0.53, z: z - q * 0.95, vary: 0.12 }); }
      else k.add(G.ico(r.range(0.4, 0.8), 0), r.pick(['#14205e', '#1c2f86', '#0f1748']), { x: s * r.range(4.9, 5.6), y: 0.25, z, sy: 0.7, flat: true, vary: 0.2 });
    }
  }
  if (o.frames) for (let z = -r.range(2, 5); z > -len; z -= o.frames) {   // centine di legno
    const th = type === 'blue' ? 0.26 : 0.4, hw = type === 'blue' ? 5.5 : 6.0;
    if (type === 'blue') {   // centina a tre pezzi che segue la volta, tutta sopra l'altezza della camera
      for (const s of [-1, 1]) {
        k.add(G.box(th, 6.4, th), r.pick(['#6b4a2e', '#5a3f28']), { x: s * hw, y: 3.2, z, vary: 0.15 });
        k.add(G.box(th, 2.7, th), '#5a3f28', { x: s * 4.55, y: 7.5, z, rz: s * 0.78, vary: 0.1 });
      }
      k.add(G.box(7.4, th * 1.1, th * 1.1), '#5a3f28', { x: 0, y: 8.45, z, vary: 0.1 });
      continue;
    }
    for (const s of [-1, 1]) k.add(G.box(th, 7.2, th), r.pick(['#6b4a2e', '#5a3f28']), { x: s * hw, y: 3.6, z, rz: s * 0.04, vary: 0.15 });
    k.add(G.box(12.6, 0.45, 0.45), '#5a3f28', { x: 0, y: 7.4, z, vary: 0.1 });
  }
  return k.lit.length || k.unlit.length ? k.build() : null;
}

// macchina perforatrice (jumbo) parcheggiata lungo la parete, come nella foto
export function buildDrillMachine() {
  const k = new Kit(9);
  const body = '#b83a2a', white = '#e8e2d6', steel = '#55585e', black = '#1e1e20';
  k.add(G.box(1.8, 1.0, 3.6), body, { y: 1.0 });
  k.add(G.box(1.6, 1.3, 1.4), white, { y: 2.1, z: 1.0 });
  k.add(G.box(1.2, 0.8, 1.0), '#3a4a5a', { y: 2.2, z: 1.05, x: 0.05 });
  for (const [x, z] of [[-0.95, 1.2], [0.95, 1.2], [-0.95, -1.2], [0.95, -1.2]]) k.add(G.cyl(0.55, 0.55, 0.45, 12), black, { x, y: 0.55, z, rz: Math.PI / 2 });
  k.add(G.box(0.3, 0.3, 3.6), white, { y: 2.6, z: -2.2, rx: -0.35 });          // braccio
  k.add(G.box(0.22, 0.22, 2.6), steel, { y: 3.4, z: -3.8, rx: -0.2 });
  k.add(G.box(0.5, 0.5, 0.8), body, { y: 3.8, z: -5.0 });
  k.add(G.box(0.25, 2.8, 0.25), white, { x: 0.6, y: 3.2, z: 0.2 });
  k.add(G.box(0.8, 0.6, 0.06), '#d84a3a', { x: -1.4, y: 1.8, z: 2.2 });        // cartello rosso
  k.add(G.box(0.06, 1.5, 0.06), steel, { x: -1.4, y: 0.75, z: 2.2 });
  return k.build({ ao: 0.2 });
}

// ------------------------------------------------------------------ ingresso della Miniera Fenice
// z = 0 sul piano del portale; la galleria inizia li' e prosegue verso -z
export function buildMinePortal(seed = 5) {
  const k = new Kit(seed); const r = rng(seed);
  const { halfW, wallH, crown } = TUNNEL;
  const inArch = (x, y, m = 0) => (Math.abs(x) < halfW + m && y < wallH) || ((x / (halfW + m)) ** 2 + ((y - wallH) / (crown + m)) ** 2 < 1);
  // parete rocciosa grigia (fratturata, con macchie di arbusti secchi)
  const X0 = -80, X1 = 80, Y1 = 46, nu = 64, nv = 26;
  const face = gridSurface(nu, nv, (u, v) => {
    const x = X0 + u * (X1 - X0), y = v * Y1;
    if (inArch(x, y, 1.6) && y < crown + wallH + 1.0) return null;
    const near = Math.max(0, 1 - Math.max(Math.abs(x) - 11, y - 14, 0) / 10);
    const z = 0.9 + (1 - near) * (fbm(x / 9, y / 8, 3, 3) * 3.5 + 1.5 - y * 0.12 + Math.abs(x) * 0.03) + noise3(x / 2.2, y / 2.2, 1) * 0.6;
    return [x, y, z];
  }, (x, y, z) => {
    const n = fbm(x / 6, y / 5, 9, 2) * 0.5 + 0.5, n2 = noise3(x / 1.5, y / 1.5, 3) * 0.5 + 0.5;
    _c.set(pickN(['#7d7a74', '#8f8b83', '#6c6a65', '#9c978e', '#85817a', '#a5a096'], n));
    if (n2 > 0.8) _c.multiplyScalar(0.7);
    if (noise3(x / 5, y / 4, 17) > 0.5 && y > 14) _c.lerp(_c2.set('#7a6a52'), 0.55);    // arbusti secchi
    return _c.getHex();
  });
  addColored(k, face);
  // muratura in pietra attorno all'arco (paramento, come nella foto)
  for (let y = 0.25; y < 13.5; y += 0.42) for (let x = -11; x < 11; x += r.range(0.6, 0.95)) {
    if (inArch(x, y, 1.15)) continue;
    k.add(G.box(r.range(0.55, 0.9), r.range(0.32, 0.4), 0.5), r.pick(['#8f877a', '#a39a8a', '#7a7468', '#b2a893', '#9a9080']), { x, y, z: 0.7 + r.range(-0.05, 0.08), vary: 0.12 });
  }
  // conci dell'arco a tutto sesto (ghiera sporgente)
  const NV = 23;
  for (let i = 0; i <= NV; i++) {
    const a = Math.PI * i / NV;
    const x = Math.cos(a) * (halfW + 0.55), y = wallH + Math.sin(a) * (crown + 0.55);
    k.add(G.box(0.62, 1.15, 1.2), r.pick(['#9a9080', '#8a8274', '#a8a090']), { x, y, z: 0.9, rz: a - Math.PI / 2, vary: 0.1 });
  }
  for (const s of [-1, 1]) for (let y = 0.35; y < wallH; y += 0.7) k.add(G.box(1.15, 0.65, 1.2), r.pick(['#9a9080', '#8a8274']), { x: s * (halfW + 0.55), y, z: 0.9, vary: 0.1 });
  // porticina laterale con stipiti e architrave in pietra (a sinistra)
  const dx = -17.5;
  k.add(G.box(3.6, 4.2, 1.6), '#8f877a', { x: dx, y: 2.1, z: 1.6, vary: 0.05 });
  k.add(G.box(2.2, 3.0, 0.4), '#141210', { x: dx, y: 1.5, z: 2.3 });
  for (const s of [-1, 1]) k.add(G.box(0.45, 3.2, 0.5), '#b8ae9a', { x: dx + s * 1.3, y: 1.6, z: 2.5, vary: 0.1 });
  k.add(G.box(3.2, 0.5, 0.6), '#c2b8a3', { x: dx, y: 3.35, z: 2.5 });
  for (let i = 0; i < 18; i++) addRock(k, r, dx + r.range(-2.4, 2.4), 4.3 + r.range(0, 1.5), 1.6 + r.range(-0.6, 0.6), r.range(0.4, 0.8), ROCK.granite, { squash: 0.7 });
  // grossi blocchi di roccia ai lati
  for (let i = 0; i < 10; i++) addRock(k, r, r.chance(0.5) ? r.range(-34, -21) : r.range(13, 30), r.range(0.5, 2.5), r.range(1.5, 5), r.range(1.2, 2.6), ROCK.granite, { squash: 0.75 });
  // colonna di ferro arrugginita con tubo verso l'arco
  const cx = -10.6;
  k.add(G.box(2.2, 0.9, 2.2), '#9a9080', { x: cx, y: 0.45, z: 3.0 });
  k.add(G.cyl(0.62, 0.62, 6.4, 14), '#8a4a2a', { x: cx, y: 4.1, z: 3.0, vary: 0.08 });
  for (const y of [1.6, 3.8, 6.0]) k.add(G.cyl(0.7, 0.7, 0.18, 14), '#6a3a22', { x: cx, y, z: 3.0 });
  k.add(G.cyl(0.66, 0.6, 0.4, 14), '#5a3020', { x: cx, y: 7.4, z: 3.0 });
  k.add(G.cyl(0.14, 0.14, 2.6, 8), '#8a4a2a', { x: cx + 1.4, y: 5.2, z: 3.0, rz: Math.PI / 2 });
  // muretto di contenimento a secco sulla destra
  for (let x = 11; x < 46; x += 0.8) for (let y = 0.3; y < 2.6; y += 0.42) k.add(G.box(0.8, 0.38, 0.9), r.pick(['#8a8274', '#7a7468', '#9a9080', '#6f6a60']), { x, y, z: 6 + (x - 11) * 0.05, vary: 0.12 });
  for (let i = 0; i < 16; i++) shrub(k, r, r.range(12, 40), 2.5, r.range(1.5, 5), r.range(0.7, 1.2), LEAF.dry);
  for (let i = 0; i < 12; i++) shrub(k, r, r.range(-40, -22), r.range(0, 1), r.range(2, 6), r.range(0.7, 1.2), LEAF.dry);
  // binario secondario verso la porticina
  for (let t = 0; t < 1; t += 0.05) {
    const x = -2 + (dx + 2) * t, z = 9 - 6.5 * t;
    for (const g of [-0.5, 0.5]) k.add(G.box(0.12, 0.12, 1.1), '#6a3a22', { x: x + g * 0.8, y: 0.08, z, ry: Math.atan2(dx + 2, -6.5) });
  }
  return k.build({ ao: 0.2 });
}
// carrello da miniera sui binari (decorazione accanto all'ingresso, come nella foto)
export function buildMineCartDecor() {
  const k = new Kit(4);
  const rust = '#8a4a2a', rust2 = '#6a3820', dark = '#2a1a12';
  k.add(G.box(1.7, 1.0, 2.4), rust, { y: 1.25, vary: 0.08 });
  k.add(G.box(1.9, 0.1, 2.6), rust2, { y: 1.78 });
  k.add(G.box(1.4, 0.15, 2.1), dark, { y: 1.72 });
  for (const [x, z] of [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]]) k.add(G.cyl(0.35, 0.35, 0.16, 12), dark, { x, y: 0.4, z, rz: Math.PI / 2 });
  k.add(G.box(1.2, 0.5, 0.2), rust2, { y: 0.7, z: 1.25 });
  return k.build();
}
// ghiera dell'uscita della galleria blu
export function buildMineExit(seed = 8) {
  const k = new Kit(seed); const r = rng(seed);
  const { halfW, wallH, crown } = TUNNEL;
  for (let i = 0; i <= 21; i++) {
    const a = Math.PI * i / 21;
    k.add(G.box(0.62, 1.1, 1.0), r.pick(['#9a9080', '#8a8274', '#a8a090']), { x: Math.cos(a) * (halfW + 0.2), y: wallH + Math.sin(a) * (crown + 0.2), z: 0, rz: a - Math.PI / 2, vary: 0.1 });
  }
  for (const s of [-1, 1]) for (let y = 0.35; y < wallH; y += 0.7) k.add(G.box(1.0, 0.65, 1.0), '#8a8274', { x: s * (halfW + 0.2), y, z: 0, vary: 0.1 });
  return k.build();
}
